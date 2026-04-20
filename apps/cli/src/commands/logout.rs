use crate::auth;
use crate::config::Config;
use anyhow::Result;

pub fn run(cfg: &Config) -> Result<()> {
    auth::delete_token(&cfg.registry)?;
    println!("Logged out.");
    Ok(())
}
