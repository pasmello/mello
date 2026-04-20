use assert_cmd::Command;
use predicates::prelude::*;
use predicates::str::contains;

#[test]
fn prints_help() {
    Command::cargo_bin("mello")
        .unwrap()
        .arg("--help")
        .assert()
        .success()
        .stdout(contains("mello"))
        .stdout(contains("login"))
        .stdout(contains("publish"))
        .stdout(contains("yank"));
}

#[test]
fn init_rejects_bad_type() {
    Command::cargo_bin("mello")
        .unwrap()
        .args(["init", "--type", "widget", "--name", "x"])
        .assert()
        .failure()
        .stderr(contains("tool | theme | workflow"));
}

#[test]
fn whoami_without_login_fails_clearly() {
    // Fake registry so we don't accidentally hit the real one. The error
    // happens at token lookup, which is offline.
    Command::cargo_bin("mello")
        .unwrap()
        .env("MELLO_REGISTRY_URL", "https://invalid.example")
        .env("HOME", std::env::temp_dir())
        .env("XDG_CONFIG_HOME", std::env::temp_dir())
        .arg("whoami")
        .assert()
        .failure()
        .stderr(contains("not logged in").or(contains("registry")));
}
