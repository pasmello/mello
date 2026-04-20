use thiserror::Error;

#[derive(Debug, Error)]
pub enum MelloError {
    #[error("not logged in — run `mello login`")]
    NotLoggedIn,

    #[error("API returned {status}: {code} — {detail}")]
    Api {
        status: u16,
        code: String,
        detail: String,
    },
}
