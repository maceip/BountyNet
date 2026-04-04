use crate::dirs;
use clap::Args;
use eyre::Result;
use serde_derive::{Deserialize, Serialize};
use std::fs;

/// Join the BountyNet network.
///
/// Opens a browser for Dynamic login (GitHub OAuth).
/// Creates a wallet and registers an agent identity on Arc.
/// Saves credentials to ~/.bountynet/agent.json.
#[derive(Debug, Args)]
pub struct Join {
    /// Gateway URL
    #[clap(long, default_value = "https://gateway.stare.network")]
    pub gateway: String,

    /// Skip browser open (print URL instead)
    #[clap(long)]
    pub no_browser: bool,
}

#[derive(Serialize, Deserialize, Debug)]
struct AgentConfig {
    agent_id: u64,
    wallet: String,
    ens: String,
    token: String,
    gateway: String,
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
        let config_dir = dirs::HOME.join(".bountynet");
        let config_file = config_dir.join("agent.json");

        // Check existing
        if config_file.exists() {
            let existing: AgentConfig = serde_json::from_str(&fs::read_to_string(&config_file)?)?;
            eprintln!("[bounty] already joined as agent #{}", existing.agent_id);
            eprintln!("[bounty] wallet: {}", existing.wallet);
            eprintln!("[bounty] ens: {}", existing.ens);
            eprintln!("[bounty] to re-join, delete {}", config_file.display());
            return Ok(());
        }

        eprintln!("[bounty] joining BountyNet...");

        // Start local callback server
        let server = tiny_http::Server::http("127.0.0.1:9876")
            .map_err(|e| eyre::eyre!("failed to start callback server: {}", e))?;

        // Open browser to Dynamic auth
        let callback = "http://localhost:9876/callback";
        let auth_url = format!("{}/identity/login?redirect_uri={}", self.gateway, callback);

        if self.no_browser {
            eprintln!("[bounty] open this URL in your browser:");
            eprintln!("  {}", auth_url);
        } else {
            eprintln!("[bounty] opening browser for login...");
            let _ = open::that(&auth_url);
        }

        // Wait for callback with token
        eprintln!("[bounty] waiting for login...");
        let token = wait_for_callback(&server)?;
        eprintln!("[bounty] authenticated");

        // Register via gateway
        eprintln!("[bounty] registering agent...");
        let client = reqwest::blocking::Client::new();
        let resp = client
            .post(format!("{}/identity/onboard", self.gateway))
            .header("Authorization", format!("Bearer {}", token))
            .json(&serde_json::json!({
                "external_id": format!("dynamic:{}", token),
                "dynamic_token": token,
            }))
            .send()?;

        let data: OnboardResponse = resp.json()?;

        if let Some(err) = data.error {
            eprintln!("[bounty] registration failed: {}", err);
            return Err(eyre::eyre!("registration failed: {}", err));
        }

        let config = AgentConfig {
            agent_id: data.agent_id.unwrap_or(0),
            wallet: data.wallet.unwrap_or_default(),
            ens: data.ens.unwrap_or_default(),
            token: token.clone(),
            gateway: self.gateway.clone(),
        };

        // Save config
        fs::create_dir_all(&config_dir)?;
        fs::write(&config_file, serde_json::to_string_pretty(&config)?)?;

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&config_file, fs::Permissions::from_mode(0o600))?;
        }

        eprintln!();
        eprintln!("[bounty] joined BountyNet!");
        eprintln!("[bounty]   agent:  #{}", config.agent_id);
        eprintln!("[bounty]   wallet: {}", config.wallet);
        eprintln!("[bounty]   ens:    {}", config.ens);
        eprintln!();
        eprintln!("[bounty] next: bounty watch");

        Ok(())
    }
}

fn wait_for_callback(server: &tiny_http::Server) -> Result<String> {
    loop {
        let request = server
            .recv()
            .map_err(|e| eyre::eyre!("server error: {}", e))?;

        let url = request.url().to_string();

        // Parse token from query string
        if let Some(query) = url.split('?').nth(1) {
            for param in query.split('&') {
                let mut parts = param.splitn(2, '=');
                let key = parts.next().unwrap_or("");
                let value = parts.next().unwrap_or("");
                if key == "token" || key == "jwt" {
                    // Respond with success page
                    let response = tiny_http::Response::from_string(
                        "<html><body style='font-family:system-ui;text-align:center;padding:4em'>\
                         <h1>BountyNet</h1>\
                         <p>Authenticated. You can close this tab.</p>\
                         </body></html>",
                    )
                    .with_header(
                        "Content-Type: text/html"
                            .parse::<tiny_http::Header>()
                            .unwrap(),
                    );
                    let _ = request.respond(response);
                    return Ok(value.to_string());
                }
            }
        }

        // Not the callback we're looking for
        let response = tiny_http::Response::from_string("waiting for auth...");
        let _ = request.respond(response);
    }
}
