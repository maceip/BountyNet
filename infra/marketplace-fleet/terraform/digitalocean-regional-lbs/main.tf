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

    write_files:
      - path: /opt/bountynet/.env
        permissions: "0640"
        content: |
          LITELLM_MASTER_KEY=${var.litellm_master_key}
          LITELLM_SALT_KEY=${var.litellm_salt_key}
          ENABLE_MANAGED_SECRET_BOOTSTRAP=${var.enable_managed_secret_bootstrap}
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
            num_retries: 0
            request_timeout: 20
            redis_host: "127.0.0.1"
            redis_port: 6379
            master_key: os.environ/LITELLM_MASTER_KEY
            salt_key: os.environ/LITELLM_SALT_KEY
            json_logs: true
          router_settings:
            allowed_fails: 1
            cooldown_time: 10
            fallbacks:
              - agents/default: ["agents/fallback"]
          model_list:
            # Provider routes/keys are expected to be managed via LiteLLM admin API/dashboard.
            # These logical aliases keep gateway/runtime config provider-agnostic.
            - model_name: agents/default
              litellm_params:
                model: anthropic/claude-sonnet-4-5
            - model_name: agents/fallback
              litellm_params:
                model: openai/gpt-5-mini
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
      - path: /opt/bountynet/sync-secrets.sh
        permissions: "0755"
        content: |
          #!/usr/bin/env bash
          set -euo pipefail
          ENV_FILE=/opt/bountynet/.env
          if [[ ! -f "$ENV_FILE" ]]; then
            exit 0
          fi
          # shellcheck disable=SC1090
          source "$ENV_FILE"
          if [[ "$${ENABLE_MANAGED_SECRET_BOOTSTRAP:-false}" != "true" ]]; then
            exit 0
          fi
          REGION="$${AWS_SECRETS_REGION:-}"
          if [[ -z "$REGION" ]]; then
            exit 0
          fi
          fetch_and_set() {
            local key_name="$1"
            local param_name="$2"
            if [[ -z "$${param_name:-}" ]]; then
              return 0
            fi
            local value
            value="$(aws ssm get-parameter --name "$param_name" --with-decryption --region "$REGION" --query Parameter.Value --output text 2>/dev/null || true)"
            if [[ -n "$value" ]]; then
              sed -i "s|^$${key_name}=.*|$${key_name}=$${value}|" "$ENV_FILE"
            fi
          }
          fetch_and_set OPENAI_API_KEY "$${OPENAI_KEY_PARAM:-}"
          fetch_and_set ANTHROPIC_API_KEY "$${ANTHROPIC_KEY_PARAM:-}"
          fetch_and_set GEMINI_API_KEY "$${GEMINI_KEY_PARAM:-}"
          fetch_and_set OPENROUTER_API_KEY "$${OPENROUTER_KEY_PARAM:-}"
          /usr/bin/docker compose -f /opt/bountynet/docker-compose.yml restart litellm >/dev/null 2>&1 || true
      - path: /etc/systemd/system/bountynet-secret-sync.service
        permissions: "0644"
        content: |
          [Unit]
          Description=BountyNet optional managed secret sync
          After=network-online.target docker.service
          Wants=network-online.target

          [Service]
          Type=oneshot
          ExecStart=/opt/bountynet/sync-secrets.sh
      - path: /etc/systemd/system/bountynet-secret-sync.timer
        permissions: "0644"
        content: |
          [Unit]
          Description=Periodic BountyNet managed secret sync

          [Timer]
          OnBootSec=2min
          OnUnitActiveSec=10min
          Unit=bountynet-secret-sync.service

          [Install]
          WantedBy=timers.target

    runcmd:
      - systemctl enable docker
      - systemctl start docker
      - systemctl enable redis-server
      - systemctl start redis-server
      - /usr/bin/docker compose -f /opt/bountynet/docker-compose.yml up -d
      - |
        if [ "${var.enable_managed_secret_bootstrap}" = "true" ]; then
          apt-get update -y
          apt-get install -y awscli
          systemctl daemon-reload
          systemctl enable --now bountynet-secret-sync.timer
        fi
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
