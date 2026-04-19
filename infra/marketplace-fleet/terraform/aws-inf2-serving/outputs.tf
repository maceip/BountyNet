output "instance_id" {
  description = "EC2 instance id for the inf2 runtime host."
  value       = aws_instance.serving.id
}

output "public_ip" {
  description = "Public IP address for the inf2 runtime host."
  value       = aws_instance.serving.public_ip
}

output "private_ip" {
  description = "Private IP address for the inf2 runtime host."
  value       = aws_instance.serving.private_ip
}

output "inference_base_url" {
  description = "Base URL for OpenAI-compatible inference endpoint."
  value       = "http://${aws_instance.serving.public_ip}:${var.inference_port}/v1"
}

output "adapter_resolve_url" {
  description = "Adapter-resolution diagnostic endpoint."
  value       = "http://${aws_instance.serving.public_ip}:${var.inference_port}/ops/adapters/resolve"
}

output "security_group_id" {
  description = "Security group id attached to the inf2 runtime host."
  value       = aws_security_group.serving.id
}
