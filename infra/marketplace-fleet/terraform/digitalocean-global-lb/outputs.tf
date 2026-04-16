output "primary_lb_ip" {
  description = "Primary ingress LB public IPv4."
  value       = digitalocean_loadbalancer.primary.ip
}

output "backup_lb_ip" {
  description = "Backup ingress LB public IPv4."
  value       = digitalocean_loadbalancer.backup.ip
}

output "primary_lb_urn" {
  description = "Primary LB URN."
  value       = digitalocean_loadbalancer.primary.urn
}

output "backup_lb_urn" {
  description = "Backup LB URN."
  value       = digitalocean_loadbalancer.backup.urn
}

