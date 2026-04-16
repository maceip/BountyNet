output "fqdn" {
  description = "FQDN managed in DigitalOcean DNS."
  value       = local.host_label == "@" ? var.domain_name : "${local.host_label}.${var.domain_name}"
}

output "edge_records" {
  description = "DigitalOcean DNS records for regional edge origins."
  value = {
    for lane, record in digitalocean_record.do_edges : lane => {
      id    = record.id
      type  = record.type
      name  = record.name
      value = record.value
      ttl   = record.ttl
    }
  }
}

output "aws_anycast_alias_enabled" {
  description = "Whether optional AWS anycast alias record is enabled."
  value       = length(digitalocean_record.aws_anycast_alias) > 0
}

output "primary_global_lb_enabled" {
  description = "Whether primary global LB DNS origin record exists."
  value       = length(digitalocean_record.primary_global_lb) > 0
}

output "backup_global_lb_enabled" {
  description = "Whether backup global LB DNS record exists."
  value       = length(digitalocean_record.backup_global_lb) > 0
}
