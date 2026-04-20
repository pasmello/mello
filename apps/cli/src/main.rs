mod auth;
mod commands;
mod config;
mod errors;
mod manifest;
mod pack;
mod registry;

use anyhow::Result;
use clap::{Parser, Subcommand};

/// mello — publish and manage Pasmello plugin packages.
#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Cli {
    /// Override the registry base URL (default: https://registry.pasmello.com).
    #[arg(long, global = true, env = "MELLO_REGISTRY_URL")]
    registry: Option<String>,

    /// Path to a config file (default: ~/.config/mello/config.toml).
    #[arg(long, global = true)]
    config: Option<std::path::PathBuf>,

    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand, Debug)]
enum Command {
    /// Authenticate via the GitHub device flow and store a token.
    Login,
    /// Remove stored credentials.
    Logout,
    /// Show the currently authenticated user.
    Whoami,
    /// Scaffold a new package in the current directory.
    Init {
        /// Package type: tool | theme | workflow.
        #[arg(long, default_value = "tool")]
        r#type: String,
        /// Package name (under your GitHub scope).
        #[arg(long)]
        name: Option<String>,
    },
    /// Validate a package directory without publishing.
    Validate {
        /// Path to the package directory (default: current dir).
        #[arg(default_value = ".")]
        path: std::path::PathBuf,
    },
    /// Pack + upload a package from the current directory.
    Publish {
        /// Skip the confirmation prompt.
        #[arg(long)]
        yes: bool,
        /// Path to the package directory (default: current dir).
        #[arg(default_value = ".")]
        path: std::path::PathBuf,
    },
    /// Mark a published version as yanked (requires owner or co-owner).
    Yank {
        /// Package coordinate: <type>:<scope>/<name>
        coord: String,
        /// Version to yank.
        version: String,
        /// Optional reason visible on the package page.
        #[arg(long)]
        reason: Option<String>,
    },
    /// Manage co-owners on a package (primary owner only for add/remove).
    Owners {
        #[command(subcommand)]
        action: OwnersAction,
    },
}

#[derive(Subcommand, Debug)]
enum OwnersAction {
    /// List current owners + co-owners.
    List {
        /// Package coordinate: <type>:<scope>/<name>
        coord: String,
    },
    /// Add a co-owner by GitHub login.
    Add {
        /// Package coordinate: <type>:<scope>/<name>
        coord: String,
        /// GitHub login to grant co-owner role.
        login: String,
    },
    /// Remove a co-owner by GitHub login.
    Remove {
        /// Package coordinate: <type>:<scope>/<name>
        coord: String,
        /// GitHub login to revoke.
        login: String,
    },
}

fn main() -> Result<()> {
    let cli = Cli::parse();
    let cfg = config::Config::load(cli.config.as_deref(), cli.registry.clone())?;

    match cli.command {
        Command::Login => commands::login::run(&cfg),
        Command::Logout => commands::logout::run(&cfg),
        Command::Whoami => commands::whoami::run(&cfg),
        Command::Init { r#type, name } => commands::init::run(&cfg, &r#type, name.as_deref()),
        Command::Validate { path } => commands::validate::run(&cfg, &path),
        Command::Publish { yes, path } => commands::publish::run(&cfg, &path, yes),
        Command::Yank { coord, version, reason } => {
            commands::yank::run(&cfg, &coord, &version, reason.as_deref())
        }
        Command::Owners { action } => match action {
            OwnersAction::List { coord } => commands::owners::list(&cfg, &coord),
            OwnersAction::Add { coord, login } => commands::owners::add(&cfg, &coord, &login),
            OwnersAction::Remove { coord, login } => {
                commands::owners::remove(&cfg, &coord, &login)
            }
        },
    }
}
