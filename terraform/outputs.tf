output "vpc_id" {
  description = "VPC Identifier"
  value       = aws_vpc.main.id
}

output "database_endpoint" {
  description = "PostgreSQL RDS connection endpoint"
  value       = aws_db_instance.postgres.endpoint
}

output "redis_primary_endpoint" {
  description = "Redis ElastiCache Primary Endpoint"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

