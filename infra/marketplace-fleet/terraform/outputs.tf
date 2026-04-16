output "regional_lb_ips" {
  description = "Regional DigitalOcean load balancer IPs keyed by lane."
  value       = var.provision_do_regional_lbs ? module.digitalocean_regional_lbs[0].regional_lb_ips : {}
}

output "edge_droplets" {
  description = "DigitalOcean edge droplets keyed by lane and index."
  value       = var.provision_do_regional_lbs ? module.digitalocean_regional_lbs[0].edge_droplets : {}
}

output "primary_lb_ip" {
  description = "Primary DigitalOcean global LB IP."
  value       = local.effective_primary_global_lb_ip
}

output "backup_lb_ip" {
  description = "Backup DigitalOcean global LB IP."
  value       = local.effective_backup_global_lb_ip
}

output "fqdn" {
  description = "FQDN managed in DigitalOcean DNS."
  value       = module.digitalocean_global_dns.fqdn
}

output "aws_global_accelerator_dns_name" {
  description = "AWS Global Accelerator DNS name when enabled."
  value       = local.effective_aws_ga_dns
}
