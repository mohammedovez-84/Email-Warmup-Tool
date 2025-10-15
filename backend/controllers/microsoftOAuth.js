require('dotenv').config();
const { AuthorizationCode } = require('simple-oauth2');

const config = {
  client: {
    id: process.env.MS_CLIENT_ID,
    secret: process.env.MS_CLIENT_SECRET,
  },
  auth: {
    tokenHost: 'https://login.microsoftonline.com',
    authorizePath: 'common/oauth2/v2.0/authorize',
    tokenPath: 'common/oauth2/v2.0/token',
  }
};

const client = new AuthorizationCode(config);

const scopes = [
  'openid',
  'profile',
  'offline_access',
  'https://outlook.office.com/IMAP.AccessAsUser.All',
  'https://outlook.office.com/SMTP.Send'
];

function getAuthUrl(redirectUri) {
  return client.authorizeURL({
    redirect_uri: redirectUri,
    scope: scopes.join(' '),
  });
}

async function getTokenFromCode(redirectUri, code) {
  const tokenParams = {
    code,
    redirect_uri: redirectUri,
    scope: scopes.join(' '),
  };

  const accessToken = await client.getToken(tokenParams);
  return accessToken.token;
}

async function refreshAccessToken(refreshToken) {
  const tokenObject = client.createToken({ refresh_token: refreshToken });
  const refreshedToken = await tokenObject.refresh();
  return refreshedToken.token;
}

module.exports = { getAuthUrl, getTokenFromCode, refreshAccessToken };
