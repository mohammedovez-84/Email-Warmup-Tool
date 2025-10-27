const { sequelize } = require('../config/db');
const EmailPool = require('../models/EmailPool'); // Adjust path as needed

const poolAccounts = [
    // ===== GMAIL Accounts =====
    {
        email: 'aasifdemand@gmail.com',
        providerType: 'GMAIL',
        appPassword: 'qjxdklxqutsxyaht'
    },
    // {
    //     email: 'business.warmup1@gmail.com',
    //     providerType: 'GMAIL',
    //     appPassword: 'your_gmail_app_password_here' // Replace with actual app password
    // },



    // ===== MICROSOFT ORGANIZATIONAL Accounts =====
    // These would use OAuth tokens (commented out for now)
    // {
    //     email: 'company.acc1@yourcompany.com',
    //     providerType: 'MICROSOFT_ORGANIZATIONAL',
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
        smtpPort: 587,
        smtpSecure: false,
        smtpUser: 'vikas@prospect-edge.com',
        smtpPassword: 'Demand@786',
        imapHost: 'prospect-edge.com',
        imapPort: 993,
        imapSecure: true,
        imapUser: 'ovez',
        imapPassword: 'Demand@786'
    },
    // {
    //     email: 'support@prospect-edge.com',
    //     providerType: 'CUSTOM',
    //     smtpHost: 'prospect-edge.com',
    //     smtpPort: 465,
    //     smtpSecure: true,
    //     smtpUser: 'support',
    //     smtpPassword: 'your_custom_domain_password',
    //     imapHost: 'prospect-edge.com',
    //     imapPort: 993,
    //     imapSecure: true,
    //     imapUser: 'support',
    //     imapPassword: 'your_custom_domain_password'
    // }
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

        // Show created accounts by provider type
        console.log('\n📊 Seeding Summary:');
        const byProvider = createdAccounts.reduce((acc, account) => {
            acc[account.providerType] = (acc[account.providerType] || 0) + 1;
            return acc;
        }, {});

        Object.entries(byProvider).forEach(([provider, count]) => {
            console.log(`   📧 ${provider}: ${count} accounts`);
        });

        console.log('\n🔍 All seeded accounts:');
        createdAccounts.forEach(account => {
            console.log(`   ✓ ${account.email} (${account.providerType})`);
        });

        console.log('\n💡 Next Steps for Outlook Accounts:');
        console.log('   1. Go to https://account.microsoft.com/security');
        console.log('   2. Enable two-factor authentication');
        console.log('   3. Generate app passwords for each Outlook account');
        console.log('   4. Update the appPassword fields in this seeder file');

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