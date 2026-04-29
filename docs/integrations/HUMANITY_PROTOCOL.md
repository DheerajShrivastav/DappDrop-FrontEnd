# Humanity Protocol Integration (v2 - OAuth SDK)

This document explains how to use and configure the Humanity Protocol verification system in DappDrop.

## Overview

The Humanity Protocol integration ensures that only verified human users can complete certain tasks, preventing Sybil attacks through biometric verification. Campaign hosts can enable Humanity verification for individual tasks, and the system automatically checks user verification status before allowing task completion.

**v2 uses the `@humanity-org/connect-sdk` with OAuth 2.0 + PKCE** instead of the v1 REST API key approach. Users are redirected to Humanity Protocol to authenticate and verify, then returned to DappDrop with verified credentials.

## Features

- **Task-Level Verification**: Enable Humanity verification per task
- **OAuth 2.0 + PKCE Flow**: Secure browser-based authentication via Humanity Protocol
- **Preset Verification**: Uses `is_human` preset to verify biometric identity
- **24-Hour Caching**: Verification results are cached to reduce re-verification
- **Rate Limiting**: Prevents abuse with configurable rate limits
- **Auto Task Completion**: After OAuth return, the task is auto-completed on blockchain

## Configuration

### 1. Register Your App

1. Visit [https://developers.humanity.org/](https://developers.humanity.org/)
2. Register your application
3. Get your `clientId`
4. Set your `redirectUri` (must match exactly — this is the most common error)
5. Register **separate** credentials for sandbox and production

### 2. Environment Variables

Add the following to your `.env.local` file:

```bash
# Client ID from Humanity Developer Portal (public, used on frontend)
NEXT_PUBLIC_HUMANITY_CLIENT_ID="your-client-id"

# Must match exactly what you registered in the developer portal
NEXT_PUBLIC_HUMANITY_REDIRECT_URI="http://localhost:3000/humanity-callback"

# "sandbox" for development, "production" for production
NEXT_PUBLIC_HUMANITY_ENVIRONMENT="sandbox"

# Portal URL for user reference
NEXT_PUBLIC_HUMANITY_PORTAL_URL="https://testnet.humanity.org"
```

### 3. Database

No migration needed from v1 — the same `humanityVerified` and `lastHumanityCheck` fields are used.

```bash
npx prisma generate
```

## How It Works (v2 OAuth Flow)

### User Verification Flow

1. User clicks "Verify with Humanity" button in the task modal
2. SDK builds an OAuth URL with PKCE challenge
3. User is redirected to Humanity Protocol to authenticate
4. User completes biometric verification (if not already done)
5. Humanity Protocol redirects back to `/humanity-callback`
6. Callback page exchanges the authorization code for an access token
7. `verifyPresets` is called with the `is_human` preset
8. Result is saved to the database and user is redirected back to the campaign
9. Campaign page detects the verification result and auto-completes the task on blockchain

### Architecture

```
Modal → buildAuthUrl() → Humanity OAuth → /humanity-callback
  → exchangeCodeForToken() → verifyPresets(['is_human'])
  → POST /api/verify-humanity (save to DB)
  → Redirect to campaign page
  → useEffect detects result → completeTask() on blockchain
```

## Usage

### For Campaign Hosts

1. Navigate to **Create Campaign**
2. Add a task with type **Humanity Protocol Verification**
3. The task will display a purple "Humanity Verification Required" badge

### For Users/Participants

1. View a campaign with Humanity-verified tasks
2. Click to attempt the task
3. A modal appears with "Verify with Humanity" button
4. Complete the OAuth flow (redirects to Humanity Protocol and back)
5. Task is auto-completed after successful verification

## Technical Implementation

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/humanity.ts` | SDK instance, PKCE helpers, session storage utils |
| `src/lib/humanity-service.ts` | Server-side DB operations (save/check verification) |
| `src/app/humanity-callback/page.tsx` | OAuth callback handler |
| `src/app/api/verify-humanity/route.ts` | API route (POST: save, GET: check cached) |
| `src/components/humanity-verification-modal.tsx` | Modal with OAuth flow trigger |
| `src/app/campaign/[id]/page.tsx` | Campaign page with auto-complete on OAuth return |

### API Endpoints

#### POST /api/verify-humanity
Save verification result from the OAuth SDK flow.

**Request:**
```json
{
  "walletAddress": "0x...",
  "isHuman": true,
  "accessToken": "eyJ..."
}
```

**Response:**
```json
{
  "success": true,
  "isHuman": true,
  "walletAddress": "0x...",
  "verifiedAt": "2025-01-01T00:00:00Z"
}
```

#### GET /api/verify-humanity?walletAddress=0x...
Check cached verification status (unchanged from v1).

### Caching System

- **Cache Duration**: 24 hours
- **Storage**: PostgreSQL database (`User` table)
- **Fields**: `humanityVerified`, `lastHumanityCheck`

### Rate Limiting

- **Limit**: 10 verification attempts per hour per wallet
- **Window**: 60 minutes (rolling)
- **Storage**: In-memory (server-side)

### Database Schema

Unchanged from v1:

```prisma
model User {
  humanityVerified    Boolean   @default(false)
  lastHumanityCheck   DateTime?
}

model CampaignTaskMetadata {
  requiresHumanityVerification Boolean @default(false)
}
```

## Troubleshooting

### "Missing PKCE code verifier" Error
The session storage was cleared between redirect and callback. Ensure cookies/session storage are not being blocked.

### OAuth redirect URI mismatch
`NEXT_PUBLIC_HUMANITY_REDIRECT_URI` must match exactly what you registered in the Humanity Developer Portal. Check for trailing slashes and protocol (http vs https).

### Verification succeeds but task doesn't complete
Check browser console for blockchain errors. The task auto-completion happens in a `useEffect` after the OAuth callback redirect.

### Rate limit exceeded
Wait 60 minutes or adjust limits in `humanity-service.ts`.

## Migration from v1

If upgrading from v1 (API key approach):
1. Remove `HUMANITY_API_KEY` and `HUMANITY_API_URL` env vars
2. Add the new `NEXT_PUBLIC_HUMANITY_*` env vars
3. No database migration needed
4. Install `@humanity-org/connect-sdk` package
