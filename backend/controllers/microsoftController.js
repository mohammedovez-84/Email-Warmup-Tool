// microsoftController.js
// const pool = require('../db');
//     const axios = require('axios');
//     require('dotenv').config();

//     // Save or update token in DB

// async function saveMicrosoftUser(profile, refreshToken, accessToken, expiresIn) {
//   const email = profile.emails?.[0]?.value || null;
//   const name = profile.displayName || null;
//     const microsoftId = profile.id;
//     // const expiresAt = expiresIn;
//   const expiresAt = Date.now() + (expiresIn * 1000); // Convert to milliseconds

//   const [existing] = await pool.query(
//     'SELECT * FROM microsoft_users WHERE microsoft_id = ? OR email = ?',
//     [microsoftId, email]
//   );

//   if (existing.length > 0) {
//     // Update existing user
//     await pool.query(
//       `UPDATE microsoft_users 
//        SET name=?, refresh_token=?, access_token=?, expires_at=? 
//        WHERE microsoft_id=?`,
//       [name, refreshToken, accessToken, expiresAt, microsoftId]
//     );
//   } else {
//     // Insert new user
//     await pool.query(
//       `INSERT INTO microsoft_users (name, email, microsoft_id, refresh_token, access_token, expires_at)
//        VALUES (?, ?, ?, ?, ?, ?)`,
//       [name, email, microsoftId, refreshToken, accessToken, expiresAt]
//     );
//   }
// }

// // Automatically refresh access token using refresh token
//     async function getNewAccessTokenAndUpdate(microsoftId) {
//     const [rows] = await pool.execute('SELECT refresh_token FROM microsoft_users WHERE microsoft_id = ?', [microsoftId]);

//     if (!rows.length) throw new Error("Microsoft user not found");

//     const refreshToken = rows[0].refresh_token;

//     const qs = new URLSearchParams();
//     qs.append('client_id', process.env.MS_CLIENT_ID);
//     qs.append('client_secret', process.env.MS_CLIENT_SECRET);
//     qs.append('grant_type', 'refresh_token');
//     qs.append('refresh_token', refreshToken);
//     qs.append('redirect_uri', process.env.MS_REDIRECT_URL);
//     // qs.append('scope', 'offline_access https://graph.microsoft.com/.default');


//     try {
//         const response = await axios.post(`https://login.microsoftonline.com/${process.env.MS_TENANT_ID }/oauth2/v2.0/token`, qs.toString(), {
//             headers: {
//                 'Content-Type': 'application/x-www-form-urlencoded'
//             }
//         });

//         const { access_token, refresh_token: newRefreshToken } = response.data;

//         if (newRefreshToken && newRefreshToken !== refreshToken) {
//             await pool.execute('UPDATE microsoft_users SET refresh_token = ? WHERE microsoft_id = ?', [newRefreshToken, microsoftId]);
//             console.log(`[INFO] Refresh token updated for Microsoft ID: ${microsoftId}`);
//         }

//         return access_token;

//     } catch (error) {
//         console.error('[ERROR] Failed to refresh Microsoft access token:', error.response?.data || error.message);
//         throw new Error('Unable to refresh Microsoft access token');
//     }
// }

// //Refresh tokens for all Microsoft users in DB
// // async function refreshMicrosoftTokens() {
// //     try {
// //         const [users] = await pool.execute('SELECT id, microsoft_id, refresh_token FROM microsoft_users');

// //         for (const user of users) {
// //             try {
// //                 const qs = new URLSearchParams();
// //                 qs.append('client_id', process.env.MS_CLIENT_ID);
// //                 qs.append('client_secret', process.env.MS_CLIENT_SECRET);
// //                 qs.append('grant_type', 'refresh_token');
// //                 qs.append('refresh_token', user.refresh_token);
// //                 qs.append('redirect_uri', process.env.MS_REDIRECT_URL);
// //                 // qs.append('scope', 'offline_access https://graph.microsoft.com/.default');

// //                 const response = await axios.post(
// //                     `https://login.microsoftonline.com/${process.env.MS_TENANT_ID}/oauth2/v2.0/token`,
// //                     qs.toString(),
// //                     { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
// //                 );

// //                 const { access_token, refresh_token: newRefreshToken } = response.data;

// //                 // Update token only if changed
// //                 if (newRefreshToken && newRefreshToken !== user.refresh_token) {
// //                     await pool.execute(
// //                         'UPDATE microsoft_users SET refresh_token = ? WHERE id = ?',
// //                         [newRefreshToken, user.id]
// //                     );
// //                     console.log(`[REFRESHED] Token updated for Microsoft ID: ${user.microsoft_id}`);
// //                 }
// //             } catch (error) {
// //                 console.error(`[ERROR] Refresh failed for Microsoft ID ${user.microsoft_id}:`, error.response?.data || error.message);
// //             }
// //         }
// //     } catch (err) {
// //         console.error('[ERROR] Failed to fetch users for refresh:', err.message);
// //     }
// // }

//     module.exports = {
//         saveMicrosoftUser,
//         getNewAccessTokenAndUpdate,
//         // refreshMicrosoftTokens,

//     };





const axios = require('axios');
require('dotenv').config();
const MicrosoftUser = require('../models/MicrosoftUser'); // Your Sequelize model

// Save or update Microsoft user in the DB using Sequelize
async function saveMicrosoftUser(profile, refreshToken, accessToken, expiresIn) {
    const email = profile.emails?.[0]?.value || null;
    const name = profile.displayName || null;
    const microsoftId = profile.id;
    const expiresAt = Date.now() + expiresIn * 1000; // milliseconds

    const existingUser = await MicrosoftUser.findOne({
        where: {
            [MicrosoftUser.sequelize.Op.or]: [
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
            user_id, // static for now, set dynamically if needed
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