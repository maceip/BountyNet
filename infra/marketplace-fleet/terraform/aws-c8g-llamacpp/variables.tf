variable "project" {
  description = "Project prefix for names and tags."
  type        = string
  default     = "bountynet-marketplace"
}

variable "name_suffix" {
  description = "Suffix for runtime resources."
  type        = string
  default     = "c8g-llamacpp"
}

variable "vpc_id" {
  description = "Optional VPC ID. Uses default VPC when empty."
  type        = string
  default     = ""
}

variable "subnet_id" {
  description = "Optional subnet ID. Uses first subnet in selected/default VPC when empty."
  type        = string
  default     = ""
}

variable "instance_type" {
  description = "Graviton instance type for llama.cpp lane."
  type        = string
  default     = "c8g.xlarge"
}

variable "ami_id" {
  description = "AMI for the c8g host. Leave empty to use latest Ubuntu 24.04 arm64."
  type        = string
  default     = ""
}

variable "ssh_key_name" {
  description = "Optional EC2 key pair name."
  type        = string
  default     = ""
}

variable "inference_port" {
  description = "Public inference/listener port."
  type        = number
  default     = 8011
}

variable "ssh_cidrs" {
  description = "CIDRs allowed to SSH the CPU worker node."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "inference_cidrs" {
  description = "CIDRs allowed to call inference endpoints."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "root_volume_gb" {
  description = "Root EBS volume size for model/runtime cache."
  type        = number
  default     = 150
}

variable "llamacpp_image" {
  description = "llama.cpp server image."
  type        = string
  default     = "ghcr.io/ggml-org/llama.cpp:server"
}

variable "gguf_model_uri" {
  description = "S3 URI (or local path if pre-baked AMI) to GGUF model."
  type        = string
  default     = ""
}

variable "served_model_name" {
  description = "OpenAI model alias exposed by runtime."
  type        = string
  default     = "cpu-worker"
}

variable "api_key" {
  description = "Runtime API key expected by serving endpoints."
  type        = string
  sensitive   = true
  default     = "replace-with-strong-key"
}

variable "context_size" {
  description = "llama.cpp context window."
  type        = number
  default     = 32768
}

variable "threads" {
  description = "llama.cpp serving thread count."
  type        = number
  default     = 8
}

variable "additional_tags" {
  description = "Additional tags to apply."
  type        = map(string)
  default     = {}
}
