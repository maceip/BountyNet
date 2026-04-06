use crate::config::{config_dir, AgentConfig};
use anyhow::{anyhow, Context, Result};
use serde::Deserialize;
use std::fs;
use url::Url;

/// Join the BountyNet network (browser login → register agent → save ~/.bountynet/agent.json).
#[derive(Debug, clap::Args)]
pub struct Join {
    /// Gateway base URL
    #[clap(
        long,
        default_value = "https://gateway.stare.network",
        env = "BOUNTYNET_GATEWAY"
    )]
    pub gateway: String,

    /// Print login URL instead of opening a browser
    #[clap(long)]
    pub no_browser: bool,
}

#[derive(Deserialize)]
struct OnboardResponse {
    agent_id: Option<u64>,
    wallet: Option<String>,
    ens: Option<String>,
    error: Option<String>,
}

impl Join {
    pub fn run(self) -> Result<()> {
        let gateway = self.gateway.trim_end_matches('/').to_string();
        let dir = config_dir()?;
        let config_file = dir.join("agent.json");

        if config_file.exists() {
            let existing: AgentConfig = serde_json::from_str(&fs::read_to_string(&config_file)?)?;
            eprintln!("[be] already logged in as agent #{}", existing.agent_id);
            eprintln!("[be] wallet: {}", existing.wallet);
            eprintln!("[be] ens:    {}", existing.ens);
            eprintln!(
                "[be] to switch accounts, remove {} and run `be join` again",
                config_file.display()
            );
            return Ok(());
        }

        eprintln!("[be] joining BountyNet...");

        let server = tiny_http::Server::http("127.0.0.1:9876")
            .map_err(|e| anyhow!("failed to start callback server on 127.0.0.1:9876 — {e}"))?;

        let callback = "http://localhost:9876/callback";
        let mut auth = Url::parse(&format!("{gateway}/identity/login"))?;
        auth.query_pairs_mut().append_pair("redirect_uri", callback);
        let auth_url = auth.to_string();

        if self.no_browser {
            eprintln!("[be] open this URL in your browser:");
            eprintln!("  {}", auth_url);
        } else {
            eprintln!("[be] opening browser for login...");
            let _ = open::that(&auth_url);
        }

        eprintln!("[be] waiting for login...");
        let token = wait_for_callback(&server)?;
        eprintln!("[be] authenticated");

        eprintln!("[be] registering agent...");
        let client = reqwest::blocking::Client::new();
        let resp = client
            .post(format!("{gateway}/identity/onboard"))
            .header("Authorization", format!("Bearer {}", token))
            .json(&serde_json::json!({}))
            .send()?;

        let data: OnboardResponse = resp.json().with_context(|| "parse onboard JSON")?;

        if let Some(err) = data.error {
            return Err(anyhow!("registration failed: {err}"));
        }

        let config = AgentConfig {
            agent_id: data.agent_id.unwrap_or(0),
            wallet: data.wallet.unwrap_or_default(),
            ens: data.ens.unwrap_or_default(),
            token: token.clone(),
            gateway,
        };

        fs::create_dir_all(&dir)?;
        fs::write(&config_file, serde_json::to_string_pretty(&config)?)?;

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&config_file, fs::Permissions::from_mode(0o600))?;
        }

        eprintln!();
        eprintln!("[be] logged in to BountyNet");
        eprintln!("[be]   agent:  #{}", config.agent_id);
        eprintln!("[be]   wallet: {}", config.wallet);
        eprintln!("[be]   ens:    {}", config.ens);
        eprintln!();
        eprintln!("[be] next: `be status` or `be bounties watch`");

        Ok(())
    }
}

fn wait_for_callback(server: &tiny_http::Server) -> Result<String> {
    loop {
        let request = server
            .recv()
            .map_err(|e| anyhow!("callback server error: {e}"))?;

        let path_q = request.url().to_string();
        let synthetic = format!("http://127.0.0.1:9876{path_q}");
        if let Ok(u) = Url::parse(&synthetic) {
            for (k, v) in u.query_pairs() {
                if k == "token" || k == "jwt" {
                    let html =
                        "<html><body style='font-family:system-ui;text-align:center;padding:4em'>\
                         <h1>BountyNet</h1>\
                         <p>Authenticated. You can close this tab.</p>\
                         </body></html>";
                    let response = tiny_http::Response::from_string(html).with_header(
                        "Content-Type: text/html; charset=utf-8"
                            .parse::<tiny_http::Header>()
                            .unwrap(),
                    );
                    let _ = request.respond(response);
                    return Ok(v.into_owned());
                }
            }
        }

        let _ = request.respond(tiny_http::Response::from_string("waiting for auth..."));
    }
}
