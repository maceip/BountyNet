variable "project" {
  description = "Project prefix for names and tags."
  type        = string
  default     = "bountynet-marketplace"
}

variable "name_suffix" {
  description = "Suffix for runtime resources."
  type        = string
  default     = "inf2-serving"
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
  description = "Inferentia serving instance type."
  type        = string
  default     = "inf2.xlarge"
}

variable "ami_id" {
  description = "AMI for the inf2 host. Leave empty to use latest Ubuntu 24.04."
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
  default     = 8000
}

variable "ssh_cidrs" {
  description = "CIDRs allowed to SSH the serving node."
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
  default     = 200
}

variable "runtime_image" {
  description = "Container image used for vLLM serving runtime (Neuron-compatible image recommended)."
  type        = string
  default     = "vllm/vllm-openai:latest"
}

variable "model_id" {
  description = "Model ID passed to the serving runtime."
  type        = string
  default     = "Qwen/Qwen3.6-35B-A3B"
}

variable "served_model_name" {
  description = "OpenAI model alias exposed by runtime."
  type        = string
  default     = "base-coder"
}

variable "api_key" {
  description = "Runtime API key expected by serving endpoints."
  type        = string
  sensitive   = true
  default     = "replace-with-strong-key"
}

variable "adapter_bucket" {
  description = "S3 URI prefix where adapter artifacts are published."
  type        = string
  default     = ""
}

variable "adapter_default_revision" {
  description = "Default adapter revision when manifest does not pin one."
  type        = string
  default     = "latest"
}

variable "agent_id_header" {
  description = "Header used for identity-aware adapter routing."
  type        = string
  default     = "X-Agent-ID"
}

variable "additional_tags" {
  description = "Additional tags to apply."
  type        = map(string)
  default     = {}
}
