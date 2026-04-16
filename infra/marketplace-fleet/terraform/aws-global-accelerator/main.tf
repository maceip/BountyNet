resource "aws_globalaccelerator_accelerator" "serving" {
  name            = "${var.project}-ga"
  ip_address_type = "IPV4"
  enabled         = true
}

resource "aws_globalaccelerator_listener" "serving_tcp" {
  accelerator_arn = aws_globalaccelerator_accelerator.serving.id
  client_affinity = "NONE"
  protocol        = "TCP"

  port_range {
    from_port = var.listener_port
    to_port   = var.listener_port
  }
}

resource "aws_globalaccelerator_endpoint_group" "regional" {
  for_each = var.endpoint_groups

  listener_arn            = aws_globalaccelerator_listener.serving_tcp.id
  endpoint_group_region   = each.value.region
  traffic_dial_percentage = each.value.traffic_dial_percentage

  health_check_protocol = "TCP"
  health_check_port     = var.endpoint_port

  endpoint_configuration {
    endpoint_id = each.value.nlb_arn
    weight      = each.value.weight
  }
}
