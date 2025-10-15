//microsoftStrategy.js
const passport = require('passport');
const MicrosoftStrategy = require('passport-microsoft').Strategy;
require('dotenv').config();

passport.use(new MicrosoftStrategy({
    clientID: process.env.MS_CLIENT_ID,
    clientSecret: process.env.MS_CLIENT_SECRET,
    callbackURL: process.env.MS_REDIRECT_URL,
    scope: ['user.read', 'offline_access', 'openid', 'profile', 'email'],
    tenant: process.env.TENANT_ID || 'common',
    authorizationURL: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenURL: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    passReqToCallback: true
},
    function (req, accessToken, refreshToken, params, profile, done) {

        profile._accessToken = accessToken;
        profile._refreshToken = refreshToken;
        profile._expiresIn = params.expires_in;

        return done(null, profile);
    }
));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));