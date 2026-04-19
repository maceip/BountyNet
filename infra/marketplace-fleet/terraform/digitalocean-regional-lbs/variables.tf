variable "project" {
  description = "Project prefix for naming."
  type        = string
  default     = "bountynet-marketplace"
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
  description = "Optional VPC UUID for droplets/LBs."
  type        = string
  default     = ""
}

variable "ssh_key_fingerprints" {
  description = "SSH key fingerprints to inject into droplets."
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

variable "model_api_region" {
  description = "Primary model control-plane region for supervisor/worker calls."
  type        = string
  default     = "eu-central-1"
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

variable "enable_managed_secret_bootstrap" {
  description = "Enable optional post-boot secret sync from AWS SSM/KMS. Does not block node startup."
  type        = bool
  default     = false
}

variable "aws_secrets_region" {
  description = "AWS region containing SSM/KMS-managed secrets used by optional sync."
  type        = string
  default     = "eu-central-1"
}

variable "aws_kms_key_arn" {
  description = "KMS key ARN metadata for optional secret-sync context."
  type        = string
  default     = ""
}

variable "secret_parameter_names" {
  description = "SSM SecureString parameter names for optional provider key sync."
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

  validation {
    condition     = sum([for _, lane in var.regional_plan : lane.droplet_count]) == 10
    error_message = "regional_plan must define exactly 10 droplets in total."
  }

  validation {
    condition     = sum([for _, lane in var.regional_plan : lane.traffic_weight]) == 100
    error_message = "regional_plan traffic_weight values must sum to 100."
  }
}

variable "service_port" {
  description = "Backend gateway service port used by load balancers."
  type        = number
  default     = 4000
}
