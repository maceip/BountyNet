locals {
  resolved_vpc_id = var.vpc_id != "" ? var.vpc_id : data.aws_vpc.default[0].id
  resolved_subnet_id = var.subnet_id != "" ? var.subnet_id : try(
    data.aws_subnets.selected[0].ids[0],
    null,
  )
  effective_ami = var.ami_id != "" ? var.ami_id : data.aws_ami.ubuntu_arm[0].id

  gguf_trimmed    = trimsuffix(trimprefix(var.gguf_model_uri, "s3://"), "/")
  gguf_bucket     = local.gguf_trimmed != "" ? split("/", local.gguf_trimmed)[0] : ""
  gguf_key_prefix = local.gguf_trimmed != "" && length(split("/", local.gguf_trimmed)) > 1 ? join("/", slice(split("/", local.gguf_trimmed), 1, length(split("/", local.gguf_trimmed)))) : ""
  gguf_bucket_arn = local.gguf_bucket != "" ? "arn:aws:s3:::${local.gguf_bucket}" : ""
  gguf_object_arn = local.gguf_key_prefix != "" ? "${local.gguf_bucket_arn}/${local.gguf_key_prefix}*" : (local.gguf_bucket != "" ? "${local.gguf_bucket_arn}/*" : "")

  common_tags = merge(
    {
      Project   = var.project
      Component = "cpu-worker"
      Runtime   = "llamacpp"
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

data "aws_ami" "ubuntu_arm" {
  count       = var.ami_id == "" ? 1 : 0
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-arm64-server-*"]
  }
}

resource "aws_security_group" "serving" {
  name_prefix = "${var.project}-${var.name_suffix}-"
  description = "Security group for ${var.project} c8g llama.cpp lane."
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

resource "aws_iam_role_policy" "gguf_read" {
  count = local.gguf_bucket != "" ? 1 : 0
  name  = "${var.project}-${var.name_suffix}-gguf-read"
  role  = aws_iam_role.serving.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = [local.gguf_bucket_arn]
      },
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject"]
        Resource = [local.gguf_object_arn]
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
    inference_port    = var.inference_port
    llamacpp_image    = var.llamacpp_image
    gguf_model_uri    = var.gguf_model_uri
    served_model_name = var.served_model_name
    api_key           = var.api_key
    context_size      = var.context_size
    threads           = var.threads
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
