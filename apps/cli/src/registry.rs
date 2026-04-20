use crate::errors::MelloError;
use anyhow::{Context, Result};
use reqwest::blocking::{multipart, Client};
use reqwest::StatusCode;
use serde::{Deserialize, Serialize};

const USER_AGENT: &str = concat!("mello-cli/", env!("CARGO_PKG_VERSION"));

pub struct Registry {
    pub base_url: String,
    client: Client,
    token: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct DeviceCodeResponse {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub interval: u64,
    pub expires_in: u64,
}

#[derive(Debug, Deserialize)]
pub struct DeviceTokenResponse {
    pub token: String,
    pub login: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MeResponse {
    pub id: String,
    pub login: String,
    pub email: Option<String>,
    pub role: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishResponse {
    pub package_id: String,
    pub version_id: String,
    pub r#type: String,
    pub scope: String,
    pub name: String,
    pub version: String,
    pub sha256: String,
    pub size_bytes: u64,
    pub download_url: String,
}

#[derive(Debug, Deserialize)]
struct ApiError {
    error: Option<String>,
    detail: Option<String>,
}

impl Registry {
    pub fn new(base_url: impl Into<String>, token: Option<String>) -> Result<Self> {
        let client = Client::builder()
            .user_agent(USER_AGENT)
            .build()
            .context("build http client")?;
        Ok(Self {
            base_url: base_url.into().trim_end_matches('/').to_string(),
            client,
            token,
        })
    }

    fn auth(&self, req: reqwest::blocking::RequestBuilder) -> reqwest::blocking::RequestBuilder {
        match &self.token {
            Some(t) => req.bearer_auth(t),
            None => req,
        }
    }

    fn url(&self, path: &str) -> String {
        format!("{}{}", self.base_url, path)
    }

    fn ok<T: for<'de> Deserialize<'de>>(res: reqwest::blocking::Response) -> Result<T> {
        let status = res.status();
        if status.is_success() {
            return Ok(res.json::<T>()?);
        }
        let err = res.json::<ApiError>().unwrap_or(ApiError {
            error: Some("unknown".into()),
            detail: Some(format!("HTTP {status}")),
        });
        Err(MelloError::Api {
            status: status.as_u16(),
            code: err.error.unwrap_or_else(|| "unknown".into()),
            detail: err.detail.unwrap_or_else(|| format!("HTTP {status}")),
        }
        .into())
    }

    pub fn device_code(&self) -> Result<DeviceCodeResponse> {
        let res = self.client.post(self.url("/auth/device/code")).send()?;
        Self::ok(res)
    }

    /// Returns Ok(Some(resp)) on success, Ok(None) if still pending, or Err for hard failures.
    pub fn device_token_poll(
        &self,
        device_code: &str,
        name: &str,
    ) -> Result<Option<DeviceTokenResponse>> {
        #[derive(Serialize)]
        struct Body<'a> {
            device_code: &'a str,
            name: &'a str,
        }
        let res = self
            .client
            .post(self.url("/auth/device/token"))
            .json(&Body { device_code, name })
            .send()?;
        let status = res.status();
        if status.is_success() {
            return Ok(Some(res.json::<DeviceTokenResponse>()?));
        }
        if status == StatusCode::PRECONDITION_REQUIRED || status == StatusCode::TOO_MANY_REQUESTS {
            // pending / slow_down
            return Ok(None);
        }
        let err = res.json::<ApiError>().unwrap_or(ApiError {
            error: Some("unknown".into()),
            detail: Some(format!("HTTP {status}")),
        });
        Err(MelloError::Api {
            status: status.as_u16(),
            code: err.error.unwrap_or_else(|| "unknown".into()),
            detail: err.detail.unwrap_or_else(|| format!("HTTP {status}")),
        }
        .into())
    }

    pub fn me(&self) -> Result<MeResponse> {
        let res = self.auth(self.client.get(self.url("/v1/me"))).send()?;
        Self::ok(res)
    }

    pub fn publish_zip(&self, zip_bytes: Vec<u8>) -> Result<PublishResponse> {
        let part = multipart::Part::bytes(zip_bytes)
            .file_name("package.zip")
            .mime_str("application/zip")?;
        let form = multipart::Form::new().part("zip", part);
        let res = self
            .auth(self.client.post(self.url("/v1/publish")))
            .multipart(form)
            .send()?;
        Self::ok(res)
    }

    pub fn yank(
        &self,
        r#type: &str,
        scope: &str,
        name: &str,
        version: &str,
        reason: Option<&str>,
    ) -> Result<()> {
        #[derive(Serialize)]
        struct Body<'a> {
            reason: Option<&'a str>,
        }
        let path = format!("/v1/packages/{type}/{scope}/{name}/yank/{version}");
        let res = self
            .auth(self.client.post(self.url(&path)))
            .json(&Body { reason })
            .send()?;
        self.expect_ok(res)
    }

    pub fn list_owners(&self, r#type: &str, scope: &str, name: &str) -> Result<Vec<OwnerEntry>> {
        #[derive(Deserialize)]
        struct Envelope {
            owners: Vec<OwnerEntry>,
        }
        let path = format!("/v1/packages/{type}/{scope}/{name}/owners");
        let res = self.auth(self.client.get(self.url(&path))).send()?;
        let env = Self::ok::<Envelope>(res)?;
        Ok(env.owners)
    }

    pub fn add_owner(&self, r#type: &str, scope: &str, name: &str, login: &str) -> Result<()> {
        #[derive(Serialize)]
        struct Body<'a> {
            login: &'a str,
        }
        let path = format!("/v1/packages/{type}/{scope}/{name}/owners");
        let res = self
            .auth(self.client.post(self.url(&path)))
            .json(&Body { login })
            .send()?;
        self.expect_ok(res)
    }

    pub fn remove_owner(&self, r#type: &str, scope: &str, name: &str, login: &str) -> Result<()> {
        let path = format!("/v1/packages/{type}/{scope}/{name}/owners/{login}");
        let res = self.auth(self.client.delete(self.url(&path))).send()?;
        self.expect_ok(res)
    }

    fn expect_ok(&self, res: reqwest::blocking::Response) -> Result<()> {
        let status = res.status();
        if status.is_success() {
            return Ok(());
        }
        let err = res.json::<ApiError>().unwrap_or(ApiError {
            error: Some("unknown".into()),
            detail: Some(format!("HTTP {status}")),
        });
        Err(MelloError::Api {
            status: status.as_u16(),
            code: err.error.unwrap_or_else(|| "unknown".into()),
            detail: err.detail.unwrap_or_else(|| format!("HTTP {status}")),
        }
        .into())
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OwnerEntry {
    pub login: Option<String>,
    pub role: String,
    pub added_at: Option<String>,
}
