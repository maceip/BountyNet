locals {
  resolved_vpc_id = var.vpc_id != "" ? var.vpc_id : data.aws_vpc.default[0].id
  resolved_subnet_id = var.subnet_id != "" ? var.subnet_id : try(
    data.aws_subnets.selected[0].ids[0],
    null,
  )
  effective_ami = var.ami_id != "" ? var.ami_id : data.aws_ami.ubuntu[0].id

  adapter_bucket_trimmed = trimsuffix(trimprefix(var.adapter_bucket, "s3://"), "/")
  adapter_bucket_name    = local.adapter_bucket_trimmed != "" ? split("/", local.adapter_bucket_trimmed)[0] : ""
  adapter_bucket_prefix  = local.adapter_bucket_trimmed != "" && length(split("/", local.adapter_bucket_trimmed)) > 1 ? join("/", slice(split("/", local.adapter_bucket_trimmed), 1, length(split("/", local.adapter_bucket_trimmed)))) : ""
  adapter_bucket_arn     = local.adapter_bucket_name != "" ? "arn:aws:s3:::${local.adapter_bucket_name}" : ""
  adapter_object_arn     = local.adapter_bucket_prefix != "" ? "${local.adapter_bucket_arn}/${local.adapter_bucket_prefix}/*" : (local.adapter_bucket_name != "" ? "${local.adapter_bucket_arn}/*" : "")

  common_tags = merge(
    {
      Project   = var.project
      Component = "model-serving"
      Runtime   = "inf2"
      ManagedBy = "terraform"
    },
    var.additional_tags,
  )
}

data "aws_vpc" "default" {
  count   = var.vpc_id == "" ? 1 : 0
  default = true
}

data "aws_subnets" "selected" {
  count = var.subnet_id == "" ? 1 : 0

  filter {
    name   = "vpc-id"
    values = [local.resolved_vpc_id]
  }
}

data "aws_ami" "ubuntu" {
  count       = var.ami_id == "" ? 1 : 0
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }
}

resource "aws_security_group" "serving" {
  name_prefix = "${var.project}-${var.name_suffix}-"
  description = "Security group for ${var.project} inf2 model serving."
  vpc_id      = local.resolved_vpc_id
  tags        = local.common_tags
}

resource "aws_vpc_security_group_ingress_rule" "ssh" {
  for_each          = toset(var.ssh_cidrs)
  security_group_id = aws_security_group.serving.id
  from_port         = 22
  to_port           = 22
  ip_protocol       = "tcp"
  cidr_ipv4         = each.value
  description       = "SSH access"
}

resource "aws_vpc_security_group_ingress_rule" "inference" {
  for_each          = toset(var.inference_cidrs)
  security_group_id = aws_security_group.serving.id
  from_port         = var.inference_port
  to_port           = var.inference_port
  ip_protocol       = "tcp"
  cidr_ipv4         = each.value
  description       = "Inference/API access"
}

resource "aws_vpc_security_group_egress_rule" "all" {
  security_group_id = aws_security_group.serving.id
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
  description       = "All egress"
}

resource "aws_iam_role" "serving" {
  name_prefix = "${var.project}-${var.name_suffix}-"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.serving.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy" "adapter_read" {
  count = local.adapter_bucket_name != "" ? 1 : 0
  name  = "${var.project}-${var.name_suffix}-adapter-read"
  role  = aws_iam_role.serving.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = [local.adapter_bucket_arn]
      },
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject"]
        Resource = [local.adapter_object_arn]
      }
    ]
  })
}

resource "aws_iam_instance_profile" "serving" {
  name_prefix = "${var.project}-${var.name_suffix}-"
  role        = aws_iam_role.serving.name
  tags        = local.common_tags
}

resource "aws_instance" "serving" {
  ami                         = local.effective_ami
  instance_type               = var.instance_type
  subnet_id                   = local.resolved_subnet_id
  vpc_security_group_ids      = [aws_security_group.serving.id]
  associate_public_ip_address = true
  iam_instance_profile        = aws_iam_instance_profile.serving.name
  key_name                    = var.ssh_key_name != "" ? var.ssh_key_name : null

  user_data = templatefile("${path.module}/cloud-init.tftpl", {
    inference_port           = var.inference_port
    runtime_image            = var.runtime_image
    model_id                 = var.model_id
    served_model_name        = var.served_model_name
    api_key                  = var.api_key
    adapter_bucket           = var.adapter_bucket
    adapter_default_revision = var.adapter_default_revision
    agent_id_header          = var.agent_id_header
  })

  root_block_device {
    volume_size           = var.root_volume_gb
    volume_type           = "gp3"
    delete_on_termination = true
    encrypted             = true
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${var.project}-${var.name_suffix}"
    },
  )
}
