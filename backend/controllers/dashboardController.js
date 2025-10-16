// const GoogleUser = require('../models/GoogleUser');
// const SmtpAccount = require('../models/smtpAccounts');
// const WarmupLog = require('../models/WarmupLog');

// exports.getDashboardData = async (req, res) => {
//     console.log('✅ Dashboard API hit');
//     try {
//         const user_id = req.user.id;
//         const googleUsers = await GoogleUser.findAll({
//             where: { user_id: req.user.id }
//         });
//         const smtpAccounts = await SmtpAccount.findAll({
//             where: { user_id: req.user.id }
//         });

//         console.log(`📥 Google Users Count for user ${req.user.id}:`, googleUsers.length);
//         console.log(`📥 SMTP Accounts Count for user ${req.user.id}:`, smtpAccounts.length);

//         res.json({ googleUsers, smtpAccounts });
//     } catch (error) {
//         console.error('❌ Error fetching dashboard data:', error);
//         res.status(500).json({ error: 'Internal server error' });
//     }
// };

// exports.deleteByEmail = async (req, res) => {
//     const { email } = req.params;
//     console.log(`🗑️ Delete request for email: ${email}`);

//     try {
//         // Delete from GoogleUser & SMTPAccount
//         const deletedGoogle = await GoogleUser.destroy({ where: { email } });
//         const deletedSmtp = await SmtpAccount.destroy({ where: { email } });

//         // Delete related warmup stats
//         const deletedLogs = await WarmupLog.destroy({ where: { sender: email } });

//         if (deletedGoogle || deletedSmtp) {
//             console.log(`✅ Deleted account(s) for: ${email}`);
//             console.log(`📊 Deleted ${deletedLogs} warmup logs for sender: ${email}`);
//             res.json({
//                 message: `Account(s) for ${email} and ${deletedLogs} related warmup log(s) deleted successfully`
//             });
//         } else {
//             console.log(`⚠️ No account records found for email: ${email}`);
//             res.status(404).json({ error: `No account records found for ${email}` });
//         }
//     } catch (error) {
//         console.error('❌ Error deleting by email:', error);
//         res.status(500).json({ error: 'Internal server error' });
//     }
// };



const GoogleUser = require('../models/GoogleUser');
const SmtpAccount = require('../models/smtpAccounts');
const MicrosoftUser = require("../models/MicrosoftUser")
// const WarmupLog = require('../models/WarmupLog');

// ✅ Fetch dashboard data for logged-in user
exports.getDashboardData = async (req, res) => {
    console.log('✅ Dashboard API hit');
    try {
        const userId = req.user.id;

        const googleUsers = await GoogleUser.findAll({
            where: { user_id: userId }
        });

        const smtpAccounts = await SmtpAccount.findAll({
            where: { user_id: userId }
        });


        const microsoftUsers = await MicrosoftUser.findAll({
            where: { user_id: userId }
        })


        console.log(`📥 Google Users Count for user ${userId}:`, googleUsers.length);
        console.log(`📥 SMTP Accounts Count for user ${userId}:`, smtpAccounts.length);
        console.log(`📥 Microsoft Accounts Count for user ${userId}:`, microsoftUsers.length);

        res.json({ googleUsers, smtpAccounts, microsoftUsers });
    } catch (error) {
        console.error('❌ Error fetching dashboard data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ✅ Delete an email account + related warmup logs for logged-in user
exports.deleteByEmail = async (req, res) => {
    const { email } = req.params;
    const userId = req.user.id;
    console.log(`🗑️ Delete request for email: ${email} by user ${userId}`);

    try {
        // Check if email belongs to this user
        const googleUserExists = await GoogleUser.findOne({
            where: { email, user_id: userId }
        });
        const smtpUserExists = await SmtpAccount.findOne({
            where: { email, user_id: userId }
        });

        if (!googleUserExists && !smtpUserExists) {
            console.log(`⚠️ No account found for ${email} belonging to user ${userId}`);
            return res.status(404).json({ error: `No account records found for ${email}` });
        }

        // Delete from GoogleUser & SMTPAccount
        const deletedGoogle = await GoogleUser.destroy({
            where: { email, user_id: userId }
        });
        const deletedSmtp = await SmtpAccount.destroy({
            where: { email, user_id: userId }
        });

        // Delete related warmup logs
        const deletedLogs = await WarmupLog.destroy({
            where: { sender: email }
        });

        console.log(`✅ Deleted account(s) for: ${email}`);
        console.log(`📊 Deleted ${deletedLogs} warmup logs for sender: ${email}`);

        res.json({
            message: `Account(s) for ${email} and ${deletedLogs} related warmup log(s) deleted successfully`
        });

    } catch (error) {
        console.error('❌ Error deleting by email:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};





// const GoogleUser = require('../models/GoogleUser');
// const SmtpAccount = require('../models/smtpAccounts');

// exports.getDashboardData = async (req, res) => {
//     console.log('✅ Dashboard API hit');
//     try {
//         const googleUsers = await GoogleUser.findAll();
//         const smtpAccounts = await SmtpAccount.findAll();

//         console.log('📥 Google Users Count:', googleUsers.length);
//         console.log('📥 SMTP Accounts Count:', smtpAccounts.length);

//         res.json({ googleUsers, smtpAccounts });
//     } catch (error) {
//         console.error('❌ Error fetching dashboard data:', error);
//         res.status(500).json({ error: 'Internal server error' });
//     }
// };

// exports.deleteDashboardData = async (req, res) => {
//     console.log('🗑️ Delete ALL dashboard data request received');
//     try {
//         await GoogleUser.destroy({ where: {} });
//         await SmtpAccount.destroy({ where: {} });

//         console.log('✅ All Google users and SMTP accounts deleted');
//         res.json({ message: 'All dashboard data deleted successfully' });
//     } catch (error) {
//         console.error('❌ Error deleting dashboard data:', error);
//         res.status(500).json({ error: 'Internal server error' });
//     }
// };

// exports.deleteByEmail = async (req, res) => {
//     const { email } = req.params;
//     console.log(`🗑️ Delete request for email: ${email}`);
//     try {
//         const deletedGoogle = await GoogleUser.destroy({ where: { email } });
//         const deletedSmtp = await SmtpAccount.destroy({ where: { email } });

//         if (deletedGoogle || deletedSmtp) {
//             console.log(`✅ Deleted records for email: ${email}`);
//             res.json({ message: `Record(s) for ${email} deleted successfully` });
//         } else {
//             console.log(`⚠️ No records found for email: ${email}`);
//             res.status(404).json({ error: `No records found for ${email}` });
//         }
//     } catch (error) {
//         console.error('❌ Error deleting by email:', error);
//         res.status(500).json({ error: 'Internal server error' });
//     }
// };
