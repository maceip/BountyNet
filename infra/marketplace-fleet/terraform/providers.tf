provider "aws" {
  region = var.aws_control_plane_region
}

provider "digitalocean" {
  token = var.do_token
}
