locals {
  effective_primary_global_lb_ip  = var.provision_do_global_lbs ? module.digitalocean_global_lb[0].primary_lb_ip : var.primary_global_lb_ip
  effective_backup_global_lb_ip   = var.provision_do_global_lbs ? module.digitalocean_global_lb[0].backup_lb_ip : var.backup_global_lb_ip
  effective_aws_ga_dns            = var.enable_aws_global_accelerator ? module.aws_global_accelerator[0].global_accelerator_dns_name : var.aws_global_accelerator_dns
  create_primary_global_lb_record = var.provision_do_global_lbs || trimspace(var.primary_global_lb_ip) != ""
  create_backup_global_lb_record  = var.provision_do_global_lbs || trimspace(var.backup_global_lb_ip) != ""
  create_aws_anycast_alias        = var.include_aws_anycast_alias && (var.enable_aws_global_accelerator || trimspace(var.aws_global_accelerator_dns) != "")
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
  litellm_master_key              = var.litellm_master_key
  litellm_salt_key                = var.litellm_salt_key
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

module "aws_inf2_serving" {
  count  = var.provision_aws_inf2_serving ? 1 : 0
  source = "./aws-inf2-serving"
  providers = {
    aws = aws.inf2
  }

  project                  = var.project
  vpc_id                   = var.aws_inf2_vpc_id
  subnet_id                = var.aws_inf2_subnet_id
  instance_type            = var.aws_inf2_instance_type
  ami_id                   = var.aws_inf2_ami_id
  ssh_key_name             = var.aws_inf2_ssh_key_name
  inference_port           = var.aws_inf2_inference_port
  model_id                 = var.aws_inf2_model_id
  served_model_name        = var.aws_inf2_served_model_name
  runtime_image            = var.aws_inf2_runtime_image
  api_key                  = var.aws_inf2_api_key != "" ? var.aws_inf2_api_key : "replace-with-strong-key"
  adapter_bucket           = var.aws_inf2_adapter_bucket
  adapter_default_revision = var.aws_inf2_adapter_default_revision
  agent_id_header          = var.aws_inf2_agent_id_header
  ssh_cidrs                = var.aws_inf2_ssh_cidrs
  inference_cidrs          = var.aws_inf2_inference_cidrs
  root_volume_gb           = var.aws_inf2_root_volume_gb
}

module "aws_c8g_llamacpp" {
  count  = var.provision_aws_c8g_cpu_worker ? 1 : 0
  source = "./aws-c8g-llamacpp"
  providers = {
    aws = aws.c8g
  }

  project           = var.project
  vpc_id            = var.aws_c8g_vpc_id
  subnet_id         = var.aws_c8g_subnet_id
  instance_type     = var.aws_c8g_instance_type
  ami_id            = var.aws_c8g_ami_id
  ssh_key_name      = var.aws_c8g_ssh_key_name
  inference_port    = var.aws_c8g_inference_port
  gguf_model_uri    = var.aws_c8g_gguf_model_uri
  served_model_name = var.aws_c8g_served_model_name
  api_key           = var.aws_c8g_api_key != "" ? var.aws_c8g_api_key : "replace-with-strong-key"
  llamacpp_image    = var.aws_c8g_llamacpp_image
  context_size      = var.aws_c8g_context_size
  threads           = var.aws_c8g_threads
  ssh_cidrs         = var.aws_c8g_ssh_cidrs
  inference_cidrs   = var.aws_c8g_inference_cidrs
  root_volume_gb    = var.aws_c8g_root_volume_gb
}

module "digitalocean_global_dns" {
  source = "./digitalocean-global-dns"

  project                         = var.project
  domain_name                     = var.domain_name
  hostname                        = var.hostname
  record_ttl                      = var.record_ttl
  do_edge_origins                 = length(var.do_edge_origins) > 0 ? var.do_edge_origins : (var.provision_do_regional_lbs ? module.digitalocean_regional_lbs[0].regional_lb_ips : {})
  create_primary_global_lb_record = local.create_primary_global_lb_record
  create_backup_global_lb_record  = local.create_backup_global_lb_record
  primary_global_lb_ip            = local.effective_primary_global_lb_ip
  backup_global_lb_ip             = local.effective_backup_global_lb_ip
  backup_hostname                 = var.backup_hostname
  create_aws_anycast_alias        = local.create_aws_anycast_alias
  aws_global_accelerator_dns      = local.effective_aws_ga_dns
}
