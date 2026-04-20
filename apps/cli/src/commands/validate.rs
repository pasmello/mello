use crate::config::Config;
use crate::manifest::{read_envelope, read_manifest};
use crate::pack::pack;
use anyhow::Result;
use std::path::Path;

const MAX_BYTES: usize = 20 * 1024 * 1024;

pub fn run(_cfg: &Config, path: &Path) -> Result<()> {
    let envelope = read_envelope(path)?;
    if !matches!(envelope.r#type.as_str(), "tool" | "theme" | "workflow") {
        anyhow::bail!("envelope.type must be tool | theme | workflow (got {})", envelope.r#type);
    }
    let manifest = read_manifest(path, &envelope.r#type)?;

    let packed = pack(path)?;
    if packed.bytes.len() > MAX_BYTES {
        anyhow::bail!(
            "packed archive is {} bytes — exceeds the 20 MB registry cap",
            packed.bytes.len()
        );
    }

    println!("Package OK:");
    println!("  {}: @{}/{}@{}", envelope.r#type, envelope.scope, envelope.name, envelope.version);
    println!("  description: {}", envelope.description);
    println!("  license: {}", envelope.license);
    println!("  author: @{}", envelope.author.github);
    println!("  size: {} KB", packed.bytes.len() / 1024);
    println!("  sha256: {}", packed.sha256);
    println!("  entries: {}", packed.entries.len());

    if envelope.author.github.to_lowercase() != envelope.scope.to_lowercase() {
        println!(
            "  warn: author.github ({}) differs from scope ({}); the server will require you to be a co-owner",
            envelope.author.github, envelope.scope
        );
    }

    if envelope.r#type == "tool" {
        check_tool_entry(path, &manifest, &packed.entries);
    }

    Ok(())
}

fn check_tool_entry(_path: &Path, manifest: &serde_json::Value, entries: &[String]) {
    if let Some(entry) = manifest.get("entry").and_then(|v| v.as_str()) {
        let found = entries.iter().any(|e| e == entry);
        if !found {
            println!("  warn: tool.entry = \"{entry}\" not found in packed zip");
        }
    }
}
