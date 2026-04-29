# Discord Authentication Setup

This document explains how to set up Discord authentication for the DappDrop platform.

## Prerequisites

1. A Discord account
2. Access to the [Discord Developer Portal](https://discord.com/developers/applications)

## Setting Up a Discord Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click on "New Application"
3. Enter a name for your application (e.g., "DappDrop")
4. Go to the "OAuth2" tab in the left sidebar
5. Add a redirect URL: `http://localhost:3000/api/auth/discord/callback` for local development
   - For production, add your production URL: `https://your-production-domain.com/api/auth/discord/callback`
6. Save changes

## Environment Variables

Add the following environment variables to your `.env.local` file:

```
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
DISCORD_BOT_TOKEN=your_discord_bot_token
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

- `DISCORD_CLIENT_ID`: Found in the "General Information" tab of your Discord application
- `DISCORD_CLIENT_SECRET`: Found in the "General Information" tab of your Discord application
- `DISCORD_BOT_TOKEN`: Create a bot in the "Bot" tab and copy the token
- `NEXT_PUBLIC_BASE_URL`: The base URL of your application

## Creating a Discord Bot (Optional for Advanced Server Verification)

If you want to automatically verify server membership:

1. Go to the "Bot" tab in your Discord application
2. Click "Add Bot"
3. Under "Privileged Gateway Intents", enable "Server Members Intent"
4. Save changes
5. Invite the bot to your Discord server using the OAuth2 URL generator:
   - Go to the "OAuth2" tab
   - Select "bot" scope
   - Select permissions: "Read Messages/View Channels" and "View Server Members"
   - Copy the generated URL and open it in your browser
   - Select your server and authorize the bot

## Usage

The Discord authentication flow works as follows:

1. User clicks the "Connect with Discord" button
2. A popup opens with the Discord authorization page
3. After authorizing, the popup closes and the user's Discord information is returned to the application
4. The Discord user information is sent to the verification API

## Testing

To test the Discord authentication:

1. Copy `.env.discord-example` to `.env.local` and fill in your Discord credentials
2. Start the development server: `npm run dev`
3. Navigate to a campaign page with a Discord task
4. Click "Verify" on a Discord task
5. Click "Connect with Discord" in the verification dialog
6. Authorize the application in the Discord popup
7. Your Discord account should now be connected and ready for verification
