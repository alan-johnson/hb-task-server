# Cloud Deployment Guide

## Platform Compatibility Summary

| Provider | macOS | Linux | Windows | Cloud |
|----------|-------|-------|---------|-------|
| **Apple Reminders** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Microsoft Tasks** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Google Tasks** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |

## Why Apple Reminders Won't Work in the Cloud

Apple Reminders uses **AppleScript** which:
- Only runs on macOS
- Requires the Reminders.app to be installed
- Accesses the local user's iCloud-synced Reminders database
- Cannot be accessed remotely or via API

**Bottom line:** Apple Reminders is for local macOS development/personal use only.

## Cloud Deployment Options

For production cloud deployment, you should use **Microsoft Tasks** and/or **Google Tasks**.

### Recommended Architecture

```
┌─────────────────────────────────────────┐
│  Cloud Server (Linux/Docker)            │
│  ├─ Node.js Server                      │
│  ├─ PostgreSQL (user data)              │
│  ├─ Redis (sessions)                    │
│  └─ Providers:                          │
│     ├─ Microsoft Tasks ✅               │
│     └─ Google Tasks ✅                  │
└─────────────────────────────────────────┘
```

## Quick Start: Cloud-Ready Server

The updated server automatically detects the platform and only enables compatible providers.

### 1. Install and Configure

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env
```

Edit `.env`:
```bash
PORT=3000
JWT_SECRET=your-production-secret-key-min-32-chars

# Microsoft Tasks (Required for cloud)
MICROSOFT_CLIENT_ID=your_client_id
MICROSOFT_CLIENT_SECRET=your_client_secret
MICROSOFT_TENANT_ID=your_tenant_id
MICROSOFT_REDIRECT_URI=https://your-domain.com/auth/microsoft/callback

# Google Tasks (Required for cloud)
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=https://your-domain.com/auth/google/callback

# Database (Production - use PostgreSQL)
DATABASE_URL=postgresql://user:pass@host:5432/dbname
```

### 2. Start Cloud-Ready Server

```bash
npm run start:cloud
```

The server will:
- Detect it's running on Linux/Cloud
- Disable Apple Reminders provider
- Enable Microsoft and Google Tasks
- Set Microsoft as the default provider

### 3. Check Available Providers

```bash
curl https://your-domain.com/api/providers
```

Response on Linux/Cloud:
```json
{
  "platform": "linux",
  "providers": ["microsoft", "google"],
  "default": "microsoft",
  "note": "Apple Reminders only available on macOS"
}
```

## Deployment Platforms

### Option 1: AWS Elastic Beanstalk

**Pros:** Easy deployment, auto-scaling, managed infrastructure
**Cons:** Can be expensive for low traffic

```bash
# Install EB CLI
pip install awsebcli

# Initialize
eb init -p node.js task-server

# Create environment
eb create task-server-prod

# Deploy
eb deploy
```

**Files needed:**
- `.ebextensions/01_environment.config` - Environment variables
- `Procfile` - Startup command

### Option 2: Google Cloud Run

**Pros:** Serverless, auto-scales to zero, pay per use
**Cons:** Cold starts

**Dockerfile:**
```dockerfile
FROM node:18-slim

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

EXPOSE 8080
CMD ["npm", "run", "start:cloud"]
```

**Deploy:**
```bash
# Build and deploy
gcloud run deploy task-server \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### Option 3: Heroku

**Pros:** Simple deployment, free tier available
**Cons:** Limited free tier, can be slow

```bash
# Install Heroku CLI
brew tap heroku/brew && brew install heroku

# Login and create app
heroku login
heroku create task-server-prod

# Set environment variables
heroku config:set JWT_SECRET=your-secret
heroku config:set MICROSOFT_CLIENT_ID=your-id
# ... set other variables

# Deploy
git push heroku main
```

**Files needed:**
- `Procfile`: `web: npm run start:cloud`

### Option 4: DigitalOcean App Platform

**Pros:** Simple, affordable, good developer experience
**Cons:** Less features than AWS

1. Connect your GitHub repo
2. Set environment variables in the dashboard
3. Deploy automatically on git push

### Option 5: Railway

**Pros:** Extremely simple, generous free tier
**Cons:** Newer platform, smaller community

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and initialize
railway login
railway init

# Set variables
railway variables set JWT_SECRET=your-secret

# Deploy
railway up
```

### Option 6: Fly.io

**Pros:** Edge deployment, good free tier, Docker-based
**Cons:** Requires Docker knowledge

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Launch app
fly launch

# Deploy
fly deploy
```

## Docker Deployment

### Dockerfile

```dockerfile
FROM node:18-slim

# Create app directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy app source
COPY . .

# Create data directory for file-based storage
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Start server
CMD ["npm", "run", "start:cloud"]
```

### docker-compose.yml (with PostgreSQL)

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - JWT_SECRET=${JWT_SECRET}
      - DATABASE_URL=postgresql://postgres:password@db:5432/taskserver
      - MICROSOFT_CLIENT_ID=${MICROSOFT_CLIENT_ID}
      - MICROSOFT_CLIENT_SECRET=${MICROSOFT_CLIENT_SECRET}
      - MICROSOFT_TENANT_ID=${MICROSOFT_TENANT_ID}
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
    depends_on:
      - db
      - redis
    volumes:
      - ./data:/app/data

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=taskserver
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

### Build and Run

```bash
# Build image
docker build -t task-server .

# Run container
docker run -d \
  -p 3000:3000 \
  -e JWT_SECRET=your-secret \
  -e MICROSOFT_CLIENT_ID=your-id \
  --name task-server \
  task-server

# Or use docker-compose
docker-compose up -d
```

## Production Considerations

### 1. Database Migration

**Current:** File-based storage (`./data/users.json`)
**Production:** Use PostgreSQL or MongoDB

**Why?**
- File-based storage doesn't scale across multiple servers
- No concurrent access support
- Data loss risk

**Migration path:**
```bash
# Install database library
npm install pg  # for PostgreSQL
# or
npm install mongodb  # for MongoDB
```

### 2. Session Management

**Current:** In-memory sessions
**Production:** Use Redis

```bash
npm install redis connect-redis express-session
```

### 3. Environment Variables

**Never commit:**
- JWT_SECRET
- API credentials
- Database passwords

**Use:**
- Cloud provider's secret management (AWS Secrets Manager, Google Secret Manager)
- Environment variables
- `.env` files (git-ignored)

### 4. HTTPS/SSL

**Required for OAuth callbacks!**

Most cloud providers offer:
- Automatic SSL (Heroku, Vercel, Railway)
- Load balancer with SSL (AWS, GCP)
- Let's Encrypt integration (DigitalOcean)

### 5. Logging

**Production logging:**
```bash
npm install winston
```

**Log aggregation:**
- CloudWatch (AWS)
- Stackdriver (GCP)
- Papertrail
- Logtail

### 6. Monitoring

**Add health checks:**
```javascript
// Already included in server
GET /health
```

**Monitoring services:**
- Datadog
- New Relic
- Sentry (error tracking)
- UptimeRobot (uptime monitoring)

### 7. Rate Limiting

```bash
npm install express-rate-limit
```

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

### 8. CORS Configuration

**Development:** Allow all origins
**Production:** Restrict to your domains

```javascript
app.use(cors({
  origin: ['https://yourdomain.com', 'https://app.yourdomain.com'],
  credentials: true
}));
```

## Cost Estimates (Monthly)

### Free Tier Options:
- **Railway:** $5/month (free tier available)
- **Fly.io:** ~$0-5 (generous free tier)
- **Heroku:** $0 (limited), $7 for hobby tier
- **Render:** $0 for static, $7 for web services

### Low Traffic (~1000 users):
- **DigitalOcean App Platform:** $5-12
- **AWS Elastic Beanstalk:** $15-30
- **Google Cloud Run:** $10-20

### Medium Traffic (~10000 users):
- **DigitalOcean:** $20-40
- **AWS:** $50-100
- **GCP:** $40-80

## Deployment Checklist

- [ ] Set strong JWT_SECRET (32+ characters)
- [ ] Configure Microsoft Tasks OAuth
- [ ] Configure Google Tasks OAuth
- [ ] Set up HTTPS/SSL
- [ ] Configure database (PostgreSQL/MongoDB)
- [ ] Set up Redis for sessions
- [ ] Add logging
- [ ] Add monitoring/health checks
- [ ] Configure CORS properly
- [ ] Add rate limiting
- [ ] Set up backups
- [ ] Configure CI/CD
- [ ] Test OAuth flows
- [ ] Load testing

## Example: Deploy to Railway

The simplest cloud deployment:

```bash
# 1. Install Railway CLI
npm i -g @railway/cli

# 2. Login
railway login

# 3. Initialize project
railway init

# 4. Add PostgreSQL
railway add postgresql

# 5. Set environment variables
railway variables set JWT_SECRET=$(openssl rand -base64 32)
railway variables set MICROSOFT_CLIENT_ID=your-id
railway variables set MICROSOFT_CLIENT_SECRET=your-secret
railway variables set MICROSOFT_TENANT_ID=your-tenant
railway variables set GOOGLE_CLIENT_ID=your-id
railway variables set GOOGLE_CLIENT_SECRET=your-secret

# 6. Deploy
railway up

# 7. Get URL
railway domain
```

Done! Your API is live at `https://your-app.railway.app`

## Testing Cloud Deployment

```bash
# Register a user
curl -X POST https://your-domain.com/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test123","email":"test@example.com"}'

# Check available providers
curl https://your-domain.com/api/providers

# Expected response on cloud:
# {
#   "platform": "linux",
#   "providers": ["microsoft", "google"],
#   "default": "microsoft"
# }
```

## Summary

✅ **For Cloud:** Use Microsoft Tasks and/or Google Tasks
❌ **Not for Cloud:** Apple Reminders (macOS only)

The server automatically detects the platform and enables the appropriate providers. Deploy to any cloud platform supporting Node.js, and your users can manage their Microsoft and Google tasks from anywhere!
