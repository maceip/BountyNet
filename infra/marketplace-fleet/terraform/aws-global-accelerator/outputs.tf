output "global_accelerator_dns_name" {
  description = "Global anycast DNS name for vLLM serving."
  value       = aws_globalaccelerator_accelerator.serving.dns_name
}

output "global_accelerator_zone_id" {
  description = "Hosted zone ID for DNS alias records."
  value       = aws_globalaccelerator_accelerator.serving.hosted_zone_id
}

output "global_accelerator_ips" {
  description = "Static anycast IP addresses."
  value       = aws_globalaccelerator_accelerator.serving.ip_sets[*].ip_addresses
}

output "regional_endpoint_groups" {
  description = "Regional endpoint group ARNs keyed by lane."
  value = {
    for lane, endpoint in aws_globalaccelerator_endpoint_group.regional : lane => endpoint.id
  }
}
