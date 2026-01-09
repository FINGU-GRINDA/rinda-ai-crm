# Environment Variables Guide - Hosted Deployment

## ⚠️ Critical Issues with Default .env.example

The default `.env.example` has values suitable for **local development**, NOT production. Here's what needs to change:

---

## Variables Comparison

| Variable | Local Dev | Hosted ✅ | Issue |
|----------|-----------|----------|-------|
| `GEMINI_API_KEY` | `your_gemini_api_key_here` | `sk-xxxxx...` | REQUIRED - get from Google AI Studio |
| `NODE_ENV` | `production` | `production` ✅ | Correct for hosted |
| `PORT` | `3001` | `3001` ✅ | Internal Docker port - OK |
| `FRONTEND_URL` | `http://localhost` ❌ | `https://yourdomain.com` ✅ | **CRITICAL** - causes CORS errors |
| `RATE_LIMIT_MAX_REQUESTS` | `100` ❌ | `200-300` ✅ | Too restrictive for real users |
| `RATE_LIMIT_WINDOW_MS` | `900000` | `900000` ✅ | Correct (15 minutes) |
| `PROSPECT_COLLECTION_ENABLED` | `true` | `true/false` ✅ | Optional - disable if not needed |
| `PROSPECT_COLLECTION_CRON` | `0 * * * *` | `0 * * * *` ✅ | Hourly collection - adjust as needed |

---

## Hosted Version Configuration

### **For Dokploy or Coolify:**

```
GEMINI_API_KEY=sk-your-actual-api-key-here
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://yourdomain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=200
PROSPECT_COLLECTION_ENABLED=true
PROSPECT_COLLECTION_CRON=0 * * * *
```

---

## Critical Variables Explained

### 1. **FRONTEND_URL** ⚠️ MOST IMPORTANT

**What it does:**
- Used by backend's CORS configuration
- Tells Express which domains are allowed to make API requests
- Without this, your frontend will get CORS errors

**How to set it:**

```
Local Development:
FRONTEND_URL=http://localhost

Dokploy/Coolify Staging:
FRONTEND_URL=https://staging.yourdomain.com

Production:
FRONTEND_URL=https://yourdomain.com

OR use your actual domain without subdomain:
FRONTEND_URL=https://yourdomain.com
```

**What happens if wrong:**
- ❌ Browser console: `CORS policy: No 'Access-Control-Allow-Origin' header`
- ❌ API calls fail with 403 Forbidden
- ❌ Frontend loads but can't fetch data

**How to verify it's correct:**
```bash
# After deployment, test:
curl -H "Origin: https://yourdomain.com" http://your-api.com/health

# Should return 200 with CORS headers:
# Access-Control-Allow-Origin: https://yourdomain.com
```

---

### 2. **GEMINI_API_KEY** ⚠️ REQUIRED

**What it does:**
- Powers all AI features (proposals, enrichment, summarization, business card scanning)
- Used by Google's Gemini API for LLM calls

**How to get it:**
1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Click "Get API key"
3. Create new API key (free tier available)
4. Copy the key

**How to set it:**
```
In Dokploy:
  Settings → Environment Variables → Add GEMINI_API_KEY

In Coolify:
  Service Settings → Environment → Add variable

Never commit this to git!
```

**What happens if missing:**
```
Server won't start:
"GEMINI_API_KEY is not set or is a placeholder.
Please set a valid API key."
```

---

### 3. **RATE_LIMIT_MAX_REQUESTS**

**What it does:**
- Limits requests per IP address
- Prevents API abuse and quota exhaustion
- Per 15-minute window by default

**Default: 100 requests per 15 minutes**
- Equals ~6-7 requests per minute per IP
- OK for testing, TOO LOW for production

**Recommendations:**
```
Single user testing:      100
Small team (2-5 users):   200-300
Medium team (5-20):       300-500
Large team (20+):         500-1000
```

**Note:** AI endpoints have separate limit of 30 requests/15 min (more restrictive)

**How to set it:**
```
In Dokploy/Coolify:
RATE_LIMIT_MAX_REQUESTS=300
```

**What happens if too low:**
- Users get "429 Too Many Requests" errors
- Features stop working during peak usage
- Prospect collection jobs get rate limited

---

### 4. **NODE_ENV**

**Must be:** `production`

**Why:**
- Enables production optimizations
- Disables verbose logging
- Enables security features
- Better performance

Never use `development` in hosted versions

---

## Step-by-Step Setup for Dokploy

### 1. Get Your Domain/URL
- Dokploy will give you: `yourdomain.dokploy.app`
- Or use custom domain: `yourdomain.com`

### 2. Configure Environment Variables

In Dokploy UI:
```
Settings → Environment Variables
```

Add these variables:
```
GEMINI_API_KEY = sk-xxxxxxxxxxxxxx

NODE_ENV = production

PORT = 3001

FRONTEND_URL = https://yourdomain.dokploy.app
(or https://yourdomain.com if you have custom domain)

RATE_LIMIT_WINDOW_MS = 900000

RATE_LIMIT_MAX_REQUESTS = 200

PROSPECT_COLLECTION_ENABLED = true

PROSPECT_COLLECTION_CRON = 0 * * * *
```

### 3. Deploy

Click "Deploy" → Wait for build → Done! ✅

### 4. Test CORS

```bash
# Should work without errors
curl -H "Origin: https://yourdomain.dokploy.app" \
  https://yourdomain.dokploy.app/api/config

# Should return data, not CORS error
```

---

## Step-by-Step Setup for Coolify

### 1. Create Service

In Coolify UI:
```
Projects → Add Service → Docker Compose
```

### 2. Paste or Connect docker-compose.yml

Option A: GitHub
```
Repository: rinda-ai-crm
Branch: main
Docker Compose Path: docker-compose.yml
```

Option B: Paste directly
```
(Copy contents of docker-compose.yml)
```

### 3. Set Environment Variables

In Service Settings → Environment:
```
GEMINI_API_KEY=sk-xxxxxxxxxxxxxx
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://yourdomain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=200
PROSPECT_COLLECTION_ENABLED=true
PROSPECT_COLLECTION_CRON=0 * * * *
```

### 4. Configure Domain

Service Settings → Proxy:
```
Domain: yourdomain.com
SSL: Let's Encrypt (auto)
Enable: ✅
```

### 5. Deploy

Click "Deploy" → Check logs → Done! ✅

---

## Troubleshooting

### Problem: "CORS policy: No 'Access-Control-Allow-Origin' header"

**Cause:** FRONTEND_URL doesn't match your actual domain

**Solution:**
```
Wrong:  FRONTEND_URL=http://localhost
Correct: FRONTEND_URL=https://yourdomain.com

Then redeploy service
```

### Problem: "429 Too Many Requests"

**Cause:** Rate limit too low for actual traffic

**Solution:**
```
Increase RATE_LIMIT_MAX_REQUESTS from 100 to 200-300
Then redeploy
```

### Problem: AI features don't work

**Cause:** GEMINI_API_KEY missing or invalid

**Solution:**
```
1. Go to https://aistudio.google.com/app/apikey
2. Create new API key
3. Copy exactly
4. Paste into GEMINI_API_KEY environment variable
5. Redeploy
6. Test again
```

### Problem: "Server fails to start"

**Check logs for:**
```
"GEMINI_API_KEY is not set"
  → Set GEMINI_API_KEY variable

"Database error"
  → Usually resolves on restart

"Port already in use"
  → Check PORT variable (should be 3001)
```

---

## Checklist Before Deploying

- [ ] GEMINI_API_KEY set to actual API key (not placeholder)
- [ ] FRONTEND_URL set to your actual domain (not localhost)
- [ ] NODE_ENV set to "production"
- [ ] RATE_LIMIT_MAX_REQUESTS increased to 200+ for users
- [ ] PORT is 3001
- [ ] docker-compose.yml in git repository
- [ ] All Dockerfiles in repository
- [ ] nginx.conf in repository
- [ ] .env NOT in git repository (already in .gitignore)

---

## Verification After Deployment

### Test 1: Frontend Loads
```bash
curl https://yourdomain.com

# Should return HTML (React app)
```

### Test 2: Backend Responds
```bash
curl https://yourdomain.com/api/config

# Should return JSON, not CORS error
```

### Test 3: Health Check
```bash
curl https://yourdomain.com/api/health

# Should return 200 OK
```

### Test 4: AI Feature Works
1. Go to frontend
2. Try to enrich a customer or generate a proposal
3. Should work without errors

---

## Security Notes

### Never expose these in public:
- GEMINI_API_KEY
- Database files
- Private API keys

### Good practices:
- Use Dokploy/Coolify's secret management
- Never commit .env to git
- Rotate GEMINI_API_KEY periodically
- Use HTTPS only (auto enabled)
- Keep rate limits reasonable

---

## Summary

For hosted version, only **3 critical changes** from `.env.example`:

```diff
- FRONTEND_URL=http://localhost
+ FRONTEND_URL=https://yourdomain.com

- GEMINI_API_KEY=your_gemini_api_key_here
+ GEMINI_API_KEY=sk-your-actual-key

- RATE_LIMIT_MAX_REQUESTS=100
+ RATE_LIMIT_MAX_REQUESTS=200
```

Everything else is fine as-is! ✅
