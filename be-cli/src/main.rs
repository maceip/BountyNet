//! `be` — BountyNet CLI (short for **BountyNet**).
//!
//! Subcommands match gateway routes in `gateway/routes/identity.py` and
//! `gateway/routes/bounties.py` only — see `ARCHITECTURE.md` at repo root.

mod commands;
mod config;

use anyhow::Result;
use clap::{Parser, Subcommand};
use commands::{bounties, join, status};

#[derive(Parser)]
#[command(
    name = "be",
    version,
    about = "BountyNet CLI — `be` is short for BountyNet"
)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// `GET /identity/login` → callback → `POST /identity/onboard`
    Join(join::Join),
    /// `GET /identity/<agent_id>`
    Status(status::Status),
    /// `GET/POST /bounties…` (list, create, claim; watch = poll + claim)
    Bounties(bounties::Bounties),
}

fn main() -> Result<()> {
    let cli = Cli::parse();
    match cli.command {
        Command::Join(c) => c.run(),
        Command::Status(c) => c.run(),
        Command::Bounties(c) => c.run(),
    }
}
