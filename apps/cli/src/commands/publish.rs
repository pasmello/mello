use crate::auth;
use crate::config::Config;
use crate::manifest::read_envelope;
use crate::pack::pack;
use crate::registry::Registry;
use anyhow::Result;
use std::io::Write;
use std::path::Path;

const MAX_BYTES: usize = 20 * 1024 * 1024;

pub fn run(cfg: &Config, path: &Path, skip_confirm: bool) -> Result<()> {
    let envelope = read_envelope(path)?;
    let token = auth::load_token(&cfg.registry)?;
    let reg = Registry::new(&cfg.registry, Some(token))?;

    let packed = pack(path)?;
    if packed.bytes.len() > MAX_BYTES {
        anyhow::bail!("packed archive {} bytes > 20 MB cap", packed.bytes.len());
    }

    println!("Publishing to {}", cfg.registry);
    println!(
        "  {}: @{}/{}@{}",
        envelope.r#type, envelope.scope, envelope.name, envelope.version
    );
    println!(
        "  size: {} KB  sha256: {}",
        packed.bytes.len() / 1024,
        packed.sha256
    );

    if !skip_confirm {
        print!("Proceed? [y/N] ");
        std::io::stdout().flush()?;
        let mut line = String::new();
        std::io::stdin().read_line(&mut line)?;
        if !matches!(line.trim().to_ascii_lowercase().as_str(), "y" | "yes") {
            println!("Cancelled.");
            return Ok(());
        }
    }

    let resp = reg.publish_zip(packed.bytes)?;
    println!(
        "Published {}: @{}/{}@{}",
        resp.r#type, resp.scope, resp.name, resp.version
    );
    println!("  download: {}", resp.download_url);
    Ok(())
}
