use crate::config::Config;
use crate::manifest::{Author, Envelope};
use anyhow::{Context, Result};
use std::io::Write;
use std::path::Path;

pub fn run(_cfg: &Config, r#type: &str, name: Option<&str>) -> Result<()> {
    match r#type {
        "tool" | "theme" | "workflow" => {}
        _ => anyhow::bail!("type must be one of tool | theme | workflow (got {type})"),
    }

    let scope = prompt("GitHub login (package scope)")?;
    let pkg_name = match name {
        Some(n) => n.to_string(),
        None => prompt("package name")?,
    };
    let description = prompt("description")?;
    let license = prompt_with("license", "MIT")?;

    let envelope = Envelope {
        mello_spec_version: "1".into(),
        r#type: r#type.into(),
        scope: scope.clone(),
        name: pkg_name.clone(),
        version: "0.1.0".into(),
        description,
        author: Author {
            github: scope.clone(),
            name: None,
            url: None,
        },
        license,
        readme: Some("README.md".into()),
        homepage: None,
        repository: None,
        keywords: None,
        pasmello_plugin_spec_version: None,
        dependencies: None,
    };
    let envelope_json = serde_json::to_string_pretty(&envelope)?;
    std::fs::write("mello.package.json", envelope_json)?;

    write_starter_manifest(r#type, &pkg_name)?;
    write_starter_readme(&pkg_name)?;

    println!("Initialized {} package: @{}/{}", r#type, scope, pkg_name);
    println!(
        "Next: fill in {}.manifest.json and run `mello publish`.",
        r#type
    );
    Ok(())
}

fn prompt(label: &str) -> Result<String> {
    prompt_with(label, "")
}

fn prompt_with(label: &str, default: &str) -> Result<String> {
    if default.is_empty() {
        print!("{label}: ");
    } else {
        print!("{label} [{default}]: ");
    }
    std::io::stdout().flush()?;
    let mut line = String::new();
    std::io::stdin().read_line(&mut line)?;
    let trimmed = line.trim().to_string();
    if trimmed.is_empty() {
        if default.is_empty() {
            anyhow::bail!("{label} is required");
        }
        return Ok(default.to_string());
    }
    Ok(trimmed)
}

fn write_starter_manifest(r#type: &str, name: &str) -> Result<()> {
    let path = format!("{type}.manifest.json");
    if Path::new(&path).exists() {
        return Ok(());
    }
    let starter = match r#type {
        "tool" => serde_json::json!({
            "id": name,
            "name": name,
            "version": "0.1.0",
            "description": "",
            "entry": "dist/index.html",
            "permissions": {
                "network": [],
                "storage": "none",
                "clipboard": "none",
                "notifications": false,
                "camera": false,
                "geolocation": false,
            },
            "actions": {},
        }),
        "theme" => serde_json::json!({
            "id": name,
            "name": name,
            "version": "0.1.0",
            "description": "",
            "builtIn": false,
            "tokens": {},
        }),
        "workflow" => serde_json::json!({
            "id": name,
            "name": name,
            "version": "0.1.0",
            "description": "",
            "triggers": [{ "type": "manual" }],
            "nodes": [],
            "edges": [],
        }),
        _ => unreachable!(),
    };
    std::fs::write(&path, serde_json::to_string_pretty(&starter)?)
        .with_context(|| format!("write {path}"))?;
    Ok(())
}

fn write_starter_readme(name: &str) -> Result<()> {
    if Path::new("README.md").exists() {
        return Ok(());
    }
    let body = format!(
        "# {name}\n\nA mello package.\n\n## Usage\n\nInstall from [market.pasmello.com]({name}).\n",
    );
    std::fs::write("README.md", body)?;
    Ok(())
}
