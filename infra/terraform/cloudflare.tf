data "cloudflare_zone" "pasmello" {
  name = var.zone_name
}

# R2 bucket for content-addressable package zips. Public reads go through
# cdn.pasmello.com via the CF Worker in infra/workers/cdn-analytics.
resource "cloudflare_r2_bucket" "packages" {
  account_id = var.cloudflare_account_id
  name       = var.r2_bucket_name
}

resource "cloudflare_pages_project" "web" {
  account_id        = var.cloudflare_account_id
  name              = var.pages_project_name
  production_branch = "main"

  build_config {
    build_command   = "pnpm --filter @mello/web run build"
    destination_dir = "apps/web/build"
    root_dir        = "/"
  }

  deployment_configs {
    production {
      environment_variables = {
        PUBLIC_API_URL         = "https://registry.${var.zone_name}"
        PUBLIC_PASMELLO_ORIGIN = "https://${var.zone_name}"
      }
    }
  }
}

# get.pasmello.com serves the install.sh script (and future binary manifest).
# Same SvelteKit build — CF Pages serves everything in apps/web/static at the
# root, so install.sh is already reachable at /<asset>.
resource "cloudflare_pages_project" "get" {
  account_id        = var.cloudflare_account_id
  name              = var.get_pages_project_name
  production_branch = "main"

  build_config {
    build_command   = "pnpm --filter @mello/web run build"
    destination_dir = "apps/web/build"
    root_dir        = "/"
  }
}

# --- DNS ---

resource "cloudflare_record" "market" {
  zone_id = data.cloudflare_zone.pasmello.id
  name    = "market"
  type    = "CNAME"
  value   = "${cloudflare_pages_project.web.name}.pages.dev"
  proxied = true
}

resource "cloudflare_record" "get" {
  zone_id = data.cloudflare_zone.pasmello.id
  name    = "get"
  type    = "CNAME"
  value   = "${cloudflare_pages_project.get.name}.pages.dev"
  proxied = true
}

# cdn.pasmello.com is routed through the CF Worker which binds the R2 bucket.
# The route is declared in infra/workers/cdn-analytics/wrangler.toml; we add
# the DNS record here so the zone entry is versioned in code.
resource "cloudflare_record" "cdn" {
  zone_id = data.cloudflare_zone.pasmello.id
  name    = "cdn"
  type    = "AAAA"
  # 100:: placeholder — CF Workers routes replace this once the worker is deployed
  # via `wrangler deploy`. The worker owns the actual content. Proxied=true is required.
  value   = "100::"
  proxied = true
}

# registry.pasmello.com is a CNAME to the Fly.io app. Fly manages the TLS cert
# via `flyctl certs add registry.pasmello.com` after DNS is in place.
resource "cloudflare_record" "registry" {
  zone_id = data.cloudflare_zone.pasmello.id
  name    = "registry"
  type    = "CNAME"
  value   = "${var.fly_app_name}.fly.dev"
  proxied = false
}

# --- Edge rate limits ---

resource "cloudflare_rate_limit" "anon" {
  zone_id   = data.cloudflare_zone.pasmello.id
  threshold = 60
  period    = 60
  match {
    request {
      url_pattern = "registry.${var.zone_name}/v1/*"
      methods     = ["_ALL_"]
    }
  }
  action {
    mode    = "simulate"
    timeout = 60
  }
  description = "Anonymous API ceiling — 60 req/min/IP"
}

resource "cloudflare_rate_limit" "publish" {
  zone_id   = data.cloudflare_zone.pasmello.id
  threshold = 10
  period    = 3600
  match {
    request {
      url_pattern = "registry.${var.zone_name}/v1/publish*"
      methods     = ["POST"]
    }
  }
  action {
    mode    = "simulate"
    timeout = 3600
  }
  description = "Publish ceiling — 10/hour/IP (server-side per-token limit also applies)"
}

# --- Billing alerts ---
# Configure billing notifications in the Cloudflare dashboard after apply —
# Notifications → Billing → thresholds at $20 / $50 / $100. The CF Terraform
# provider's coverage of billing notifications is thin, so we handle this
# step out-of-band rather than risk a broken apply.
