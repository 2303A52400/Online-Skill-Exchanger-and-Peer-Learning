variable "aws_region" {
  description = "Target AWS deployment region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Target deployment environment (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "project_name" {
  description = "Project namespace for tagging and resource naming"
  type        = string
  default     = "skillswap"
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "db_username" {
  description = "PostgreSQL Master Username"
  type        = string
  default     = "skillswap_admin"
}

variable "db_password" {
  description = "PostgreSQL Master Password"
  type        = string
  sensitive   = true
}

