use crate::dirs;
use clap::{Args, Subcommand};
use eyre::Result;
use serde_derive::{Deserialize, Serialize};
use std::fs;

/// Agent config stored at ~/.bountynet/agent.json
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AgentConfig {
    pub agent_id: u64,
    pub wallet: String,
    pub ens: String,
    pub token: String,
    pub gateway: String,
}

impl AgentConfig {
    pub fn load() -> Result<Self> {
        let path = dirs::HOME.join(".bountynet/agent.json");
        if !path.exists() {
            return Err(eyre::eyre!(
                "not joined yet — run `be join` first"
            ));
        }
        let data = fs::read_to_string(&path)?;
        Ok(serde_json::from_str(&data)?)
    }

    fn client(&self) -> reqwest::blocking::Client {
        reqwest::blocking::Client::new()
    }
}

// ── be status ─────────────────────────────────────────────────

/// Show agent status — ID, wallet, balances, reputation.
#[derive(Debug, Args)]
pub struct Status {
    /// Output as JSON
    #[clap(long)]
    pub json: bool,
}

#[derive(Deserialize, Debug)]
struct IdentityResponse {
    agent_id: Option<u64>,
    wallet: Option<String>,
    ens: Option<String>,
    balances: Option<Balances>,
    reputation: Option<Reputation>,
    escrow: Option<String>,
    error: Option<String>,
}

#[derive(Deserialize, Debug)]
struct Balances {
    eurc: Option<String>,
    native: Option<String>,
}

#[derive(Deserialize, Debug)]
struct Reputation {
    bounties_solved: Option<u64>,
    total_earned_eurc: Option<String>,
}

impl Status {
    pub fn run(self) -> Result<()> {
        let config = AgentConfig::load()?;

        let resp = config
            .client()
            .get(format!("{}/identity/{}", config.gateway, config.agent_id))
            .send()?;

        let text = resp.text()?;

        if self.json {
            println!("{}", text);
            return Ok(());
        }

        let data: IdentityResponse = serde_json::from_str(&text)?;

        if let Some(err) = data.error {
            eprintln!("[bounty] error: {}", err);
            return Err(eyre::eyre!("{}", err));
        }

        eprintln!("[bounty] agent #{}", data.agent_id.unwrap_or(config.agent_id));
        eprintln!("[bounty]   wallet: {}", data.wallet.unwrap_or(config.wallet));
        eprintln!("[bounty]   ens:    {}", data.ens.unwrap_or(config.ens));

        if let Some(bal) = data.balances {
            eprintln!("[bounty]   eurc:   {} EURC", bal.eurc.unwrap_or_default());
            eprintln!("[bounty]   native: {}", bal.native.unwrap_or_default());
        }

        if let Some(rep) = data.reputation {
            eprintln!(
                "[bounty]   solved: {} bounties, {} EURC earned",
                rep.bounties_solved.unwrap_or(0),
                rep.total_earned_eurc.unwrap_or_default()
            );
        }

        if let Some(escrow) = data.escrow {
            eprintln!("[bounty]   escrow: {}", escrow);
        }

        Ok(())
    }
}

// ── be bounty ─────────────────────────────────────────────────

/// Manage bounties — list, create, claim, watch.
#[derive(Debug, Args)]
pub struct Bounty {
    #[clap(subcommand)]
    pub command: BountyCommand,
}

#[derive(Debug, Subcommand)]
pub enum BountyCommand {
    /// List available bounties
    List(BountyList),
    /// Create a bounty manually
    Create(BountyCreate),
    /// Claim a bounty
    Claim(BountyClaim),
    /// Watch for bounties and auto-claim
    Watch(BountyWatch),
}

impl Bounty {
    pub fn run(self) -> Result<()> {
        match self.command {
            BountyCommand::List(cmd) => cmd.run(),
            BountyCommand::Create(cmd) => cmd.run(),
            BountyCommand::Claim(cmd) => cmd.run(),
            BountyCommand::Watch(cmd) => cmd.run(),
        }
    }
}

// ── be bounty list ────────────────────────────────────────────

/// List available bounties from the network.
#[derive(Debug, Args)]
pub struct BountyList {
    /// Filter: claimable, claimed, resolved, all
    #[clap(long, default_value = "claimable")]
    pub status: String,

    /// Max results
    #[clap(long, default_value = "20")]
    pub limit: u32,

    /// Output as JSON
    #[clap(long)]
    pub json: bool,

    /// Gateway URL (overrides config)
    #[clap(long)]
    pub gateway: Option<String>,
}

#[derive(Deserialize, Debug)]
struct BountiesResponse {
    bounties: Option<Vec<BountyItem>>,
    count: Option<u64>,
    error: Option<String>,
}

#[derive(Deserialize, Debug)]
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

impl BountyList {
    pub fn run(self) -> Result<()> {
        let gw = match &self.gateway {
            Some(g) => g.clone(),
            None => AgentConfig::load()
                .map(|c| c.gateway)
                .unwrap_or_else(|_| "https://gateway.stare.network".to_string()),
        };

        let url = format!(
            "{}/bounties?status={}&limit={}",
            gw, self.status, self.limit
        );

        let resp = reqwest::blocking::get(&url)?;
        let text = resp.text()?;

        if self.json {
            println!("{}", text);
            return Ok(());
        }

        let data: BountiesResponse = serde_json::from_str(&text)?;

        if let Some(err) = data.error {
            eprintln!("[bounty] error: {}", err);
        }

        let bounties = data.bounties.unwrap_or_default();
        if bounties.is_empty() {
            eprintln!("[bounty] no bounties found (status={})", self.status);
            return Ok(());
        }

        eprintln!("[bounty] {} bounties:\n", bounties.len());
        eprintln!(
            "  {:<18} {:<10} {:<12} {}",
            "CONTEXT", "EURC", "STATUS", "REPO"
        );
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

// ── be bounty create ──────────────────────────────────────────

/// Create a bounty for a failing CI check.
#[derive(Debug, Args)]
pub struct BountyCreate {
    /// Repository (owner/repo)
    #[clap(long)]
    pub repo: String,

    /// Commit SHA
    #[clap(long)]
    pub commit: String,

    /// Check name
    #[clap(long, default_value = "build")]
    pub check_name: String,

    /// Budget mode: api_key or eurc
    #[clap(long, default_value = "api_key")]
    pub budget_mode: String,

    /// Anthropic API key (for api_key mode)
    #[clap(long)]
    pub anthropic_key: Option<String>,

    /// OpenAI API key (for api_key mode)
    #[clap(long)]
    pub openai_key: Option<String>,

    /// Token budget (for api_key mode)
    #[clap(long, default_value = "100000")]
    pub budget_tokens: u64,

    /// EURC amount in micro-EURC (for eurc mode)
    #[clap(long, default_value = "5000000")]
    pub amount_eurc: u64,
}

#[derive(Deserialize, Debug)]
struct CreateResponse {
    context_hash: Option<String>,
    status: Option<String>,
    budget_tokens: Option<u64>,
    error: Option<String>,
}

impl BountyCreate {
    pub fn run(self) -> Result<()> {
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
            eprintln!("[bounty] error: {}", err);
            return Err(eyre::eyre!("{}", err));
        }

        eprintln!("[bounty] bounty created!");
        eprintln!(
            "[bounty]   context: {}",
            data.context_hash.unwrap_or_default()
        );
        eprintln!("[bounty]   status:  {}", data.status.unwrap_or_default());
        if let Some(budget) = data.budget_tokens {
            eprintln!("[bounty]   budget:  {} tokens", budget);
        }

        Ok(())
    }
}

// ── be bounty claim ───────────────────────────────────────────

/// Claim a bounty and get an inference token.
#[derive(Debug, Args)]
pub struct BountyClaim {
    /// Context hash of the bounty to claim
    pub context_hash: String,
}

#[derive(Deserialize, Debug)]
struct ClaimResponse {
    status: Option<String>,
    context_hash: Option<String>,
    agent_id: Option<u64>,
    bnet_token: Option<String>,
    inference_endpoint: Option<String>,
    budget_remaining: Option<u64>,
    error: Option<String>,
}

impl BountyClaim {
    pub fn run(self) -> Result<()> {
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
            eprintln!("[bounty] error: {}", err);
            return Err(eyre::eyre!("{}", err));
        }

        let bnet_token = data.bnet_token.unwrap_or_default();
        let endpoint = data
            .inference_endpoint
            .unwrap_or_else(|| "https://gateway.stare.network/v1".to_string());

        eprintln!("[bounty] bounty claimed!");
        eprintln!(
            "[bounty]   context:   {}",
            data.context_hash.unwrap_or_default()
        );
        eprintln!("[bounty]   agent:     #{}", data.agent_id.unwrap_or(0));
        eprintln!("[bounty]   token:     {}", bnet_token);
        eprintln!("[bounty]   endpoint:  {}", endpoint);
        if let Some(budget) = data.budget_remaining {
            eprintln!("[bounty]   budget:    {} tokens remaining", budget);
        }

        eprintln!();
        eprintln!("[bounty] to use inference, set:");
        if !bnet_token.is_empty() {
            eprintln!("  export ANTHROPIC_API_KEY={}", bnet_token);
            eprintln!("  export ANTHROPIC_BASE_URL={}", endpoint);
        }

        Ok(())
    }
}

// ── be bounty watch ───────────────────────────────────────────

/// Watch for claimable bounties and auto-claim them.
#[derive(Debug, Args)]
pub struct BountyWatch {
    /// Poll interval in seconds
    #[clap(long, default_value = "10")]
    pub interval: u64,

    /// Only claim bounties for repos matching this pattern
    #[clap(long)]
    pub repo: Option<String>,
}

impl BountyWatch {
    pub fn run(self) -> Result<()> {
        let config = AgentConfig::load()?;
        let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();
        let mut claimed: Vec<String> = Vec::new();

        eprintln!("[bounty] watching for bounties (poll={}s)...", self.interval);
        if let Some(ref repo) = self.repo {
            eprintln!("[bounty] filtering: repo={}", repo);
        }
        eprintln!("[bounty] agent #{}, gateway: {}", config.agent_id, config.gateway);
        eprintln!();

        loop {
            let url = format!("{}/bounties?status=claimable&limit=10", config.gateway);
            match reqwest::blocking::get(&url) {
                Ok(resp) => {
                    if let Ok(data) = resp.json::<BountiesResponse>() {
                        for b in data.bounties.unwrap_or_default() {
                            let hash = match &b.context_hash {
                                Some(h) => h.clone(),
                                None => continue,
                            };

                            if seen.contains(&hash) {
                                continue;
                            }
                            seen.insert(hash.clone());

                            // Repo filter
                            if let Some(ref pattern) = self.repo {
                                if let Some(ref repo) = b.repo {
                                    if !repo.contains(pattern.as_str()) {
                                        continue;
                                    }
                                }
                            }

                            eprintln!(
                                "[bounty] found: {} {} ({})",
                                b.repo.as_deref().unwrap_or("?"),
                                hash.get(..14).unwrap_or("?"),
                                b.amount_eurc.as_deref().unwrap_or("?")
                            );

                            // Auto-claim
                            match config
                                .client()
                                .post(format!("{}/bounties/{}/claim", config.gateway, hash))
                                .header("Authorization", format!("Bearer {}", config.token))
                                .json(&serde_json::json!({ "agent_id": config.agent_id }))
                                .send()
                            {
                                Ok(resp) => {
                                    if let Ok(claim) = resp.json::<ClaimResponse>() {
                                        if claim.error.is_some() {
                                            eprintln!(
                                                "[bounty]   skip: {}",
                                                claim.error.unwrap_or_default()
                                            );
                                        } else {
                                            eprintln!(
                                                "[bounty]   claimed! token={}",
                                                claim.bnet_token.as_deref().unwrap_or("?")
                                            );
                                            claimed.push(hash);
                                        }
                                    }
                                }
                                Err(e) => eprintln!("[bounty]   claim failed: {}", e),
                            }
                        }
                    }
                }
                Err(e) => eprintln!("[bounty] poll error: {}", e),
            }

            eprintln!(
                "[bounty] {} seen, {} claimed — next poll in {}s",
                seen.len(),
                claimed.len(),
                self.interval
            );
            std::thread::sleep(std::time::Duration::from_secs(self.interval));
        }
    }
}
