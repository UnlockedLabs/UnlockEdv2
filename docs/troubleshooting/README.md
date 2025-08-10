# Troubleshooting Guide

This comprehensive troubleshooting guide helps developers and administrators diagnose and resolve common issues with UnlockEdv2 across development, staging, and production environments.

## 📋 Table of Contents
- [Quick Diagnostics](#quick-diagnostics)
- [Authentication Issues](#authentication-issues)
- [Database Problems](#database-problems)
- [API and Backend Issues](#api-and-backend-issues)
- [Frontend Problems](#frontend-problems)
- [Integration Failures](#integration-failures)
- [Performance Issues](#performance-issues)
- [Deployment Problems](#deployment-problems)
- [Logging and Monitoring](#logging-and-monitoring)
- [Emergency Procedures](#emergency-procedures)

## 🚨 Quick Diagnostics

### System Health Check
```bash
# Quick system status check
curl -s http://127.0.0.1:8080/api/health | jq '.'

# Check all services
docker compose ps

# View recent logs
docker compose logs --tail=50 server
docker compose logs --tail=50 frontend
docker compose logs --tail=50 db
```

### Service Connectivity Test
```bash
# Test database connection
docker compose exec server psql $DATABASE_URL -c "SELECT 1"

# Test NATS connection
docker compose exec server nats-cli stream ls

# Test external services
curl -s http://127.0.0.1:4433/health/ready  # Kratos
curl -s http://127.0.0.1:4444/health/ready  # Hydra
```

### Common Quick Fixes
```bash
# Clear cookies (browser issue)
# Go to browser settings and clear cookies for 127.0.0.1

# Restart services
docker compose restart

# Fresh database migration
make migrate-fresh

# Clean Docker resources
docker system prune -a
docker volume prune
```

---

## 🔐 Authentication Issues

### "Invalid ory session, please clear your cookies"

#### Symptoms
- Users redirected to login repeatedly
- "Invalid ory session" error in logs
- Authentication works briefly then fails

#### Diagnosis
```bash
# Check Kratos health
curl -v http://127.0.0.1:4433/health/ready

# Check session validation
curl -v -H "Cookie: ory_kratos_session=your-session-here" \
  http://127.0.0.1:4433/sessions/whoami

# Check logs for authentication errors
docker compose logs kratos | grep -i error
docker compose logs server | grep -i "auth\|session"
```

#### Solutions
1. **Clear Browser Cookies**
   ```bash
   # In browser developer tools:
   # Application -> Storage -> Clear storage
   # Or manually clear cookies for 127.0.0.1
   ```

2. **Restart Authentication Services**
   ```bash
   docker compose restart kratos hydra
   # Wait 10 seconds
   docker compose restart server
   ```

3. **Check Environment Configuration**
   ```bash
   # Verify URLs in .env
   grep -E "KRATOS|HYDRA|APP_URL" .env
   
   # URLs must use 127.0.0.1, not localhost
   APP_URL=http://127.0.0.1
   KRATOS_PUBLIC_URL=http://127.0.0.1:4433
   ```

### "User not found after login"

#### Symptoms
- Successful Kratos authentication
- "User not found" or "Invalid kratos_id" errors
- Database has no matching user record

#### Diagnosis
```bash
# Check Kratos identities
curl -H "Authorization: Bearer $ORY_TOKEN" \
  http://kratos:4434/admin/identities | jq '.[] | {id, traits.username}'

# Check user records
psql $DATABASE_URL -c "SELECT id, username, kratos_id FROM users LIMIT 10;"

# Look for orphaned identities
psql $DATABASE_URL -c "
  SELECT k.id as kratos_id, u.id as user_id 
  FROM (SELECT 'kratos-id-here' as id) k 
  LEFT JOIN users u ON u.kratos_id = k.id;"
```

#### Solutions
1. **Sync Identities with Database**
   ```bash
   # Clean up orphaned Kratos identities
   curl -X DELETE -H "Authorization: Bearer $ORY_TOKEN" \
     http://127.0.0.1:8080/api/identities/sync
   ```

2. **Create Missing User Records**
   ```sql
   -- Insert missing user (replace values)
   INSERT INTO users (username, name_first, name_last, email, role, facility_id, kratos_id) 
   VALUES ('admin', 'System', 'Admin', 'admin@example.com', 'system_admin', 1, 'kratos-id-here');
   ```

3. **Reset Authentication System**
   ```bash
   # Nuclear option - recreates all auth data
   docker compose down
   docker volume rm unlockedv2_kratos_data unlockedv2_hydra_data
   docker compose up -d
   make migrate-fresh
   make seed
   ```

### Permission Denied / Unauthorized Errors

#### Symptoms
- "User is not allowed to view this resource" 
- 401/403 HTTP responses
- Users can't access expected features

#### Diagnosis
```bash
# Check user role and permissions
psql $DATABASE_URL -c "
  SELECT u.username, u.role, u.facility_id, f.name as facility_name 
  FROM users u 
  JOIN facilities f ON u.facility_id = f.id 
  WHERE u.username = 'problematic-user';"

# Check feature flags
psql $DATABASE_URL -c "SELECT name, enabled FROM feature_flags;"

# Check claims in logs
docker compose logs server | grep -A5 -B5 "claims\|permission"
```

#### Solutions
1. **Update User Role**
   ```sql
   UPDATE users SET role = 'facility_admin' WHERE username = 'user123';
   ```

2. **Enable Feature Flags**
   ```sql
   UPDATE feature_flags SET enabled = true WHERE name = 'program_management';
   ```

3. **Check Route Resolvers**
   ```bash
   # Verify resource belongs to user's facility
   psql $DATABASE_URL -c "
     SELECT pc.id, pc.name, pc.facility_id, u.facility_id as user_facility 
     FROM program_classes pc, users u 
     WHERE u.username = 'user123' AND pc.id = 456;"
   ```

---

## 🗄️ Database Problems

### Database Connection Refused

#### Symptoms
- "connection refused" errors
- Application fails to start
- Database queries timeout

#### Diagnosis
```bash
# Check database container status
docker compose ps db

# Check database logs
docker compose logs db

# Test connection directly
docker compose exec db psql -U postgres -c "SELECT 1"

# Check network connectivity
docker compose exec server ping db
```

#### Solutions
1. **Restart Database Service**
   ```bash
   docker compose restart db
   # Wait for health check to pass
   docker compose exec db pg_isready -U postgres
   ```

2. **Check Database Configuration**
   ```bash
   # Verify environment variables
   grep -E "DATABASE_URL|POSTGRES" .env
   
   # Test connection string
   docker compose exec server psql $DATABASE_URL -c "SELECT version();"
   ```

3. **Reset Database**
   ```bash
   # Full database reset
   docker compose down
   docker volume rm unlockedv2_postgres_data
   docker compose up -d db
   make migrate
   ```

### Migration Failures

#### Symptoms
- "migration failed" errors
- "table already exists" errors
- Inconsistent database schema

#### Diagnosis
```bash
# Check migration status
docker compose exec server ./migrate -path ./migrations \
  -database $DATABASE_URL version

# Check failed migration
docker compose logs server | grep -i migration

# Verify table structure
psql $DATABASE_URL -c "\dt"  # List tables
psql $DATABASE_URL -c "\d users"  # Describe specific table
```

#### Solutions
1. **Fix Failed Migration**
   ```bash
   # Check which migration failed
   psql $DATABASE_URL -c "SELECT * FROM schema_migrations ORDER BY version DESC LIMIT 5;"
   
   # Manually fix the issue and retry
   make migrate
   ```

2. **Force Migration Version**
   ```bash
   # Set to specific version (use carefully)
   docker compose exec server ./migrate -path ./migrations \
     -database $DATABASE_URL force 42
   ```

3. **Fresh Migration** 
   ```bash
   # Complete reset (destroys data)
   make migrate-fresh
   make seed  # Restore test data
   ```

### Slow Query Performance

#### Symptoms
- Long response times
- Database CPU high
- Query timeouts

#### Diagnosis
```sql
-- Check slow queries
SELECT query, mean_exec_time, calls, total_exec_time 
FROM pg_stat_statements 
ORDER BY total_exec_time DESC 
LIMIT 10;

-- Check missing indexes
SELECT schemaname, tablename, attname, n_distinct, correlation 
FROM pg_stats 
WHERE schemaname = 'public' 
ORDER BY n_distinct DESC;

-- Check table sizes
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

#### Solutions
1. **Add Missing Indexes**
   ```sql
   -- Common indexes for performance
   CREATE INDEX CONCURRENTLY idx_activities_user_created 
   ON activities(user_id, created_at);
   
   CREATE INDEX CONCURRENTLY idx_enrollments_status_class 
   ON program_class_enrollments(enrollment_status, class_id);
   ```

2. **Optimize Queries**
   ```sql
   -- Use EXPLAIN to analyze query plans
   EXPLAIN (ANALYZE, BUFFERS) 
   SELECT * FROM users u 
   JOIN program_class_enrollments e ON u.id = e.user_id 
   WHERE u.facility_id = 1;
   ```

3. **Database Maintenance**
   ```bash
   # Vacuum and analyze
   docker compose exec db psql -U postgres -c "VACUUM ANALYZE;"
   
   # Update table statistics
   docker compose exec db psql -U postgres -c "ANALYZE;"
   ```

---

## 🔧 API and Backend Issues

### 500 Internal Server Error

#### Symptoms
- Generic "Internal server error" responses
- API endpoints returning 500 status codes
- Minimal error information in response

#### Diagnosis
```bash
# Check backend logs for stack traces
docker compose logs server | grep -A10 -B10 "panic\|ERROR\|FATAL"

# Check specific endpoint
curl -v -H "Cookie: ory_kratos_session=$SESSION" \
  http://127.0.0.1:8080/api/users

# Enable debug logging
export LOG_LEVEL=debug
docker compose restart server
```

#### Solutions
1. **Check Application Logs**
   ```bash
   # Full error details
   docker compose logs server --tail=100 -f
   
   # Look for specific patterns
   docker compose logs server | grep -E "(database|auth|panic)"
   ```

2. **Verify Dependencies**
   ```bash
   # Check all required services
   docker compose ps
   
   # Test service connectivity
   docker compose exec server ping db
   docker compose exec server ping kratos
   ```

3. **Restart Backend Service**
   ```bash
   docker compose restart server
   # Monitor startup logs
   docker compose logs server -f
   ```

### API Rate Limiting Issues

#### Symptoms
- "Rate limit exceeded" responses
- 429 HTTP status codes
- Intermittent API failures

#### Diagnosis
```bash
# Check rate limiting configuration
grep -r "rate\|limit" backend/src/handlers/

# Monitor API request patterns
docker compose logs server | grep -E "rate|limit|429"

# Check current request rates
curl -v http://127.0.0.1:8080/api/health
```

#### Solutions
1. **Adjust Rate Limits**
   ```go
   // In middleware configuration
   limit_req_zone $binary_remote_addr zone=api:10m rate=100r/s;  // Increase rate
   limit_req zone=api burst=50 nodelay;  // Increase burst
   ```

2. **Implement Request Batching**
   ```bash
   # Instead of multiple requests, batch operations
   curl -X POST http://127.0.0.1:8080/api/users/batch \
     -d '{"users": [user1, user2, user3]}'
   ```

### JSON Parsing Errors

#### Symptoms
- "Invalid JSON" errors
- Request body parsing failures
- Malformed request errors

#### Diagnosis
```bash
# Test API endpoint with valid JSON
curl -X POST -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@example.com"}' \
  http://127.0.0.1:8080/api/users

# Check request content-type
curl -v -H "Content-Type: application/json" \
  http://127.0.0.1:8080/api/endpoint
```

#### Solutions
1. **Validate JSON Payload**
   ```bash
   # Use jq to validate JSON
   echo '{"invalid": json}' | jq .  # Should show error
   echo '{"valid": "json"}' | jq .  # Should parse successfully
   ```

2. **Check Content-Type Headers**
   ```bash
   # Ensure proper headers
   curl -X POST \
     -H "Content-Type: application/json" \
     -H "Accept: application/json" \
     -d '{"valid": "json"}' \
     http://127.0.0.1:8080/api/endpoint
   ```

---

## 🎨 Frontend Problems

### White Screen / Application Won't Load

#### Symptoms
- Blank white screen
- No React components render
- Console shows JavaScript errors

#### Diagnosis
```bash
# Check frontend container status
docker compose ps frontend

# Check frontend build logs
docker compose logs frontend

# Check browser console for errors
# Open browser dev tools -> Console tab

# Test frontend directly
curl http://127.0.0.1:3000
```

#### Solutions
1. **Check Build Process**
   ```bash
   # Restart frontend service
   docker compose restart frontend
   
   # Rebuild frontend
   docker compose build frontend
   docker compose up -d frontend
   ```

2. **Clear Browser Cache**
   ```bash
   # Hard refresh (Ctrl+F5 or Cmd+Shift+R)
   # Or clear browser cache completely
   ```

3. **Check Environment Variables**
   ```bash
   # Verify frontend environment
   docker compose exec frontend env | grep -E "NODE_ENV|VITE"
   ```

### API Requests Failing (CORS)

#### Symptoms
- "CORS error" in browser console
- API requests blocked
- "Access-Control-Allow-Origin" errors

#### Diagnosis
```bash
# Check CORS headers
curl -v -H "Origin: http://127.0.0.1:3000" \
  http://127.0.0.1:8080/api/health

# Check nginx configuration
docker compose exec nginx cat /etc/nginx/nginx.conf | grep -A10 -B10 cors
```

#### Solutions
1. **Configure CORS Headers**
   ```go
   // In backend CORS middleware
   w.Header().Set("Access-Control-Allow-Origin", "http://127.0.0.1:3000")
   w.Header().Set("Access-Control-Allow-Credentials", "true")
   w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
   ```

2. **Update Nginx Configuration**
   ```nginx
   # In nginx.conf
   add_header Access-Control-Allow-Origin "http://127.0.0.1:3000" always;
   add_header Access-Control-Allow-Credentials "true" always;
   ```

### Authentication State Issues

#### Symptoms
- User appears logged out after refresh
- Authentication state not persisting
- Login successful but UI shows logged out

#### Diagnosis
```bash
# Check cookies in browser dev tools
# Application -> Cookies -> 127.0.0.1

# Check authentication endpoint
curl -v -H "Cookie: ory_kratos_session=$SESSION" \
  http://127.0.0.1:8080/api/auth

# Check frontend authentication logic
docker compose logs frontend | grep -i auth
```

#### Solutions
1. **Check Cookie Configuration**
   ```javascript
   // Verify fetch credentials
   fetch('/api/auth', { credentials: 'include' })
   ```

2. **Clear Authentication State**
   ```bash
   # Clear browser storage
   # Dev tools -> Application -> Local Storage -> Clear all
   # Dev tools -> Application -> Cookies -> Delete all
   ```

### Build Failures

#### Symptoms
- Frontend container fails to start
- "npm run build" errors
- TypeScript compilation errors

#### Diagnosis
```bash
# Check build logs
docker compose logs frontend

# Run build locally
cd frontend
yarn build

# Check TypeScript errors
cd frontend
yarn tsc --noEmit
```

#### Solutions
1. **Fix TypeScript Errors**
   ```bash
   # Check specific errors
   cd frontend
   yarn tsc --noEmit --pretty
   
   # Fix import/export issues
   # Update type definitions
   ```

2. **Clear Node Modules**
   ```bash
   # Clean install
   docker compose down
   docker volume rm unlockedv2_node_modules
   docker compose up -d frontend
   ```

---

## 🔗 Integration Failures

### LMS Platform Connection Issues

#### Symptoms
- "Provider platform not responding" errors
- Sync jobs failing
- User/course data not updating

#### Diagnosis
```bash
# Check provider platform status
psql $DATABASE_URL -c "
  SELECT id, name, type, state, base_url 
  FROM provider_platforms 
  WHERE state = 'enabled';"

# Test provider connectivity
curl -v "https://canvas.example.com/api/v1/accounts/self" \
  -H "Authorization: Bearer $CANVAS_TOKEN"

# Check sync job logs
docker compose logs server | grep -i "sync\|provider"
```

#### Solutions
1. **Verify Provider Configuration**
   ```sql
   -- Check provider settings
   SELECT * FROM provider_platforms WHERE id = 1;
   
   -- Update base URL or credentials
   UPDATE provider_platforms 
   SET base_url = 'https://new-canvas-url.com', 
       access_key = 'new-token-here' 
   WHERE id = 1;
   ```

2. **Test API Credentials**
   ```bash
   # Test Canvas API
   curl -H "Authorization: Bearer $TOKEN" \
     "https://canvas.example.com/api/v1/accounts/self"
   
   # Test Kolibri API
   curl -u "username:password" \
     "http://kolibri.example.com/api/auth/session/"
   ```

3. **Restart Sync Jobs**
   ```bash
   # Trigger manual sync
   curl -X POST -H "Cookie: ory_kratos_session=$SESSION" \
     http://127.0.0.1:8080/api/provider-platforms/sync \
     -d '{"platform_ids": [1]}'
   ```

### Content Provider Issues

#### Symptoms
- YouTube videos not downloading
- Kiwix libraries not accessible
- Content proxy returning errors

#### Diagnosis
```bash
# Check video download status
psql $DATABASE_URL -c "
  SELECT id, title, availability, external_url 
  FROM videos 
  WHERE availability != 'available' 
  ORDER BY created_at DESC 
  LIMIT 10;"

# Test video download manually
docker compose exec server yt-dlp --version
docker compose exec server yt-dlp -f "best[height<=720]" \
  "https://youtube.com/watch?v=test"

# Check library proxy
curl -v http://127.0.0.1:8080/api/libraries/1/proxy/
```

#### Solutions
1. **Fix Video Download Issues**
   ```bash
   # Update yt-dlp
   docker compose exec server pip install --upgrade yt-dlp
   
   # Check disk space
   docker compose exec server df -h
   
   # Clear failed videos
   psql $DATABASE_URL -c "
     UPDATE videos SET availability = 'processing' 
     WHERE availability = 'has_error';"
   ```

2. **Restart Content Services**
   ```bash
   # Restart Kiwix server
   docker compose restart kiwix
   
   # Check Kiwix catalog
   curl http://kiwix:3000/catalog/v2/entries
   ```

---

## ⚡ Performance Issues

### Slow Page Load Times

#### Symptoms
- Pages take >3 seconds to load
- High memory usage
- Browser becomes unresponsive

#### Diagnosis
```bash
# Check bundle sizes
cd frontend
yarn build --analyze

# Check backend performance
curl -w "@curl-format.txt" -s -o /dev/null \
  http://127.0.0.1:8080/api/dashboard

# Monitor resource usage
docker stats

# Check database performance
psql $DATABASE_URL -c "
  SELECT query, mean_exec_time, calls 
  FROM pg_stat_statements 
  ORDER BY mean_exec_time DESC 
  LIMIT 10;"
```

#### Solutions
1. **Optimize Frontend Bundle**
   ```bash
   # Analyze bundle size
   cd frontend
   yarn build --analyze
   
   # Implement lazy loading
   # Split large components
   # Remove unused dependencies
   ```

2. **Database Query Optimization**
   ```sql
   -- Add missing indexes
   CREATE INDEX CONCURRENTLY idx_activities_user_created 
   ON activities(user_id, created_at);
   
   -- Optimize N+1 queries with preloading
   ```

3. **Enable Caching**
   ```bash
   # Add Redis for caching
   # Configure CDN for static assets
   # Implement HTTP caching headers
   ```

### High Memory Usage

#### Symptoms
- Containers being killed (OOMKilled)
- System becoming slow/unresponsive
- Memory usage continuously increasing

#### Diagnosis
```bash
# Check container memory usage
docker stats --no-stream

# Check system memory
free -h

# Check for memory leaks
docker compose exec server pprof -http=:6060 ./server

# Database memory usage
psql $DATABASE_URL -c "
  SELECT 
    name,
    setting,
    unit,
    context 
  FROM pg_settings 
  WHERE name IN ('shared_buffers', 'work_mem', 'effective_cache_size');"
```

#### Solutions
1. **Optimize Database Memory Settings**
   ```sql
   -- PostgreSQL memory configuration
   ALTER SYSTEM SET shared_buffers = '256MB';
   ALTER SYSTEM SET work_mem = '4MB';
   ALTER SYSTEM SET effective_cache_size = '1GB';
   SELECT pg_reload_conf();
   ```

2. **Configure Container Memory Limits**
   ```yaml
   # docker-compose.yml
   services:
     server:
       deploy:
         resources:
           limits:
             memory: 512M
           reservations:
             memory: 256M
   ```

3. **Fix Memory Leaks**
   ```go
   // Close database connections properly
   defer rows.Close()
   
   // Use connection pooling
   db.SetMaxOpenConns(25)
   db.SetMaxIdleConns(5)
   db.SetConnMaxLifetime(5 * time.Minute)
   ```

---

## 🚀 Deployment Problems

### Docker Compose Issues

#### Symptoms
- Services fail to start
- Network connectivity problems
- Volume mount issues

#### Diagnosis
```bash
# Check service status
docker compose ps

# Check logs for all services
docker compose logs

# Check networks
docker network ls
docker network inspect unlockedv2_default

# Check volumes
docker volume ls
docker volume inspect unlockedv2_postgres_data
```

#### Solutions
1. **Restart Services in Order**
   ```bash
   # Stop all services
   docker compose down
   
   # Start core services first
   docker compose up -d db nats kratos hydra
   sleep 10
   
   # Start application services
   docker compose up -d server frontend nginx
   ```

2. **Fix Network Issues**
   ```bash
   # Recreate networks
   docker compose down
   docker network prune
   docker compose up -d
   ```

3. **Fix Volume Issues**
   ```bash
   # Check volume permissions
   docker compose exec server ls -la /data/
   
   # Fix ownership issues
   docker compose exec server chown -R app:app /data/
   ```

### Kubernetes Deployment Issues

#### Symptoms
- Pods stuck in pending/error state
- Services not accessible
- Resource constraints

#### Diagnosis
```bash
# Check pod status
kubectl get pods -n unlocked-prod

# Check events
kubectl get events -n unlocked-prod --sort-by='.lastTimestamp'

# Describe problematic pods
kubectl describe pod unlocked-backend-xxx -n unlocked-prod

# Check logs
kubectl logs -f deployment/unlocked-backend -n unlocked-prod
```

#### Solutions
1. **Resource Issues**
   ```bash
   # Check node resources
   kubectl describe nodes
   
   # Adjust resource requests/limits
   kubectl patch deployment unlocked-backend -p '
   {
     "spec": {
       "template": {
         "spec": {
           "containers": [{
             "name": "backend",
             "resources": {
               "requests": {"memory": "256Mi", "cpu": "200m"},
               "limits": {"memory": "512Mi", "cpu": "500m"}
             }
           }]
         }
       }
     }
   }'
   ```

2. **Image Pull Issues**
   ```bash
   # Check image pull secrets
   kubectl get secrets -n unlocked-prod
   
   # Update image pull policy
   kubectl patch deployment unlocked-backend -p '
   {
     "spec": {
       "template": {
         "spec": {
           "containers": [{
             "name": "backend",
             "imagePullPolicy": "Always"
           }]
         }
       }
     }
   }'
   ```

---

## 📊 Logging and Monitoring

### Log Analysis

#### Common Log Patterns
```bash
# Authentication errors
docker compose logs server | grep -E "auth.*error|unauthorized|forbidden"

# Database connection issues
docker compose logs server | grep -E "database.*error|connection.*refused|timeout"

# API errors
docker compose logs server | grep -E "500|error|panic|fatal"

# Performance issues
docker compose logs server | grep -E "slow|timeout|memory|cpu"
```

#### Structured Log Queries
```bash
# Using jq for JSON logs
docker compose logs server --tail=1000 | \
  grep '{"level"' | jq 'select(.level == "error")'

# Filter by time range
docker compose logs server --since="1h" | \
  grep '{"level"' | jq 'select(.time > "2024-01-01T10:00:00Z")'

# Group errors by message
docker compose logs server --tail=1000 | \
  grep '{"level"' | jq -r 'select(.level == "error") | .message' | \
  sort | uniq -c | sort -nr
```

### Monitoring Setup

#### Health Check Monitoring
```bash
# Set up health check monitoring
#!/bin/bash
# health-monitor.sh
while true; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/api/health)
    if [ "$STATUS" -ne 200 ]; then
        echo "$(date): Health check failed with status $STATUS"
        # Send alert
        curl -X POST -H 'Content-type: application/json' \
          --data '{"text":"UnlockEd health check failed!"}' \
          $SLACK_WEBHOOK_URL
    fi
    sleep 30
done
```

#### Metrics Collection
```bash
# Prometheus metrics endpoint
curl http://127.0.0.1:8080/api/prometheus/metrics

# Key metrics to monitor
grep -E "(http_requests_total|http_request_duration|database_connections|active_users)" \
  <(curl -s http://127.0.0.1:8080/api/prometheus/metrics)
```

---

## 🆘 Emergency Procedures

### System Recovery

#### Complete System Failure
```bash
# 1. Stop all services
docker compose down

# 2. Check system resources
df -h  # Disk space
free -h  # Memory
top  # CPU usage

# 3. Clean up resources
docker system prune -a
docker volume prune

# 4. Restore from backup
pg_restore -d $DATABASE_URL backup.dump

# 5. Restart services
docker compose up -d

# 6. Verify system health
curl http://127.0.0.1:8080/api/health
```

#### Data Corruption Recovery
```bash
# 1. Stop application services
docker compose stop server frontend

# 2. Backup current state
pg_dump $DATABASE_URL > corrupted_backup_$(date +%Y%m%d).sql

# 3. Restore from last good backup
pg_restore -d $DATABASE_URL last_good_backup.dump

# 4. Run integrity checks
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM programs;"

# 5. Restart services
docker compose start server frontend
```

#### Security Incident Response
```bash
# 1. Immediate isolation
# Block suspicious IP addresses
iptables -A INPUT -s suspicious.ip.address -j DROP

# 2. Rotate all secrets
# Generate new database passwords
# Update API tokens
# Regenerate JWT secrets

# 3. Check for unauthorized access
psql $DATABASE_URL -c "
  SELECT username, last_login, failed_attempts 
  FROM login_metrics 
  ORDER BY last_login DESC;"

# 4. Review audit logs
docker compose logs server | grep -E "auth|login|admin" > security_audit.log

# 5. Reset user sessions
curl -X DELETE -H "Authorization: Bearer $ORY_TOKEN" \
  http://127.0.0.1:8080/api/identities/sync
```

### Rollback Procedures

#### Application Rollback
```bash
# 1. Stop current version
docker compose down

# 2. Switch to previous version
git checkout previous-stable-tag
docker compose build
docker compose up -d

# 3. Rollback database if needed
./migrate -path ./migrations -database $DATABASE_URL down 1

# 4. Verify rollback
curl http://127.0.0.1:8080/api/health
```

#### Configuration Rollback
```bash
# 1. Restore previous configuration
cp .env.backup .env
cp docker-compose.yml.backup docker-compose.yml

# 2. Restart with old configuration
docker compose down
docker compose up -d

# 3. Verify services
docker compose ps
```

### Contact Information

#### Support Escalation
```bash
# Level 1: Self-service (this guide)
# Level 2: Development team
# Level 3: Infrastructure team
# Level 4: Vendor support

# Emergency contacts:
# - On-call developer: +1-xxx-xxx-xxxx
# - System administrator: admin@facility.gov
# - Vendor support: support@unlocked.example.com
```

#### Incident Reporting
```bash
# Document all incidents with:
# 1. Timestamp of issue
# 2. Affected systems/users
# 3. Steps taken to resolve
# 4. Root cause analysis
# 5. Prevention measures

# Report template:
echo "
Incident Report: $(date)
===================
System: UnlockEd v2
Severity: [Critical/High/Medium/Low]
Duration: [Start time - End time]
Affected Users: [Number/List]

Description:
[What happened]

Root Cause:
[Why it happened]

Resolution:
[What was done to fix it]

Prevention:
[How to prevent it in future]
" > incident_$(date +%Y%m%d_%H%M%S).txt
```

---

This comprehensive troubleshooting guide should help resolve most issues encountered with UnlockEdv2. For additional support, consult the system logs, check the GitHub issues, or contact the development team.