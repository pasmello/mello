use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Envelope {
    #[serde(rename = "melloSpecVersion")]
    pub mello_spec_version: String,
    pub r#type: String,
    pub scope: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub author: Author,
    pub license: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub readme: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub homepage: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub repository: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub keywords: Option<Vec<String>>,
    #[serde(rename = "pasmelloPluginSpecVersion", skip_serializing_if = "Option::is_none")]
    pub pasmello_plugin_spec_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dependencies: Option<Vec<Dependency>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Author {
    pub github: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Dependency {
    pub r#type: String,
    pub name: String,
    pub range: String,
}

pub fn read_envelope(dir: &Path) -> Result<Envelope> {
    let path = dir.join("mello.package.json");
    let text = std::fs::read_to_string(&path)
        .with_context(|| format!("read {}", path.display()))?;
    let env: Envelope = serde_json::from_str(&text)
        .with_context(|| format!("parse {}", path.display()))?;
    Ok(env)
}

/// Verifies the nested manifest exists and parses as JSON. Schema validation
/// is delegated to the server at publish time.
pub fn read_manifest(dir: &Path, r#type: &str) -> Result<serde_json::Value> {
    let filename = format!("{type}.manifest.json");
    let path = dir.join(&filename);
    let text = std::fs::read_to_string(&path)
        .with_context(|| format!("read {}", path.display()))?;
    let value: serde_json::Value = serde_json::from_str(&text)
        .with_context(|| format!("parse {}", path.display()))?;
    Ok(value)
}
