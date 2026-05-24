# Deployment Guide - onulota eCommerce Platform

## Overview

This guide provides comprehensive instructions for deploying the onulota eCommerce Platform to production environments.

## Prerequisites

### System Requirements
- Node.js >= 18.0.0
- npm >= 9.0.0
- Docker >= 20.10.0
- Docker Compose >= 1.29.0
- MongoDB >= 4.4.0
- Redis >= 6.0.0

### Access Requirements
- GitHub repository access
- Docker Hub account (for image registry)
- Production server access (SSH)
- Domain name and SSL certificate
- Email service credentials (SendGrid or similar)
- Payment gateway credentials (SSLCommerz)

## Pre-Deployment Checklist

### Code Quality
- [ ] All tests passing: `npm run test:all`
- [ ] No linting errors: `npm run lint`
- [ ] No security vulnerabilities: `npm audit`
- [ ] No secrets in code: Gitleaks scan passes
- [ ] Code coverage >= 70%

### Environment Configuration
- [ ] Production `.env` files created
- [ ] All required environment variables set
- [ ] Database credentials configured
- [ ] Redis credentials configured
- [ ] JWT secrets configured (256+ bits)
- [ ] Payment gateway credentials configured
- [ ] Email service credentials configured
- [ ] CORS whitelist configured

### Infrastructure
- [ ] Production database provisioned
- [ ] Production Redis instance provisioned
- [ ] SSL certificate obtained
- [ ] Domain DNS configured
- [ ] Firewall rules configured
- [ ] Backup strategy planned

## Environment Variables

### Frontend (.env.production)
```bash
VITE_API_URL=https://api.yourdomain.com
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

### Backend (.env.production)
```bash
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/onulota
REDIS_URL=redis://user:password@redis-host:6379
JWT_SECRET=your_256_bit_secret_key_here
JWT_REFRESH_SECRET=your_256_bit_refresh_secret_key_here
BCRYPT_ROUNDS=12
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
SSLCOMMERZ_STORE_ID=your_store_id
SSLCOMMERZ_STORE_PASSWORD=your_store_password
FRONTEND_URL=https://yourdomain.com
CORS_ORIGIN=https://yourdomain.com
SENDGRID_API_KEY=your_sendgrid_api_key
```

## Deployment Methods

### Method 1: Docker Compose (Recommended for Small-Medium Scale)

#### Step 1: Prepare Server
```bash
# SSH into production server
ssh user@production-server

# Clone repository
git clone https://github.com/your-org/onulota-ecommerce-platform.git
cd onulota-ecommerce-platform

# Create production environment files
cp frontend/.env.example frontend/.env.production
cp backend/.env.example backend/.env.production

# Edit environment files with production values
nano frontend/.env.production
nano backend/.env.production
```

#### Step 2: Build Docker Images
```bash
# Build all images
docker-compose build

# Verify images built successfully
docker images | grep onulota
```

#### Step 3: Start Services
```bash
# Start all services in background
docker-compose up -d

# Verify services are running
docker-compose ps

# Check logs
docker-compose logs -f
```

#### Step 4: Initialize Database
```bash
# Run database migrations/seed
docker-compose exec backend npm run seed

# Verify data loaded
docker-compose exec backend npm run test:backend
```

#### Step 5: Verify Deployment
```bash
# Check health endpoint
curl https://yourdomain.com/api/health

# Run E2E tests
docker-compose exec frontend npm run test:e2e

# Check logs for errors
docker-compose logs backend
docker-compose logs frontend
```

### Method 2: Kubernetes (For Large-Scale Deployment)

#### Prerequisites
- Kubernetes cluster (EKS, GKE, AKS, or self-managed)
- kubectl configured
- Helm (optional, for package management)

#### Step 1: Create Kubernetes Manifests
```bash
# Create namespace
kubectl create namespace onulota

# Create ConfigMaps for environment variables
kubectl create configmap frontend-config \
  --from-file=.env.production=frontend/.env.production \
  -n onulota

kubectl create configmap backend-config \
  --from-file=.env.production=backend/.env.production \
  -n onulota
```

#### Step 2: Deploy Services
```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/frontend-deployment.yaml -n onulota
kubectl apply -f k8s/backend-deployment.yaml -n onulota
kubectl apply -f k8s/mongodb-statefulset.yaml -n onulota
kubectl apply -f k8s/redis-deployment.yaml -n onulota
kubectl apply -f k8s/nginx-ingress.yaml -n onulota

# Verify deployments
kubectl get deployments -n onulota
kubectl get pods -n onulota
```

#### Step 3: Configure Ingress
```bash
# Install Nginx Ingress Controller (if not already installed)
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install nginx-ingress ingress-nginx/ingress-nginx -n ingress-nginx --create-namespace

# Apply Ingress configuration
kubectl apply -f k8s/ingress.yaml -n onulota
```

#### Step 4: Monitor Deployment
```bash
# Watch deployment progress
kubectl rollout status deployment/frontend -n onulota
kubectl rollout status deployment/backend -n onulota

# Check logs
kubectl logs -f deployment/backend -n onulota
kubectl logs -f deployment/frontend -n onulota
```

### Method 3: Cloud Platform (AWS, GCP, Azure)

#### AWS Elastic Beanstalk
```bash
# Install EB CLI
pip install awsebcli

# Initialize EB application
eb init -p docker onulota-ecommerce

# Create environment
eb create production

# Deploy application
eb deploy

# Monitor deployment
eb status
eb logs
```

#### Google Cloud Run
```bash
# Build and push Docker image
gcloud builds submit --tag gcr.io/PROJECT_ID/onulota-backend

# Deploy to Cloud Run
gcloud run deploy onulota-backend \
  --image gcr.io/PROJECT_ID/onulota-backend \
  --platform managed \
  --region us-central1 \
  --set-env-vars MONGODB_URI=$MONGODB_URI,REDIS_URL=$REDIS_URL
```

## Post-Deployment Verification

### Health Checks
```bash
# Check API health
curl https://yourdomain.com/api/health

# Check database connection
curl https://yourdomain.com/api/health | jq '.database'

# Check Redis connection
curl https://yourdomain.com/api/health | jq '.redis'
```

### Smoke Tests
```bash
# Run E2E tests against production
npm run test:e2e -- --baseURL=https://yourdomain.com

# Test critical flows:
# 1. User registration
# 2. User login
# 3. Product browsing
# 4. Add to cart
# 5. Checkout (COD)
# 6. Admin operations
```

### Performance Monitoring
```bash
# Run Lighthouse audit
npm run lighthouse -- https://yourdomain.com

# Check Core Web Vitals
# - Largest Contentful Paint (LCP): < 2.5s
# - First Input Delay (FID): < 100ms
# - Cumulative Layout Shift (CLS): < 0.1
```

### Security Verification
```bash
# Check SSL certificate
openssl s_client -connect yourdomain.com:443

# Verify security headers
curl -I https://yourdomain.com | grep -E "Strict-Transport-Security|X-Frame-Options|X-Content-Type-Options"

# Run security scan
npm audit
```

## Monitoring and Logging

### Application Monitoring
- Set up monitoring with:
  - Datadog
  - New Relic
  - Prometheus + Grafana
  - CloudWatch (AWS)
  - Stackdriver (GCP)

### Log Aggregation
- Configure centralized logging:
  - ELK Stack (Elasticsearch, Logstash, Kibana)
  - Splunk
  - CloudWatch Logs (AWS)
  - Cloud Logging (GCP)

### Alerts
- Set up alerts for:
  - High error rates (> 1%)
  - High response times (> 1s)
  - Database connection failures
  - Redis connection failures
  - Disk space low (< 10%)
  - Memory usage high (> 80%)

## Backup and Recovery

### Database Backups
```bash
# MongoDB backup
mongodump --uri="mongodb+srv://user:password@cluster.mongodb.net/onulota" --out=/backups/mongodb

# Automated backups (daily)
0 2 * * * mongodump --uri="$MONGODB_URI" --out=/backups/mongodb-$(date +\%Y\%m\%d)
```

### Redis Backups
```bash
# Redis backup
redis-cli --rdb /backups/redis.rdb

# Automated backups (daily)
0 3 * * * redis-cli --rdb /backups/redis-$(date +\%Y\%m\%d).rdb
```

### Disaster Recovery Plan
- [ ] Backup strategy documented
- [ ] Recovery procedures tested
- [ ] RTO (Recovery Time Objective) defined
- [ ] RPO (Recovery Point Objective) defined
- [ ] Backup retention policy set

## Scaling Strategies

### Horizontal Scaling
- Add more backend instances behind load balancer
- Use auto-scaling groups based on CPU/memory metrics
- Configure database read replicas

### Vertical Scaling
- Increase server resources (CPU, RAM)
- Upgrade database instance size
- Increase Redis memory allocation

### Caching Strategy
- Redis caching for:
  - Category tree (1-hour TTL)
  - Featured products (15-minute TTL)
  - Product lists (5-minute TTL)
- CDN for static assets (images, CSS, JS)

### Database Optimization
- Add indexes for frequently queried fields
- Use database connection pooling
- Implement query optimization
- Archive old data

## Rollback Procedures

### Docker Compose Rollback
```bash
# Stop current deployment
docker-compose down

# Checkout previous version
git checkout previous-tag

# Rebuild and restart
docker-compose up -d
```

### Kubernetes Rollback
```bash
# Check rollout history
kubectl rollout history deployment/backend -n onulota

# Rollback to previous version
kubectl rollout undo deployment/backend -n onulota

# Verify rollback
kubectl rollout status deployment/backend -n onulota
```

## Maintenance

### Regular Tasks
- [ ] Monitor application logs daily
- [ ] Check system resources weekly
- [ ] Review security alerts weekly
- [ ] Update dependencies monthly
- [ ] Run security audits monthly
- [ ] Test backup/recovery quarterly
- [ ] Review performance metrics quarterly

### Updates and Patches
```bash
# Update dependencies
npm update

# Security patches
npm audit fix

# Major version updates
npm install package@latest

# Test updates
npm run test:all

# Deploy updates
git commit -m "Update dependencies"
git push
# Trigger CI/CD pipeline
```

## Troubleshooting

### Common Issues

#### Application Won't Start
```bash
# Check logs
docker-compose logs backend

# Verify environment variables
docker-compose exec backend env | grep MONGODB

# Check database connection
docker-compose exec backend npm run test:backend
```

#### High Memory Usage
```bash
# Check memory usage
docker stats

# Restart services
docker-compose restart backend

# Increase memory limit in docker-compose.yml
```

#### Database Connection Errors
```bash
# Check MongoDB connection
docker-compose exec backend mongo $MONGODB_URI

# Check Redis connection
docker-compose exec backend redis-cli -u $REDIS_URL ping
```

#### Slow Performance
```bash
# Check database indexes
docker-compose exec backend npm run check-indexes

# Check Redis cache hit rate
docker-compose exec redis redis-cli info stats

# Run Lighthouse audit
npm run lighthouse
```

## Support and Documentation

### Resources
- [Project README](./README.md)
- [Testing Guide](./TESTING_QUICK_START.md)
- [E2E Testing Guide](./E2E_TESTING_GUIDE.md)
- [Implementation Status](./IMPLEMENTATION_STATUS.md)

### Contact
- Development Team: dev@yourdomain.com
- Operations Team: ops@yourdomain.com
- Support: support@yourdomain.com

## Checklist for Production Deployment

- [ ] All tests passing
- [ ] No security vulnerabilities
- [ ] Environment variables configured
- [ ] Database provisioned and seeded
- [ ] Redis provisioned
- [ ] SSL certificate installed
- [ ] Domain DNS configured
- [ ] Firewall rules configured
- [ ] Monitoring configured
- [ ] Logging configured
- [ ] Backup strategy implemented
- [ ] Disaster recovery plan tested
- [ ] Load balancer configured
- [ ] CDN configured (optional)
- [ ] Health checks passing
- [ ] Smoke tests passing
- [ ] Performance acceptable
- [ ] Security headers verified
- [ ] Documentation updated
- [ ] Team trained on deployment

## Post-Deployment

### Day 1
- Monitor application closely
- Check error rates and performance
- Verify all critical flows working
- Respond to any issues immediately

### Week 1
- Monitor metrics and logs
- Gather user feedback
- Fix any critical issues
- Optimize performance if needed

### Month 1
- Review performance metrics
- Analyze user behavior
- Plan improvements
- Schedule maintenance windows

---

**Last Updated**: May 17, 2026  
**Status**: Ready for Production Deployment
