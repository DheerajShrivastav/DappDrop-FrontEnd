# Payment Task Frontend Integration - Complete

## Overview

The payment task UI has been successfully integrated into both the campaign creation form and the campaign detail page. Users can now create payment tasks and participants can complete them by submitting transaction hashes.

## Changes Made

### 1. Campaign Creation Form (`src/app/create-campaign/page.tsx`)

#### Schema Updates

- Added payment metadata fields to `taskSchema`:
  - `paymentRequired`: boolean checkbox
  - `paymentRecipient`: wallet address
  - `chainId`: network chain ID
  - `network`: network name (sepolia, ethereum, base, polygon)
  - `tokenAddress`: ERC-20 token address (optional)
  - `tokenSymbol`: token symbol (ETH, USDC, etc.)
  - `amount`: payment amount in wei
  - `amountDisplay`: human-readable amount display

#### UI Components Added

- **Payment Required Checkbox**: Toggle to enable payment fields for ONCHAIN_TX tasks
- **Payment Details Section**: Conditional section that appears when checkbox is checked
  - Recipient wallet address input
  - Network selector (Sepolia, Ethereum, Base, Polygon)
  - Token address input (optional, leave empty for native token)
  - Token symbol input
  - Amount inputs (both wei and display format)
  - Information alert explaining payment verification process

#### Features

- Auto-sets chainId when network is selected
- Clear visual distinction with purple-themed UI
- Helpful descriptions for each field
- Validation through Zod schema

### 2. Campaign Detail Page (`src/app/campaign/[id]/page.tsx`)

#### State Management

Added new state variables:

```typescript
const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
const [paymentTaskId, setPaymentTaskId] = useState<string | null>(null)
const [transactionHash, setTransactionHash] = useState('')
const [isVerifyingPayment, setIsVerifyingPayment] = useState(false)
```

#### Task Rendering Logic

- Payment tasks now show "Submit Payment" button instead of humanity verification
- Detection based on `task.metadata?.paymentRequired` flag
- Falls back to humanity verification for ONCHAIN_TX without payment metadata

#### Payment Dialog Component

New dialog with:

- **Payment Requirements Display**:
  - Amount (display format)
  - Token symbol
  - Network name
  - Recipient address
- **Transaction Hash Input**: For users to paste their tx hash
- **Verify Button**: Submits to `/api/tasks/verify-payment` endpoint
- **Auto-completion**: Automatically completes the task after successful verification

#### Visual Enhancements

- Payment tasks show a purple badge with amount and network below description
- Clear payment requirements in alert box
- Loading states during verification
- Success/error toast notifications

### 3. Type Definitions (`src/lib/types.ts`)

Updated `Task` type to include metadata:

```typescript
metadata?: {
  paymentRequired?: boolean
  paymentRecipient?: string
  chainId?: number
  network?: string
  tokenAddress?: string | null
  tokenSymbol?: string
  amount?: string
  amountDisplay?: string
}
```

### 4. Web3 Service Updates (`src/lib/web3-service.ts`)

#### Both `createCampaign` and `createAndActivateCampaign` functions updated:

- Added payment metadata storage logic
- Checks for `task.type === 'ONCHAIN_TX' && task.paymentRequired`
- Posts payment metadata to `/api/campaign-task-metadata` endpoint
- Stores all payment parameters in metadata JSON field

## User Flow

### For Campaign Hosts:

1. Create campaign and add tasks
2. Select "On-chain Action" task type
3. Check "Payment Required" checkbox
4. Fill in payment details:
   - Recipient wallet address
   - Network (Sepolia, Ethereum, Base, Polygon)
   - Token address (optional, leave empty for native token)
   - Token symbol
   - Amount in wei and display format
5. Submit campaign

### For Campaign Participants:

1. View campaign with payment task
2. See payment requirements displayed (amount, token, network, recipient)
3. Send payment externally using their wallet
4. Click "Submit Payment" button
5. Enter transaction hash
6. Click "Verify Payment"
7. Backend verifies transaction on blockchain
8. Task automatically marked as complete

## API Integration

### Payment Verification Endpoint

**POST** `/api/tasks/verify-payment`

Request body:

```json
{
  "campaignId": "1",
  "taskIndex": 0,
  "userAddress": "0x...",
  "transactionHash": "0x..."
}
```

Response:

```json
{
  "success": true,
  "verified": true,
  "transactionHash": "0x...",
  "verifiedAt": "2024-01-01T00:00:00.000Z"
}
```

### Payment Status Check Endpoint

**GET** `/api/tasks/check-payment?campaignId=1&taskIndex=0&userAddress=0x...`

Returns payment verification status and requirements.

## Testing Checklist

- [ ] Create campaign with payment task
- [ ] Verify payment fields are visible when "Payment Required" is checked
- [ ] Verify payment fields are hidden when checkbox is unchecked
- [ ] Submit campaign and check database for metadata storage
- [ ] View campaign as participant
- [ ] Verify payment requirements are displayed correctly
- [ ] Submit test transaction hash
- [ ] Verify payment verification works
- [ ] Check task completion after successful payment verification
- [ ] Test error handling for invalid transaction hashes
- [ ] Test with different networks (Sepolia, Ethereum, Base, Polygon)
- [ ] Test with native tokens (ETH, MATIC)
- [ ] Test with ERC-20 tokens (USDC, DAI)

## Network Support

### Supported Networks:

- **Sepolia Testnet** (chainId: 11155111)
- **Ethereum Mainnet** (chainId: 1)
- **Base** (chainId: 8453)
- **Polygon** (chainId: 137)

### Token Support:

- Native tokens (ETH, MATIC)
- ERC-20 tokens (USDC, DAI, custom tokens)

## UI Components Used

- `Checkbox`: For payment required toggle
- `Input`: For text inputs (address, amount, etc.)
- `Select`: For network selection
- `Dialog`: For payment submission modal
- `Alert`: For displaying requirements and information
- `Badge`: For payment indicator on task cards
- `Button`: For actions and submissions
- `Label`: For form labels

## Security Features

- Transaction hash uniqueness enforced (prevents replay attacks)
- Blockchain verification before marking task complete
- Recipient address validation
- Amount verification (exact match required)
- Network/chainId verification

## Future Enhancements

- Real-time transaction monitoring
- Automatic wallet connection for payment
- Direct payment from UI (integrate with wallet providers)
- Payment history tracking
- Refund mechanism
- Multi-recipient support
- Batch payment verification
