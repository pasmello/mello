resource "fly_app" "api" {
  name = var.fly_app_name
  org  = var.fly_org
}

# Fly does not (yet) support declarative regions or machine sizing in the
# current Terraform provider; `flyctl deploy --region nrt` and the in-repo
# fly.toml handle region + VM spec. This resource just reserves the app name.
#
# Spending cap ($25/mo) is set in the Fly.io dashboard after apply —
# Organizations → Billing → Spending Limits. The Terraform provider does not
# expose this knob.
#
# Secrets are set out-of-band via `fly secrets set` so the state file stays
# free of credentials. Required secrets:
#   DATABASE_URL                    — Neon Postgres connection string
#   S3_ENDPOINT                     — R2 S3 endpoint (https://<account>.r2.cloudflarestorage.com)
#   S3_BUCKET                       — mello-packages-prod
#   S3_ACCESS_KEY_ID                — R2 access key
#   S3_SECRET_ACCESS_KEY            — R2 secret
#   CDN_BASE_URL                    — https://cdn.pasmello.com/packages
#   GITHUB_CLIENT_ID
#   GITHUB_CLIENT_SECRET
#   GITHUB_OAUTH_CALLBACK_URL       — https://registry.pasmello.com/auth/github/callback
#   WEB_ORIGIN                      — https://market.pasmello.com
#   ADMIN_LOGINS                    — comma-separated GitHub logins (lowercased)
#   SENTRY_DSN                      — optional; enables error tracking
