# Refresh Token Testing Guide

## Overview

This guide provides comprehensive manual testing scenarios for the refresh token system with httpOnly cookies. Follow these steps to verify that token refresh, rotation, and security features work correctly.

## Prerequisites

### Backend Setup

```bash
cd ProjectAlfa-BE
npm install cookie-parser
npm install
npx prisma db push
npx prisma generate
npm run start:dev
```

### Frontend Setup

```bash
cd ProjectAlfaFE
npm install
npm run dev
```

### Environment Variables

Ensure these are set in `ProjectAlfa-BE/.env`:

```bash
JWT_ACCESS_SECRET=your-access-secret
JWT_ACCESS_EXPIRES_IN=15m  # For testing, use 30s to see refresh in action
JWT_REFRESH_SECRET=your-refresh-secret
JWT_REFRESH_EXPIRES_IN=30d
```

## Test Scenarios

### Test 1: Basic Authentication Flow

**Objective:** Verify that login stores refresh token in httpOnly cookie

**Steps:**

1. Open browser DevTools (F12) → Network tab
2. Navigate to `http://localhost:3000`
3. Click "Login" and enter credentials
4. Submit login form

**Expected Console Logs (Frontend):**

```
🔐 [LOGIN] 2025-10-26T... Login attempt
📤 [API_REQUEST] POST /auth/login
📥 [API_RESPONSE] POST /auth/login - 200
💾 [AUTH] Auth data saved to localStorage
✅ [AUTH CONTEXT] Login successful, state updated
```

**Expected Console Logs (Backend):**

```
🔐 [AUTH] Login request received { email: 'user@example.com' }
🍪 [AUTH] Refresh token cookie set { secure: false, expiresIn: '30 days' }
```

**Verification:**

1. DevTools → Application → Cookies → `http://localhost:3000`
2. Find cookie named `refresh_token`
3. Verify properties:
   - ✅ HttpOnly: true
   - ✅ Secure: false (development)
   - ✅ SameSite: Strict
   - ✅ Max-Age: ~2592000 (30 days)

---

### Test 2: Access Token Expiration and Auto-Refresh

**Objective:** Verify automatic token refresh when access token expires

**Setup:**

1. Temporarily change `JWT_ACCESS_EXPIRES_IN=30s` in backend `.env`
2. Restart backend server
3. Login to the application
4. Wait 35 seconds
5. Make an API request (e.g., navigate to profile page or make any authenticated request)

**Expected Behavior:**

1. First request fails with 401
2. Token refresh triggered automatically
3. Original request retried with new token

**Expected Console Logs (Frontend):**

```
📤 [API_REQUEST] GET /auth/protected
❌ [API_ERROR] GET /auth/protected - Error 401
🔒 [AUTH API] 401 Unauthorized - Attempting token refresh
🔄 [TOKEN REFRESH] Starting token refresh...
📤 [API_REQUEST] POST /auth/refresh
📥 [API_RESPONSE] POST /auth/refresh - 200
✅ [TOKEN REFRESH] Token refreshed successfully
💾 [AUTH] Auth data saved to localStorage
✅ [AUTH API] Token refreshed, retrying original request
📤 [API_REQUEST] GET /auth/protected (retry)
📥 [API_RESPONSE] GET /auth/protected - 200
```

**Expected Console Logs (Backend):**

```
🔄 [AUTH] Token refresh request received
🔄 [AUTH SERVICE] Starting token refresh process
🔍 [AUTH SERVICE] Validating refresh token...
✅ [AUTH SERVICE] Refresh token validated
👤 [AUTH SERVICE] Looking up user data...
✅ [AUTH SERVICE] User found
🔑 [AUTH SERVICE] Generating new access token...
🔄 [AUTH SERVICE] Rotating refresh token...
🗑️ [AUTH SERVICE] Old refresh token revoked
🆕 [AUTH SERVICE] New refresh token created
✅ [AUTH SERVICE] Token refresh completed successfully
🍪 [AUTH] Refresh token cookie set
```

**Verification:**

1. Check that request completed successfully after refresh
2. New access token stored in localStorage
3. New refresh token cookie set (check Last-Modified time)

---

### Test 3: Concurrent Requests During Token Expiration

**Objective:** Verify request queue prevents multiple simultaneous refresh calls

**Setup:**

1. Keep `JWT_ACCESS_EXPIRES_IN=30s`
2. Login and wait for token to expire
3. Quickly trigger multiple API requests (e.g., open multiple tabs or make rapid clicks)

**Expected Behavior:**

- Only ONE refresh request made
- Other requests queued and retried after refresh

**Expected Console Logs (Frontend):**

```
🔒 [AUTH API] 401 Unauthorized - Attempting token refresh
🔄 [TOKEN REFRESH] Starting token refresh...
📋 [QUEUE_REQUEST] Request queued: /api/endpoint1
⏳ [AUTH API] Token refresh in progress, queueing request...
📋 [QUEUE_REQUEST] Request queued: /api/endpoint2
⚙️ [QUEUE_PROCESS] Processing 2 queued requests
✅ All queued requests retried successfully
```

**Verification:**

- Network tab shows only ONE `/auth/refresh` request
- All other requests succeed after refresh completes

---

### Test 4: Token Rotation (Security Feature)

**Objective:** Verify old refresh token is invalidated after refresh

**Steps:**

1. Login to application
2. Copy refresh token cookie value from DevTools
3. Wait for access token to expire and trigger refresh
4. Try to use old refresh token (via curl or Postman):

```bash
curl -X POST http://localhost:3001/auth/refresh \
  -H "Cookie: refresh_token=<OLD_TOKEN_VALUE>"
```

**Expected Response:**

```json
{
  "statusCode": 401,
  "message": "Invalid or revoked refresh token"
}
```

**Expected Console Logs (Backend):**

```
🔄 [AUTH] Token refresh request received
🔄 [AUTH SERVICE] Starting token refresh process
🔍 [AUTH SERVICE] Validating refresh token...
❌ [AUTH SERVICE] Invalid refresh token { reason: 'Token validation failed' }
```

**Verification:**

- Old token cannot be reused
- Database shows old token with `isActive: false`

---

### Test 5: Logout Flow

**Objective:** Verify refresh token is revoked on logout

**Steps:**

1. Login to application
2. Note refresh token cookie in DevTools
3. Click "Logout"
4. Check cookies and localStorage

**Expected Console Logs (Frontend):**

```
👋 [AUTH CONTEXT] Logout initiated
👋 [LOGOUT] Logout initiated
📤 [API_REQUEST] POST /auth/logout
📥 [API_RESPONSE] POST /auth/logout - 200
👋 [LOGOUT] Backend logout successful
👋 [LOGOUT] Logout completed - local storage cleared
✅ [AUTH CONTEXT] Logout completed, state cleared
```

**Expected Console Logs (Backend):**

```
👋 [AUTH] Logout request received
🗑️ [AUTH] Refresh token cookie cleared
✅ [AUTH] Logout successful
```

**Verification:**

1. ✅ `refresh_token` cookie deleted
2. ✅ `auth_token` removed from localStorage
3. ✅ `user_data` removed from localStorage
4. ✅ Redirected to login page
5. ✅ Database shows token with `isActive: false`

---

### Test 6: Cross-Site Request Forgery (CSRF) Protection

**Objective:** Verify SameSite cookie prevents CSRF attacks

**Steps:**

1. Login to application
2. Create a malicious HTML file:

```html
<!-- malicious.html -->
<html>
  <body>
    <form action="http://localhost:3001/auth/refresh" method="POST">
      <input type="submit" value="Click me!" />
    </form>
    <script>
      document.forms[0].submit();
    </script>
  </body>
</html>
```

3. Open this file in browser (file:/// protocol)

**Expected Result:**

- Request fails due to SameSite=Strict
- Cookie not sent with cross-site request
- 401 Unauthorized response

**Verification:**

- Network tab shows no `refresh_token` cookie sent
- CSRF attack prevented

---

### Test 7: XSS Protection

**Objective:** Verify JavaScript cannot access httpOnly cookie

**Steps:**

1. Login to application
2. Open browser console
3. Try to access cookie:

```javascript
// Try to read refresh token
document.cookie.split(';').find((c) => c.includes('refresh_token'));

// Try to read via various methods
console.log(document.cookie);
console.log(navigator.cookieEnabled);
```

**Expected Result:**

- Refresh token NOT visible in `document.cookie`
- Only non-httpOnly cookies visible

**Verification:**

- ✅ `refresh_token` not accessible via JavaScript
- ✅ XSS attack cannot steal refresh token

---

### Test 8: Register Flow

**Objective:** Verify registration sets refresh token cookie

**Steps:**

1. Click "Register"
2. Fill form and submit
3. Check DevTools

**Expected Console Logs:**

```
📝 [REGISTER] Registration attempt
📤 [API_REQUEST] POST /auth/register
📥 [API_RESPONSE] POST /auth/register - 201
💾 [AUTH] Auth data saved to localStorage
✅ [AUTH CONTEXT] Registration successful
```

**Expected Console Logs (Backend):**

```
📝 [AUTH] Registration request received
🍪 [AUTH] Refresh token cookie set
```

**Verification:**

- ✅ Refresh token cookie set
- ✅ Access token in localStorage
- ✅ User redirected to profile

---

### Test 9: Google OAuth Flow

**Objective:** Verify Google login sets refresh token cookie

**Steps:**

1. Click "Sign in with Google"
2. Complete Google auth
3. Check DevTools

**Expected Behavior:**

- Same as Test 1 but via Google
- Refresh token cookie set
- Access token in localStorage

---

### Test 10: Debug Endpoint (Development Only)

**Objective:** Test development debug endpoint

**Steps:**

1. Login to application
2. Make request to debug endpoint:

```bash
curl -X GET http://localhost:3001/auth/debug/token-info \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

**Expected Response:**

```json
{
  "message": "Token information",
  "user": {
    "sub": "user_id",
    "email": "user@example.com"
  }
}
```

**Production Test:**
Set `NODE_ENV=production` and verify endpoint returns error.

---

## Troubleshooting

### Issue: Cookie not set

**Possible Causes:**

1. `withCredentials: true` not set in axios config
2. CORS not configured with `credentials: true`
3. Cookie-parser not installed/configured

**Solution:**

```typescript
// Frontend axios config
withCredentials: true;

// Backend CORS config
app.enableCors({
  credentials: true,
  origin: 'http://localhost:3000',
});

// Backend cookie parser
app.use(cookieParser());
```

### Issue: 401 on refresh

**Possible Causes:**

1. Refresh token expired
2. Token revoked in database
3. Cookie not sent with request

**Debug Steps:**

1. Check cookie exists in DevTools
2. Check Network tab → Request Headers → Cookie
3. Check backend logs for validation errors

### Issue: Infinite refresh loop

**Possible Causes:**

1. `_retry` flag not set
2. Refresh endpoint returning 401

**Solution:**

- Ensure `originalRequest._retry = true` before retry
- Exclude `/auth/refresh` from 401 handling

---

## Performance Metrics

**Expected Timings:**

- Login: < 500ms
- Token refresh: < 300ms
- Queue processing: < 100ms per request

**Monitor these in console logs:**

```
Duration metrics appear in all log messages
Example: "duration": "245ms"
```

---

## Security Checklist

- [ ] Refresh token stored in httpOnly cookie
- [ ] Access token stored in localStorage (short-lived)
- [ ] SameSite=Strict prevents CSRF
- [ ] Token rotation on each refresh
- [ ] Old tokens revoked in database
- [ ] Logout revokes refresh token
- [ ] 401 triggers automatic refresh
- [ ] Concurrent requests queued properly
- [ ] XSS cannot access refresh token
- [ ] Production uses secure flag (HTTPS)

---

## Tips for Testing

1. **Use Console Filters:**
   - Filter by `[AUTH]` to see auth-related logs only
   - Filter by `[TOKEN REFRESH]` for refresh operations

2. **Network Tab Filters:**
   - Filter by `/auth/` to see auth endpoints
   - Check "Preserve log" to keep logs across navigation

3. **Test in Multiple Tabs:**
   - Open 3-4 tabs
   - Let token expire
   - Make requests in all tabs simultaneously
   - Verify only one refresh call

4. **Test Token Expiry:**
   - Set very short expiry (30s) for testing
   - Reset to production values (15m) after testing

5. **Database Inspection:**

```sql
-- View all refresh tokens
SELECT id, "userId", "isActive", "expiresAt", "createdAt"
FROM "RefreshToken"
ORDER BY "createdAt" DESC;

-- Count active tokens per user
SELECT "userId", COUNT(*) as active_tokens
FROM "RefreshToken"
WHERE "isActive" = true
GROUP BY "userId";
```

---

## Success Criteria

✅ All 10 test scenarios pass
✅ No errors in console logs
✅ Token refresh happens automatically
✅ Old tokens cannot be reused
✅ Cookies have correct security flags
✅ Logout clears all auth data
✅ Concurrent requests handled gracefully
✅ CSRF and XSS protections work

---

## Next Steps

After successful testing:

1. Increase access token expiry to 15 minutes
2. Deploy to staging environment
3. Test with HTTPS (secure flag validation)
4. Run automated integration tests
5. Perform security audit
6. Monitor logs in production

---

**Last Updated:** October 26, 2025
**Testing Time:** ~30-45 minutes for full suite
