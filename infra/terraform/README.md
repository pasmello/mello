# Terraform

Provisions Cloudflare + Fly.io resources for mello.

## Files

- `versions.tf` — provider version pins
- `providers.tf` — provider configuration (reads creds from env)
- `cloudflare.tf` — zone, R2 bucket, Pages project, edge rate limits
- `fly.tf` — Fly.io app (API)
- `variables.tf` — input variables
- `outputs.tf` — emitted URLs/keys for use in GitHub Actions

## Usage

```bash
# One-time
terraform init

# Plan + apply
terraform plan  -var-file=env/prod.tfvars
terraform apply -var-file=env/prod.tfvars
```

Credentials come from env:

- `CLOUDFLARE_API_TOKEN`
- `FLY_API_TOKEN`

## State

State lives in a Cloudflare R2 bucket via the S3-compatible backend. See
[`../../docs/bootstrap.md`](../../docs/bootstrap.md) for first-time setup
(bucket creation + `backend.hcl`).

## Out of scope

- DNS for `pasmello.com` itself (owned by the `pasmello-saas` repo)
- Neon / Sentry / UptimeRobot configuration (managed via their own UIs)
