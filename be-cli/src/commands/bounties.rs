use crate::config::AgentConfig;
use anyhow::{anyhow, Result};
use clap::Subcommand;
use serde::Deserialize;
use std::collections::HashSet;
use std::thread;
use std::time::Duration;

/// Bounty commands — matches `gateway/routes/bounties.py` only.
#[derive(Debug, clap::Args)]
pub struct Bounties {
    #[clap(subcommand)]
    pub command: BountyCommand,
}

#[derive(Debug, Subcommand)]
pub enum BountyCommand {
    /// `GET /bounties` (gateway does not filter by query params)
    List(List),
    /// `POST /bounties/create`
    Create(Create),
    /// `POST /bounties/<context_hash>/claim`
    Claim(Claim),
    /// Poll `GET /bounties`, client filters claimable, then claim (no extra route)
    Watch(Watch),
}

#[derive(Debug, clap::Args)]
pub struct List {
    #[clap(long)]
    pub json: bool,
    /// Gateway when not logged in (otherwise uses `agent.json`)
    #[clap(long)]
    pub gateway: Option<String>,
}

#[derive(Debug, clap::Args)]
pub struct Create {
    #[clap(long)]
    pub repo: String,
    #[clap(long)]
    pub commit: String,
    #[clap(long, default_value = "build")]
    pub check_name: String,
    #[clap(long, default_value = "api_key")]
    pub budget_mode: String,
    #[clap(long)]
    pub anthropic_key: Option<String>,
    #[clap(long)]
    pub openai_key: Option<String>,
    #[clap(long, default_value = "100000")]
    pub budget_tokens: u64,
    #[clap(long, default_value = "5000000")]
    pub amount_eurc: u64,
}

#[derive(Debug, clap::Args)]
pub struct Claim {
    pub context_hash: String,
}

#[derive(Debug, clap::Args)]
pub struct Watch {
    #[clap(long, default_value = "10")]
    pub interval: u64,
    #[clap(long)]
    pub repo: Option<String>,
}

#[derive(Deserialize, Debug)]
#[allow(dead_code)]
struct BountiesResponse {
    bounties: Option<Vec<BountyItem>>,
    count: Option<u64>,
    error: Option<String>,
}

#[derive(Deserialize, Debug)]
#[allow(dead_code)]
struct BountyItem {
    context_hash: Option<String>,
    creator: Option<String>,
    amount_eurc: Option<String>,
    solver_agent_id: Option<u64>,
    claimable: Option<bool>,
    resolved: Option<bool>,
    repo: Option<String>,
    check_name: Option<String>,
    commit: Option<String>,
}

#[derive(Deserialize, Debug)]
struct CreateResponse {
    context_hash: Option<String>,
    status: Option<String>,
    budget_tokens: Option<u64>,
    error: Option<String>,
}

#[derive(Deserialize, Debug)]
#[allow(dead_code)]
struct ClaimResponse {
    status: Option<String>,
    context_hash: Option<String>,
    agent_id: Option<u64>,
    bnet_token: Option<String>,
    inference_endpoint: Option<String>,
    budget_remaining: Option<u64>,
    error: Option<String>,
}

impl Bounties {
    pub fn run(self) -> Result<()> {
        match self.command {
            BountyCommand::List(c) => c.run(),
            BountyCommand::Create(c) => c.run(),
            BountyCommand::Claim(c) => c.run(),
            BountyCommand::Watch(c) => c.run(),
        }
    }
}

impl List {
    fn run(self) -> Result<()> {
        let gw = match &self.gateway {
            Some(g) => g.trim_end_matches('/').to_string(),
            None => AgentConfig::load()
                .map(|c| c.gateway)
                .unwrap_or_else(|_| "https://gateway.stare.network".to_string()),
        };

        let url = format!("{gw}/bounties");
        let resp = reqwest::blocking::get(&url)?;
        let text = resp.text()?;

        if self.json {
            println!("{}", text);
            return Ok(());
        }

        let data: BountiesResponse = serde_json::from_str(&text)?;
        if let Some(err) = data.error {
            eprintln!("[be] error: {err}");
        }

        let bounties = data.bounties.unwrap_or_default();
        if bounties.is_empty() {
            eprintln!("[be] no bounties in feed");
            return Ok(());
        }

        eprintln!("[be] {} bounties:\n", bounties.len());
        eprintln!("  {:<18} {:<10} {:<12} REPO", "CONTEXT", "EURC", "STATUS");
        eprintln!("  {}", "-".repeat(64));

        for b in &bounties {
            let hash = b
                .context_hash
                .as_deref()
                .unwrap_or("?")
                .get(..18)
                .unwrap_or("?");
            let amount = b.amount_eurc.as_deref().unwrap_or("?");
            let status = if b.resolved.unwrap_or(false) {
                "resolved"
            } else if b.claimable.unwrap_or(false) {
                "claimable"
            } else {
                "claimed"
            };
            let repo = b.repo.as_deref().unwrap_or("?");
            eprintln!("  {:<18} {:<10} {:<12} {}", hash, amount, status, repo);
        }

        Ok(())
    }
}

impl Create {
    fn run(self) -> Result<()> {
        let config = AgentConfig::load()?;

        let mut body = serde_json::json!({
            "repo": self.repo,
            "commit": self.commit,
            "check_name": self.check_name,
            "budget_mode": self.budget_mode,
        });

        if self.budget_mode == "api_key" {
            if let Some(key) = &self.anthropic_key {
                body["anthropic_key"] = serde_json::Value::String(key.clone());
            }
            if let Some(key) = &self.openai_key {
                body["openai_key"] = serde_json::Value::String(key.clone());
            }
            body["budget_tokens"] = serde_json::Value::Number(self.budget_tokens.into());
        } else {
            body["amount_eurc"] = serde_json::Value::Number(self.amount_eurc.into());
        }

        let resp = config
            .client()
            .post(format!("{}/bounties/create", config.gateway))
            .header("Authorization", format!("Bearer {}", config.token))
            .json(&body)
            .send()?;

        let data: CreateResponse = resp.json()?;

        if let Some(err) = data.error {
            eprintln!("[be] error: {err}");
            return Err(anyhow!("{err}"));
        }

        eprintln!("[be] bounty created!");
        eprintln!("[be]   context: {}", data.context_hash.unwrap_or_default());
        eprintln!("[be]   status:  {}", data.status.unwrap_or_default());
        if let Some(budget) = data.budget_tokens {
            eprintln!("[be]   budget:  {budget} tokens");
        }

        Ok(())
    }
}

impl Claim {
    fn run(self) -> Result<()> {
        let config = AgentConfig::load()?;

        let resp = config
            .client()
            .post(format!(
                "{}/bounties/{}/claim",
                config.gateway, self.context_hash
            ))
            .header("Authorization", format!("Bearer {}", config.token))
            .json(&serde_json::json!({ "agent_id": config.agent_id }))
            .send()?;

        let data: ClaimResponse = resp.json()?;

        if let Some(err) = data.error {
            eprintln!("[be] error: {err}");
            return Err(anyhow!("{err}"));
        }

        let bnet_token = data.bnet_token.unwrap_or_default();
        let endpoint = data
            .inference_endpoint
            .unwrap_or_else(|| "https://gateway.stare.network/v1".to_string());

        eprintln!("[be] bounty claimed!");
        eprintln!(
            "[be]   context:   {}",
            data.context_hash.unwrap_or_default()
        );
        eprintln!("[be]   agent:     #{}", data.agent_id.unwrap_or(0));
        eprintln!("[be]   token:     {bnet_token}");
        eprintln!("[be]   endpoint:  {endpoint}");
        if let Some(budget) = data.budget_remaining {
            eprintln!("[be]   budget:    {budget} tokens remaining");
        }

        eprintln!();
        eprintln!("[be] to use inference, set:");
        if !bnet_token.is_empty() {
            eprintln!("  export ANTHROPIC_API_KEY={bnet_token}");
            eprintln!("  export ANTHROPIC_BASE_URL={endpoint}");
        }

        Ok(())
    }
}

impl Watch {
    fn run(self) -> Result<()> {
        let config = AgentConfig::load()?;
        let mut seen: HashSet<String> = HashSet::new();
        let mut claimed: Vec<String> = Vec::new();

        eprintln!("[be] watching for bounties (poll={}s)...", self.interval);
        if let Some(ref repo) = self.repo {
            eprintln!("[be] filtering: repo={repo}");
        }
        eprintln!(
            "[be] agent #{}, gateway: {}",
            config.agent_id, config.gateway
        );
        eprintln!();

        loop {
            let url = format!("{}/bounties", config.gateway);
            match reqwest::blocking::get(&url) {
                Ok(resp) => {
                    if let Ok(data) = resp.json::<BountiesResponse>() {
                        for b in data.bounties.unwrap_or_default() {
                            if !b.claimable.unwrap_or(false) || b.resolved.unwrap_or(false) {
                                continue;
                            }
                            let hash = match &b.context_hash {
                                Some(h) => h.clone(),
                                None => continue,
                            };

                            if seen.contains(&hash) {
                                continue;
                            }

                            if let Some(ref pattern) = self.repo {
                                if let Some(ref repo) = b.repo {
                                    if !repo.contains(pattern.as_str()) {
                                        continue;
                                    }
                                }
                            }

                            seen.insert(hash.clone());

                            eprintln!(
                                "[be] found: {} {} ({})",
                                b.repo.as_deref().unwrap_or("?"),
                                hash.get(..14).unwrap_or("?"),
                                b.amount_eurc.as_deref().unwrap_or("?")
                            );

                            match config
                                .client()
                                .post(format!("{}/bounties/{}/claim", config.gateway, hash))
                                .header("Authorization", format!("Bearer {}", config.token))
                                .json(&serde_json::json!({ "agent_id": config.agent_id }))
                                .send()
                            {
                                Ok(resp) => {
                                    if let Ok(claim) = resp.json::<ClaimResponse>() {
                                        if let Some(err) = claim.error {
                                            eprintln!("[be]   skip: {err}");
                                        } else {
                                            eprintln!(
                                                "[be]   claimed! token={}",
                                                claim.bnet_token.as_deref().unwrap_or("?")
                                            );
                                            claimed.push(hash);
                                        }
                                    }
                                }
                                Err(e) => eprintln!("[be]   claim failed: {e}"),
                            }
                        }
                    }
                }
                Err(e) => eprintln!("[be] poll error: {e}"),
            }

            eprintln!(
                "[be] {} seen, {} claimed — next poll in {}s",
                seen.len(),
                claimed.len(),
                self.interval
            );
            thread::sleep(Duration::from_secs(self.interval));
        }
    }
}
