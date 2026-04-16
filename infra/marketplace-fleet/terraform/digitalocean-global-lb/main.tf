resource "digitalocean_loadbalancer" "primary" {
  name   = "${var.project}-global-primary-lb"
  region = var.primary_region

  forwarding_rule {
    entry_port      = var.entry_port
    entry_protocol  = "tcp"
    target_port     = var.target_port
    target_protocol = "tcp"
  }

  healthcheck {
    protocol                 = "tcp"
    port                     = var.healthcheck_port
    check_interval_seconds   = 10
    response_timeout_seconds = 5
    healthy_threshold        = 5
    unhealthy_threshold      = 3
  }

  droplet_tag = var.primary_droplet_tag
}

resource "digitalocean_loadbalancer" "backup" {
  name   = "${var.project}-global-backup-lb"
  region = var.backup_region

  forwarding_rule {
    entry_port      = var.entry_port
    entry_protocol  = "tcp"
    target_port     = var.target_port
    target_protocol = "tcp"
  }

  healthcheck {
    protocol                 = "tcp"
    port                     = var.healthcheck_port
    check_interval_seconds   = 10
    response_timeout_seconds = 5
    healthy_threshold        = 5
    unhealthy_threshold      = 3
  }

  droplet_tag = var.backup_droplet_tag
}

