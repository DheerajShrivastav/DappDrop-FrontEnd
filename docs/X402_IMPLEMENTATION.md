# x402 Payment Protocol Integration

## Overview

This implementation adds payment-required task support to DappDrop campaigns using a minimal approach similar to the Humanity Protocol verification pattern. Hosts can require users to pay a fee to complete specific campaign tasks.

## Architecture

**Pattern:** Follows the same architecture as Humanity Protocol verification

- Uses blockchain as source of truth
- Minimal database caching (only verification results)
- Task type: `ONCHAIN_TX` (will be updated to `PAYMENT_REQUIRED` in smart contract later)
- Payment requirements stored in `CampaignTaskMetadata.metadata` JSON field

## Database Changes

### Single New Model

```prisma
model PaymentVerification {
  id              String   @id @default(cuid())
  campaignId      String
  taskIndex       Int
  userAddress     String
  transactionHash String   @unique
  verified        Boolean  @default(false)
  verifiedAt      DateTime?
  createdAt       DateTime @default(now())

  @@unique([campaignId, taskIndex, userAddress])
  @@index([transactionHash])
  @@index([userAddress])
}
```

**Purpose:** Cache payment verification results to avoid redundant blockchain queries

## API Endpoints

### 1. Verify Payment Transaction

**POST** `/api/tasks/verify-payment`

Verifies a blockchain transaction matches payment requirements.

**Request Body:**

```json
{
  "campaignId": 1,
  "taskIndex": 0,
  "transactionHash": "0x...",
  "userAddress": "0x..."
}
```

**Response (Success):**

```json
{
  "verified": true,
  "message": "Payment verified successfully",
  "transactionHash": "0x..."
}
```

**Response (Error):**

```json
{
  "verified": false,
  "error": "Wrong amount: expected 1000000000000000 wei, got 500000000000000 wei"
}
```

### 2. Check Payment Status

**GET** `/api/tasks/check-payment?campaignId=1&taskIndex=0&userAddress=0x...`

Checks if a user has completed a payment task.

**Response:**

```json
{
  "verified": true,
  "transactionHash": "0x...",
  "verifiedAt": "2025-11-27T12:00:00Z",
  "paymentRequired": true,
  "paymentInfo": {
    "recipient": "0x...",
    "amount": "0.001 ETH",
    "token": "ETH",
    "network": "sepolia",
    "chainId": 11155111
  }
}
```

## Payment Task Metadata Structure

Store payment requirements in the `metadata` JSON field of `CampaignTaskMetadata`:

```typescript
{
  paymentRequired: true,
  paymentRecipient: "0x1234...",  // Host's wallet address
  chainId: 11155111,               // Sepolia testnet
  network: "sepolia",
  tokenAddress: "0x0",             // 0x0 for native ETH
  tokenSymbol: "ETH",
  amount: "1000000000000000",      // Amount in Wei
  amountDisplay: "0.001 ETH"       // Human-readable display
}
```

**Supported Networks:**

- `sepolia` - Ethereum Sepolia Testnet (chainId: 11155111)
- `ethereum` - Ethereum Mainnet (chainId: 1)
- `base` - Base Mainnet (chainId: 8453)
- `polygon` - Polygon Mainnet (chainId: 137)

**Supported Tokens:**

- Native tokens: ETH, MATIC, etc. (use `tokenAddress: "0x0"`)
- ERC-20 tokens: USDC, DAI, etc. (use actual token contract address)

## Usage Flow

### Creating a Campaign with Payment Task

```typescript
// In create-campaign flow
const paymentTask = {
  type: 'ONCHAIN_TX',
  description: 'Pay 0.001 ETH to join this campaign',
  verificationData: '', // Empty for payment tasks
}

// After creating campaign on-chain, store metadata
await fetch('/api/campaign-task-metadata', {
  method: 'POST',
  body: JSON.stringify({
    campaignId: '1',
    taskIndex: 0,
    taskType: 'ONCHAIN_TX',
    metadata: {
      paymentRequired: true,
      paymentRecipient: hostWalletAddress,
      chainId: 11155111,
      network: 'sepolia',
      tokenAddress: '0x0',
      tokenSymbol: 'ETH',
      amount: ethers.parseEther('0.001').toString(),
      amountDisplay: '0.001 ETH',
    },
  }),
})
```

### User Completing Payment Task

```typescript
import { completePaymentTask } from '@/lib/payment-task-client'

// Complete the full payment flow
const txHash = await completePaymentTask(
  provider, // BrowserProvider from ethers
  campaignId, // Campaign ID
  taskIndex // Task index
)

// After payment is verified, complete the task on-chain
await completeTask(campaignId, taskIndex)
```

### Manual Payment Flow (Step by Step)

```typescript
import {
  checkPaymentTaskStatus,
  sendPaymentTransaction,
  verifyPaymentTransaction,
} from '@/lib/payment-task-client'

// 1. Check requirements
const status = await checkPaymentTaskStatus(campaignId, taskIndex, userAddress)

if (status.paymentRequired && !status.verified) {
  // 2. Send payment
  const txHash = await sendPaymentTransaction(provider, status.paymentInfo)

  // 3. Verify with server
  await verifyPaymentTransaction(campaignId, taskIndex, txHash, userAddress)

  // 4. Complete task on-chain
  await completeTask(campaignId, taskIndex)
}
```

## Verification Logic

### Native Token (ETH, MATIC)

The system verifies:

1. ✅ Transaction succeeded (status === 1)
2. ✅ Recipient address matches (`tx.to === paymentRecipient`)
3. ✅ Amount matches exactly (`tx.value === amount`)

### ERC-20 Token (USDC, DAI)

The system verifies:

1. ✅ Transaction succeeded
2. ✅ Transfer event exists in logs
3. ✅ Transfer recipient matches
4. ✅ Transfer amount matches exactly

## Security Features

### Replay Attack Prevention

- Each transaction hash can only be used once
- Database enforces unique constraint on `transactionHash`
- Attempts to reuse a transaction return 403 error

### Amount Verification

- Exact amount matching in Wei (no tolerance)
- Prevents overpayment or underpayment acceptance

### Address Verification

- Server verifies recipient matches task metadata
- Sender cannot manipulate recipient address

## Client Helper Functions

### `checkPaymentTaskStatus(campaignId, taskIndex, userAddress)`

Checks if payment is required and if user has already paid.

### `sendPaymentTransaction(provider, paymentInfo)`

Sends either native token or ERC-20 token payment transaction.

### `verifyPaymentTransaction(campaignId, taskIndex, txHash, userAddress)`

Submits transaction hash to server for blockchain verification.

### `completePaymentTask(provider, campaignId, taskIndex)`

Complete automated flow: check → pay → verify.

## Example: ERC-20 USDC Payment

```typescript
// Task metadata for USDC payment on Base
const usdcPaymentTask = {
  paymentRequired: true,
  paymentRecipient: '0xHostWallet...',
  chainId: 8453,
  network: 'base',
  tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
  tokenSymbol: 'USDC',
  amount: '5000000', // 5 USDC (6 decimals)
  amountDisplay: '5.00 USDC',
}
```

## Future Smart Contract Update

Currently uses `ONCHAIN_TX` task type. When smart contract is updated:

1. Add new task type: `PAYMENT_REQUIRED = 6`
2. Update `taskTypeMap` in web3-service.ts:

```typescript
const taskTypeMap: Record<TaskType, number> = {
  SOCIAL_FOLLOW: 0,
  JOIN_DISCORD: 1,
  JOIN_TELEGRAM: 2,
  RETWEET: 3,
  HUMANITY_VERIFICATION: 4,
  ONCHAIN_TX: 5,
  PAYMENT_REQUIRED: 6, // New type
}
```

3. Update types.ts to include `PAYMENT_REQUIRED` in `TaskType` union

## Testing

### Test Payment Verification (Sepolia)

1. Create test campaign with payment task
2. Send 0.001 ETH to recipient address
3. Get transaction hash
4. Call verify endpoint:

```bash
curl -X POST http://localhost:3000/api/tasks/verify-payment \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "1",
    "taskIndex": 0,
    "transactionHash": "0x...",
    "userAddress": "0x..."
  }'
```

### Test Status Check

```bash
curl "http://localhost:3000/api/tasks/check-payment?campaignId=1&taskIndex=0&userAddress=0x..."
```

## Migration

Run the database migration:

```bash
npx prisma migrate dev --name add_payment_verification
npx prisma generate
```

## Error Handling

Common errors and solutions:

**"Wrong amount"**

- User sent incorrect payment amount
- Solution: Send exact amount specified in task

**"Wrong recipient"**

- Payment went to wrong address
- Solution: Double-check recipient address

**"Transaction hash already used"**

- Replay attack detected
- Solution: Send a new transaction

**"Transaction not found or still pending"**

- Transaction not yet confirmed
- Solution: Wait for confirmation and retry

**"Insufficient balance"**

- Not enough tokens to complete payment
- Solution: Add funds to wallet

## Files Created

1. `prisma/schema.prisma` - Added `PaymentVerification` model
2. `src/lib/payment-verification.ts` - Core verification logic
3. `src/app/api/tasks/verify-payment/route.ts` - Verification endpoint
4. `src/app/api/tasks/check-payment/route.ts` - Status check endpoint
5. `src/lib/payment-task-client.ts` - Client-side helper functions
6. `docs/X402_IMPLEMENTATION.md` - This documentation

## Integration Points

- ✅ Works with existing task completion flow
- ✅ Compatible with blockchain verification pattern
- ✅ Uses same metadata storage as Discord/Telegram tasks
- ✅ Follows Humanity Protocol verification architecture
- ✅ Minimal database footprint

## Notes

- Payment amounts are stored in Wei (smallest unit) for precision
- All blockchain verification is done server-side for security
- Client-side payment sending uses ethers.js v6
- Supports both MetaMask and WalletConnect providers
- Transaction confirmations are automatic (built into `tx.wait()`)
