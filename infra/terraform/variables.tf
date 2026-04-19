variable "cloudflare_account_id" {
  type        = string
  description = "Cloudflare account that owns the zone + R2 bucket."
}

variable "zone_name" {
  type        = string
  default     = "pasmello.dev"
  description = "Root zone. The SaaS repo owns this record; we only read the zone_id."
}

variable "r2_bucket_name" {
  type        = string
  default     = "mello-packages"
  description = "R2 bucket that stores content-addressable package zips."
}

variable "pages_project_name" {
  type        = string
  default     = "market-pasmello-dev"
  description = "Cloudflare Pages project that hosts apps/web."
}

variable "fly_app_name" {
  type        = string
  default     = "mello-api"
}

variable "fly_region" {
  type        = string
  default     = "iad"
}
