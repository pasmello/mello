terraform {
  required_version = ">= 1.9"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.45"
    }
    fly = {
      source  = "fly-apps/fly"
      version = "~> 0.0"
    }
  }
}
