variable "project" {
  description = "Project prefix for naming."
  type        = string
  default     = "bountynet-marketplace"
}

variable "aws_control_plane_region" {
  description = "AWS region used by the root provider (Global Accelerator resources are global)."
  type        = string
  default     = "eu-central-1"
}

variable "do_token" {
  description = "DigitalOcean API token for all DigitalOcean modules."
  type        = string
  sensitive   = true
  default     = ""
}

variable "provision_do_regional_lbs" {
  description = "When true, create the DigitalOcean regional edge droplets and load balancers."
  type        = bool
  default     = true
}

variable "provision_do_global_lbs" {
  description = "When true, create the primary and backup DigitalOcean global load balancers."
  type        = bool
  default     = true
}

variable "enable_aws_global_accelerator" {
  description = "When true, create the AWS Global Accelerator resources."
  type        = bool
  default     = false
}

variable "domain_name" {
  description = "DigitalOcean-managed domain name."
  type        = string
  default     = ""
}

variable "hostname" {
  description = "Host label within the managed domain."
  type        = string
  default     = "llm"
}

variable "record_ttl" {
  description = "TTL for DigitalOcean DNS records."
  type        = number
  default     = 30
}

variable "do_edge_origins" {
  description = "Optional explicit DigitalOcean edge origin IPs. Leave empty to use outputs from the regional LB module."
  type        = map(string)
  default     = {}
}

variable "primary_global_lb_ip" {
  description = "Optional explicit primary global LB IPv4 when the global LB module is disabled."
  type        = string
  default     = ""
}

variable "backup_global_lb_ip" {
  description = "Optional explicit backup global LB IPv4 when the global LB module is disabled."
  type        = string
  default     = ""
}

variable "backup_hostname" {
  description = "Backup host label used for explicit failover endpoint."
  type        = string
  default     = "llm-backup"
}

variable "include_aws_anycast_alias" {
  description = "Whether to publish a CNAME to AWS Global Accelerator."
  type        = bool
  default     = false
}

variable "aws_global_accelerator_dns" {
  description = "Optional explicit AWS Global Accelerator DNS name when the AWS module is disabled."
  type        = string
  default     = ""
}

variable "primary_region" {
  description = "Region for the primary global ingress LB."
  type        = string
  default     = "nyc3"
}

variable "backup_region" {
  description = "Region for the backup global ingress LB."
  type        = string
  default     = "sfo3"
}

variable "primary_droplet_tag" {
  description = "Droplet tag targeted by the primary global LB."
  type        = string
  default     = "bountynet-edge-na-east"
}

variable "backup_droplet_tag" {
  description = "Droplet tag targeted by the backup global LB."
  type        = string
  default     = "bountynet-edge-na-west"
}

variable "target_port" {
  description = "Target port for the DigitalOcean global LBs."
  type        = number
  default     = 4000
}

variable "healthcheck_port" {
  description = "Health check port for the DigitalOcean global LBs."
  type        = number
  default     = 4000
}

variable "droplet_size" {
  description = "Droplet size for edge gateway nodes."
  type        = string
  default     = "s-2vcpu-4gb"
}

variable "droplet_image" {
  description = "Droplet image slug."
  type        = string
  default     = "ubuntu-24-04-x64"
}

variable "vpc_uuid" {
  description = "Optional VPC UUID for droplets and load balancers."
  type        = string
  default     = ""
}

variable "ssh_key_fingerprints" {
  description = "SSH key fingerprints injected into droplets."
  type        = list(string)
  default     = []
}

variable "gateway_docker_image" {
  description = "Gateway image deployed on each droplet."
  type        = string
  default     = "ghcr.io/berriai/litellm:main-stable"
}

variable "gateway_container_port" {
  description = "Gateway container port exposed on each droplet."
  type        = number
  default     = 4000
}

variable "entry_port" {
  description = "Public ingress port."
  type        = number
  default     = 443
}

variable "service_port" {
  description = "Backend gateway service port used by regional load balancers."
  type        = number
  default     = 4000
}

variable "model_api_region" {
  description = "Primary model control-plane region used for supervisor and worker API calls."
  type        = string
  default     = "eu-central-1"
}

variable "enable_managed_secret_bootstrap" {
  description = "Optional post-boot secret sync from AWS SSM/KMS. Does not block droplet startup."
  type        = bool
  default     = false
}

variable "aws_secrets_region" {
  description = "AWS region containing SSM and KMS managed fallback provider secrets."
  type        = string
  default     = "eu-central-1"
}

variable "aws_kms_key_arn" {
  description = "KMS key ARN used for SecureString encryption metadata."
  type        = string
  default     = ""
}

variable "secret_parameter_names" {
  description = "SSM SecureString parameter names for optional provider-key sync."
  type = object({
    openai     = string
    anthropic  = string
    gemini     = string
    openrouter = string
  })
  default = {
    openai     = "/bountynet/market/edge/openai_api_key"
    anthropic  = "/bountynet/market/edge/anthropic_api_key"
    gemini     = "/bountynet/market/edge/gemini_api_key"
    openrouter = "/bountynet/market/edge/openrouter_api_key"
  }
}

variable "litellm_master_key" {
  description = "Optional LiteLLM master key used to protect admin/key APIs."
  type        = string
  default     = ""
  sensitive   = true
}

variable "litellm_salt_key" {
  description = "Optional LiteLLM salt key used for key hashing/encryption features."
  type        = string
  default     = ""
  sensitive   = true
}

variable "regional_plan" {
  description = "Droplet and traffic layout by geo region."
  type = map(object({
    region         = string
    droplet_count  = number
    droplet_tag    = string
    traffic_weight = number
  }))
  default = {
    na_west = {
      region         = "sfo3"
      droplet_count  = 2
      droplet_tag    = "bountynet-edge-na-west"
      traffic_weight = 20
    }
    na_east = {
      region         = "nyc3"
      droplet_count  = 2
      droplet_tag    = "bountynet-edge-na-east"
      traffic_weight = 20
    }
    eu = {
      region         = "fra1"
      droplet_count  = 3
      droplet_tag    = "bountynet-edge-eu"
      traffic_weight = 30
    }
    asia = {
      region         = "sgp1"
      droplet_count  = 2
      droplet_tag    = "bountynet-edge-asia"
      traffic_weight = 20
    }
    australia = {
      region         = "syd1"
      droplet_count  = 1
      droplet_tag    = "bountynet-edge-australia"
      traffic_weight = 10
    }
  }
}

variable "listener_port" {
  description = "Public listener port for Global Accelerator."
  type        = number
  default     = 443
}

variable "endpoint_port" {
  description = "Backend service port exposed by regional endpoints."
  type        = number
  default     = 8000
}

variable "endpoint_groups" {
  description = "Global Accelerator endpoint groups keyed by lane (default preference: Frankfurt -> Ireland -> London)."
  type = map(object({
    region                  = string
    nlb_arn                 = string
    traffic_dial_percentage = number
    weight                  = number
  }))
  default = {}
}

variable "provision_aws_inf2_serving" {
  description = "When true, provision AWS Inferentia serving host."
  type        = bool
  default     = false
}

variable "provision_aws_c8g_cpu_worker" {
  description = "When true, provision AWS Graviton llama.cpp worker host."
  type        = bool
  default     = false
}

variable "aws_inf2_region" {
  description = "AWS region for Inferentia serving lane."
  type        = string
  default     = "eu-central-1"
}

variable "aws_c8g_region" {
  description = "AWS region for Graviton CPU worker lane."
  type        = string
  default     = "eu-central-1"
}

variable "aws_inf2_vpc_id" {
  description = "Optional VPC id for Inferentia serving host."
  type        = string
  default     = ""
}

variable "aws_inf2_subnet_id" {
  description = "Optional subnet id for Inferentia serving host."
  type        = string
  default     = ""
}

variable "aws_inf2_instance_type" {
  description = "Inferentia instance type."
  type        = string
  default     = "inf2.xlarge"
}

variable "aws_inf2_ami_id" {
  description = "Optional AMI id for Inferentia serving host."
  type        = string
  default     = ""
}

variable "aws_inf2_ssh_key_name" {
  description = "Optional EC2 key pair for Inferentia host."
  type        = string
  default     = ""
}

variable "aws_inf2_inference_port" {
  description = "Public inference port for Inferentia host."
  type        = number
  default     = 8000
}

variable "aws_inf2_model_id" {
  description = "Base model id served by Inferentia lane."
  type        = string
  default     = "Qwen/Qwen3.6-35B-A3B"
}

variable "aws_inf2_served_model_name" {
  description = "OpenAI alias served by Inferentia lane."
  type        = string
  default     = "base-coder"
}

variable "aws_inf2_runtime_image" {
  description = "Serving container image for Inferentia lane (set to neuron-compatible image)."
  type        = string
  default     = "vllm/vllm-openai:latest"
}

variable "aws_inf2_api_key" {
  description = "API key required by Inferentia lane."
  type        = string
  sensitive   = true
  default     = ""
}

variable "aws_inf2_adapter_bucket" {
  description = "S3 URI prefix for published adapter artifacts."
  type        = string
  default     = "s3://marketplace-trajectories/adapters"
}

variable "aws_inf2_adapter_default_revision" {
  description = "Default adapter revision used when manifest is empty."
  type        = string
  default     = "latest"
}

variable "aws_inf2_agent_id_header" {
  description = "Header used for identity-aware adapter selection."
  type        = string
  default     = "X-Agent-ID"
}

variable "aws_inf2_ssh_cidrs" {
  description = "CIDRs allowed to SSH Inferentia host."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "aws_inf2_inference_cidrs" {
  description = "CIDRs allowed to call Inferentia inference endpoints."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "aws_inf2_root_volume_gb" {
  description = "Root volume size for Inferentia host."
  type        = number
  default     = 200
}

variable "aws_c8g_vpc_id" {
  description = "Optional VPC id for c8g worker host."
  type        = string
  default     = ""
}

variable "aws_c8g_subnet_id" {
  description = "Optional subnet id for c8g worker host."
  type        = string
  default     = ""
}

variable "aws_c8g_instance_type" {
  description = "Graviton instance type for cpu worker lane."
  type        = string
  default     = "c8g.xlarge"
}

variable "aws_c8g_ami_id" {
  description = "Optional AMI id for c8g worker host."
  type        = string
  default     = ""
}

variable "aws_c8g_ssh_key_name" {
  description = "Optional EC2 key pair for c8g host."
  type        = string
  default     = ""
}

variable "aws_c8g_inference_port" {
  description = "Public inference port for c8g worker."
  type        = number
  default     = 8011
}

variable "aws_c8g_gguf_model_uri" {
  description = "S3 URI for GGUF model artifact."
  type        = string
  default     = ""
}

variable "aws_c8g_served_model_name" {
  description = "OpenAI alias served by c8g lane."
  type        = string
  default     = "cpu-worker"
}

variable "aws_c8g_api_key" {
  description = "API key required by c8g lane."
  type        = string
  sensitive   = true
  default     = ""
}

variable "aws_c8g_llamacpp_image" {
  description = "llama.cpp server image for c8g lane."
  type        = string
  default     = "ghcr.io/ggml-org/llama.cpp:server"
}

variable "aws_c8g_context_size" {
  description = "llama.cpp context window for cpu worker lane."
  type        = number
  default     = 32768
}

variable "aws_c8g_threads" {
  description = "llama.cpp thread count."
  type        = number
  default     = 8
}

variable "aws_c8g_ssh_cidrs" {
  description = "CIDRs allowed to SSH c8g host."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "aws_c8g_inference_cidrs" {
  description = "CIDRs allowed to call c8g inference endpoints."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "aws_c8g_root_volume_gb" {
  description = "Root volume size for c8g host."
  type        = number
  default     = 150
}
