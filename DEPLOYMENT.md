# DevBoard Deployment Guide

This guide covers deploying the full-stack DevBoard application to production using Vercel (frontend) and Render (backend) with PostgreSQL database.

## Architecture Overview

```
┌─────────────────┐    HTTPS/WSS     ┌─────────────────┐    PostgreSQL    ┌──────────────┐
│   Vercel        │ ◄──────────────► │   Render        │ ◄──────────────► │  PostgreSQL  │
│                 │                  │                 │                  │              │
│ Next.js 15      │                  │ Node.js 20      │                  │              │
│ Frontend        │                  │ Socket.IO       │                  │              │
│                 │                  │ Prisma ORM      │                  │              │
└─────────────────┘                  └─────────────────┘                  └──────────────┘
```

## Prerequisites

- Node.js 20+
- PostgreSQL database
- Vercel account
- Render account
- GitHub repository

## Environment Setup

### Frontend Environment Variables (Vercel)

Create `.env.production` in `frontend/`:

```bash
# API Configuration
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
NEXT_PUBLIC_WS_URL=https://your-backend.onrender.com

# Optional: Feature Flags
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENVIRONMENT=production
```

### Backend Environment Variables (Render)

Set these in your Render dashboard:

```bash
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Server
NODE_ENV=production
PORT=5000

# CORS (comma-separated origins)
CORS_ORIGIN=https://yourdomain.vercel.app,https://www.yourdomain.com

# Security
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters

# WebSocket
WS_URL=https://your-backend.onrender.com
```

## Build Steps

### Frontend (Next.js)

```bash
cd frontend

# Install dependencies
npm ci

# Generate TypeScript check
npx tsc --noEmit

# Build for production
npm run build

# Test build locally (optional)
npm start
```

### Backend (Node.js)

```bash
cd backend

# Install dependencies
npm ci

# Generate Prisma client
npm run db:generate

# Build TypeScript
npm run build

# Test production build
npm start
```

## Deployment Steps

### 1. Database Setup

1. **Create PostgreSQL Database**
   ```bash
   # Using Render
   - Create new PostgreSQL service on Render
   - Note the connection string
   
   # Using external provider (AWS RDS, ElephantSQL, etc.)
   - Create database instance
   - Get connection string
   ```

2. **Configure Database URL**
   ```bash
   # Add to Render environment variables
   DATABASE_URL=postgresql://username:password@host:port/database
   ```

### 2. Backend Deployment (Render)

1. **Connect GitHub Repository**
   - Go to Render dashboard
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select `backend` folder as root directory

2. **Configure Build Settings**
   ```yaml
   Build Command: npm ci && npm run build
   Start Command: npm start
   Runtime: Node 20
   ```

3. **Set Environment Variables**
   - Add all backend environment variables
   - Ensure `DATABASE_URL` is correctly set
   - Set `NODE_ENV=production`

4. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment to complete
   - Note the deployed URL

### 3. Database Migration

After backend deployment, run migrations:

```bash
# Option 1: Via Render Console (Recommended)
- Go to your service dashboard
- Click "Shell" tab
- Run: npm run db:deploy

# Option 2: Locally (if you have direct DB access)
DATABASE_URL=your_production_db_url npm run db:deploy

# Option 3: Via GitHub Actions (Automated)
# See .github/workflows/deploy.yml
```

### 4. Frontend Deployment (Vercel)

1. **Connect GitHub Repository**
   - Go to Vercel dashboard
   - Click "New Project"
   - Import your GitHub repository
   - Select `frontend` folder as root directory

2. **Configure Build Settings**
   ```bash
   Framework Preset: Next.js
   Build Command: npm run build
   Output Directory: .next
   Install Command: npm ci
   ```

3. **Set Environment Variables**
   - Add `NEXT_PUBLIC_API_URL` (your Render backend URL)
   - Add `NEXT_PUBLIC_WS_URL` (your Render backend URL)

4. **Deploy**
   - Click "Deploy"
   - Wait for deployment to complete
   - Test the application

## Database Migration Steps

### Initial Setup

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database (development)
npm run db:push

# Run migrations (production)
npm run db:deploy

# Seed database (optional)
npm run db:seed
```

### Production Migration Workflow

1. **Create Migration** (development)
   ```bash
   cd backend
   npx prisma migrate dev --name migration_name
   ```

2. **Test Migration**
   ```bash
   # Test on staging database first
   DATABASE_URL=staging_db_url npm run db:deploy
   ```

3. **Deploy to Production**
   ```bash
   # Via GitHub Actions (automated)
   git push main
   
   # Or manually
   DATABASE_URL=production_db_url npm run db:deploy
   ```

## WebSocket Configuration

### Production WebSocket Setup

1. **Backend Configuration** (already configured in `server.ts`)
   ```typescript
   const ioOptions = {
     cors: corsOptions,
     transports: ['websocket', 'polling'],
     pingTimeout: 60000,
     pingInterval: 25000,
   };
   ```

2. **Frontend Connection** (configured in `socket.ts`)
   ```typescript
   const socketOptions = {
     transports: ['websocket', 'polling'],
     secure: process.env.NODE_ENV === 'production',
     rejectUnauthorized: process.env.NODE_ENV === 'production',
   };
   ```

### WebSocket Troubleshooting

1. **Connection Issues**
   ```bash
   # Check backend logs on Render
   # Verify CORS origins include your Vercel domain
   
   # Test WebSocket connection
   wscat -c wss://your-backend.onrender.com/socket.io/
   ```

2. **Common Issues**
   - CORS misconfiguration
   - SSL certificate issues
   - Proxy/Load balancer interference
   - Firewall blocking WebSocket connections

## Troubleshooting

### Common Issues & Solutions

#### 1. Database Connection Errors

**Problem:** `ECONNREFUSED` database connection
```bash
# Solution:
- Verify DATABASE_URL is correct
- Check database is running
- Ensure firewall allows connection
- Test with psql command
```

#### 2. WebSocket Connection Failures

**Problem:** Socket.IO connection timeouts
```bash
# Solution:
- Check CORS configuration
- Verify WebSocket URL is correct
- Ensure HTTPS/WSS protocol in production
- Check Render logs for connection errors
```

#### 3. Build Failures

**Problem:** Next.js or TypeScript build errors
```bash
# Solution:
- Run `npx tsc --noEmit` locally
- Check for missing dependencies
- Verify environment variables
- Review build logs on Vercel/Render
```

#### 4. Environment Variable Issues

**Problem:** Missing or incorrect environment variables
```bash
# Solution:
- Double-check variable names (NEXT_PUBLIC_ prefix for frontend)
- Verify values are correctly escaped
- Check platform-specific variable format
- Test locally with same variables
```

#### 5. CORS Errors

**Problem:** Browser blocks cross-origin requests
```bash
# Solution:
- Verify CORS_ORIGIN includes all frontend domains
- Check for trailing slashes in URLs
- Ensure credentials flag matches
- Test with curl to bypass browser
```

### Debugging Tools

#### Frontend Debugging
```bash
# Vercel logs
vercel logs

# Local testing with production variables
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com npm run dev
```

#### Backend Debugging
```bash
# Render logs
# View in Render dashboard > Logs

# Database testing
psql $DATABASE_URL -c "SELECT 1"

# WebSocket testing
wscat -c wss://your-backend.onrender.com/socket.io/
```

#### Database Debugging
```bash
# Prisma Studio
npm run db:studio

# Check migrations
npx prisma migrate status

# Reset database (development only)
npx prisma migrate reset
```

## Performance Optimization

### Frontend (Vercel)

1. **Image Optimization**
   ```typescript
   // next.config.ts already configured
   images: {
     formats: ['image/webp', 'image/avif'],
   }
   ```

2. **Bundle Optimization**
   ```typescript
   // Package imports optimized
   experimental: {
     optimizePackageImports: ['@monaco-editor/react'],
   }
   ```

### Backend (Render)

1. **Database Connection Pooling**
   ```bash
   # Prisma handles automatically
   # Monitor connection count in database
   ```

2. **WebSocket Optimization**
   ```typescript
   // Configured in server.ts
   pingTimeout: 60000,
   pingInterval: 25000,
   ```

## Monitoring & Logging

### Frontend Monitoring
```bash
# Vercel Analytics
# Enable in Vercel dashboard

# Error Tracking (optional)
# Add Sentry or similar service
```

### Backend Monitoring
```bash
# Render Metrics
# Available in Render dashboard

# Log Monitoring
# Check Render logs regularly

# Database Monitoring
# Use database provider's monitoring tools
```

## Security Considerations

### Frontend Security
- Environment variables are client-side (NEXT_PUBLIC_*)
- Use HTTPS in production
- Implement CSP headers (configured in next.config.ts)

### Backend Security
- Validate all inputs
- Use environment variables for secrets
- Implement rate limiting
- Enable CORS restrictions
- Use JWT for authentication (when implemented)

### Database Security
- Use connection strings with strong passwords
- Enable SSL connections
- Regular backups
- Principle of least privilege

## Rollback Procedures

### Frontend Rollback
```bash
# Vercel automatically keeps previous deployments
# Go to Vercel dashboard > Deployments
# Click "..." on previous deployment > "Promote to Production"
```

### Backend Rollback
```bash
# Render supports redeployment
# Go to Render dashboard > Services
# Click "Manual Deploy" > "Deploy Latest Commit"
# Or revert to previous commit in GitHub
```

### Database Rollback
```bash
# Prisma migrations are versioned
# Check migration history
npx prisma migrate history

# Rollback to specific migration (advanced)
npx prisma migrate reset --force
# Then run migrations up to desired version
```

## Support

### Documentation
- [Next.js Deployment Docs](https://nextjs.org/docs/deployment)
- [Vercel Deployment Guide](https://vercel.com/docs)
- [Render Deployment Guide](https://render.com/docs/deploy-node-express)
- [Prisma Deployment](https://www.prisma.io/docs/guides/deployment)

### Common Issues
- Check GitHub Issues for known problems
- Review platform status pages (Vercel, Render)
- Monitor database provider status

---

**Deployment Checklist:**
- [ ] Frontend environment variables set
- [ ] Backend environment variables set
- [ ] Database created and accessible
- [ ] Database migrations run
- [ ] Frontend deployed to Vercel
- [ ] Backend deployed to Render
- [ ] WebSocket connections working
- [ ] CORS properly configured
- [ ] SSL certificates valid
- [ ] Monitoring enabled
- [ ] Error handling tested
- [ ] Performance optimized
