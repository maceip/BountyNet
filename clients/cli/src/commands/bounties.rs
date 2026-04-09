use crate::config::AgentConfig;
use anyhow::{anyhow, Result};
use clap::Subcommand;
use log::{error, info, warn};
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
    #[clap(long, default_value = "inference_budget", help = "Funding kind: inference_budget or escrow")]
    pub funding_kind: String,
    #[clap(long)]
    pub anthropic_key: Option<String>,
    #[clap(long)]
    pub openai_key: Option<String>,
    #[clap(long, default_value = "100000")]
    pub budget_tokens: u64,
    #[clap(long, default_value = "5000000")]
    pub escrow_amount_eurc: u64,
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
    funding_kind: Option<String>,
    funding_label: Option<String>,
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
    funding_kind: Option<String>,
    funding_label: Option<String>,
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
            error!("error: {err}");
        }

        let bounties = data.bounties.unwrap_or_default();
        if bounties.is_empty() {
            info!("no bounties in feed");
            return Ok(());
        }

        info!("{} bounties:\n", bounties.len());
        info!("  {:<18} {:<18} {:<12} REPO", "CONTEXT", "FUNDING", "STATUS");
        info!("  {}", "-".repeat(64));

        for b in &bounties {
            let hash = b
                .context_hash
                .as_deref()
                .unwrap_or("?")
                .get(..18)
                .unwrap_or("?");
            let funding = b
                .funding_label
                .as_deref()
                .unwrap_or("?");
            let status = if b.resolved.unwrap_or(false) {
                "resolved"
            } else if b.claimable.unwrap_or(false) {
                "claimable"
            } else {
                "claimed"
            };
            let repo = b.repo.as_deref().unwrap_or("?");
            info!("  {:<18} {:<18} {:<12} {}", hash, funding, status, repo);
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
            "funding_kind": self.funding_kind,
        });

        if self.funding_kind == "inference_budget" {
            if let Some(key) = &self.anthropic_key {
                body["anthropic_key"] = serde_json::Value::String(key.clone());
            }
            if let Some(key) = &self.openai_key {
                body["openai_key"] = serde_json::Value::String(key.clone());
            }
            body["budget_tokens"] = serde_json::Value::Number(self.budget_tokens.into());
        } else {
            body["escrow_amount_eurc"] = serde_json::Value::Number(self.escrow_amount_eurc.into());
        }

        let resp = config
            .client()
            .post(format!("{}/bounties/create", config.gateway))
            .header("Authorization", format!("Bearer {}", config.token))
            .json(&body)
            .send()?;

        let data: CreateResponse = resp.json()?;

        if let Some(err) = data.error {
            error!("error: {err}");
            return Err(anyhow!("{err}"));
        }

        info!("bounty created!");
        info!("  context: {}", data.context_hash.unwrap_or_default());
        info!("  status:  {}", data.status.unwrap_or_default());
        if let Some(kind) = data.funding_kind {
            info!("  funding: {kind}");
        }
        if let Some(label) = data.funding_label {
            info!("  amount:  {label}");
        } else if let Some(budget) = data.budget_tokens {
            info!("  amount:  {budget} tokens");
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
            error!("error: {err}");
            return Err(anyhow!("{err}"));
        }

        let bnet_token = data.bnet_token.unwrap_or_default();
        let endpoint = data
            .inference_endpoint
            .unwrap_or_else(|| "https://gateway.stare.network/v1".to_string());

        info!("bounty claimed!");
        info!(
            "  context:   {}",
            data.context_hash.unwrap_or_default()
        );
        info!("  agent:     #{}", data.agent_id.unwrap_or(0));
        info!("  token:     {bnet_token}");
        info!("  endpoint:  {endpoint}");
        if let Some(budget) = data.budget_remaining {
            info!("  budget:    {budget} tokens remaining");
        }

        info!("");
        info!("to use inference, set:");
        if !bnet_token.is_empty() {
            info!("  export ANTHROPIC_API_KEY={bnet_token}");
            info!("  export ANTHROPIC_BASE_URL={endpoint}");
        }

        Ok(())
    }
}

impl Watch {
    fn run(self) -> Result<()> {
        let config = AgentConfig::load()?;
        let mut seen: HashSet<String> = HashSet::new();
        let mut claimed: Vec<String> = Vec::new();

        info!("watching for bounties (poll={}s)...", self.interval);
        if let Some(ref repo) = self.repo {
            info!("filtering: repo={repo}");
        }
        info!(
            "agent #{}, gateway: {}",
            config.agent_id, config.gateway
        );
        info!("");

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

                            info!(
                                "found: {} {} ({})",
                                b.repo.as_deref().unwrap_or("?"),
                                hash.get(..14).unwrap_or("?"),
                                b.funding_label.as_deref().unwrap_or("?")
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
                                            warn!("  skip: {err}");
                                        } else {
                                            info!(
                                                "  claimed! token={}",
                                                claim.bnet_token.as_deref().unwrap_or("?")
                                            );
                                            claimed.push(hash);
                                        }
                                    }
                                }
                                Err(e) => error!("  claim failed: {e}"),
                            }
                        }
                    }
                }
                Err(e) => warn!("poll error: {e}"),
            }

            info!(
                "{} seen, {} claimed — next poll in {}s",
                seen.len(),
                claimed.len(),
                self.interval
            );
            thread::sleep(Duration::from_secs(self.interval));
        }
    }
}
