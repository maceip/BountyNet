variable "project" {
  description = "Project prefix for naming."
  type        = string
  default     = "bountynet-marketplace"
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
  description = "Droplet tag targeted by the primary LB."
  type        = string
  default     = "bountynet-edge-na-east"
}

variable "backup_droplet_tag" {
  description = "Droplet tag targeted by the backup LB."
  type        = string
  default     = "bountynet-edge-na-west"
}

variable "entry_port" {
  description = "Public ingress port."
  type        = number
  default     = 443
}

variable "target_port" {
  description = "LiteLLM ingress port on droplets."
  type        = number
  default     = 4000
}

variable "healthcheck_port" {
  description = "TCP health check port."
  type        = number
  default     = 4000
}

