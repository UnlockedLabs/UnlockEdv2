# Deployment Guide

This guide provides comprehensive instructions for deploying UnlockEdv2 in development, staging, and production environments using Docker, Kubernetes, and various cloud platforms.

## 📋 Table of Contents
- [Deployment Options](#deployment-options)
- [Prerequisites](#prerequisites)
- [Development Deployment](#development-deployment)
- [Production Deployment](#production-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Cloud Platform Deployment](#cloud-platform-deployment)
- [Configuration Management](#configuration-management)
- [Monitoring & Observability](#monitoring--observability)
- [Backup & Recovery](#backup--recovery)
- [Security Considerations](#security-considerations)
- [Scaling & Performance](#scaling--performance)
- [Troubleshooting](#troubleshooting)

## 🚀 Deployment Options

### Available Deployment Methods
1. **Docker Compose** - Local development and small production deployments
2. **Kubernetes (Helm)** - Production-grade container orchestration
3. **Cloud Platforms** - AWS, GCP, Azure managed services
4. **Bare Metal** - Traditional server deployment

### Architecture Overview
```
                    ┌─────────────────┐
                    │   Load Balancer │
                    │    (Nginx)      │
                    └─────────┬───────┘
                              │
                    ┌─────────▼───────┐
                    │   Frontend      │
                    │   (React)       │
                    └─────────┬───────┘
                              │
                    ┌─────────▼───────┐
                    │   Backend API   │
                    │   (Go/Gin)      │
                    └─────────┬───────┘
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
    ┌───────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐
    │ PostgreSQL   │  │ Ory Stack   │  │    NATS     │
    │  Database    │  │ (Auth)      │  │   Queue     │
    └──────────────┘  └─────────────┘  └─────────────┘
```

---

## ✅ Prerequisites

### System Requirements

#### Minimum Hardware
- **CPU**: 4 cores
- **RAM**: 8GB
- **Storage**: 50GB SSD
- **Network**: 1Gbps connection

#### Recommended Hardware
- **CPU**: 8 cores
- **RAM**: 16GB
- **Storage**: 100GB SSD
- **Network**: 1Gbps connection

#### Production Hardware
- **CPU**: 16 cores
- **RAM**: 32GB
- **Storage**: 500GB SSD (with backup storage)
- **Network**: 10Gbps connection

### Software Dependencies

#### Required
- Docker 24.0+
- Docker Compose 2.20+
- Make (GNU Make 4.0+)

#### For Kubernetes
- kubectl 1.28+
- Helm 3.12+
- Kubernetes cluster 1.28+

#### For Development
- Go 1.23+
- Node.js 18+
- Yarn 1.22+
- PostgreSQL 16+ (for local development)

### Network Requirements
- **HTTP/HTTPS**: Ports 80, 443
- **Application**: Port 8080 (backend)
- **Frontend**: Port 3000 (development)
- **Database**: Port 5432 (PostgreSQL)
- **Auth Services**: Ports 4433, 4434, 4444, 4445 (Ory)
- **Message Queue**: Port 4222 (NATS)

---

## 🛠️ Development Deployment

### Quick Start
```bash
# Clone repository
git clone <repository-url>
cd UnlockEdv2

# Copy environment configuration
cp .env.example .env

# Initialize development environment
make init

# Run database migrations
make migrate

# Seed with test data (optional)
make seed

# Start development servers
make dev
```

### Development Services
```bash
# Individual service control
make dev-be    # Backend only
make dev-fe    # Frontend only
make dev-db    # Database only

# Service status
docker compose ps

# View logs
docker compose logs -f server
docker compose logs -f frontend
```

### Development Environment File
```bash
# .env for development
NODE_ENV=development
DATABASE_URL=postgres://postgres:postgres@db:5432/unlocked_development
POSTGRES_DB=unlocked_development
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

# Application URLs (must use 127.0.0.1)
APP_URL=http://127.0.0.1
FRONTEND_URL=http://127.0.0.1:3000

# Ory Configuration
KRATOS_PUBLIC_URL=http://127.0.0.1:4433
KRATOS_ADMIN_URL=http://kratos:4434
HYDRA_ADMIN_URL=http://hydra:4445
HYDRA_PUBLIC_URL=http://127.0.0.1:4444

# Provider Service
PROVIDER_SERVICE_URL=http://provider-middleware:8081

# Optional: AWS S3 for video storage
# AWS_REGION=us-east-1
# S3_BUCKET_NAME=unlocked-videos-dev
# AWS_ACCESS_KEY_ID=your-access-key
# AWS_SECRET_ACCESS_KEY=your-secret-key
```

### Development Commands
```bash
# Database management
make migrate        # Run migrations
make migrate-fresh  # Drop and recreate database
make seed          # Add test data

# Dependency management
make install-dep NAME=react-select  # Install frontend package

# Testing
make test          # Run backend tests
make test-integration  # Integration tests

# Cleanup
make clean         # Stop and remove containers
docker system prune -a  # Clean up Docker resources
```

---

## 🏭 Production Deployment

### Production Environment Setup

#### 1. Server Preparation
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install additional tools
sudo apt install -y nginx certbot python3-certbot-nginx
```

#### 2. Environment Configuration
```bash
# Production environment file
NODE_ENV=production
DATABASE_URL=postgres://unlocked_user:secure_password@db:5432/unlocked_production
POSTGRES_DB=unlocked_production
POSTGRES_USER=unlocked_user
POSTGRES_PASSWORD=secure_random_password_here

# Production URLs
APP_URL=https://yourdomain.com
FRONTEND_URL=https://yourdomain.com

# Ory Configuration (production URLs)
KRATOS_PUBLIC_URL=https://yourdomain.com/auth
KRATOS_ADMIN_URL=http://kratos:4434
HYDRA_ADMIN_URL=http://hydra:4445
HYDRA_PUBLIC_URL=https://yourdomain.com/oauth2

# Security settings
SECURE_COOKIES=true
SESSION_TIMEOUT=3600
ORY_TOKEN=your-secure-admin-token-here

# AWS S3 (recommended for production)
AWS_REGION=us-east-1
S3_BUCKET_NAME=unlocked-videos-prod
AWS_ACCESS_KEY_ID=your-production-access-key
AWS_SECRET_ACCESS_KEY=your-production-secret-key

# Monitoring
ENABLE_PROMETHEUS=true
LOG_LEVEL=info
```

#### 3. SSL/TLS Setup
```bash
# Generate SSL certificates with Let's Encrypt
sudo certbot --nginx -d yourdomain.com

# Or provide your own certificates
# Place certificates in /etc/nginx/ssl/
sudo mkdir -p /etc/nginx/ssl
sudo cp your-cert.pem /etc/nginx/ssl/
sudo cp your-key.pem /etc/nginx/ssl/
```

#### 4. Production Deployment
```bash
# Clone and configure
git clone <repository-url> /opt/unlockEdv2
cd /opt/unlockEdv2

# Configure environment
cp .env.example .env.production
nano .env.production  # Edit with production values

# Build production images
make build

# Start production stack
make prod

# Run database migrations
make migrate

# Create initial admin user
docker exec -it unlockedv2-server-1 ./create-admin-user
```

### Production Docker Compose
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./config/nginx.prod.conf:/etc/nginx/nginx.conf:ro
      - /etc/nginx/ssl:/etc/nginx/ssl:ro
      - /var/log/nginx:/var/log/nginx
    depends_on:
      - frontend
      - server
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    environment:
      - NODE_ENV=production
    restart: unless-stopped

  server:
    build:
      context: ./backend
      dockerfile: Dockerfile
    env_file: .env.production
    depends_on:
      - db
      - kratos
      - hydra
      - nats
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:8080/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./config/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    ports:
      - "127.0.0.1:5432:5432"
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Additional production configurations for Kratos, Hydra, NATS...

volumes:
  postgres_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /opt/unlockEdv2/data/postgres

networks:
  default:
    name: unlocked_production
```

---

## ☸️ Kubernetes Deployment

### Helm Chart Deployment

#### 1. Prerequisites
```bash
# Add UnlockEd Helm repository
helm repo add unlocked https://charts.unlocked.example.com
helm repo update

# Or use local chart
cd config/helmchart
```

#### 2. Configuration Values
```yaml
# values.prod.yaml
global:
  domain: yourdomain.com
  environment: production

frontend:
  replicaCount: 3
  image:
    repository: unlocked/frontend
    tag: "latest"
  resources:
    requests:
      cpu: 100m
      memory: 128Mi
    limits:
      cpu: 500m
      memory: 256Mi

backend:
  replicaCount: 3
  image:
    repository: unlocked/backend
    tag: "latest"
  resources:
    requests:
      cpu: 200m
      memory: 256Mi
    limits:
      cpu: 1000m
      memory: 512Mi

database:
  enabled: true
  postgresql:
    auth:
      postgresPassword: "secure-postgres-password"
      username: "unlocked"
      password: "secure-user-password"
      database: "unlocked_production"
    persistence:
      size: 100Gi
      storageClass: "fast-ssd"

ingress:
  enabled: true
  className: "nginx"
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
  tls:
    - secretName: unlocked-tls
      hosts:
        - yourdomain.com

monitoring:
  enabled: true
  prometheus:
    enabled: true
  grafana:
    enabled: true
```

#### 3. Deploy to Kubernetes
```bash
# Create namespace
kubectl create namespace unlocked-prod

# Deploy with Helm
helm install unlocked-prod ./config/helmchart \
  -f values.prod.yaml \
  -n unlocked-prod

# Check deployment status
kubectl get pods -n unlocked-prod
kubectl get svc -n unlocked-prod
kubectl get ingress -n unlocked-prod

# View logs
kubectl logs -f deployment/unlocked-backend -n unlocked-prod
```

### Kubernetes Manifests

#### Deployment Example
```yaml
# k8s/backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: unlocked-backend
  namespace: unlocked-prod
spec:
  replicas: 3
  selector:
    matchLabels:
      app: unlocked-backend
  template:
    metadata:
      labels:
        app: unlocked-backend
    spec:
      containers:
      - name: backend
        image: unlocked/backend:latest
        ports:
        - containerPort: 8080
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: unlocked-secrets
              key: database-url
        - name: KRATOS_PUBLIC_URL
          value: "https://yourdomain.com/auth"
        resources:
          requests:
            cpu: 200m
            memory: 256Mi
          limits:
            cpu: 1000m
            memory: 512Mi
        livenessProbe:
          httpGet:
            path: /api/health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: unlocked-backend-service
  namespace: unlocked-prod
spec:
  selector:
    app: unlocked-backend
  ports:
  - port: 80
    targetPort: 8080
  type: ClusterIP
```

#### Ingress Configuration
```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: unlocked-ingress
  namespace: unlocked-prod
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "100m"
spec:
  tls:
  - hosts:
    - yourdomain.com
    secretName: unlocked-tls
  rules:
  - host: yourdomain.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: unlocked-backend-service
            port:
              number: 80
      - path: /
        pathType: Prefix
        backend:
          service:
            name: unlocked-frontend-service
            port:
              number: 80
```

---

## ☁️ Cloud Platform Deployment

### AWS Deployment

#### Using AWS ECS with Fargate
```yaml
# aws/task-definition.json
{
  "family": "unlocked-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::account:role/unlockedTaskRole",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "your-account.dkr.ecr.region.amazonaws.com/unlocked-backend:latest",
      "portMappings": [
        {
          "containerPort": 8080,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:unlocked/database-url"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/unlocked-backend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:8080/api/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3
      }
    }
  ]
}
```

#### AWS RDS Configuration
```bash
# Create RDS PostgreSQL instance
aws rds create-db-instance \
  --db-instance-identifier unlocked-prod-db \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --engine-version 16.1 \
  --master-username unlocked_admin \
  --master-user-password "secure-password" \
  --allocated-storage 100 \
  --vpc-security-group-ids sg-xxxxxxxxx \
  --db-subnet-group-name unlocked-subnet-group \
  --backup-retention-period 7 \
  --multi-az \
  --storage-encrypted \
  --deletion-protection
```

### Google Cloud Platform (GKE)

#### GKE Cluster Setup
```bash
# Create GKE cluster
gcloud container clusters create unlocked-cluster \
  --zone us-central1-a \
  --num-nodes 3 \
  --machine-type e2-standard-4 \
  --disk-size 50GB \
  --disk-type pd-ssd \
  --enable-autorepair \
  --enable-autoupgrade \
  --enable-autoscaling \
  --min-nodes 1 \
  --max-nodes 10

# Get cluster credentials
gcloud container clusters get-credentials unlocked-cluster --zone us-central1-a

# Deploy application
kubectl apply -f k8s/
```

#### Cloud SQL Configuration
```bash
# Create Cloud SQL PostgreSQL instance
gcloud sql instances create unlocked-db \
  --database-version POSTGRES_16 \
  --tier db-custom-2-7680 \
  --region us-central1 \
  --storage-size 100GB \
  --storage-type SSD \
  --backup-start-time 03:00 \
  --maintenance-window-day SUN \
  --maintenance-window-hour 05 \
  --enable-bin-log \
  --deletion-protection
```

### Azure Deployment (AKS)

#### AKS Cluster Setup
```bash
# Create resource group
az group create --name unlocked-rg --location eastus

# Create AKS cluster
az aks create \
  --resource-group unlocked-rg \
  --name unlocked-aks \
  --node-count 3 \
  --node-vm-size Standard_DS2_v2 \
  --enable-addons monitoring \
  --enable-autoscaler \
  --min-count 1 \
  --max-count 10 \
  --generate-ssh-keys

# Get cluster credentials
az aks get-credentials --resource-group unlocked-rg --name unlocked-aks
```

---

## ⚙️ Configuration Management

### Environment-Specific Configuration

#### Configuration Hierarchy
```
1. Default values (in code)
2. .env file
3. Environment variables
4. Command line arguments (highest priority)
```

#### Environment Files
```bash
# Development
.env.development
.env.local            # Local overrides (not committed)

# Testing  
.env.test
.env.test.local

# Production
.env.production
.env.production.local
```

### Secret Management

#### Using Docker Secrets
```yaml
# docker-compose.secrets.yml
version: '3.8'

services:
  server:
    secrets:
      - database_password
      - ory_token
      - aws_secret_key
    environment:
      - DATABASE_PASSWORD_FILE=/run/secrets/database_password
      - ORY_TOKEN_FILE=/run/secrets/ory_token
      - AWS_SECRET_ACCESS_KEY_FILE=/run/secrets/aws_secret_key

secrets:
  database_password:
    file: ./secrets/database_password.txt
  ory_token:
    file: ./secrets/ory_token.txt
  aws_secret_key:
    file: ./secrets/aws_secret_key.txt
```

#### Using Kubernetes Secrets
```bash
# Create secrets
kubectl create secret generic unlocked-secrets \
  --from-literal=database-password='secure-password' \
  --from-literal=ory-token='secure-ory-token' \
  --from-literal=aws-secret-key='aws-secret' \
  -n unlocked-prod

# Reference in deployment
env:
- name: DATABASE_PASSWORD
  valueFrom:
    secretKeyRef:
      name: unlocked-secrets
      key: database-password
```

#### Using Cloud Secret Managers
```go
// AWS Secrets Manager integration
func getSecretFromAWS(secretName string) (string, error) {
    sess := session.Must(session.NewSession())
    svc := secretsmanager.New(sess)
    
    input := &secretsmanager.GetSecretValueInput{
        SecretId: aws.String(secretName),
    }
    
    result, err := svc.GetSecretValue(input)
    if err != nil {
        return "", err
    }
    
    return *result.SecretString, nil
}
```

---

## 📊 Monitoring & Observability

### Application Monitoring

#### Prometheus Metrics
```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'unlocked-backend'
    static_configs:
      - targets: ['backend:8080']
    metrics_path: '/api/prometheus/metrics'
    scrape_interval: 15s

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx-exporter:9113']
```

#### Grafana Dashboards
```json
{
  "dashboard": {
    "title": "UnlockEd Application Metrics",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{ method }} {{ status }}"
          }
        ]
      },
      {
        "title": "Database Connections",
        "type": "singlestat",
        "targets": [
          {
            "expr": "pg_stat_database_numbackends{datname=\"unlocked_production\"}"
          }
        ]
      }
    ]
  }
}
```

### Logging Configuration

#### Structured Logging
```go
// Application logging configuration
logger := logrus.New()
logger.SetFormatter(&logrus.JSONFormatter{})

// Add correlation ID middleware
func correlationIDMiddleware() gin.HandlerFunc {
    return gin.HandlerFunc(func(c *gin.Context) {
        correlationID := uuid.New().String()
        c.Set("correlation_id", correlationID)
        c.Header("X-Correlation-ID", correlationID)
        c.Next()
    })
}
```

#### Log Aggregation
```yaml
# fluentd configuration
<source>
  @type forward
  port 24224
</source>

<filter **>
  @type record_transformer
  <record>
    hostname "#{Socket.gethostname}"
    environment "#{ENV['NODE_ENV']}"
  </record>
</filter>

<match **>
  @type elasticsearch
  host elasticsearch
  port 9200
  index_name unlocked-logs
</match>
```

### Health Checks

#### Application Health Endpoint
```go
func (srv *Server) handleHealth(w http.ResponseWriter, r *http.Request) error {
    health := map[string]interface{}{
        "status": "healthy",
        "timestamp": time.Now().UTC(),
        "version": os.Getenv("APP_VERSION"),
        "uptime": time.Since(srv.startTime).String(),
    }
    
    // Check database connectivity
    if err := srv.Db.Raw("SELECT 1").Error; err != nil {
        health["status"] = "unhealthy"
        health["database"] = "down"
        return writeJsonResponse(w, http.StatusServiceUnavailable, health)
    }
    health["database"] = "up"
    
    // Check NATS connectivity
    if srv.Nats == nil || srv.Nats.IsClosed() {
        health["status"] = "degraded"
        health["nats"] = "down"
    } else {
        health["nats"] = "up"
    }
    
    statusCode := http.StatusOK
    if health["status"] != "healthy" {
        statusCode = http.StatusServiceUnavailable
    }
    
    return writeJsonResponse(w, statusCode, health)
}
```

---

## 💾 Backup & Recovery

### Database Backup Strategy

#### Automated Backups
```bash
#!/bin/bash
# backup-database.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/backups/database"
BACKUP_FILE="$BACKUP_DIR/unlocked_backup_$DATE.sql"

# Create backup directory
mkdir -p $BACKUP_DIR

# Perform database backup
pg_dump $DATABASE_URL > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Upload to S3 (optional)
aws s3 cp $BACKUP_FILE.gz s3://unlocked-backups/database/

# Clean up local files older than 7 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE.gz"
```

#### Backup Automation with Cron
```bash
# Add to crontab
crontab -e

# Daily backup at 3 AM
0 3 * * * /opt/scripts/backup-database.sh

# Weekly full system backup at 2 AM Sunday
0 2 * * 0 /opt/scripts/backup-system.sh
```

### Point-in-Time Recovery
```bash
# Enable WAL archiving in postgresql.conf
wal_level = replica
archive_mode = on
archive_command = 'cp %p /opt/backups/wal/%f'

# Create base backup
pg_basebackup -D /opt/backups/base_$(date +%Y%m%d) -Ft -z

# Recovery configuration
# In recovery.conf (PostgreSQL < 12) or postgresql.conf (>= 12)
restore_command = 'cp /opt/backups/wal/%f %p'
recovery_target_time = '2024-01-01 12:00:00'
```

### Application Data Backup
```bash
#!/bin/bash
# backup-app-data.sh

BACKUP_DIR="/opt/backups/app-data"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup uploaded files
tar -czf $BACKUP_DIR/files_$DATE.tar.gz /opt/unlockEdv2/uploads/

# Backup configuration
tar -czf $BACKUP_DIR/config_$DATE.tar.gz /opt/unlockEdv2/config/

# Backup logs (last 30 days)
find /opt/unlockEdv2/logs/ -name "*.log" -mtime -30 | \
  tar -czf $BACKUP_DIR/logs_$DATE.tar.gz -T -
```

### Disaster Recovery Plan

#### Recovery Steps
1. **Assess Damage**: Determine scope of failure
2. **Restore Infrastructure**: Rebuild servers if necessary
3. **Restore Database**: From latest backup + WAL replay
4. **Restore Application**: Deploy from known good state
5. **Restore Data**: Files, configurations, logs
6. **Validate System**: Run health checks and tests
7. **Resume Operations**: Monitor for issues

#### RTO/RPO Targets
- **Recovery Time Objective (RTO)**: < 4 hours
- **Recovery Point Objective (RPO)**: < 1 hour
- **Mean Time to Recovery (MTTR)**: < 2 hours

---

## 🔒 Security Considerations

### Production Security Checklist

#### Network Security
- [ ] Enable firewall (UFW/iptables)
- [ ] Configure fail2ban for intrusion prevention
- [ ] Use VPN for administrative access
- [ ] Implement network segmentation
- [ ] Enable DDoS protection

#### Application Security
- [ ] Use HTTPS everywhere (TLS 1.3)
- [ ] Implement proper CORS policies
- [ ] Enable security headers (HSTS, CSP, etc.)
- [ ] Regular security updates
- [ ] Vulnerability scanning

#### Access Control
- [ ] Rotate all default credentials
- [ ] Implement SSH key-based authentication
- [ ] Use principle of least privilege
- [ ] Regular access review
- [ ] Multi-factor authentication

#### Data Protection
- [ ] Encrypt data at rest
- [ ] Encrypt data in transit
- [ ] Secure backup storage
- [ ] Audit logging enabled
- [ ] GDPR/compliance measures

### Security Configuration

#### Nginx Security Headers
```nginx
# nginx security configuration
server {
    # SSL/TLS configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" always;
    
    # Hide server version
    server_tokens off;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;
}
```

#### Database Security
```sql
-- Create restricted database user
CREATE USER unlocked_app WITH PASSWORD 'secure-random-password';

-- Grant minimal required permissions
GRANT CONNECT ON DATABASE unlocked_production TO unlocked_app;
GRANT USAGE ON SCHEMA public TO unlocked_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO unlocked_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO unlocked_app;

-- Enable row-level security for multi-tenancy
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY facility_isolation ON users 
  FOR ALL TO unlocked_app
  USING (facility_id = current_setting('app.current_facility_id')::int);
```

---

## 📈 Scaling & Performance

### Horizontal Scaling

#### Load Balancing Configuration
```nginx
# nginx load balancer
upstream backend_servers {
    least_conn;
    server backend1:8080 max_fails=3 fail_timeout=30s;
    server backend2:8080 max_fails=3 fail_timeout=30s;
    server backend3:8080 max_fails=3 fail_timeout=30s;
}

server {
    location /api {
        proxy_pass http://backend_servers;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Health check
        proxy_next_upstream error timeout http_500 http_502 http_503;
    }
}
```

#### Auto-scaling Configuration
```yaml
# kubernetes/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: unlocked-backend-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: unlocked-backend
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### Database Scaling

#### Read Replicas
```yaml
# postgresql-replica.yaml
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: postgres-cluster
spec:
  instances: 3
  
  postgresql:
    parameters:
      max_connections: "100"
      shared_buffers: "256MB"
      effective_cache_size: "1GB"
      
  bootstrap:
    initdb:
      database: unlocked_production
      owner: unlocked_user
      
  monitoring:
    enabled: true
```

#### Connection Pooling
```yaml
# pgbouncer configuration
databases:
  unlocked_production = host=postgres-primary port=5432 dbname=unlocked_production

[pgbouncer]
pool_mode = transaction
default_pool_size = 25
max_client_conn = 100
max_db_connections = 100
server_reset_query = DISCARD ALL
```

### Caching Strategy

#### Redis Configuration
```yaml
# redis.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        args: ["redis-server", "--appendonly", "yes"]
        ports:
        - containerPort: 6379
        volumeMounts:
        - name: redis-data
          mountPath: /data
      volumes:
      - name: redis-data
        persistentVolumeClaim:
          claimName: redis-pvc
```

#### Application Caching
```go
// Redis caching implementation
type CacheService struct {
    client *redis.Client
}

func (c *CacheService) Get(key string) (string, error) {
    val, err := c.client.Get(context.Background(), key).Result()
    if err == redis.Nil {
        return "", nil // Key doesn't exist
    }
    return val, err
}

func (c *CacheService) Set(key, value string, expiration time.Duration) error {
    return c.client.Set(context.Background(), key, value, expiration).Err()
}

// Usage in handlers
func (srv *Server) getUserWithCache(userID uint) (*models.User, error) {
    cacheKey := fmt.Sprintf("user:%d", userID)
    
    // Try cache first
    cached, err := srv.Cache.Get(cacheKey)
    if err == nil && cached != "" {
        var user models.User
        json.Unmarshal([]byte(cached), &user)
        return &user, nil
    }
    
    // Fallback to database
    user, err := srv.Db.GetUserByID(userID)
    if err != nil {
        return nil, err
    }
    
    // Cache for future requests
    userData, _ := json.Marshal(user)
    srv.Cache.Set(cacheKey, string(userData), 10*time.Minute)
    
    return user, nil
}
```

---

## 🐛 Troubleshooting

### Common Deployment Issues

#### Service Discovery Problems
```bash
# Check service connectivity
docker compose exec server ping db
docker compose exec server ping kratos
docker compose exec server nslookup kratos

# Check network configuration
docker network ls
docker network inspect unlockedv2_default
```

#### Database Connection Issues
```bash
# Test database connection
docker compose exec server psql $DATABASE_URL -c "SELECT 1"

# Check database logs
docker compose logs db

# Verify database is accepting connections
docker compose exec db pg_isready -U postgres
```

#### Authentication Service Issues
```bash
# Check Kratos health
curl http://127.0.0.1:4433/health/ready

# Check Hydra health  
curl http://127.0.0.1:4444/health/ready

# View auth service logs
docker compose logs kratos
docker compose logs hydra
```

### Performance Troubleshooting

#### Database Performance
```sql
-- Check slow queries
SELECT query, mean_exec_time, calls, total_exec_time 
FROM pg_stat_statements 
ORDER BY total_exec_time DESC 
LIMIT 10;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Check table sizes
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

#### Memory and CPU Monitoring
```bash
# Container resource usage
docker stats

# System resources
htop
iostat -x 1
free -h

# Application metrics
curl http://127.0.0.1:8080/api/prometheus/metrics | grep -E "(memory|cpu|http_request)"
```

### Log Analysis

#### Common Log Patterns
```bash
# Application errors
docker compose logs server | grep -E "(ERROR|FATAL|panic)"

# Authentication failures  
docker compose logs server | grep -E "(auth.*fail|unauthorized|forbidden)"

# Database connection issues
docker compose logs server | grep -E "(database.*connect|connection.*refused)"

# Performance issues
docker compose logs server | grep -E "(slow|timeout|performance)"
```

#### Log Aggregation Queries
```bash
# Using journalctl for systemd services
journalctl -u unlocked-backend -f --since "1 hour ago"

# Using ELK stack
# Elasticsearch query for errors
curl -X GET "localhost:9200/unlocked-logs-*/_search" -H 'Content-Type: application/json' -d'
{
  "query": {
    "bool": {
      "must": [
        {"range": {"@timestamp": {"gte": "now-1h"}}},
        {"match": {"level": "ERROR"}}
      ]
    }
  }
}'
```

This comprehensive deployment guide provides everything needed to successfully deploy UnlockEdv2 across various environments and platforms, from development to enterprise-scale production deployments.