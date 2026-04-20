use crate::auth;
use crate::config::Config;
use crate::registry::Registry;
use anyhow::Result;

pub fn run(cfg: &Config, coord: &str, version: &str, reason: Option<&str>) -> Result<()> {
    let (r#type, scope, name) = parse_coord(coord)?;
    let token = auth::load_token(&cfg.registry)?;
    let reg = Registry::new(&cfg.registry, Some(token))?;
    reg.yank(&r#type, &scope, &name, version, reason)?;
    println!("Yanked {type}:@{scope}/{name}@{version}");
    Ok(())
}

/// Parses `<type>:@<scope>/<name>` or `<type>:<scope>/<name>`.
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
