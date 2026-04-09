use crate::config::{config_dir, AgentConfig};
use anyhow::{anyhow, Context, Result};
use log::info;
use serde::Deserialize;
use std::fs;
use std::thread;
use std::time::{Duration, Instant};

/// Join the BountyNet network (web `/auth/cli` handoff → canonical onboard → save ~/.bountynet/agent.json).
#[derive(Debug, clap::Args)]
pub struct Join {
    /// Gateway base URL
    #[clap(
        long,
        default_value = "https://gateway.stare.network",
        env = "BOUNTYNET_GATEWAY"
    )]
    pub gateway: String,

    /// Canonical web app URL used for browser-side authentication
    #[clap(
        long,
        default_value = "https://bountynet.stare.network",
        env = "BOUNTYNET_APP_URL"
    )]
    pub app_url: String,

    /// Print login URL instead of opening a browser
    #[clap(long)]
    pub no_browser: bool,
}

#[derive(Deserialize)]
struct CliSessionResponse {
    #[allow(dead_code)]
    session_id: Option<String>,
    status: Option<String>,
    auth_url: Option<String>,
    poll_url: Option<String>,
    expires_at: Option<u64>,
    token: Option<String>,
    agent_id: Option<u64>,
    wallet: Option<String>,
    ens: Option<String>,
    identity_anchor: Option<String>,
    error: Option<String>,
}

impl Join {
    pub fn run(self) -> Result<()> {
        let gateway = self.gateway.trim_end_matches('/').to_string();
        let app_url = self.app_url.trim_end_matches('/').to_string();
        let dir = config_dir()?;
        let config_file = dir.join("agent.json");

        if config_file.exists() {
            let existing: AgentConfig = serde_json::from_str(&fs::read_to_string(&config_file)?)?;
            info!("already logged in as agent #{}", existing.agent_id);
            info!("wallet: {}", existing.wallet);
            info!("ens:    {}", existing.ens);
            info!(
                "to switch accounts, remove {} and run `be join` again",
                config_file.display()
            );
            return Ok(());
        }

        info!("joining BountyNet...");

        let client = reqwest::blocking::Client::new();
        let session = client
            .post(format!("{gateway}/identity/cli/sessions"))
            .json(&serde_json::json!({ "app_url": app_url }))
            .send()?
            .json::<CliSessionResponse>()
            .with_context(|| "parse cli session create JSON")?;

        if let Some(err) = session.error {
            return Err(anyhow!("could not start auth session: {err}"));
        }

        let auth_url = session
            .auth_url
            .ok_or_else(|| anyhow!("gateway did not return auth_url"))?;
        let poll_url = session
            .poll_url
            .ok_or_else(|| anyhow!("gateway did not return poll_url"))?;
        let expires_at = session.expires_at.unwrap_or(0);

        if self.no_browser {
            info!("open this BountyNet auth URL in your browser:");
            info!("  {}", auth_url);
        } else {
            info!("opening browser for BountyNet auth handoff...");
            let _ = open::that(&auth_url);
        }

        info!("waiting for login...");
        let callback_data = wait_for_session(&client, &poll_url, expires_at)?;
        info!("authenticated");

        let config = AgentConfig {
            agent_id: callback_data.agent_id,
            wallet: callback_data.wallet,
            ens: callback_data.ens,
            token: callback_data.token,
            gateway,
        };

        fs::create_dir_all(&dir)?;
        fs::write(&config_file, serde_json::to_string_pretty(&config)?)?;

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&config_file, fs::Permissions::from_mode(0o600))?;
        }

        info!("");
        info!("logged in to BountyNet");
        info!("  agent:  #{}", config.agent_id);
        info!("  wallet: {}", config.wallet);
        info!("  ens:    {}", config.ens);
        info!("");
        info!("next: `be status` or `be bounties watch`");

        Ok(())
    }
}

struct CallbackData {
    token: String,
    agent_id: u64,
    wallet: String,
    ens: String,
    #[allow(dead_code)]
    identity_anchor: String,
}

fn wait_for_session(
    client: &reqwest::blocking::Client,
    poll_url: &str,
    expires_at: u64,
) -> Result<CallbackData> {
    let deadline = if expires_at > 0 {
        Instant::now() + Duration::from_secs(expires_at.saturating_sub(current_unix_ts()).min(600))
    } else {
        Instant::now() + Duration::from_secs(600)
    };

    loop {
        if Instant::now() >= deadline {
            return Err(anyhow!("authentication timed out"));
        }

        let response = client.get(poll_url).send()?;
        let body = response.json::<CliSessionResponse>()?;

        if let Some(err) = body.error {
            return Err(anyhow!("authentication failed: {err}"));
        }

        match body.status.as_deref() {
            Some("complete") => {
                let token = body
                    .token
                    .ok_or_else(|| anyhow!("completed auth session missing token"))?;
                let agent_id = body
                    .agent_id
                    .ok_or_else(|| anyhow!("completed auth session missing agent_id"))?;
                return Ok(CallbackData {
                    token,
                    agent_id,
                    wallet: body.wallet.unwrap_or_default(),
                    ens: body.ens.unwrap_or_default(),
                    identity_anchor: body.identity_anchor.unwrap_or_default(),
                });
            }
            Some("pending") | None => {
                thread::sleep(Duration::from_secs(2));
            }
            Some(other) => {
                return Err(anyhow!("unexpected auth session status: {other}"));
            }
        }
    }
}

fn current_unix_ts() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}
