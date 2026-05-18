# API Compatibility Report: Old Express Backend vs New Elysia Backend

## Executive Summary

The new Elysia backend has **critical incompatibilities** with the old Express backend that will break the frontend. The primary issue is the response format - the frontend expects wrapped responses but the new backend returns unwrapped data.

---

## 1. CRITICAL: Response Format Incompatibility

### Old Express Backend (Expected by Frontend)
```javascript
// Success
{ success: true, data: {...} }

// Error
{ success: false, error: "message" }

// List with count
{ success: true, data: [...], count: number }
```

### New Elysia Backend (Current Implementation)
```javascript
// Success - Direct data return
{...}

// Error
{ error: "message" }

// List - No count field
[...]
```

### Impact
**BREAKING CHANGE** - Frontend will fail to parse all API responses.

### Required Fix
Wrap ALL successful responses in `{ success: true, data: ... }` format and errors in `{ success: false, error: ... }` format.

---

## 2. Missing Query Parameters

### Customer Routes

#### Old: `GET /api/customers`
**Query Params:** status, industry, search, limit, offset, orderBy, order
**Response:** `{ success: true, data: [...], count: number }`
**Default Limit:** 100

#### New: `GET /api/customers`
**Query Params:** NONE
**Response:** Array of customers (unwrapped)

**Required Fix:** Add query parameter support for filtering, pagination, and sorting.

---

## 3. Missing Endpoints

### 3.1 Customer Follow-ups Combined View

**Old:**
- `GET /api/customers/:id/follow-ups`
- Returns: `{ success: true, data: { history: [...], scheduled: [...] } }`

**New:**
- Separate endpoints: `/api/followups/...` (not nested under customer)
- No combined view endpoint

**Required Fix:** Add `GET /api/customers/:id/followups` that returns both history and scheduled in one response.

---

### 3.2 Prospect Collection Endpoints

**Missing from new backend:**
- `POST /api/prospects/collect` - Collect new prospects from ICP profiles
- `GET /api/prospects/status` - Get collection status
- `GET /api/prospects/status-stream` - Server-Sent Events for collection progress

**Required Fix:** Implement prospect collection service and routes.

---

### 3.3 AI Endpoints

**Missing from new backend:**
- `POST /api/ai/parse-intent` - Parse user intent from natural language
- `POST /api/ai/scan-business-card` - Extract contact info from business card image
- `POST /api/ai/generate-response` - Generate AI response with context

**Existing in new backend:**
- `POST /api/ai/generate` - Basic text generation
- `POST /api/ai/enrich/:customerId` - Enrich customer data
- `POST /api/ai/proposal/:customerId` - Generate proposal
- `POST /api/ai/meeting/:meetingId/summarize` - Summarize meeting

**Required Fix:** Add missing AI endpoints for intent parsing and business card scanning.

---

### 3.4 Gmail Endpoints

**Missing from new backend:**
- `GET /api/gmail/messages/unmatched` - Get emails not linked to customers

**Required Fix:** Add unmatched emails endpoint.

---

### 3.5 Mixpanel Endpoints

**Missing from new backend:**
- `GET /api/mixpanel/connection-status` - Check connection status
- `GET /api/mixpanel/settings` - Get Mixpanel settings
- `PUT /api/mixpanel/settings` - Update Mixpanel settings
- `GET /api/mixpanel/sync-status` - Get sync job status
- `POST /api/mixpanel/test` - Test Mixpanel connection
- `POST /api/mixpanel/test-event` - Send test event to Mixpanel

**Existing in new backend:**
- `GET /api/mixpanel/status` - General status
- `POST /api/mixpanel/sync` - Sync events
- Most CRUD endpoints for events

**Required Fix:** Add missing Mixpanel management endpoints.

---

### 3.6 Settings Endpoints

**Missing from new backend:**
- `POST /api/settings/slack/validate` - Validate Slack webhook URL
- `POST /api/settings/slack/test` - Test Slack webhook
- `POST /api/settings/slack/notify` - Send Slack notification

**Note:** These may have moved to slack-event routes in new backend. Need to verify.

---

## 4. Response Structure Differences

### 4.1 Customer Stats

**Old:**
```javascript
{
  success: true,
  data: {
    countByStatus: {
      prospect: 5,
      new: 10,
      contact: 3,
      negotiation: 2,
      won: 15,
      lost: 8
    },
    dueFollowUpsCount: 12,
    dueFollowUps: [
      { id, customerId, customerName, scheduledFor, type, content, ... }
      // Top 10 due follow-ups
    ]
  }
}
```

**New:**
```javascript
// Direct stats object (no wrapper)
{
  countByStatus: {...},
  dueFollowUpsCount: number,
  // Missing: dueFollowUps array
}
```

**Required Fix:**
1. Wrap in `{ success: true, data: ... }`
2. Include top 10 due follow-ups in response

---

### 4.2 Prospect Stats

**Old:**
```javascript
{
  success: true,
  data: {
    countBySignal: { high: 5, medium: 10, low: 3 },
    unconvertedCount: 18,
    total: 20
  }
}
```

**New:**
Not implemented

**Required Fix:** Add `GET /api/prospects/stats` endpoint.

---

### 4.3 Prospect Bulk Create

**Old:**
```javascript
POST /api/prospects/bulk
Body: { prospects: [...] }

Response: {
  success: true,
  data: [...],  // Created prospects
  count: number,
  skipped: number  // Duplicates skipped
}
```

**New:**
Not implemented

**Required Fix:** Add bulk prospect creation endpoint.

---

### 4.4 Prospect Convert

**Old:**
```javascript
{
  success: true,
  data: {
    customer: {...},
    prospect: {...}
  }
}
```

**New:**
```javascript
{
  customer: {...},
  prospect: {...}
}
```

**Required Fix:** Wrap in `{ success: true, data: ... }`

---

### 4.5 List Responses with Count

**Old pattern:**
```javascript
{
  success: true,
  data: [...],
  count: number  // Total count, not just returned items
}
```

**New pattern:**
```javascript
[...]  // Just the array
```

**Affected endpoints:**
- `GET /api/customers`
- `GET /api/prospects`
- `GET /api/gmail/messages`
- `GET /api/notifications`
- `GET /api/slack/messages`

**Required Fix:** Add `count` field to all list responses.

---

## 5. Validation and Error Handling

### 5.1 Required Fields

**Old backend validates:**
- Customer name required
- Contact name required
- Meeting title required
- Prospect companyName required
- ICP profile name required

**New backend:**
Uses Elysia/Zod validation - verify all validations match.

---

### 5.2 Error Codes

**Old backend uses error codes:**
- `CONTACT_NOT_FOUND`
- `MEETING_NOT_FOUND`
- `MISSING_FIELDS`
- `MISSING_COMPANY_NAME`
- `MISSING_IMAGE`
- `MISSING_AUDIO_OR_TRANSCRIPTION`
- `MISSING_ICP_PROFILES`
- `COLLECTION_RUNNING`

**New backend:**
Uses simple `{ error: "message" }` format without codes.

**Required Fix:** Add error code field to error responses: `{ success: false, error: "message", code: "ERROR_CODE" }`

---

## 6. OAuth Callback Handling

### Calendar & Gmail OAuth

**Old backend:**
```javascript
// Success redirect
res.redirect('/settings?calendar=connected')
res.redirect('/settings?gmail=connected')

// Error redirect
res.redirect('/settings?error=calendar_auth_failed')
res.redirect('/settings?error=gmail_token_exchange')
```

**New backend:**
Returns JSON response instead of redirecting.

**Required Fix:** Change OAuth callbacks to perform redirects instead of returning JSON.

---

## 7. Status Code Consistency

Both backends use similar status codes, but ensure consistency:
- 200: Success
- 201: Created
- 400: Bad request
- 401: Unauthorized
- 404: Not found
- 409: Conflict
- 500: Server error
- 503: Service unavailable

---

## 8. Data Transformation Differences

### Meeting Summary Fields

**Old backend stores as JSON:**
- keyDiscussions
- actionItems
- customerNeeds
- nextSteps

**New backend:**
Same - stores as stringified JSON

✅ **Compatible**

---

### ICP Profile Fields

**Old backend stores as JSON:**
- industries
- keywords
- targetRegions

**New backend:**
Same - uses `stringifyData()` and `parseProfile()` methods

✅ **Compatible**

---

### Mixpanel Event Properties

**Old backend:**
Stores as JSON string

**New backend:**
Same

✅ **Compatible**

---

## 9. Nested Resource Routes

### Old Backend Structure
```
/api/customers/:id/contacts
/api/customers/:id/meetings
/api/customers/:id/follow-ups
/api/customers/:id/enrichment
/api/customers/:id/proposals
```

### New Backend Structure
```
/api/customers/:id/contacts    ✅
/api/customers/:id/meetings    ✅
/api/customers/:id/enrichment  ✅
/api/customers/:id/proposals   ✅
/api/customers/:id/followups   ❌ (separate /api/followups routes)
/api/customers/:id/scheduled   ❌ (separate /api/followups routes)
```

**Required Fix:** Add follow-up endpoints under customer routes for consistency.

---

## 10. Default Values

### Pagination Limits

**Old Backend:**
- Customers: 100
- Prospects: 100
- Meetings: 50
- Gmail messages: 50 (sync), 100 (list)
- Slack messages: 10 (web API), 50 (stored messages)
- Notifications: 50

**New Backend:**
- Customers: No limit (returns all)
- Prospects: No limit (returns all)
- Meetings: 10
- Gmail emails: 50
- Notifications: 50
- Follow-ups: All (no limit)

**Required Fix:** Add default limits to match old backend.

---

## 11. Special Endpoint Behaviors

### Slack Events Endpoint

**Both backends:**
- POST /api/slack/events
- Handles URL verification challenge
- Processes events asynchronously
- Returns "ok" or challenge response immediately

✅ **Compatible**

---

### Calendar/Gmail OAuth Callback

**Old:**
Redirects to frontend with query params

**New:**
Returns JSON

❌ **Incompatible** - See Section 6

---

## Priority Fixes

### P0 (Critical - Breaks all API calls)
1. ✅ **Wrap all responses in `{ success: true, data: ... }` format**
2. ✅ **Add `count` field to list responses**
3. ✅ **Implement OAuth callback redirects**

### P1 (High - Missing core features)
4. ⚠️ **Add query parameter support to `/api/customers` and `/api/prospects`**
5. ⚠️ **Add missing endpoints:**
   - Customer follow-ups combined view
   - Prospect bulk create
   - Prospect stats
   - AI parse-intent
   - AI scan-business-card
   - Gmail unmatched messages

### P2 (Medium - Feature parity)
6. ⚠️ **Add missing Mixpanel endpoints**
7. ⚠️ **Implement prospect collection service**
8. ⚠️ **Add error codes to error responses**

### P3 (Low - Nice to have)
9. ⚠️ **Add default pagination limits**
10. ⚠️ **Add top 10 due follow-ups to customer stats**

---

## Testing Checklist

After fixes are applied, test these scenarios:

### Response Format
- [ ] All success responses wrapped in `{ success: true, data: ... }`
- [ ] All error responses wrapped in `{ success: false, error: ... }`
- [ ] List responses include `count` field

### Customer Endpoints
- [ ] GET /api/customers with query params (status, industry, search, limit, offset)
- [ ] GET /api/customers/stats includes dueFollowUps array
- [ ] GET /api/customers/:id/followups returns combined history + scheduled

### Prospect Endpoints
- [ ] POST /api/prospects/bulk creates multiple prospects
- [ ] GET /api/prospects/stats returns statistics
- [ ] POST /api/prospects/collect starts collection
- [ ] GET /api/prospects/status-stream streams SSE events

### AI Endpoints
- [ ] POST /api/ai/parse-intent parses natural language
- [ ] POST /api/ai/scan-business-card extracts business card data

### OAuth Flows
- [ ] Calendar OAuth callback redirects to /settings?calendar=connected
- [ ] Gmail OAuth callback redirects to /settings?gmail=connected
- [ ] Error cases redirect with error query param

### Pagination
- [ ] All list endpoints respect limit/offset parameters
- [ ] Default limits match old backend

---

## Conclusion

The new Elysia backend needs significant modifications to maintain API compatibility with the frontend. The most critical issue is the response format wrapper, which affects every single endpoint. Once this is fixed, the missing endpoints and query parameters should be added to achieve full feature parity with the old Express backend.