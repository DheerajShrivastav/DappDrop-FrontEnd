# Discord OAuth2 Error Fix

You're seeing the "Invalid OAuth2 redirect_uri" error because the redirect URI in your Discord Developer Portal doesn't match the one in your code.

## Fix Steps

1. **Go to the Discord Developer Portal**:

   - Visit [https://discord.com/developers/applications](https://discord.com/developers/applications)
   - Sign in with your Discord account
   - Select your application (DappDrop or whatever you named it)

2. **Update the OAuth2 Redirect URI**:

   - Click on the "OAuth2" tab in the left sidebar
   - In the "Redirects" section, make sure you have this exact URI:
     ```
     http://localhost:3000/api/auth/discord/callback
     ```
   - If you already have a redirect URI listed, click "Edit" and update it to match
   - If you need to add a new one, click "Add Redirect" and enter the above URI
   - Click "Save Changes"

3. **Verify the Application Settings**:

   - Double check your Client ID and Client Secret match what's in your `.env` file
   - Make sure your application has the "identify" OAuth2 scope

4. **Important Notes**:

   - Redirect URIs are case-sensitive and must match exactly
   - Make sure there are no trailing spaces or extra characters
   - The scheme (http/https), domain, port, and path all must match exactly
   - For production, you'll need to add another redirect URI with your production domain

5. **After making changes**:
   - It may take a few minutes for Discord to update its settings
   - Try the authentication again after completing these steps

If you're still having issues, double-check the console logs for any additional error details which can help diagnose the problem.
