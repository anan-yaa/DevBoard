# 🚀 DevBoard Production Deployment Guide

## Overview

This guide covers deploying the production-ready DevBoard collaborative code editor with full security, performance optimizations, and monitoring.

## Architecture

```
┌─────────────────┐    HTTPS/WSS     ┌─────────────────┐    PostgreSQL    ┌──────────────┐
│   Vercel        │ ◄──────────────► │   Render        │ ◄──────────────► │  PostgreSQL  │
│                 │                  │                 │                  │              │
│ Next.js 15      │                  │ Node.js 20      │                  │              │
│ Frontend        │                  │ Socket.IO       │                  │              │
│ + Security      │                  │ + Prisma        │                  │              │
│ + Performance   │                  │ + Logging       │                  │              │
└─────────────────┘                  └─────────────────┘                  └──────────────┘
```

## 📋 Prerequisites

- Node.js 20+
- PostgreSQL database
- Vercel account
- Render account
- GitHub repository
- SSL certificates (handled automatically)

## 🔐 Security Features Implemented

### Backend Security
- ✅ Helmet.js security headers
- ✅ Express rate limiting (100 req/15min production)
- ✅ CORS with production origins
- ✅ Input validation and sanitization
- ✅ Environment variable validation
- ✅ Database connection security
- ✅ WebSocket security (WSS only in production)

### Frontend Security
- ✅ CSP headers
- ✅ XSS protection
- ✅ Frame protection
- ✅ Secure cookies (if implemented)
- ✅ Environment variable protection
- ✅ No console logs in production

## 🚀 Deployment Steps

### 1. Database Setup

#### Option A: Render PostgreSQL (Recommended)
1. Go to Render dashboard
2. Create new PostgreSQL service
3. Set database name: `devboard`
4. Note connection string

#### Option B: External PostgreSQL
1. Create database instance
2. Get connection string
3. Ensure SSL is enabled

### 2. Backend Deployment (Render)

#### Environment Variables
Set these in your Render service environment:

```bash
# Required
DATABASE_URL=postgresql://user:password@host:port/database
NODE_ENV=production
PORT=5000
CORS_ORIGIN=https://yourdomain.vercel.app,https://www.yourdomain.com

# Optional
WS_URL=https://your-backend.onrender.com
LOG_LEVEL=info
```

#### Build Configuration
```yaml
# render.yaml (already configured)
buildCommand: npm ci && npx prisma generate && npm run build
startCommand: npx prisma migrate deploy && npm start
healthCheckPath: /health
```

#### Deployment Commands
```bash
# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:deploy

# Build application
npm run build

# Start production server
npm start
```

### 3. Frontend Deployment (Vercel)

#### Environment Variables
Set these in Vercel project settings:

```bash
# Required
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
NEXT_PUBLIC_WS_URL=https://your-backend.onrender.com

# Optional
NEXT_PUBLIC_APP_NAME=DevBoard
NEXT_PUBLIC_ENVIRONMENT=production
NEXT_PUBLIC_ENABLE_ANALYTICS=true
```

#### Build Configuration
```bash
# Install dependencies
npm ci

# Build for production
npm run build

# Start production server
npm start
```

### 4. Database Migration

#### Automatic Migration (Recommended)
The GitHub Actions workflow handles migration automatically:
```bash
# Triggered on deployment
npm run db:deploy
```

#### Manual Migration
```bash
# Via Render Console
npx prisma migrate deploy

# Via local (with production DB URL)
DATABASE_URL=production_url npm run db:deploy
```

## 🔧 Configuration Files

### Backend Configuration

#### Environment Validation (`src/config/env.ts`)
```typescript
// Validates required environment variables on startup
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET', 'CORS_ORIGIN', 'NODE_ENV'];
```

#### Security Middleware (`src/middleware/security.ts`)
```typescript
// Helmet, rate limiting, compression, CORS
// Production headers and security policies
```

#### Socket.IO Configuration (`src/config/socket.ts`)
```typescript
// Production-safe WebSocket settings
// Reconnection handling and transport optimization
```

### Frontend Configuration

#### Next.js Config (`next.config.ts`)
```typescript
// Security headers, performance optimizations
// Bundle splitting, image optimization, caching
```

#### Optimized Components
- `OptimizedMonacoEditor.tsx` - Code splitting and performance
- `useDebounce.ts` - Performance hooks
- `ErrorBoundary.tsx` - Error handling

## 📊 Monitoring & Logging

### Structured Logging (Backend)
```typescript
// Pino logger with environment-specific levels
// Request logging, error tracking, security events
import { logInfo, logError, logSecurityEvent } from './utils/logger';
```

### Health Checks
```typescript
// GET /health endpoint checks:
// - Database connectivity
// - Server uptime
// - Environment status
```

### Performance Monitoring
- Frontend: Vercel Analytics
- Backend: Render metrics + structured logs
- Database: Provider monitoring tools

## 🛡️ Security Checklist

### Pre-Deployment Security
- [ ] CORS origins are correct
- [ ] Database uses SSL
- [ ] No hardcoded secrets
- [ ] Environment variables validated
- [ ] Rate limiting configured
- [ ] Security headers enabled

### Post-Deployment Security
- [ ] Test HTTPS/WSS connections
- [ ] Verify CORS policies
- [ ] Check rate limiting
- [ ] Test error handling
- [ ] Monitor logs for security events

## 🚀 Performance Optimizations

### Backend Optimizations
- [ ] Database indexes added
- [ ] Connection pooling configured
- [ ] Compression enabled
- [ ] Rate limiting optimized
- [ ] Socket.IO transports optimized

### Frontend Optimizations
- [ ] Code splitting implemented
- [ ] Bundle optimization enabled
- [ ] Image optimization configured
- [ ] Caching headers set
- [ ] Monaco Editor optimized

### Database Optimizations
- [ ] Indexes on foreign keys
- [ ] Composite indexes for queries
- [ ] Connection limits set
- [ ] Query optimization

## 🔍 Testing Before Deployment

### Local Testing
```bash
# Backend
npm run build
npm start
curl http://localhost:5000/health

# Frontend
npm run build
npm start
```

### Integration Testing
```bash
# Test WebSocket connection
wscat -c wss://your-backend.onrender.com/socket.io/

# Test API endpoints
curl https://your-backend.onrender.com/health

# Test CORS
curl -H "Origin: https://yourdomain.vercel.app" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS https://your-backend.onrender.com/api/rooms
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Database Connection Errors
```bash
# Check DATABASE_URL format
postgresql://user:password@host:port/database

# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

#### 2. WebSocket Connection Failures
```bash
# Check CORS origins
# Verify WSS protocol
# Check Render logs
```

#### 3. Build Failures
```bash
# Check TypeScript compilation
npx tsc --noEmit

# Check dependencies
npm ci --verbose
```

#### 4. Environment Variable Issues
```bash
# Verify all required variables
grep -r "process.env" src/
```

### Debug Commands
```bash
# Backend logs
# View in Render dashboard > Logs

# Frontend logs
vercel logs

# Database queries
npx prisma studio

# Health check
curl -I https://your-backend.onrender.com/health
```

## 📈 Scaling Considerations

### Backend Scaling
- Horizontal scaling with load balancer
- Database connection pooling
- Redis for session storage (if needed)
- CDN for static assets

### Frontend Scaling
- Vercel edge functions
- CDN optimization
- Image optimization
- Bundle splitting

### Database Scaling
- Read replicas for read-heavy workloads
- Connection pooling optimization
- Query optimization
- Regular maintenance

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow
```yaml
# .github/workflows/deploy.yml
# Automated testing, building, and deployment
# Database migrations
# Security scans
# Performance monitoring
```

### Deployment Triggers
- Push to `main` branch → Production deployment
- Pull requests → Testing only
- Manual deployment via dashboard

## 📞 Support & Monitoring

### Monitoring Tools
- **Backend**: Render metrics + Pino logs
- **Frontend**: Vercel Analytics
- **Database**: Provider monitoring
- **Custom**: Error tracking (Sentry, etc.)

### Alert Configuration
- High error rates
- Database connection failures
- High memory/CPU usage
- WebSocket connection issues

### Log Analysis
```bash
# Security events
grep "security_event" logs

# Error patterns
grep "ERROR" logs | tail -100

# Performance metrics
grep "duration" logs
```

## 🎯 Production Readiness Checklist

### Security ✅
- [ ] Helmet security headers enabled
- [ ] Rate limiting configured
- [ ] CORS properly set
- [ ] Environment variables validated
- [ ] Database SSL enabled
- [ ] WebSocket security enabled

### Performance ✅
- [ ] Database indexes added
- [ ] Compression enabled
- [ ] Bundle optimization
- [ ] Code splitting implemented
- [ ] Caching headers configured
- [ ] Image optimization enabled

### Monitoring ✅
- [ ] Health checks implemented
- [ ] Structured logging enabled
- [ ] Error tracking configured
- [ ] Performance monitoring active
- [ ] Security event logging

### Deployment ✅
- [ ] Environment variables set
- [ ] Database migrations run
- [ ] Build processes tested
- [ ] CI/CD pipeline active
- [ ] Rollback procedures ready

## 🚀 Go Live!

Once all checks are complete:

1. **Final Health Check**
   ```bash
   curl https://your-backend.onrender.com/health
   ```

2. **Frontend Test**
   ```bash
   # Visit https://yourdomain.vercel.app
   # Test room creation, collaboration, comments
   ```

3. **Monitor Initial Traffic**
   - Check logs for errors
   - Monitor performance metrics
   - Verify WebSocket connections

4. **Announce Deployment**
   - Update documentation
   - Notify users
   - Monitor feedback

---

**🎉 Your DevBoard is now production-ready with enterprise-grade security, performance, and monitoring!**

For ongoing maintenance:
- Regular security updates
- Performance monitoring
- Database maintenance
- Log review and analysis
