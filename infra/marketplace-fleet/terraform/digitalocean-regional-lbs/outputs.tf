output "regional_lb_ips" {
  description = "Regional DigitalOcean LB IPs keyed by lane."
  value = {
    for lane, lb in digitalocean_loadbalancer.regional : lane => lb.ip
  }
}

output "edge_droplets" {
  description = "All DigitalOcean edge droplets keyed by lane/index."
  value = {
    for key, droplet in digitalocean_droplet.edge_gateway : key => {
      id         = droplet.id
      name       = droplet.name
      region     = droplet.region
      ipv4       = droplet.ipv4_address
      ipv6       = droplet.ipv6_address
      status     = droplet.status
      created_at = droplet.created_at
      tags       = droplet.tags
    }
  }
}

output "regional_plan" {
  description = "Applied regional droplet topology and traffic weights."
  value       = var.regional_plan
}
