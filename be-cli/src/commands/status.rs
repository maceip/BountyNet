use crate::config::AgentConfig;
use anyhow::{anyhow, Result};
use serde::Deserialize;

/// Show agent status from the gateway (wallet, balances, reputation).
#[derive(Debug, clap::Args)]
pub struct Status {
    /// Print raw JSON from the gateway
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
            eprintln!("[be] error: {err}");
            return Err(anyhow!("{err}"));
        }

        eprintln!("[be] agent #{}", data.agent_id.unwrap_or(config.agent_id));
        eprintln!("[be]   wallet: {}", data.wallet.unwrap_or(config.wallet));
        eprintln!("[be]   ens:    {}", data.ens.unwrap_or(config.ens.clone()));

        if let Some(bal) = data.balances {
            eprintln!("[be]   eurc:   {} EURC", bal.eurc.unwrap_or_default());
            eprintln!("[be]   native: {}", bal.native.unwrap_or_default());
        }

        if let Some(rep) = data.reputation {
            eprintln!(
                "[be]   solved: {} bounties, {} EURC earned",
                rep.bounties_solved.unwrap_or(0),
                rep.total_earned_eurc.unwrap_or_default()
            );
        }

        if let Some(escrow) = data.escrow {
            eprintln!("[be]   escrow: {escrow}");
        }

        Ok(())
    }
}
