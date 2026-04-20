use crate::errors::MelloError;
use anyhow::{Context, Result};
use keyring::Entry;
use std::path::PathBuf;

const SERVICE: &str = "mello";

fn entry_for(registry: &str) -> Result<Entry> {
    Entry::new(SERVICE, registry).context("create keyring entry")
}

fn file_fallback(registry: &str) -> Result<PathBuf> {
    let base = dirs::config_dir().context("no XDG config dir")?;
    let slug = registry
        .replace(|c: char| !c.is_ascii_alphanumeric(), "_")
        .trim_matches('_')
        .to_string();
    Ok(base.join("mello").join(format!("credentials-{slug}")))
}

/// Store a token for the given registry. Tries OS keyring first; falls back
/// to a 0600 file in ~/.config/mello/.
pub fn store_token(registry: &str, token: &str) -> Result<()> {
    if let Ok(entry) = entry_for(registry) {
        if entry.set_password(token).is_ok() {
            return Ok(());
        }
    }
    let path = file_fallback(registry)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&path, token)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600))?;
    }
    Ok(())
}

/// Load a token for the given registry. Returns Err(NotLoggedIn) if missing.
pub fn load_token(registry: &str) -> Result<String> {
    if let Ok(entry) = entry_for(registry) {
        if let Ok(tok) = entry.get_password() {
            return Ok(tok);
        }
    }
    let path = file_fallback(registry)?;
    if !path.exists() {
        return Err(MelloError::NotLoggedIn.into());
    }
    let tok = std::fs::read_to_string(&path)?.trim().to_string();
    if tok.is_empty() {
        return Err(MelloError::NotLoggedIn.into());
    }
    Ok(tok)
}

pub fn delete_token(registry: &str) -> Result<()> {
    if let Ok(entry) = entry_for(registry) {
        let _ = entry.delete_credential();
    }
    let path = file_fallback(registry)?;
    if path.exists() {
        std::fs::remove_file(path)?;
    }
    Ok(())
}
