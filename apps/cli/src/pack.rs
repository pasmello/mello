use anyhow::{Context, Result};
use sha2::{Digest, Sha256};
use std::io::Cursor;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;
use zip::write::{SimpleFileOptions, ZipWriter};

pub struct Packed {
    pub bytes: Vec<u8>,
    pub sha256: String,
    pub entries: Vec<String>,
}

/// Default ignore patterns. Supplemented by `.melloignore` globs if present.
const DEFAULT_IGNORE: &[&str] = &[
    ".git",
    ".github",
    "node_modules",
    "target",
    "dist-tmp",
    ".DS_Store",
    ".env",
    ".env.*",
    "*.log",
];

fn load_ignore(dir: &Path) -> Vec<String> {
    let mut patterns: Vec<String> = DEFAULT_IGNORE.iter().map(|s| s.to_string()).collect();
    let path = dir.join(".melloignore");
    if let Ok(text) = std::fs::read_to_string(&path) {
        for line in text.lines() {
            let t = line.trim();
            if t.is_empty() || t.starts_with('#') {
                continue;
            }
            patterns.push(t.to_string());
        }
    }
    patterns
}

fn matches_any(path_str: &str, patterns: &[String]) -> bool {
    for p in patterns {
        if let Ok(pat) = glob::Pattern::new(p) {
            if pat.matches(path_str) || path_str.split('/').any(|seg| pat.matches(seg)) {
                return true;
            }
        }
    }
    false
}

pub fn pack(dir: &Path) -> Result<Packed> {
    let root = dir
        .canonicalize()
        .with_context(|| format!("canonicalize {}", dir.display()))?;
    let ignore = load_ignore(&root);

    let mut buffer: Cursor<Vec<u8>> = Cursor::new(Vec::new());
    let mut entries: Vec<String> = Vec::new();
    {
        let mut writer = ZipWriter::new(&mut buffer);
        let opts =
            SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

        for entry in WalkDir::new(&root).follow_links(false) {
            let entry = entry?;
            let path = entry.path();
            if path == root {
                continue;
            }
            let rel: PathBuf = path.strip_prefix(&root).unwrap().to_path_buf();
            let rel_str = rel.to_string_lossy().replace('\\', "/");

            if matches_any(&rel_str, &ignore) {
                continue;
            }

            if entry.file_type().is_dir() {
                // zip-rs handles dir markers implicitly; skip.
                continue;
            }
            if !entry.file_type().is_file() {
                continue;
            }

            writer.start_file::<_, ()>(&rel_str, opts)?;
            let mut f = std::fs::File::open(path)?;
            std::io::copy(&mut f, &mut writer)?;
            entries.push(rel_str);
        }
        writer.finish()?;
    }
    let bytes = buffer.into_inner();
    let sha256 = sha256_hex(&bytes);
    Ok(Packed {
        bytes,
        sha256,
        entries,
    })
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    let mut h = Sha256::new();
    h.update(bytes);
    hex::encode(h.finalize())
}

