const User = require('../models/userModel');
const logger = require('../utils/logger');

/**
 * GET /api/user/profile
 * Returns the authenticated user's profile
 */
exports.getProfile = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id, {
            attributes: {
                exclude: [
                    'password',
                    'email_verification_token',
                    'two_fa_secret',
                    'reset_password_token',
                    'reset_password_expires'
                ]
            }
        });

        if (!user) {
            logger.warn(`User not found for ID: ${req.user.id}`);
            return res.status(404).json({ error: 'User not found' });
        }

        logger.log(`Fetched profile for user ID: ${req.user.id}`);
        res.json(user);
    } catch (err) {
        logger.error('Get profile error: ' + err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
};
// /**
//  * PATCH /api/user/profile
//  * Updates the authenticated user's profile
//  */
// exports.updateProfile = async (req, res) => {
//     const { name, company, phone, title } = req.body;

//     try {
//         const user = await User.findByPk(req.user.id);

//         if (!user) {
//             logger.warn(`User not found for ID: ${req.user.id}`);
//             return res.status(404).json({ error: 'User not found' });
//         }

//         await user.update({
//             name,
//             company,
//             phone,
//             title
//         });

//         logger.log(`Updated profile for user ID: ${req.user.id}`);
//         res.json({ message: 'Profile updated successfully' });
//     } catch (err) {
//         logger.error('Update profile error: ' + err.message);
//         res.status(500).json({ error: 'Internal server error' });
//     }
// };

/**
 * PUT /api/users/me
 * Updates the authenticated user's profile
 */
exports.updateProfile = async (req, res) => {
    const { name, lastname, company, phone, title } = req.body;

    try {
        const user = await User.findByPk(req.user.id);

        if (!user) {
            logger.warn(`User not found for ID: ${req.user.id}`);
            return res.status(404).json({ error: 'User not found' });
        }

        await user.update({
            name,
            lastname,
            company,
            phone,
            title,
            industry: req.body.industry || user.industry,
        });

        logger.log(`Updated profile for user ID: ${req.user.id}`);
        res.json({ message: 'Profile updated successfully' });
    } catch (err) {
        logger.error('Update profile error: ' + err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * DELETE /api/users/me
 * Deletes the authenticated user's account
 */
exports.deleteAccount = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { password } = req.body;

        const user = await User.findByPk(userId);

        if (!user) {
            logger.warn(`User not found for ID: ${userId}`);
            return res.status(404).json({ error: 'User not found' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            logger.warn(`Incorrect password attempt for user ID: ${userId}`);
            return res.status(400).json({ error: 'Incorrect password' });
        }

        await User.destroy({ where: { user_id: userId } });

        logger.log(`Deleted account for user ID: ${userId}`);
        res.json({ message: 'Account deleted successfully' });
    } catch (error) {
        logger.error('Error deleting account: ' + error.message);
        res.status(500).json({ error: 'Failed to delete account' });
    }
};


/**
 * GET /api/user/all
 * Returns all users (admin/superadmin only)
 */
exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: {
                exclude: ['password', 'email_verification_token', 'two_fa_secret', 'reset_password_token', 'reset_password_expires']
            }
        });

        logger.log('Fetched all users');
        res.json(users);
    } catch (err) {
        logger.error('Get all users error: ' + err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
};
