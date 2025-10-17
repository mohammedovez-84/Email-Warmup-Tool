





const axios = require('axios');
require('dotenv').config();
const MicrosoftUser = require('../models/MicrosoftUser'); // Your Sequelize model
const { Op } = require('sequelize');


// Save or update Microsoft user in the DB using Sequelize
async function saveMicrosoftUser(profile, refreshToken, accessToken, expiresIn, userId) {
    console.log("profile: ", profile);

    const email = profile.emails?.[0]?.value || null;
    const name = profile.displayName || null;
    const microsoftId = profile.id;
    const expiresAt = Date.now() + expiresIn * 1000; // milliseconds

    const existingUser = await MicrosoftUser.findOne({
        where: {
            [Op.or]: [
                { microsoft_id: microsoftId },
                { email: email }
            ]
        }
    });

    if (existingUser) {
        await existingUser.update({
            name,
            refresh_token: refreshToken,
            access_token: accessToken,
            expires_at: expiresAt
        });
    } else {
        await MicrosoftUser.create({
            name,
            email,
            microsoft_id: microsoftId,
            refresh_token: refreshToken,
            access_token: accessToken,
            expires_at: expiresAt,
            user_id: userId, // static for now, set dynamically if needed
            warmupStatus: 'active'
        });
    }
}

// Automatically refresh access token using refresh token
async function getNewAccessTokenAndUpdate(microsoftId) {
    const user = await MicrosoftUser.findOne({
        where: { microsoft_id: microsoftId }
    });

    if (!user) throw new Error("Microsoft user not found");

    const refreshToken = user.refresh_token;

    const qs = new URLSearchParams();
    qs.append('client_id', process.env.MS_CLIENT_ID);
    qs.append('client_secret', process.env.MS_CLIENT_SECRET);
    qs.append('grant_type', 'refresh_token');
    qs.append('refresh_token', refreshToken);
    qs.append('redirect_uri', process.env.MS_REDIRECT_URL);

    try {
        const response = await axios.post(
            `https://login.microsoftonline.com/${process.env.MS_TENANT_ID}/oauth2/v2.0/token`,
            qs.toString(),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const { access_token, refresh_token: newRefreshToken } = response.data;

        // Update refresh token if it has changed
        if (newRefreshToken && newRefreshToken !== refreshToken) {
            await user.update({ refresh_token: newRefreshToken });
            console.log(`[INFO] Refresh token updated for Microsoft ID: ${microsoftId}`);
        }

        return access_token;

    } catch (error) {
        console.error('[ERROR] Failed to refresh Microsoft access token:', error.response?.data || error.message);
        throw new Error('Unable to refresh Microsoft access token');
    }
}

module.exports = {
    saveMicrosoftUser,
    getNewAccessTokenAndUpdate
};