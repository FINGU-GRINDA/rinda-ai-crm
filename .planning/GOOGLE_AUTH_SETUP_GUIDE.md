# Google Auth Integration Guide

## Overview

Your app now has full Google OAuth 2.0 authentication integrated. Users can:
- Register with email/password
- Login with email/password
- Sign in with Google
- Automatic token refresh
- Secure logout with token revocation

## For Users: How to Use Google Auth

### 1. **Sign Up with Google**

1. Go to the login page
2. Click "Sign in with Google" button
3. You'll be redirected to Google's login page
4. Enter your Google email and password
5. Grant the app permission to access your profile
6. You'll be automatically logged in and redirected to the dashboard

### 2. **Sign In with Google (if already have account)**

1. Click "Sign in with Google"
2. Select your Google account
3. Grant permissions if prompted
4. You're logged in!

### 3. **Automatic Token Refresh**

- Your access token lasts **15 minutes**
- When it expires, a new one is automatically fetched
- **You'll never need to re-login** during normal use
- If your refresh token expires (7 days), you'll be sent to login

### 4. **Logout**

- Click the logout button in settings
- All your tokens are immediately revoked
- You must login again to continue

## For Developers: Implementation Details

### Architecture

```
┌─────────────────────────────────────────────┐
│         Frontend (React + Vite)             │
│  ┌─────────────────────────────────────┐  │
│  │  AuthProvider (Context)             │  │
│  │  - Manages user state               │  │
│  │  - Handles login/logout             │  │
│  │  - Provides auth to all components  │  │
│  └─────────────────────────────────────┘  │
│                  ↓                          │
│  ┌─────────────────────────────────────┐  │
│  │  ProtectedRoute (Component)         │  │
│  │  - Redirects to login if not auth'd │  │
│  │  - Shows loading state              │  │
│  └─────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
           ↓ (HTTPS + httpOnly Cookies)
┌─────────────────────────────────────────────┐
│    Backend (Elysia.js)                      │
│  ┌─────────────────────────────────────┐  │
│  │  Auth Routes                        │  │
│  │  - /api/auth/register               │  │
│  │  - /api/auth/login                  │  │
│  │  - /api/auth/google/url             │  │
│  │  - /api/auth/google/callback        │  │
│  │  - /api/auth/refresh                │  │
│  │  - /api/auth/me                     │  │
│  │  - /api/auth/logout                 │  │
│  └─────────────────────────────────────┘  │
│                  ↓                          │
│  ┌─────────────────────────────────────┐  │
│  │  JWT Middleware                     │  │
│  │  - Verifies token in httpOnly cookie│  │
│  │  - Attaches auth context to request │  │
│  └─────────────────────────────────────┘  │
│                  ↓                          │
│  ┌─────────────────────────────────────┐  │
│  │  PostgreSQL Database                │  │
│  │  - users table                      │  │
│  │  - sessions table                   │  │
│  │  - oauth_states table               │  │
│  └─────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────┐
│    Google OAuth 2.0 Servers                 │
│  - accounts.google.com (auth)               │
│  - oauth2.googleapis.com (token exchange)   │
│  - googleapis.com/oauth2 (user info)        │
└─────────────────────────────────────────────┘
```

### Frontend Files

#### 1. **AuthContext.tsx** - State Management
```typescript
import { useAuth } from './contexts/AuthContext'

// In any component:
const { user, loading, login, register, loginWithGoogle, logout } = useAuth()

// Use it:
if (loading) return <Spinner />
if (!user) return <LoginForm onSubmit={loginWithGoogle} />
return <Dashboard user={user} onLogout={logout} />
```

#### 2. **ProtectedRoute.tsx** - Route Protection
Automatically redirects unauthenticated users to login page.

```typescript
<ProtectedRoute>
  <Dashboard /> {/* Only rendered if user is logged in */}
</ProtectedRoute>
```

#### 3. **App.tsx** - Setup
```typescript
<AuthProvider>
  <ProtectedRoute>
    <App />
  </ProtectedRoute>
</AuthProvider>
```

### Backend Files

#### 1. **auth.routes.ts** - API Endpoints
All authentication endpoints:
- `POST /api/auth/register` - Email/password signup
- `POST /api/auth/login` - Email/password login
- `GET /api/auth/google/url` - Get Google auth URL
- `GET /api/auth/google/callback` - OAuth callback handler
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

#### 2. **auth.service.ts** - Business Logic
```typescript
authService.register(email, password, name)  // Create account
authService.login(email, password)            // Authenticate user
authService.generateTokens(user)              // Create JWT tokens
authService.refreshTokens(refreshToken)       // Get new access token
authService.invalidateAllTokens(userId)       // Logout (revoke all tokens)
```

#### 3. **google-oauth.service.ts** - OAuth Implementation
Manual Google OAuth without libraries:
```typescript
googleOAuthService.getAuthorizationUrl(state, flowType)
googleOAuthService.exchangeCodeForTokens(code)
googleOAuthService.refreshAccessToken(refreshToken)
googleOAuthService.getUserInfo(accessToken)
googleOAuthService.validateToken(accessToken)
```

#### 4. **middleware/auth.ts** - JWT Verification
Automatically verifies JWT in httpOnly cookies for all protected endpoints.

### Environment Variables Required

**Backend (.env in elysia-server/):**
```bash
# JWT Secrets (generate with: openssl rand -hex 32)
JWT_SECRET=<64-char-random-string>
JWT_REFRESH_SECRET=<64-char-random-string>

# Google OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<your-client-secret>
GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

**Frontend (.env in frontend/):**
```bash
VITE_API_URL=http://localhost:3001
```

## OAuth Flow Diagram

### Google Sign-in Flow
```
1. User clicks "Sign in with Google"
                ↓
2. Frontend calls GET /api/auth/google/url
                ↓
3. Backend returns Google auth URL with CSRF state token
                ↓
4. Browser redirects to accounts.google.com
                ↓
5. User enters Google credentials (Google handles this)
                ↓
6. Google redirects back to /api/auth/google/callback?code=...&state=...
                ↓
7. Backend verifies state token (CSRF protection)
                ↓
8. Backend exchanges code for tokens at oauth2.googleapis.com
                ↓
9. Backend retrieves user info from googleapis.com/oauth2/v2/userinfo
                ↓
10. Backend finds or creates user in database
                ↓
11. Backend generates JWT tokens
                ↓
12. Backend redirects to frontend: /auth/callback?access_token=...&refresh_token=...
                ↓
13. Frontend stores tokens in httpOnly cookies via AuthCallback component
                ↓
14. Frontend redirects to dashboard
                ↓
✅ User is now logged in!
```

### Token Refresh Flow
```
User makes API request
        ↓
Request includes access token in httpOnly cookie
        ↓
Backend verifies token
        ↓
If expired (> 15 min):
  - Frontend intercepts 401 response
  - Calls POST /api/auth/refresh with refresh token
  - Backend issues new access token
  - Frontend retries original request
  ↓
If refresh token expired (> 7 days):
  - Backend returns error
  - Frontend redirects to login
  ↓
✅ Request succeeds with valid token
```

## Security Features

### 1. **Password Security**
- Hashed with Argon2id (19 MiB memory, 2 iterations)
- Never stored in plaintext
- Never sent over unencrypted connections

### 2. **Session Management**
- Access tokens: 15-minute expiration (short-lived)
- Refresh tokens: 7-day expiration (long-lived)
- httpOnly cookies: JavaScript cannot access tokens (XSS protection)
- Secure flag: Only sent over HTTPS in production
- SameSite=strict: Prevents CSRF attacks

### 3. **Token Revocation**
- Token versioning allows instant revocation
- On logout, user's token version increments
- All old tokens become invalid immediately
- No token blacklist needed (stateless)

### 4. **OAuth Security**
- CSRF protection via cryptographic state parameter
- State tokens expire after 10 minutes
- Manual OAuth implementation (no library vulnerabilities)

### 5. **Multi-tenancy**
- All data isolated by user_id
- Foreign key constraints prevent data leakage
- Users can only access their own data

## Testing Google Auth Locally

### 1. **Setup Google Cloud Project**

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project
3. Enable OAuth 2.0 API
4. Create OAuth 2.0 credentials (Web application)
5. Add authorized redirect URIs:
   - `http://localhost:3001/api/auth/google/callback`
6. Copy Client ID and Client Secret

### 2. **Configure Environment Variables**

```bash
# elysia-server/.env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback
FRONTEND_URL=http://localhost:3000
```

### 3. **Test the Flow**

**Register with Email/Password:**
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "name": "Test User"
  }'
```

**Login with Email/Password:**
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!"
  }' \
  -c cookies.txt
```

**Get Google Auth URL:**
```bash
curl http://localhost:3001/api/auth/google/url
```
Then visit the returned URL in browser.

**Get Current User:**
```bash
curl http://localhost:3001/api/auth/me \
  -b cookies.txt
```

**Logout:**
```bash
curl -X POST http://localhost:3001/api/auth/logout \
  -b cookies.txt
```

## Common Issues

### "Authentication required" error
- **Cause**: No valid access token in cookies
- **Solution**: Login again at /login

### "Invalid token" error
- **Cause**: Token expired or user version changed (logout elsewhere)
- **Solution**: Refresh token or login again

### "Google OAuth not configured"
- **Cause**: Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET
- **Solution**: Add to .env file

### Tokens not stored in cookies
- **Cause**: Frontend not handling /auth/callback
- **Solution**: Ensure AuthCallback component is mounted at /auth/callback

### CORS errors
- **Cause**: Frontend and backend on different ports
- **Solution**: Configure CORS in backend (already done)

## Next Steps

1. **Deploy Google OAuth credentials** to production
2. **Update FRONTEND_URL** and **GOOGLE_REDIRECT_URI** for production domain
3. **Enable HTTPS** (required for Secure cookie flag)
4. **Test on production domain** before releasing to users
5. **Monitor auth errors** in production logs

## Useful Links

- [Google OAuth 2.0 Docs](https://developers.google.com/identity/protocols/oauth2)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [httpOnly Cookies Security](https://owasp.org/www-community/controls/Cookie_Security)

