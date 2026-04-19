variable "project" {
  description = "Project prefix for naming."
  type        = string
  default     = "bountynet-marketplace"
}

variable "domain_name" {
  description = "DigitalOcean-managed domain name (for example, bountynet.ai)."
  type        = string
}

variable "hostname" {
  description = "Host label within the domain (for example, llm). Use @ for apex."
  type        = string
  default     = "llm"
}

variable "record_ttl" {
  description = "TTL for DNS records."
  type        = number
  default     = 30
}

variable "do_edge_origins" {
  description = "DigitalOcean regional LB IPv4 addresses keyed by lane."
  type        = map(string)
  default     = {}
}

variable "create_primary_global_lb_record" {
  description = "Create/maintain the primary global LB A record."
  type        = bool
  default     = false
}

variable "primary_global_lb_ip" {
  description = "Optional primary global ingress LB IPv4."
  type        = string
  default     = ""
}

variable "create_backup_global_lb_record" {
  description = "Create/maintain the backup global LB A record."
  type        = bool
  default     = false
}

variable "backup_global_lb_ip" {
  description = "Optional backup global ingress LB IPv4."
  type        = string
  default     = ""
}

variable "create_aws_anycast_alias" {
  description = "Create/maintain the optional AWS Global Accelerator CNAME alias."
  type        = bool
  default     = false
}

variable "backup_hostname" {
  description = "Backup host label used for explicit failover endpoint."
  type        = string
  default     = "llm-backup"
}

variable "include_aws_anycast_alias" {
  description = "Whether to publish an additional CNAME to AWS Global Accelerator."
  type        = bool
  default     = false
}

variable "aws_global_accelerator_dns" {
  description = "AWS GA DNS name for optional alias/fallback."
  type        = string
  default     = ""
}
