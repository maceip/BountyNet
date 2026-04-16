locals {
  regional_plan = var.regional_plan
  edge_nodes = flatten([
    for lane_key, lane in local.regional_plan : [
      for index in range(lane.droplet_count) : {
        key         = "${lane_key}-${index + 1}"
        lane_key    = lane_key
        lane_region = lane.region
        lane_tag    = lane.droplet_tag
        lane_weight = lane.traffic_weight
        index       = index + 1
      }
    ]
  ])
  edge_node_map = { for node in local.edge_nodes : node.key => node }
}

resource "digitalocean_tag" "regional_edge" {
  for_each = local.regional_plan
  name     = each.value.droplet_tag
}

resource "digitalocean_droplet" "edge_gateway" {
  for_each = local.edge_node_map

  name              = "${var.project}-${each.value.lane_key}-${format("%02d", each.value.index)}"
  region            = each.value.lane_region
  size              = var.droplet_size
  image             = var.droplet_image
  ssh_keys          = var.ssh_key_fingerprints
  monitoring        = true
  ipv6              = true
  vpc_uuid          = var.vpc_uuid != "" ? var.vpc_uuid : null
  resize_disk       = true
  backups           = false
  droplet_agent     = true
  graceful_shutdown = true
  tags = [
    var.project,
    "bountynet-edge",
    "circuit-breaker",
    each.value.lane_tag,
  ]

  user_data = <<-EOT
    #cloud-config
    package_update: true
    packages:
      - docker.io
      - docker-compose-plugin
      - redis-server
      - awscli

    write_files:
      - path: /opt/bountynet/.env
        permissions: "0640"
        content: |
          OPENAI_API_KEY=
          ANTHROPIC_API_KEY=
          GEMINI_API_KEY=
          OPENROUTER_API_KEY=
          AWS_REGION_NAME=${var.model_api_region}
          AWS_SECRETS_REGION=${var.aws_secrets_region}
          AWS_KMS_KEY_ARN=${var.aws_kms_key_arn}
          OPENAI_KEY_PARAM=${var.secret_parameter_names.openai}
          ANTHROPIC_KEY_PARAM=${var.secret_parameter_names.anthropic}
          GEMINI_KEY_PARAM=${var.secret_parameter_names.gemini}
          OPENROUTER_KEY_PARAM=${var.secret_parameter_names.openrouter}
      - path: /opt/bountynet/config.yaml
        permissions: "0644"
        content: |
          litellm_settings:
            num_retries: 2
            request_timeout: 60
            redis_host: "127.0.0.1"
            redis_port: 6379
            enable_thinking: true
            preserve_thinking: true
            fallbacks:
              - ["qwen/supervisor_flash", "qwen/worker_universal", "openai/gpt-4.1-mini"]
              - ["qwen/worker_security", "qwen/worker_universal", "anthropic/claude-3-7-sonnet-latest"]
              - ["qwen/worker_vendor_swap", "qwen/worker_universal", "openai/gpt-4.1"]
              - ["qwen/worker_recovery", "qwen/worker_universal", "gemini/gemini-2.0-flash"]
          model_list:
            - model_name: qwen/supervisor_flash
              litellm_params:
                model: openrouter/qwen/qwen3.6-flash
                api_key: os.environ/OPENROUTER_API_KEY
            - model_name: qwen/worker_universal
              litellm_params:
                model: openrouter/qwen/qwen3.6-35b-a3b
                api_key: os.environ/OPENROUTER_API_KEY
            - model_name: qwen/worker_security
              litellm_params:
                model: openrouter/qwen/qwen3.6-35b-a3b
                api_key: os.environ/OPENROUTER_API_KEY
            - model_name: qwen/worker_vendor_swap
              litellm_params:
                model: openrouter/qwen/qwen3.6-35b-a3b
                api_key: os.environ/OPENROUTER_API_KEY
            - model_name: qwen/worker_recovery
              litellm_params:
                model: openrouter/qwen/qwen3.6-35b-a3b
                api_key: os.environ/OPENROUTER_API_KEY
      - path: /opt/bountynet/docker-compose.yml
        permissions: "0644"
        content: |
          services:
            litellm:
              image: ${var.gateway_docker_image}
              container_name: litellm-gateway
              restart: always
              env_file:
                - /opt/bountynet/.env
              command: ["--config", "/app/config.yaml", "--port", "${var.gateway_container_port}", "--num_workers", "2"]
              ports:
                - "${var.gateway_container_port}:${var.gateway_container_port}"
              volumes:
                - /opt/bountynet/config.yaml:/app/config.yaml:ro

    runcmd:
      - systemctl enable docker
      - systemctl start docker
      - systemctl enable redis-server
      - systemctl start redis-server
      - |
        if [ "${var.enable_managed_secret_bootstrap}" = "true" ]; then
          OPENAI_KEY=$(aws ssm get-parameter --name "${var.secret_parameter_names.openai}" --with-decryption --region "${var.aws_secrets_region}" --query Parameter.Value --output text 2>/dev/null || true)
          ANTHROPIC_KEY=$(aws ssm get-parameter --name "${var.secret_parameter_names.anthropic}" --with-decryption --region "${var.aws_secrets_region}" --query Parameter.Value --output text 2>/dev/null || true)
          GEMINI_KEY=$(aws ssm get-parameter --name "${var.secret_parameter_names.gemini}" --with-decryption --region "${var.aws_secrets_region}" --query Parameter.Value --output text 2>/dev/null || true)
          OPENROUTER_KEY=$(aws ssm get-parameter --name "${var.secret_parameter_names.openrouter}" --with-decryption --region "${var.aws_secrets_region}" --query Parameter.Value --output text 2>/dev/null || true)
          if [ -n "$OPENAI_KEY" ]; then sed -i "s|^OPENAI_API_KEY=.*|OPENAI_API_KEY=$OPENAI_KEY|" /opt/bountynet/.env; fi
          if [ -n "$ANTHROPIC_KEY" ]; then sed -i "s|^ANTHROPIC_API_KEY=.*|ANTHROPIC_API_KEY=$ANTHROPIC_KEY|" /opt/bountynet/.env; fi
          if [ -n "$GEMINI_KEY" ]; then sed -i "s|^GEMINI_API_KEY=.*|GEMINI_API_KEY=$GEMINI_KEY|" /opt/bountynet/.env; fi
          if [ -n "$OPENROUTER_KEY" ]; then sed -i "s|^OPENROUTER_API_KEY=.*|OPENROUTER_API_KEY=$OPENROUTER_KEY|" /opt/bountynet/.env; fi
        fi
      - /usr/bin/docker compose -f /opt/bountynet/docker-compose.yml up -d
  EOT
}

resource "digitalocean_loadbalancer" "regional" {
  for_each = local.regional_plan

  name     = "${var.project}-${each.key}-lb"
  region   = each.value.region
  vpc_uuid = var.vpc_uuid != "" ? var.vpc_uuid : null

  redirect_http_to_https = true

  forwarding_rule {
    entry_port      = var.entry_port
    entry_protocol  = "tcp"
    target_port     = var.gateway_container_port
    target_protocol = "tcp"
  }

  healthcheck {
    protocol                 = "tcp"
    port                     = var.service_port
    check_interval_seconds   = 10
    response_timeout_seconds = 5
    healthy_threshold        = 5
    unhealthy_threshold      = 3
  }

  droplet_tag = each.value.droplet_tag
}
