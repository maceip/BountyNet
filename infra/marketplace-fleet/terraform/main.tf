locals {
  effective_primary_global_lb_ip = var.provision_do_global_lbs ? module.digitalocean_global_lb[0].primary_lb_ip : var.primary_global_lb_ip
  effective_backup_global_lb_ip  = var.provision_do_global_lbs ? module.digitalocean_global_lb[0].backup_lb_ip : var.backup_global_lb_ip
  effective_aws_ga_dns           = var.enable_aws_global_accelerator ? module.aws_global_accelerator[0].global_accelerator_dns_name : var.aws_global_accelerator_dns
}

module "digitalocean_regional_lbs" {
  count  = var.provision_do_regional_lbs ? 1 : 0
  source = "./digitalocean-regional-lbs"

  project                         = var.project
  droplet_size                    = var.droplet_size
  droplet_image                   = var.droplet_image
  vpc_uuid                        = var.vpc_uuid
  ssh_key_fingerprints            = var.ssh_key_fingerprints
  gateway_docker_image            = var.gateway_docker_image
  gateway_container_port          = var.gateway_container_port
  entry_port                      = var.entry_port
  model_api_region                = var.model_api_region
  enable_managed_secret_bootstrap = var.enable_managed_secret_bootstrap
  aws_secrets_region              = var.aws_secrets_region
  aws_kms_key_arn                 = var.aws_kms_key_arn
  secret_parameter_names          = var.secret_parameter_names
  regional_plan                   = var.regional_plan
  service_port                    = var.service_port
}

module "digitalocean_global_lb" {
  count  = var.provision_do_global_lbs ? 1 : 0
  source = "./digitalocean-global-lb"

  project             = var.project
  primary_region      = var.primary_region
  backup_region       = var.backup_region
  primary_droplet_tag = var.primary_droplet_tag
  backup_droplet_tag  = var.backup_droplet_tag
  entry_port          = var.entry_port
  target_port         = var.target_port
  healthcheck_port    = var.healthcheck_port
}

module "aws_global_accelerator" {
  count  = var.enable_aws_global_accelerator ? 1 : 0
  source = "./aws-global-accelerator"

  project         = var.project
  listener_port   = var.listener_port
  endpoint_port   = var.endpoint_port
  endpoint_groups = var.endpoint_groups
}

module "digitalocean_global_dns" {
  source = "./digitalocean-global-dns"

  project                    = var.project
  domain_name                = var.domain_name
  hostname                   = var.hostname
  record_ttl                 = var.record_ttl
  do_edge_origins            = length(var.do_edge_origins) > 0 ? var.do_edge_origins : (var.provision_do_regional_lbs ? module.digitalocean_regional_lbs[0].regional_lb_ips : {})
  primary_global_lb_ip       = local.effective_primary_global_lb_ip
  backup_global_lb_ip        = local.effective_backup_global_lb_ip
  backup_hostname            = var.backup_hostname
  include_aws_anycast_alias  = var.include_aws_anycast_alias
  aws_global_accelerator_dns = local.effective_aws_ga_dns
}
