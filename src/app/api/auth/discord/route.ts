import { NextRequest, NextResponse } from 'next/server'

// Discord OAuth2 configuration
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET
// Use a hard-coded redirect URI to ensure consistency
const DISCORD_REDIRECT_URI = 'http://localhost:3000/api/auth/discord/callback'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const redirectUrl = searchParams.get('redirect') || '/'

  // Make sure we have the client ID
  if (!DISCORD_CLIENT_ID) {
    return NextResponse.json(
      { error: 'Discord client ID is not configured' },
      { status: 500 }
    )
  }

  // Ensure the redirect URI is absolute and properly formatted
  const fullRedirectUri = encodeURIComponent(DISCORD_REDIRECT_URI)

  // Store the redirect URL in a cookie so the callback can use it
  const response = NextResponse.redirect(
    `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${fullRedirectUri}&response_type=code&scope=identify`
  )

  response.cookies.set('discord_oauth_redirect', redirectUrl, {
    httpOnly: true,
    maxAge: 60 * 10, // 10 minutes
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })

  return response
}
