variable "project" {
  description = "Project prefix for naming."
  type        = string
  default     = "bountynet-marketplace"
}

variable "aws_control_plane_region" {
  description = "AWS region used by the root provider (Global Accelerator resources are global)."
  type        = string
  default     = "us-east-1"
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

variable "bedrock_region" {
  description = "Primary Bedrock region for supervisor and worker calls."
  type        = string
  default     = "us-west-2"
}

variable "enable_managed_secret_bootstrap" {
  description = "When true, cloud-init resolves API keys from AWS SSM SecureString."
  type        = bool
  default     = true
}

variable "aws_secrets_region" {
  description = "AWS region containing SSM and KMS managed fallback provider secrets."
  type        = string
  default     = "us-west-2"
}

variable "aws_kms_key_arn" {
  description = "KMS key ARN used for SecureString encryption metadata."
  type        = string
  default     = ""
}

variable "secret_parameter_names" {
  description = "SSM SecureString parameter names for fallback provider API keys."
  type = object({
    openai    = string
    anthropic = string
    gemini    = string
  })
  default = {
    openai    = "/bountynet/market/edge/openai_api_key"
    anthropic = "/bountynet/market/edge/anthropic_api_key"
    gemini    = "/bountynet/market/edge/gemini_api_key"
  }
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
  description = "Global Accelerator endpoint groups keyed by lane."
  type = map(object({
    region                  = string
    nlb_arn                 = string
    traffic_dial_percentage = number
    weight                  = number
  }))
  default = {}
}
