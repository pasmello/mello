output "pages_project_name" {
  value = cloudflare_pages_project.web.name
}

output "r2_bucket_name" {
  value = cloudflare_r2_bucket.packages.name
}

output "fly_app_name" {
  value = fly_app.api.name
}
