# Security Implementation: Wallet Signature Authentication

## Overview

This document describes the security improvements implemented for the DappDrop image upload system, addressing three critical vulnerabilities related to authentication and authorization.

## Security Issues Fixed

### 1. ⚠️ Unauthenticated Image Cleanup Endpoint

**Location:** `src/app/api/uploadthing/cleanup/route.ts`

**Problem:** The endpoint allowed anyone to delete images from UploadThing storage without any authentication or ownership verification.

**Solution:**

- Added signature-based authentication requiring users to sign a message with their wallet
- Implemented ownership verification by checking the CampaignCache table
- Only campaign hosts can delete images associated with their campaigns
- Added comprehensive logging with user identifiers

### 2. ⚠️ Trusted User Input Without Verification

**Location:** `src/app/api/campaigns/[campaignId]/image/route.ts` (POST handler)

**Problem:** The endpoint trusted the `userAddress` from the request body without server-side verification, allowing address spoofing attacks.

**Solution:**

- Implemented signature verification using ethers.js `verifyMessage`
- Server recovers the actual signer address from the signature
- Compares recovered address with blockchain campaign host data
- Removed reliance on client-provided `userAddress`

### 3. ⚠️ Unauthenticated Image Deletion

**Location:** `src/app/api/campaigns/[campaignId]/image/route.ts` (DELETE handler)

**Problem:** Anyone could delete campaign images by calling the endpoint with a valid UploadThing URL.

**Solution:**

- Added signature-based authentication
- Verify the authenticated user is the campaign host
- Check that the image URL matches the campaign's stored imageUrl
- Update database to remove image reference after successful deletion

## Implementation Details

### Authentication Flow

1. **Client Signs Message**

   ```typescript
   const address = await signer.getAddress()
   const nonce = Date.now().toString()
   const message = `Sign this message to authenticate with DappDrop\n\nWallet: ${address}\nNonce: ${nonce}`
   const signature = await signer.signMessage(message)
   ```

2. **Client Sends Request**

   ```typescript
   fetch('/api/campaigns/[id]/image', {
     method: 'POST',
     body: JSON.stringify({
       imageUrl: 'https://...',
       signature: '0x...',
       message: 'Sign this message...',
     }),
   })
   ```

3. **Server Verifies Signature**

   ```typescript
   const authenticatedAddress = ethers.verifyMessage(message, signature)
   ```

4. **Server Checks Authorization**
   ```typescript
   // Fetch campaign from blockchain or database
   if (campaign.host.toLowerCase() !== authenticatedAddress.toLowerCase()) {
     return 403 Forbidden
   }
   ```

### New Files Created

#### `src/lib/auth-utils.ts`

Server-side utilities for signature verification:

- `verifyAuthentication(signature, message)` - Verify signature and recover address
- `generateAuthMessage(address, nonce)` - Generate standard auth message
- `validateAuthMessage(message, maxAge)` - Validate message freshness (5 min default)

#### `src/lib/wallet-auth.ts`

Client-side utilities for signing:

- `signAuthMessage(provider)` - Sign authentication message with wallet

### Modified Files

#### `src/app/api/uploadthing/cleanup/route.ts`

- Added authentication via signature verification
- Added authorization check (user must own the campaign)
- Added comprehensive logging with user addresses
- Returns appropriate HTTP status codes (401, 403, 500)

#### `src/app/api/campaigns/[campaignId]/image/route.ts`

**POST Handler:**

- Replaced `userAddress` from body with signature verification
- Server recovers actual signer address
- Verifies against blockchain host data
- Removed internal error details from responses

**DELETE Handler:**

- Added complete authentication flow
- Verifies user is campaign host
- Checks imageUrl matches campaign's stored URL
- Updates database after deletion
- Returns appropriate status codes

#### `src/lib/web3-service.ts`

**Functions Updated:**

- `createAndActivateCampaign()` - Signs message before saving image
- `createCampaign()` - Signs message before saving image

## Security Best Practices Applied

### ✅ Server-Side Verification

- Never trust client-provided addresses
- Always verify signatures on the server
- Recover and validate the actual signer

### ✅ Proper Authorization

- Check campaign ownership via blockchain data
- Verify user permissions before mutations
- Match stored data with deletion requests

### ✅ Error Handling

- Generic error messages for clients
- Detailed logging server-side only
- Appropriate HTTP status codes (401, 403, 404, 500)

### ✅ Message Freshness

- Include timestamp nonce in signed messages
- Validate message age (5 minute window)
- Prevent replay attacks

## API Changes

### POST `/api/campaigns/[campaignId]/image`

**Before:**

```json
{
  "imageUrl": "https://...",
  "userAddress": "0x..." // ⚠️ Trusted from client
}
```

**After:**

```json
{
  "imageUrl": "https://...",
  "signature": "0x...", // ✅ Verified on server
  "message": "Sign this message..."
}
```

### DELETE `/api/campaigns/[campaignId]/image`

**Before:**

```json
{
  "imageUrl": "https://..." // ⚠️ No auth check
}
```

**After:**

````json
{
  "signature": "0x...",     // ✅ Authentication required
  "message": "Sign this message..."
}
// Verifies imageUrl from database

### POST `/api/uploadthing/cleanup`

**Before:**
```json
{
  "imageUrl": "https://..." // ⚠️ Anyone could delete
}
````

**After:**

```json
{
  "imageUrl": "https://...",
  "signature": "0x...", // ✅ Authentication required
  "message": "Sign this message...",
  "userAddress": "0x..." // ✅ Verified via signature
}
```

## Testing

### Test Authentication

```typescript
// Should fail without signature
fetch('/api/campaigns/1/image', {
  method: 'POST',
  body: JSON.stringify({ imageUrl: 'https://...' }),
}) // Returns 401

// Should fail with invalid signature
fetch('/api/campaigns/1/image', {
  method: 'POST',
  body: JSON.stringify({
    imageUrl: 'https://...',
    signature: 'invalid',
    message: 'test',
  }),
}) // Returns 401

// Should succeed with valid signature from campaign host
const message = `Sign this message to authenticate with DappDrop\n\nWallet: ${address}\nNonce: ${Date.now()}`
const signature = await signer.signMessage(message)
fetch('/api/campaigns/1/image', {
  method: 'POST',
  body: JSON.stringify({ imageUrl: 'https://...', signature, message }),
}) // Returns 200
```

### Test Authorization

```typescript
// Should fail if authenticated user is not campaign host
const otherUserSignature = await otherSigner.signMessage(message)
fetch('/api/campaigns/1/image', {
  method: 'POST',
  body: JSON.stringify({
    imageUrl: 'https://...',
    signature: otherUserSignature,
    message,
  }),
}) // Returns 403
```

## Migration Notes

### For Frontend Developers

When making requests to image endpoints, you must now:

1. Get the user's signer
2. Generate and sign an authentication message
3. Include `signature` and `message` in the request body
4. Remove `userAddress` from the body (server derives it)

Example:

```typescript
const address = await signer.getAddress()
const nonce = Date.now().toString()
const message = `Sign this message to authenticate with DappDrop\n\nWallet: ${address}\nNonce: ${nonce}`
const signature = await signer.signMessage(message)

await fetch('/api/campaigns/1/image', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    imageUrl: uploadedUrl,
    signature,
    message,
  }),
})
```

### TypeScript May Require Restart

After adding new files (`auth-utils.ts`, `wallet-auth.ts`), your IDE may show import errors. Restart the TypeScript server or VS Code to resolve.

## Security Considerations

### ⚠️ Important Notes

1. **Message Replay Protection:** Messages are time-bound (5 minute window). Consider implementing a nonce database for stricter replay protection in production.

2. **HTTPS Required:** This authentication scheme requires HTTPS in production to prevent man-in-the-middle attacks.

3. **Gas Costs:** Signing messages is free (off-chain), but operations still require gas for blockchain interactions.

4. **Browser Extension Required:** Users must have MetaMask or compatible wallet to sign messages.

## Future Enhancements

- [ ] Implement session-based authentication to reduce signing frequency
- [ ] Add nonce database for stronger replay attack prevention
- [ ] Implement rate limiting per address
- [ ] Add audit logging for all authenticated actions
- [ ] Consider SIWE (Sign-In with Ethereum) standard for better UX

## References

- [EIP-191: Signed Data Standard](https://eips.ethereum.org/EIPS/eip-191)
- [EIP-4361: Sign-In with Ethereum](https://eips.ethereum.org/EIPS/eip-4361)
- [ethers.js Documentation](https://docs.ethers.org/)
