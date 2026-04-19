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

output "aws_inf2_serving" {
  description = "Inferentia serving lane runtime endpoint details."
  value = var.provision_aws_inf2_serving ? {
    instance_id         = module.aws_inf2_serving[0].instance_id
    public_ip           = module.aws_inf2_serving[0].public_ip
    private_ip          = module.aws_inf2_serving[0].private_ip
    inference_base_url  = module.aws_inf2_serving[0].inference_base_url
    adapter_resolve_url = module.aws_inf2_serving[0].adapter_resolve_url
    security_group_id   = module.aws_inf2_serving[0].security_group_id
  } : null
}

output "aws_c8g_cpu_worker" {
  description = "Graviton llama.cpp lane runtime endpoint details."
  value = var.provision_aws_c8g_cpu_worker ? {
    instance_id        = module.aws_c8g_llamacpp[0].instance_id
    public_ip          = module.aws_c8g_llamacpp[0].public_ip
    private_ip         = module.aws_c8g_llamacpp[0].private_ip
    inference_base_url = module.aws_c8g_llamacpp[0].inference_base_url
    security_group_id  = module.aws_c8g_llamacpp[0].security_group_id
  } : null
}
