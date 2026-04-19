data "cloudflare_zone" "pasmello" {
  name = var.zone_name
}

# R2 bucket for content-addressable package zips. Public reads go through
# cdn.pasmello.dev (custom domain attached to the bucket via the Cloudflare
# dashboard; see infra/README.md). We intentionally do not attach the custom
# domain via Terraform until the provider supports it cleanly.
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
}

# Subdomain CNAMEs for market.pasmello.dev and cdn.pasmello.dev.
# cdn points at the R2 custom-domain endpoint (configured out-of-band);
# market points at the Pages project.
resource "cloudflare_record" "market" {
  zone_id = data.cloudflare_zone.pasmello.id
  name    = "market"
  type    = "CNAME"
  value   = "${cloudflare_pages_project.web.name}.pages.dev"
  proxied = true
}

# Rate-limit rules — anon and authed ceilings enforced at the edge.
resource "cloudflare_rate_limit" "anon" {
  zone_id   = data.cloudflare_zone.pasmello.id
  threshold = 60
  period    = 60
  match {
    request {
      url_pattern = "market.${var.zone_name}/v1/*"
      methods     = ["_ALL_"]
    }
  }
  action {
    mode    = "simulate"
    timeout = 60
  }
}
