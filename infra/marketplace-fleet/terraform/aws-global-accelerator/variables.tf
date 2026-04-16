variable "project" {
  description = "Project prefix for naming."
  type        = string
  default     = "bountynet-marketplace"
}

variable "listener_port" {
  description = "Public listener port for global accelerator."
  type        = number
  default     = 443
}

variable "endpoint_port" {
  description = "Backend service port exposed by regional NLB endpoints."
  type        = number
  default     = 8000
}

variable "endpoint_groups" {
  description = "Global accelerator endpoint groups keyed by lane."
  type = map(object({
    region                  = string
    nlb_arn                 = string
    traffic_dial_percentage = number
    weight                  = number
  }))
  default = {
    na_west = {
      region                  = "us-west-2"
      nlb_arn                 = ""
      traffic_dial_percentage = 20
      weight                  = 128
    }
    na_east = {
      region                  = "us-east-1"
      nlb_arn                 = ""
      traffic_dial_percentage = 20
      weight                  = 128
    }
    eu = {
      region                  = "eu-west-1"
      nlb_arn                 = ""
      traffic_dial_percentage = 30
      weight                  = 128
    }
    asia = {
      region                  = "ap-southeast-1"
      nlb_arn                 = ""
      traffic_dial_percentage = 20
      weight                  = 128
    }
    australia = {
      region                  = "ap-southeast-2"
      nlb_arn                 = ""
      traffic_dial_percentage = 10
      weight                  = 128
    }
  }

  validation {
    condition     = sum([for _, endpoint in var.endpoint_groups : endpoint.traffic_dial_percentage]) == 100
    error_message = "endpoint_groups traffic_dial_percentage values must sum to 100."
  }
}
