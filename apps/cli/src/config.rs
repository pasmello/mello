use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

const DEFAULT_REGISTRY: &str = "https://registry.pasmello.com";
const ENV_OVERRIDE: &str = "MELLO_REGISTRY_URL";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct FileShape {
    registry: Option<String>,
}

#[derive(Debug, Clone)]
pub struct Config {
    pub registry: String,
}

impl Config {
    /// Resolution precedence: --registry flag > MELLO_REGISTRY_URL env >
    /// config file > hardcoded default.
    pub fn load(override_path: Option<&Path>, flag_override: Option<String>) -> Result<Self> {
        let config_path = resolve_config_path(override_path)?;
        let file = read_file(&config_path)?;

        let registry = flag_override
            .or_else(|| std::env::var(ENV_OVERRIDE).ok())
            .or(file.registry)
            .unwrap_or_else(|| DEFAULT_REGISTRY.to_string());

        Ok(Config { registry })
    }
}

fn resolve_config_path(override_path: Option<&Path>) -> Result<PathBuf> {
    if let Some(p) = override_path {
        return Ok(p.to_path_buf());
    }
    let base = dirs::config_dir().context("no XDG config dir")?;
    Ok(base.join("mello").join("config.toml"))
}

fn read_file(path: &Path) -> Result<FileShape> {
    if !path.exists() {
        return Ok(FileShape::default());
    }
    let text = std::fs::read_to_string(path).with_context(|| format!("read {}", path.display()))?;
    let parsed: FileShape =
        toml::from_str(&text).with_context(|| format!("parse {}", path.display()))?;
    Ok(parsed)
}
