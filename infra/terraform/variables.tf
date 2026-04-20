variable "cloudflare_account_id" {
  type        = string
  description = "Cloudflare account that owns the zone + R2 bucket."
}

variable "zone_name" {
  type        = string
  default     = "pasmello.com"
  description = "Root zone. The SaaS repo owns this record; we only read the zone_id."
}

variable "r2_bucket_name" {
  type        = string
  default     = "mello-packages-prod"
  description = "R2 bucket that stores content-addressable package zips."
}

variable "pages_project_name" {
  type        = string
  default     = "market-pasmello-com"
  description = "Cloudflare Pages project that hosts apps/web."
}

variable "get_pages_project_name" {
  type        = string
  default     = "get-pasmello-com"
  description = "Cloudflare Pages project that serves the CLI install script at get.pasmello.com."
}

variable "fly_app_name" {
  type        = string
  default     = "mello-api"
}

variable "fly_org" {
  type        = string
  default     = "pasmello"
}

variable "fly_region" {
  type        = string
  default     = "nrt"
  description = "Fly.io region. Tokyo by default — closest to the primary user base."
}

variable "fly_spending_cap_usd" {
  type        = number
  default     = 25
  description = "Hard monthly spending cap for the Fly.io app (day-1 guardrail)."
}

variable "analytics_dataset" {
  type        = string
  default     = "mello_downloads"
  description = "Cloudflare Analytics Engine dataset name for download events."
}
