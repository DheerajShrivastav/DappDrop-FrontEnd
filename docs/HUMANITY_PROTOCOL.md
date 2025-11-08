# Humanity Protocol Integration

This document explains how to use and configure the Humanity Protocol verification system in DappDrop.

## Overview

The Humanity Protocol integration ensures that only verified human users can complete certain tasks, preventing Sybil attacks through biometric palm verification. Campaign hosts can enable Humanity verification for individual tasks, and the system automatically checks user verification status before allowing task completion.

## Features

- **Task-Level Verification**: Enable Humanity verification per task
- **Automatic Verification Checks**: System checks verification before task completion
- **24-Hour Caching**: Verification results are cached to reduce API calls
- **Rate Limiting**: Prevents abuse with configurable rate limits
- **Clear User Guidance**: Users are guided to complete verification if needed
- **Status Display**: Shows verification status in user dashboard

## Configuration

### 1. Environment Variables

Add the following to your `.env.local` file:

```bash
# Humanity Protocol API Key (required)
HUMANITY_API_KEY="your-api-key-here"

# API URL (optional, defaults to testnet)
HUMANITY_API_URL="https://testnet-api.humanity.org/v1/human/verify"
```

**Getting an API Key:**
1. Visit [https://developer.humanity.org](https://developer.humanity.org)
2. Create an account or sign in
3. Generate a new API key
4. Copy the key to your `.env.local` file

**API Endpoints:**
- Testnet: `https://testnet-api.humanity.org/v1/human/verify`
- Mainnet: `https://api.humanity.org/v1/human/verify`

### 2. Database Migration

The integration requires database schema changes. Run the migration:

```bash
npx prisma migrate dev --name add_humanity_verification
```

Or just generate the Prisma client if you're using an existing database:

```bash
npx prisma generate
```

## Usage

### For Campaign Hosts

#### Creating a Humanity-Verified Task

1. Navigate to the **Create Campaign** page
2. Add a task or edit an existing task
3. Toggle the **"Require Humanity Protocol Verification"** switch
4. Complete the rest of the task configuration
5. Submit the campaign

The task will now display a purple "Humanity Verified Required" badge.

#### What Happens

- Users without verification cannot complete the task
- Users attempting the task will see an error modal
- The modal guides them to https://testnet.humanity.org for verification
- Once verified, they can retry and complete the task

### For Users/Participants

#### Completing Humanity-Verified Tasks

1. View a campaign with Humanity-verified tasks
2. Look for tasks with the purple "Humanity Verified Required" badge
3. If not yet verified:
   - Click to attempt the task
   - A modal will appear explaining the requirement
   - Click "Go to Humanity Protocol" to start verification
   - Complete palm scan verification on Humanity Protocol
   - Return to DappDrop and try again

4. If already verified:
   - Complete the task normally
   - Your verification status is displayed in your profile

#### Verification Status

Your Humanity verification status is shown:
- In your profile/dashboard: Green "Human Verified" badge
- On the campaign page: Below your wallet address

## Technical Implementation

### API Endpoints

#### POST /api/verify-humanity
Verify a wallet address using Humanity Protocol

**Request:**
```json
{
  "walletAddress": "0x..."
}
```

**Response:**
```json
{
  "success": true,
  "isHuman": true,
  "walletAddress": "0x...",
  "verifiedAt": "2024-01-01T00:00:00Z"
}
```

#### GET /api/verify-humanity?walletAddress=0x...
Check cached verification status

**Response:**
```json
{
  "success": true,
  "isHuman": true,
  "walletAddress": "0x..."
}
```

### Caching System

- **Cache Duration**: 24 hours (86,400 seconds)
- **Storage**: PostgreSQL database (`User` table)
- **Fields**: `humanityVerified`, `lastHumanityCheck`

Verification results are cached to:
1. Reduce API calls to Humanity Protocol
2. Improve user experience (faster checks)
3. Reduce costs

### Rate Limiting

- **Limit**: 10 verification attempts per hour per wallet
- **Window**: 60 minutes (rolling window)
- **Storage**: In-memory (server-side)

If rate limit is exceeded, users receive:
```
"Rate limit exceeded. Please try again later."
```

### Database Schema

**User Model:**
```prisma
model User {
  id                  String    @id @default(cuid())
  walletAddress       String    @unique
  humanityVerified    Boolean   @default(false)
  lastHumanityCheck   DateTime?
  // ... other fields
}
```

**CampaignTaskMetadata Model:**
```prisma
model CampaignTaskMetadata {
  id                           String   @id @default(cuid())
  campaignId                   String
  taskIndex                    Int
  requiresHumanityVerification Boolean  @default(false)
  // ... other fields
}
```

### Components

**HumanityBadge** (`src/components/humanity-badge.tsx`)
- Displays "Humanity Verified Required" badge on tasks
- Configurable size and variant
- Also includes `HumanityVerifiedStatus` for user status

**HumanityVerificationModal** (`src/components/humanity-verification-modal.tsx`)
- Modal shown to unverified users
- Explains verification requirement
- Provides link to Humanity Protocol
- Includes "Check Verification Status" button

### Service Layer

**humanity-service.ts** (`src/lib/humanity-service.ts`)
- `verifyHumanity(walletAddress)`: Verify a wallet with Humanity Protocol
- `isUserVerified(walletAddress)`: Check cached verification status
- `refreshVerification(walletAddress)`: Force refresh verification
- Internal caching and rate limiting logic

## Testing

### Manual Testing

1. **Create a Humanity-Verified Task**
   - Create a campaign with Humanity verification enabled
   - Verify the badge appears on the task

2. **Test Without Verification**
   - Use an unverified wallet
   - Attempt to complete the task
   - Verify error modal appears

3. **Test With Verification**
   - Use a verified wallet (or mock the API response)
   - Complete the task successfully
   - Verify task completion works

### Development/Testing Mode

If `HUMANITY_API_KEY` is not configured, the system falls back to permissive mode (all users pass verification). This is for development only.

**⚠️ WARNING**: Never deploy to production without a valid API key!

## Security Considerations

### API Key Security
- Store API key in environment variables only
- Never commit `.env.local` to version control
- Use different keys for development and production

### Rate Limiting
- Protects against abuse and excessive API calls
- Can be adjusted in `src/lib/humanity-service.ts`

### Caching
- Prevents verification bypass through cache invalidation
- 24-hour TTL balances security and user experience
- Cache is automatically refreshed after expiration

### Wallet Verification
- Backend validates all verification checks
- Frontend cannot bypass verification
- Verification status is checked at task completion time

## Troubleshooting

### "API key not configured" Error
**Solution**: Add `HUMANITY_API_KEY` to your `.env.local` file

### "Rate limit exceeded" Error
**Solution**: Wait 60 minutes or adjust rate limits in `humanity-service.ts`

### Verification Status Not Updating
**Solution**: 
1. Check database connection
2. Verify Prisma client is generated
3. Check browser console for errors

### Task Verification Always Fails
**Solution**:
1. Verify API key is correct
2. Check API endpoint URL
3. Check Humanity Protocol API status
4. Review server logs for detailed errors

## API Documentation

### Humanity Protocol API

**Endpoint**: `GET https://testnet-api.humanity.org/v1/human/verify?wallet_address=<ADDRESS>`

**Headers**:
```
X-HP-API-Key: <YOUR_API_KEY>
Content-Type: application/json
```

**Response**:
```json
{
  "is_human": true,
  "wallet_address": "0x...",
  "verified_at": "2024-01-01T00:00:00Z"
}
```

**Error Responses**:
- `400`: Invalid wallet address
- `401`: Invalid API key
- `404`: Wallet not found/verified
- `429`: Rate limit exceeded

## Support

For issues with:
- **DappDrop Integration**: Open an issue in this repository
- **Humanity Protocol API**: Contact support@humanity.org
- **Verification Process**: Visit https://testnet.humanity.org/help

## Future Enhancements

Potential improvements:
1. Webhook support for real-time verification updates
2. Batch verification for multiple wallets
3. Custom cache TTL per campaign
4. Verification analytics dashboard
5. Multi-network support (different chains)

## License

This integration follows the same license as the main DappDrop project.
