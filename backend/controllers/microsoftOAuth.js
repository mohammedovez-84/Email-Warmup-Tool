require('dotenv').config();
const { AuthorizationCode } = require('simple-oauth2');

const TENANT_ID = process.env.TENANT_ID;
const CLIENT_ID = process.env.MS_CLIENT_ID;
const CLIENT_SECRET = process.env.MS_CLIENT_SECRET;

// Validate required environment variables
if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing required Microsoft OAuth environment variables');
  throw new Error('Microsoft OAuth configuration is incomplete');
}

const config = {
  client: {
    id: CLIENT_ID,
    secret: CLIENT_SECRET,
  },
  auth: {
    tokenHost: `https://login.microsoftonline.com/common`,
    authorizePath: `/oauth2/v2.0/authorize`,  // Fixed - remove tenant ID from path
    tokenPath: `/oauth2/v2.0/token`,         // Fixed - remove tenant ID from path
  }
};

const client = new AuthorizationCode(config);

const scopes = [
  'openid',
  'profile',
  'offline_access',
  'User.Read',
  'https://outlook.office.com/IMAP.AccessAsUser.All',
  'https://outlook.office.com/SMTP.Send'
];

function getAuthUrl(redirectUri) {
  try {
    const url = client.authorizeURL({
      redirect_uri: redirectUri,
      scope: scopes.join(' '),
      response_type: "code"
    });
    console.log('Generated auth URL:', url);
    return url;
  } catch (error) {
    console.error('Error generating auth URL:', error);
    throw error;
  }
}

async function getTokenFromCode(redirectUri, code) {
  try {
    console.log('Exchanging code for token, redirectUri:', redirectUri);
    const tokenParams = {
      code,
      redirect_uri: redirectUri,
      scope: scopes.join(' '),
    };

    const accessToken = await client.getToken(tokenParams);
    console.log('Token exchange successful');
    return accessToken.token;
  } catch (error) {
    console.error('Error exchanging code for token:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    throw error;
  }
}

module.exports = { getAuthUrl, getTokenFromCode };