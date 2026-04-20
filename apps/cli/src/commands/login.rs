use crate::auth;
use crate::config::Config;
use crate::registry::Registry;
use anyhow::Result;
use std::thread::sleep;
use std::time::{Duration, Instant};

pub fn run(cfg: &Config) -> Result<()> {
    let reg = Registry::new(&cfg.registry, None)?;
    let start = reg.device_code()?;

    println!("Open this URL in your browser:");
    println!("  {}", start.verification_uri);
    println!("And enter this code:");
    println!("  {}", start.user_code);
    println!();
    let _ = open::that(&start.verification_uri);
    println!(
        "Waiting for authorization (expires in {}s)…",
        start.expires_in
    );

    let deadline = Instant::now() + Duration::from_secs(start.expires_in);
    let mut interval = Duration::from_secs(start.interval.max(1));
    let token = loop {
        sleep(interval);
        if Instant::now() >= deadline {
            anyhow::bail!("authorization expired — run `mello login` again");
        }
        match reg.device_token_poll(&start.device_code, &default_token_name())? {
            Some(res) => break res,
            None => {
                // server tells us to slow down by bumping interval; keep it simple.
                interval = Duration::from_secs((interval.as_secs() + 2).min(30));
            }
        }
    };

    auth::store_token(&cfg.registry, &token.token)?;
    println!("Logged in as @{}", token.login);
    Ok(())
}

fn default_token_name() -> String {
    let host = hostname();
    format!("mello CLI ({host})")
}

fn hostname() -> String {
    std::env::var("HOSTNAME")
        .or_else(|_| std::env::var("COMPUTERNAME"))
        .unwrap_or_else(|_| "unknown".into())
}
