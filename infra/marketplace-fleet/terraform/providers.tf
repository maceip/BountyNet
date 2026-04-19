provider "aws" {
  region = var.aws_control_plane_region
}

provider "aws" {
  alias  = "inf2"
  region = var.aws_inf2_region
}

provider "aws" {
  alias  = "c8g"
  region = var.aws_c8g_region
}

provider "digitalocean" {
  token = var.do_token
}
