const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/userModel');

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL,
        },
        async (accessToken, refreshToken, profile, done) => {   // ✅ FIXED HERE
            try {
                let user = await User.findOne({ where: { email: profile.emails[0].value } });

                if (!user) {
                    user = await User.create({
                        name: profile.name.givenName,
                        lastname: profile.name.familyName || '',
                        email: profile.emails[0].value,
                        password: null,
                        email_verified: true,
                        role: 'user',
                        isGoogleAccount: true
                    });
                }

                return done(null, user);
            } catch (err) {
                console.error('Error in Google Auth:', err);
                return done(err, null);
            }
        }
    )
);



passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findByPk(id);
        done(null, user);
    } catch (err) {
        done(err);
    }
});

module.exports = passport;
