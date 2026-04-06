//! ~/.bountynet/agent.json

use anyhow::{anyhow, Context, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AgentConfig {
    pub agent_id: u64,
    pub wallet: String,
    pub ens: String,
    pub token: String,
    pub gateway: String,
}

pub fn agent_json_path() -> Result<PathBuf> {
    let home = dirs::home_dir().ok_or_else(|| anyhow!("could not find home directory"))?;
    Ok(home.join(".bountynet/agent.json"))
}

pub fn config_dir() -> Result<PathBuf> {
    let home = dirs::home_dir().ok_or_else(|| anyhow!("could not find home directory"))?;
    Ok(home.join(".bountynet"))
}

impl AgentConfig {
    pub fn load() -> Result<Self> {
        let path = agent_json_path()?;
        if !path.exists() {
            return Err(anyhow!("not logged in — run `be join` first"));
        }
        let data = fs::read_to_string(&path).with_context(|| path.display().to_string())?;
        Ok(serde_json::from_str(&data)?)
    }

    pub fn client(&self) -> reqwest::blocking::Client {
        reqwest::blocking::Client::new()
    }
}
