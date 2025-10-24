const { sequelize } = require('../config/db');
const EmailPool = require('../models/EmailPool'); // Adjust path as needed

const poolAccounts = [
    {
        email: 'aasifdemand@gmail.com',
        providerType: 'GMAIL',
        appPassword: 'qjxdklxqutsxyaht'
    },
    // {
    //     email: 'business.account1@gmail.com',
    //     providerType: 'GMAIL',
    //     appPassword: 'your_gmail_app_password_here'
    // },

    // // ===== MICROSOFT Accounts =====  
    // // OAuth tokens work for both SMTP & IMAP
    // {
    //     email: 'company.acc1@outlook.com',
    //     providerType: 'MICROSOFT',
    //     refreshToken: 'your_microsoft_refresh_token_here',
    //     accessToken: 'your_microsoft_access_token_here',
    //     tokenExpiresAt: Date.now() + 3600000
    // },

    // ===== CUSTOM DOMAINS =====
    // Need separate SMTP & IMAP credentials
    {
        email: 'vikas@prospect-edge.com',
        providerType: 'CUSTOM',
        smtpHost: 'prospect-edge.com',
        smtpPort: 465,
        smtpSecure: true,
        smtpUser: 'ovez',
        smtpPassword: 'Demand@786',
        imapHost: 'prospect-edge.com',
        imapPort: 993,
        imapSecure: true,
        imapUser: 'ovez',
        imapPassword: 'Demand@786'
    }
];

async function seedEmailPool() {
    try {
        console.log('🔄 Connecting to database...');

        // Test connection
        await sequelize.authenticate();
        console.log('✅ Database connected successfully');

        // Sync model (creates table if not exists)
        await EmailPool.sync();
        console.log('✅ Table synced/created');

        // Clear existing data (optional)
        await EmailPool.destroy({ where: {} });
        console.log('✅ Cleared existing data');

        // Insert new data
        const createdAccounts = await EmailPool.bulkCreate(poolAccounts);
        console.log(`✅ Successfully seeded ${createdAccounts.length} accounts`);

        // Show created accounts
        createdAccounts.forEach(account => {
            console.log(`   ✓ ${account.email} (${account.providerType})`);
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await sequelize.close();
        console.log('🔌 Database connection closed');
    }
}

// Run if called directly
if (require.main === module) {
    seedEmailPool();
}

module.exports = seedEmailPool;