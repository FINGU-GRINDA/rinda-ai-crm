# Deployment Recommendations: Dokploy vs Coolify

## Quick Answer

**Recommendation: Use `docker-compose.yml` for both platforms** ✅

Both Dokploy and Coolify support docker-compose natively, making it the simplest deployment strategy for your 2-container setup.

---

## Platform Comparison

### Dokploy

**What it is:**
- Modern, lightweight alternative to Heroku
- Built on Docker, very developer-friendly
- Self-hosted PaaS platform
- Written in modern stack (Node.js/TypeScript)

**Deployment Method:**
- Push code to GitHub/GitLab
- Dokploy auto-detects Dockerfile or docker-compose.yml
- Builds and deploys automatically
- Built-in monitoring, logs, and rollback

**Best For:**
- Simple, quick deployments
- Teams wanting Heroku-like experience
- Small to medium projects
- Self-hosted environments

**Pros:**
✅ Very simple UI/UX
✅ Git-based deployment (push-to-deploy)
✅ Automatic SSL/HTTPS with Let's Encrypt
✅ Built-in Docker support
✅ Easy environment variable management
✅ Cost-effective (self-hosted)
✅ Great documentation

**Cons:**
❌ Fewer advanced features than Coolify
❌ Smaller community
❌ Limited horizontal scaling options

---

### Coolify

**What it is:**
- Advanced open-source PaaS alternative
- More features than Dokploy
- Better for production workloads
- GitOps-focused

**Deployment Method:**
- Multiple options:
  - Git integration (GitHub/GitLab)
  - Docker Compose files
  - Manual Docker deployments
  - Dockerfile auto-detection

**Best For:**
- Production deployments
- Teams needing advanced features
- Horizontal scaling requirements
- Complex applications

**Pros:**
✅ More powerful features
✅ Better horizontal scaling
✅ Advanced monitoring & logging
✅ More deployment options
✅ Better for microservices
✅ Larger community
✅ Automated backups
✅ Database management tools

**Cons:**
❌ Steeper learning curve
❌ More complex configuration
❌ Heavier on resources
❌ More moving parts to manage

---

## Docker Compose: Should You Use It?

### **YES - Use docker-compose.yml for both platforms**

#### Why:

1. **Multi-container Definition**
   ```yaml
   # Single file defines both frontend and backend
   services:
     frontend:
       build: .
     backend:
       build: ./server
   ```

2. **Network Communication**
   - Containers automatically connect
   - Service DNS names work (backend:3001)
   - No CORS issues
   - Simpler configuration

3. **Volume Management**
   - Database persistence with volumes
   - Both platforms handle it natively

4. **Environment Variables**
   - Easy to define per service
   - Both platforms support `.env` files

5. **Local Testing**
   - `docker-compose up` mirrors production
   - "Works on my machine" problem solved

#### Alternatives (Less Recommended):

**Option A: Separate Services**
```
- Create backend service from server/Dockerfile
- Create frontend service from Dockerfile
- Manually manage networking
```
❌ More complex configuration
❌ Harder to sync deployments
❌ Risk of out-of-sync versions

**Option B: Monolithic Single Container**
```
- Express serves both API and static files
- Single Dockerfile
```
❌ Can't scale independently
❌ Wasted resources
❌ Goes against your architecture goals

---

## Dokploy: Step-by-Step Deployment

### 1. **Prepare Repository**

```bash
# Ensure these files exist in root:
- Dockerfile              # Frontend
- server/Dockerfile       # Backend
- docker-compose.yml      # Orchestration
- .dockerignore          # Frontend
- server/.dockerignore   # Backend
- .env.example           # Template
- nginx.conf             # Frontend routing

# All already created ✅
```

### 2. **Create Dokploy Project**

a) **Create new project in Dokploy UI:**
   - Go to Projects → New Project
   - Name: `rinda-crm`
   - Choose Docker Compose template

b) **Connect GitHub Repository:**
   - Click "Connect Repository"
   - Select your `rinda-ai-crm` repo
   - Branch: `main`

c) **Build Settings:**
   - Build Type: `Docker Compose`
   - Docker Compose File: `docker-compose.yml`
   - Build Context: `.` (root)

### 3. **Environment Variables**

In Dokploy UI:
```
Settings → Environment Variables

Add:
- GEMINI_API_KEY = your_key_here
- NODE_ENV = production
- FRONTEND_URL = https://yourdomain.com
- PORT = 3001
```

**Or use `.env` file:**
```bash
# Push .env to server (or use Dokploy secrets)
# Never commit to git
GEMINI_API_KEY=sk-xxxxx
NODE_ENV=production
FRONTEND_URL=https://yourdomain.com
```

### 4. **Domain & SSL**

a) **Add Domain:**
   - Settings → Domains
   - Add: `yourdomain.com`
   - SSL auto-enabled (Let's Encrypt)

b) **Configure Reverse Proxy:**
   - Dokploy automatically proxies to port 80
   - Nginx.conf handles internal routing

### 5. **Deploy**

```bash
# Option A: Automatic (recommended)
- Push to main branch
- Dokploy auto-builds and deploys

# Option B: Manual
- Click "Deploy" in Dokploy UI
- Waits for docker-compose up
```

### 6. **Verify**

```bash
# In Dokploy Logs tab:
- backend service: node index.js
- frontend service: nginx

# Access:
- https://yourdomain.com           # Frontend
- https://yourdomain.com/api/*     # API (proxied)
```

### Dokploy Configuration File

Create `dokploy.json` in root (optional, for advanced config):

```json
{
  "deployments": [
    {
      "name": "rinda-crm",
      "type": "docker-compose",
      "source": {
        "type": "github",
        "repository": "your-username/rinda-ai-crm",
        "branch": "main"
      },
      "buildCommand": "docker-compose build",
      "startCommand": "docker-compose up -d"
    }
  ]
}
```

---

## Coolify: Step-by-Step Deployment

### 1. **Initial Setup**

```bash
# Coolify runs on your server
# Install: https://coolify.io/docs/installation

docker run -d \
  --name coolify \
  -p 3000:3000 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v coolify-db:/data/coolify/db \
  coollabs/coolify:latest
```

### 2. **Create Project in Coolify**

a) **New Project:**
   - Go to Projects → Create
   - Name: `rinda-crm`
   - Server: Select your server

b) **Add Service:**
   - Click "Add Service"
   - Choose "Docker Compose"

### 3. **Configure Docker Compose**

**Option A: Connect GitHub (Recommended)**
```
- Select: GitHub
- Repository: rinda-ai-crm
- Branch: main
- Docker Compose Path: docker-compose.yml
- Auto-deploy on push: Enabled
```

**Option B: Paste docker-compose.yml**
```
Paste contents of docker-compose.yml directly in UI
```

### 4. **Environment Variables**

In Coolify Service Settings:
```
Environment Variables:
GEMINI_API_KEY = sk-xxxxx
NODE_ENV = production
FRONTEND_URL = https://yourdomain.com
RATE_LIMIT_MAX_REQUESTS = 200
```

### 5. **Configure Reverse Proxy**

Coolify UI → Service Settings:
```
- Port Expose: 80 (for frontend)
- Domain: yourdomain.com
- SSL: Let's Encrypt (auto)
- HTTP → HTTPS redirect: Enabled
```

### 6. **Database Persistence**

Coolify automatically handles volumes from docker-compose.yml:
```yaml
volumes:
  - ./server/crm.db:/app/crm.db
```

Coolify will:
- Mount the volume
- Back it up regularly
- Allow download/restore from UI

### 7. **Deploy**

```bash
# Coolify:
Services → Deploy

# Or auto-deploy on git push (if GitHub connected)
```

### 8. **Monitoring**

Coolify Logs tab:
```
- Real-time logs from both containers
- Search and filter capabilities
- Resource usage monitoring
```

### Advanced Coolify Features

**Auto-scaling (if needed later):**
```yaml
# Modify docker-compose.yml
services:
  backend:
    deploy:
      replicas: 3  # 3 backend instances
      update_config:
        parallelism: 1
```

**Health Checks:**
```yaml
backend:
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
    interval: 30s
    timeout: 10s
    retries: 3
```

---

## Comparison Table

| Feature | Dokploy | Coolify |
|---------|---------|---------|
| **Setup Time** | 5-10 min | 15-20 min |
| **Learning Curve** | Easy | Medium |
| **Docker Compose Support** | ✅ Yes | ✅ Yes |
| **Auto-scaling** | Basic | Advanced |
| **Monitoring** | Basic | Advanced |
| **Database Backups** | Manual | Automatic |
| **Git Integration** | ✅ Yes | ✅ Yes |
| **SSL/HTTPS** | ✅ Auto | ✅ Auto |
| **Cost** | Low | Low |
| **Community** | Growing | Larger |
| **Best For** | Quick deploys | Production apps |

---

## Recommended Setup for Your Project

### **Quick Deployment (Recommend Dokploy)**

If you want:
- Fast setup
- Simple management
- Deploy within 30 minutes

**Use Dokploy + Docker Compose:**
```
1. Push code to GitHub
2. Create Dokploy project
3. Connect GitHub repo
4. Set environment variables
5. Click Deploy
6. Done! 🚀
```

### **Production Deployment (Recommend Coolify)**

If you want:
- Advanced features
- Better scaling later
- Automated backups
- Detailed monitoring

**Use Coolify + Docker Compose:**
```
1. Set up Coolify on VPS
2. Create project
3. Connect GitHub repo
4. Configure auto-deploy
5. Set up monitoring
6. Production-ready ✅
```

---

## File Structure for Deployment

Your current structure is **already optimal**:

```
rinda-ai-crm/
├── Dockerfile                 # Frontend (multi-stage)
├── docker-compose.yml         # ✅ Both platforms support
├── nginx.conf                # Frontend routing
├── .dockerignore
├── .env.example
├── server/
│   ├── Dockerfile            # Backend
│   ├── .dockerignore
│   ├── index.js
│   ├── package.json
│   └── ...
├── src/
├── components/
└── ...
```

**Both Dokploy and Coolify will auto-detect and use:**
- `docker-compose.yml` ✅
- `Dockerfile` (frontend) ✅
- `server/Dockerfile` (backend) ✅

---

## Deployment Checklist

### Pre-Deployment

- [ ] All Docker files created ✅
- [ ] `.dockerignore` files created ✅
- [ ] `docker-compose.yml` created ✅
- [ ] `.env.example` created ✅
- [ ] Push to GitHub
- [ ] Test locally: `docker-compose up -d`

### Dokploy Setup

- [ ] Create Dokploy account/instance
- [ ] Connect GitHub repository
- [ ] Select `docker-compose.yml`
- [ ] Add environment variables
- [ ] Add custom domain (if any)
- [ ] Click Deploy
- [ ] Check logs for errors
- [ ] Test: Visit your domain

### Coolify Setup

- [ ] Install Coolify on server
- [ ] Create new project
- [ ] Connect GitHub (or paste docker-compose.yml)
- [ ] Configure environment variables
- [ ] Set up SSL certificate
- [ ] Enable auto-deploy
- [ ] Deploy
- [ ] Check logs
- [ ] Set up backups
- [ ] Test application

---

## Common Issues & Solutions

### Issue 1: Database Lost After Restart

**Cause:** Volume not properly mounted

**Solution (docker-compose.yml):**
```yaml
backend:
  volumes:
    - ./server/crm.db:/app/crm.db     # ✅ Correct
    - crm-db:/app/data                # Also works
```

Dokploy/Coolify will handle volume creation automatically.

### Issue 2: API Calls Failing (Frontend → Backend)

**Cause:** Nginx not proxying correctly

**Verify:**
```bash
# In Dokploy/Coolify logs:
# Check nginx error logs
# Check backend is running on port 3001

# Test API directly:
curl http://yourdomain.com/health
curl http://yourdomain.com/api/config
```

### Issue 3: Environment Variables Not Loading

**Dokploy Solution:**
- Go to Settings → Environment Variables
- Add each variable
- Restart service

**Coolify Solution:**
- Service Settings → Environment
- Add variables
- Redeploy

### Issue 4: Build Fails

**Check logs in platform UI:**
```
Services → Logs → Build Output

Common causes:
- Missing environment variables
- npm dependency issues
- Port already in use
```

---

## Cost Estimation

### Dokploy
- **Server Cost:** $5-20/month (VPS)
- **Additional:** Free
- **Total:** ~$5-20/month

### Coolify
- **Server Cost:** $5-20/month (VPS)
- **Additional:** Free
- **Total:** ~$5-20/month

Both require a server to run on. If you don't have one:
- DigitalOcean: $4-6/month
- Hetzner: $2.99-4/month
- AWS EC2: $0-5/month (free tier available)

---

## My Recommendation

### **For You: Use Dokploy + Docker Compose**

**Reasons:**
1. ✅ You already have docker-compose.yml
2. ✅ Simplest setup (get deployed in 30 min)
3. ✅ Perfect for your 2-container setup
4. ✅ Easy to switch to Coolify later if needed
5. ✅ Smallest learning curve
6. ✅ Push-to-deploy workflow
7. ✅ Auto SSL/HTTPS

**Setup Steps:**
```bash
# 1. Ensure docker-compose.yml is in git
git add docker-compose.yml
git commit -m "Add Docker configuration"
git push

# 2. Go to dokploy.io
# 3. Connect GitHub repo
# 4. Select docker-compose.yml
# 5. Add GEMINI_API_KEY
# 6. Deploy
```

**Done!** Your app is live in 15 minutes. 🚀

---

## Next Steps

1. **Test locally first:**
   ```bash
   docker-compose up -d
   # Visit http://localhost
   # Test API calls
   ```

2. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Add Docker and deployment configuration"
   git push origin main
   ```

3. **Deploy to Dokploy/Coolify:**
   - Choose one platform
   - Connect your repo
   - Set environment variables
   - Click Deploy

4. **Monitor:**
   - Watch logs for errors
   - Test key features
   - Set up monitoring alerts

---

**Last Updated:** 2024
**Version:** 1.0
