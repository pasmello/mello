# Infrastructure bootstrap

This is the first-time-only setup that has to happen before `terraform apply`
can run. All of it involves real accounts + real money, so it's deliberately
not scripted into CI.

## Prerequisites

- `pasmello.com` domain ownership (Cloudflare Registrar or any registrar with CF nameservers)
- `terraform` ≥ 1.9
- `wrangler` (included in `@mello/web` + `@mello/cdn-analytics-worker` devDeps)
- `flyctl`
- `gh` (optional — for CI secrets)

## 1. Cloudflare account + zone

1. Sign up at cloudflare.com → create an account
2. Dashboard → **Add a site** → `pasmello.com` → follow the NS change instructions
3. Dashboard → **My Profile** → API Tokens → Create Token with:
   - Zone:Edit (for `pasmello.com`)
   - Pages:Edit
   - Workers:Edit
   - Account → Read
4. Export the token + your account id:

   ```bash
   export CLOUDFLARE_API_TOKEN=<paste>
   export CLOUDFLARE_ACCOUNT_ID=<from-dashboard>
   ```

## 2. R2 bucket (state + packages)

R2 is where (a) packages live and (b) Terraform state lives.

```bash
pnpm dlx wrangler r2 bucket create mello-tf-state
pnpm dlx wrangler r2 bucket create mello-packages-prod
```

Generate an R2 API token (Dashboard → R2 → Manage R2 API Tokens → **Admin Read & Write**).
Save the access key + secret + the S3 endpoint
(`https://<ACCOUNT_ID>.r2.cloudflarestorage.com`).

## 3. Terraform backend config

Create `infra/terraform/backend.hcl` (not committed):

```hcl
bucket                      = "mello-tf-state"
key                         = "prod.tfstate"
endpoints                   = { s3 = "https://<ACCOUNT_ID>.r2.cloudflarestorage.com" }
region                      = "auto"
access_key                  = "<r2-access-key>"
secret_key                  = "<r2-secret>"
skip_credentials_validation = true
skip_metadata_api_check     = true
skip_region_validation      = true
skip_requesting_account_id  = true
use_path_style              = true
```

Then init with it:

```bash
cd infra/terraform
terraform init -backend-config=backend.hcl
```

## 4. Fly.io

```bash
flyctl auth signup       # or `auth login` if you already have an account
flyctl orgs create pasmello
export FLY_API_TOKEN=$(flyctl auth token)
```

Spending cap: **Dashboard → Organization → Billing → Spending Limits → $25/mo**.
The Terraform provider doesn't expose this knob.

## 5. Neon

1. neon.tech → sign in with GitHub → **New project** `mello` in `AWS ap-northeast-1` (Tokyo)
2. Create two connection strings:
   - **Pooled** (`-pooler` in hostname) → `DATABASE_URL` for the API
   - **Direct** → `DATABASE_URL_MIGRATIONS` for CI
3. Free tier auto-suspend: already on.

## 6. GitHub OAuth app

1. github.com/settings/developers → **OAuth Apps** → New OAuth App
2. Homepage: `https://market.pasmello.com`
3. Callback: `https://registry.pasmello.com/auth/github/callback`
4. ☑ Enable Device Flow
5. Save `GITHUB_CLIENT_ID` + generate `GITHUB_CLIENT_SECRET`

## 7. tfvars + first apply

```bash
cd infra/terraform
cp env/prod.tfvars.example env/prod.tfvars
# fill in cloudflare_account_id + fly_org
terraform plan  -var-file=env/prod.tfvars
terraform apply -var-file=env/prod.tfvars
```

This creates: DNS records (`registry`, `market`, `cdn`, `get`), R2 bucket
`mello-packages-prod`, two CF Pages projects, edge rate-limit rules, Fly app
reservation.

## 8. Fly secrets + first deploy

```bash
cd apps/api
flyctl secrets set \
  DATABASE_URL=<neon-pooled> \
  S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com \
  S3_BUCKET=mello-packages-prod \
  S3_ACCESS_KEY_ID=<r2-access> S3_SECRET_ACCESS_KEY=<r2-secret> \
  CDN_BASE_URL=https://cdn.pasmello.com \
  GITHUB_CLIENT_ID=<id> GITHUB_CLIENT_SECRET=<secret> \
  GITHUB_OAUTH_CALLBACK_URL=https://registry.pasmello.com/auth/github/callback \
  WEB_ORIGIN=https://market.pasmello.com \
  ADMIN_LOGINS=<your-github-login>
flyctl deploy --remote-only
flyctl certs add registry.pasmello.com
```

Wait ~5 minutes for the TLS cert to issue, then:

```bash
curl https://registry.pasmello.com/healthz
# → {"ok":true}
```

## 9. DB migration

```bash
cd apps/api
DATABASE_URL=<neon-direct> pnpm migrate
```

## 10. CDN Worker

```bash
cd infra/workers/cdn-analytics
pnpm dlx wrangler deploy
```

This provisions the Analytics Engine dataset `mello_downloads` and binds
the Worker to `cdn.pasmello.com`.

## 11. Web + get.pasmello.com

```bash
cd apps/web
PUBLIC_API_URL=https://registry.pasmello.com \
PUBLIC_PASMELLO_ORIGIN=https://pasmello.com \
pnpm build

pnpm dlx wrangler pages deploy build --project-name=market-pasmello-com --branch=main
pnpm dlx wrangler pages deploy build --project-name=get-pasmello-com     --branch=main
```

## 12. GitHub Actions secrets

```bash
# From the repo root
gh secret set FLY_API_TOKEN               --body "$FLY_API_TOKEN"
gh secret set DATABASE_URL_MIGRATIONS     --body "<neon-direct>"
gh secret set CLOUDFLARE_API_TOKEN        --body "$CLOUDFLARE_API_TOKEN"
gh secret set CLOUDFLARE_ACCOUNT_ID       --body "$CLOUDFLARE_ACCOUNT_ID"
gh secret set CF_ANALYTICS_READ_TOKEN     --body "<read-only-analytics-token>"
```

From here, pushes to `main` auto-deploy via `.github/workflows/deploy-api.yml`
and `.github/workflows/deploy-web.yml`.

## 13. First CLI release

```bash
git tag v0.1.0 && git push --tags
```

`release-cli.yml` cross-builds five binaries and uploads them to a GitHub
Release along with `manifest.sha256`. `get.pasmello.com/install.sh` picks them
up automatically (unversioned — always the latest release).

## 14. Billing alerts (dashboards)

- **Cloudflare** — Notifications → Billing → thresholds $20 / $50 / $100
- **Fly.io** — Organization → Billing → already capped at $25 in step 4
- **Neon** — free tier auto-suspends; no alert needed

## Smoke test end-to-end

```bash
# Anonymous
curl https://registry.pasmello.com/healthz
curl https://market.pasmello.com
curl https://get.pasmello.com/install.sh | head

# Authenticated
curl -fsSL https://get.pasmello.com | sh
mello login                           # browser pops, short code flow
mello whoami                          # → @<your-login>
mello init --type tool --name hello
# edit tool.manifest.json + write a tiny dist/index.html
mello validate
mello publish --yes
```

If that final publish returns `{ok: true, downloadUrl: ...}` — you're live.
