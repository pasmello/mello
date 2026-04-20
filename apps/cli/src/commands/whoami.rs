use crate::auth;
use crate::config::Config;
use crate::registry::Registry;
use anyhow::Result;

pub fn run(cfg: &Config) -> Result<()> {
    let token = auth::load_token(&cfg.registry)?;
    let reg = Registry::new(&cfg.registry, Some(token))?;
    let me = reg.me()?;
    println!("@{} ({}; role: {})", me.login, me.id, me.role);
    if let Some(email) = me.email {
        println!("email: {email}");
    }
    Ok(())
}
