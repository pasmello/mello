resource "fly_app" "api" {
  name = var.fly_app_name
}

# Secrets are set out-of-band via `fly secrets set`; Terraform does not
# manage the secret values so the state file stays free of credentials.
# Required secrets:
#   DATABASE_URL          — Neon Postgres connection string
#   S3_ENDPOINT           — R2 S3 endpoint (https://<account>.r2.cloudflarestorage.com)
#   S3_BUCKET             — mello-packages
#   S3_ACCESS_KEY_ID      — R2 access key
#   S3_SECRET_ACCESS_KEY  — R2 secret
#   CDN_BASE_URL          — https://cdn.pasmello.dev/mello-packages
#   GITHUB_CLIENT_ID
#   GITHUB_CLIENT_SECRET
#   ADMIN_LOGINS          — comma-separated GitHub logins
