use crate::auth;
use crate::config::Config;
use crate::registry::Registry;
use anyhow::Result;

fn parse_coord(coord: &str) -> Result<(String, String, String)> {
    let (type_str, rest) = coord
        .split_once(':')
        .ok_or_else(|| anyhow::anyhow!("coord must be <type>:<scope>/<name>"))?;
    let rest = rest.trim_start_matches('@');
    let (scope, name) = rest
        .split_once('/')
        .ok_or_else(|| anyhow::anyhow!("coord must be <type>:<scope>/<name>"))?;
    if !matches!(type_str, "tool" | "theme" | "workflow") {
        anyhow::bail!("type must be tool | theme | workflow");
    }
    Ok((type_str.to_string(), scope.to_string(), name.to_string()))
}

fn client(cfg: &Config, require_token: bool) -> Result<Registry> {
    let token = if require_token {
        Some(auth::load_token(&cfg.registry)?)
    } else {
        auth::load_token(&cfg.registry).ok()
    };
    Registry::new(&cfg.registry, token)
}

pub fn list(cfg: &Config, coord: &str) -> Result<()> {
    let (r#type, scope, name) = parse_coord(coord)?;
    let reg = client(cfg, false)?;
    let owners = reg.list_owners(&r#type, &scope, &name)?;
    if owners.is_empty() {
        println!("no owners listed");
        return Ok(());
    }
    for o in owners {
        let login = o.login.unwrap_or_else(|| "<unknown>".into());
        let added = o.added_at.as_deref().unwrap_or("—");
        println!("  @{login} ({role}) — {added}", role = o.role);
    }
    Ok(())
}

pub fn add(cfg: &Config, coord: &str, login: &str) -> Result<()> {
    let (r#type, scope, name) = parse_coord(coord)?;
    let reg = client(cfg, true)?;
    reg.add_owner(&r#type, &scope, &name, login)?;
    println!("Added @{login} as co-owner of {type}:@{scope}/{name}");
    Ok(())
}

pub fn remove(cfg: &Config, coord: &str, login: &str) -> Result<()> {
    let (r#type, scope, name) = parse_coord(coord)?;
    let reg = client(cfg, true)?;
    reg.remove_owner(&r#type, &scope, &name, login)?;
    println!("Removed @{login} from {type}:@{scope}/{name}");
    Ok(())
}
