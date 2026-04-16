terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.41"
    }
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.84"
    }
  }
}
