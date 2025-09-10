import { NextRequest, NextResponse } from 'next/server';

// Discord OAuth2 configuration
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/discord/callback`;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  
  // Get the redirect URL from the cookie
  const redirectUrl = request.cookies.get('discord_oauth_redirect')?.value || '/';
  
  // If there's an error in the OAuth process
  if (error) {
    return generateCallbackPage({ 
      success: false,
      error: `Discord authorization failed: ${error}`,
      redirectUrl
    });
  }
  
  // If there's no code, something went wrong
  if (!code) {
    return generateCallbackPage({ 
      success: false, 
      error: 'No authorization code provided',
      redirectUrl
    });
  }
  
  try {
    // Exchange the code for an access token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID!,
        client_secret: DISCORD_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code,
        redirect_uri: DISCORD_REDIRECT_URI,
      }),
    });
    
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${errorData}`);
    }
    
    const tokenData = await tokenResponse.json();
    const { access_token } = tokenData;
    
    // Use the access token to get the user's details
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });
    
    if (!userResponse.ok) {
      const errorData = await userResponse.text();
      throw new Error(`Failed to fetch user data: ${errorData}`);
    }
    
    const userData = await userResponse.json();
    
    // Return a success page that will pass the data back to the opener
    return generateCallbackPage({ 
      success: true, 
      user: userData, 
      redirectUrl 
    });
    
  } catch (error: any) {
    console.error('Discord auth error:', error);
    return generateCallbackPage({ 
      success: false, 
      error: error.message || 'Failed to authenticate with Discord',
      redirectUrl
    });
  }
}

// Helper function to generate the HTML page for the callback
function generateCallbackPage({ 
  success, 
  user = null, 
  error = null, 
  redirectUrl 
}: { 
  success: boolean; 
  user?: any; 
  error?: string | null;
  redirectUrl: string;
}) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Discord Authentication</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            background-color: #36393f;
            color: #ffffff;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            text-align: center;
          }
          .container {
            background-color: #2f3136;
            border-radius: 8px;
            padding: 2rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            max-width: 500px;
          }
          h1 {
            margin-top: 0;
            color: #7289da;
          }
          p {
            margin-bottom: 1.5rem;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>${success ? 'Authentication Successful' : 'Authentication Failed'}</h1>
          <p>${success 
            ? 'You have successfully connected your Discord account. You can close this window now.' 
            : `Error: ${error}`}</p>
          <script>
            // Pass the data back to the opener window
            if (window.opener) {
              window.opener.postMessage(
                { 
                  type: ${success ? '"discord-auth-success"' : '"discord-auth-error"'}, 
                  ${success ? `user: ${JSON.stringify(user)}` : `error: "${error}"`}
                }, 
                "${new URL(redirectUrl).origin}"
              );
              setTimeout(() => {
                window.close();
              }, 3000);
            }
          </script>
        </div>
      </body>
    </html>
  `;
  
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
    },
  });
}
