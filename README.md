# DApp Drop Zone - A Web3 Campaign Platform

This is a Next.js application for creating and participating in airdrop campaigns, built with Firebase Studio. It allows users to create campaigns with specific tasks and rewards, and for participants to complete those tasks to earn rewards on the Sepolia testnet.

## Features

- **Campaign Creation**: Hosts can create airdrop campaigns with custom tasks and rewards
- **Task Verification**: Support for Discord, Telegram, Twitter, and on-chain task verification
- **Humanity Protocol Integration**: Prevent Sybil attacks with biometric palm verification
- **AI-Powered Campaign Generation**: Use AI to draft campaign details
- **Real-time Analytics**: Track participant engagement and task completion
- **Multi-Chain Support**: Built for Sepolia testnet with mainnet compatibility

## Running Locally

To run this project on your local machine, follow these steps:

### 1. Set up Environment Variables

Create a file named `.env.local` in the root of your project. Copy the contents of `.env.example` into it and replace the placeholder values with your actual data.

```bash
cp .env.example .env.local
```

You will need to fill in the following values in your new `.env.local` file:

- `NEXT_PUBLIC_CAMPAIGN_FACTORY_CONTRACT`: The address of your deployed `Web3Campaigns` smart contract on the Sepolia testnet.
- `NEXT_PUBLIC_SEPOLIA_RPC_URL`: Your Sepolia RPC URL. You can get one from a service like Alchemy or Infura, or use a public one like `https://rpc.sepolia.org`.
- `GEMINI_API_KEY`: Your API key for Google AI Studio. You can get one from [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).
- `HUMANITY_API_KEY`: (Optional) Your Humanity Protocol API key for enabling Sybil-resistant verification. Get one from [https://developer.humanity.org](https://developer.humanity.org).
- `DATABASE_URL`: PostgreSQL database connection string

**Important**: You must deploy the smart contract (found in the `contracts` directory of your project) to the Sepolia testnet and place its deployed address in this file for the application to function correctly.

### 2. Install Dependencies

Open your terminal, navigate to the project's root directory, and run the following command to install all the necessary packages defined in `package.json`:

```bash
npm install
```

### 3. Set up Database

Run Prisma migrations to set up your database:

```bash
npx prisma migrate dev
```

Or generate the Prisma client if using an existing database:

```bash
npx prisma generate
```

### 4. Run the Development Server

Once the dependencies are installed, you can start the Next.js development server:

```bash
npm run dev
```

This will start the application, typically on `http://localhost:3000`. You can now open this URL in your web browser to view and interact with the DApp. You will need a browser wallet like MetaMask installed and connected to the Sepolia testnet.

## Humanity Protocol Integration

DappDrop integrates with Humanity Protocol to enable Sybil-resistant task verification. Campaign hosts can require biometric palm verification for specific tasks, ensuring only unique human participants can complete them.

**Key Features:**
- Task-level verification control
- 24-hour verification caching
- Rate limiting protection
- Clear user guidance
- Status display in dashboard

For detailed documentation, see [docs/HUMANITY_PROTOCOL.md](docs/HUMANITY_PROTOCOL.md).

## Documentation

- [Humanity Protocol Integration](docs/HUMANITY_PROTOCOL.md) - Complete guide for Sybil-resistant verification

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
