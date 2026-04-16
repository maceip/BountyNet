locals {
  host_label = trimspace(var.hostname) == "" ? "@" : trimspace(var.hostname)
}

resource "digitalocean_record" "do_edges" {
  for_each = var.do_edge_origins

  domain = var.domain_name
  type   = "A"
  name   = local.host_label
  value  = each.value
  ttl    = var.record_ttl
}

resource "digitalocean_record" "primary_global_lb" {
  count = trimspace(var.primary_global_lb_ip) != "" ? 1 : 0

  domain = var.domain_name
  type   = "A"
  name   = local.host_label
  value  = trimspace(var.primary_global_lb_ip)
  ttl    = var.record_ttl
}

resource "digitalocean_record" "backup_global_lb" {
  count = trimspace(var.backup_global_lb_ip) != "" ? 1 : 0

  domain = var.domain_name
  type   = "A"
  name   = trimspace(var.backup_hostname)
  value  = trimspace(var.backup_global_lb_ip)
  ttl    = var.record_ttl
}

resource "digitalocean_record" "aws_anycast_alias" {
  count = var.include_aws_anycast_alias && trimspace(var.aws_global_accelerator_dns) != "" ? 1 : 0

  domain = var.domain_name
  type   = "CNAME"
  name   = local.host_label
  value  = var.aws_global_accelerator_dns
  ttl    = var.record_ttl
}
