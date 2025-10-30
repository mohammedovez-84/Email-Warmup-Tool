const { sequelize } = require('../config/db');
const EmailPool = require('../models/EmailPool');
const nodemailer = require('nodemailer');
const Imap = require('imap');

const poolAccounts = [
    // ===== GMAIL Accounts =====
    {
        email: 'aasifdemand@gmail.com',
        providerType: 'GMAIL',
        appPassword: 'qjxdklxqutsxyaht'
    },
    {
        email: 'hissan1.dcm@gmail.com',
        providerType: 'GMAIL',
        appPassword: 'fqzmadvjprpkoudn'
    },
    {
        email: 'jinendra.dcm@gmail.com',
        providerType: 'GMAIL',
        appPassword: 'ygztusvpxvrblzwv'
    },
    {
        email: 'demandjeevan10@gmail.com',
        providerType: 'GMAIL',
        appPassword: 'eaffjgpwftkdtdgc'
    },
    // {
    //     email: 'business.warmup1@gmail.com',
    //     providerType: 'GMAIL',
    //     appPassword: 'your_gmail_app_password_here'
    // },

    // ===== CUSTOM DOMAINS =====
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
        imapUser: 'vikas@prospect-edge.com',
        imapPassword: 'Demand@786'
    },
];

class EmailValidator {
    static async testSMTPConnection(account) {
        return new Promise(async (resolve) => {
            try {
                let transporterConfig;

                if (account.providerType === 'GMAIL') {
                    transporterConfig = {
                        service: 'gmail',
                        auth: {
                            user: account.email,
                            pass: account.appPassword
                        }
                    };
                } else if (account.providerType === 'CUSTOM') {
                    transporterConfig = {
                        host: account.smtpHost,
                        port: account.smtpPort,
                        secure: account.smtpSecure,
                        auth: {
                            user: account.smtpUser,
                            pass: account.smtpPassword
                        },
                        // Add timeout and connection validation
                        connectionTimeout: 10000,
                        greetingTimeout: 10000,
                        socketTimeout: 10000
                    };
                }

                console.log(`   🔧 Testing SMTP for: ${account.email}`);

                const transporter = nodemailer.createTransport(transporterConfig);

                // Test connection by sending NOOP command
                await transporter.verify();

                console.log(`   ✅ SMTP connection successful: ${account.email}`);
                resolve({ success: true, account });
            } catch (error) {
                console.log(`   ❌ SMTP failed for ${account.email}: ${error.message}`);
                resolve({
                    success: false,
                    account,
                    error: `SMTP: ${error.message}`
                });
            }
        });
    }

    static async testIMAPConnection(account) {
        return new Promise((resolve) => {
            try {
                let imapConfig;

                if (account.providerType === 'GMAIL') {
                    imapConfig = {
                        user: account.email,
                        password: account.appPassword,
                        host: 'imap.gmail.com',
                        port: 993,
                        tls: true,
                        tlsOptions: { rejectUnauthorized: false },
                        authTimeout: 10000,
                        connTimeout: 10000
                    };
                } else if (account.providerType === 'CUSTOM') {
                    imapConfig = {
                        user: account.imapUser,
                        password: account.imapPassword,
                        host: account.imapHost,
                        port: account.imapPort,
                        tls: account.imapSecure,
                        tlsOptions: { rejectUnauthorized: false },
                        authTimeout: 10000,
                        connTimeout: 10000
                    };
                }

                console.log(`   🔧 Testing IMAP for: ${account.email}`);

                const imap = new Imap(imapConfig);

                imap.once('ready', () => {
                    console.log(`   ✅ IMAP connection successful: ${account.email}`);
                    imap.end();
                    resolve({ success: true, account });
                });

                imap.once('error', (err) => {
                    console.log(`   ❌ IMAP failed for ${account.email}: ${err.message}`);
                    resolve({
                        success: false,
                        account,
                        error: `IMAP: ${err.message}`
                    });
                });

                imap.once('end', () => {
                    // Connection ended normally
                });

                imap.connect();

                // Set timeout for IMAP connection
                setTimeout(() => {
                    if (imap.state !== 'authenticated') {
                        imap.end();
                        resolve({
                            success: false,
                            account,
                            error: 'IMAP: Connection timeout'
                        });
                    }
                }, 15000);

            } catch (error) {
                console.log(`   ❌ IMAP setup failed for ${account.email}: ${error.message}`);
                resolve({
                    success: false,
                    account,
                    error: `IMAP Setup: ${error.message}`
                });
            }
        });
    }

    static async validateAccount(account) {
        console.log(`\n🔍 Validating account: ${account.email} (${account.providerType})`);

        const smtpResult = await this.testSMTPConnection(account);
        const imapResult = await this.testIMAPConnection(account);

        const isValid = smtpResult.success && imapResult.success;

        if (isValid) {
            console.log(`   ✅ ALL CHECKS PASSED: ${account.email}`);
        } else {
            console.log(`   ❌ VALIDATION FAILED: ${account.email}`);
            if (!smtpResult.success) console.log(`      SMTP Error: ${smtpResult.error}`);
            if (!imapResult.success) console.log(`      IMAP Error: ${imapResult.error}`);
        }

        return {
            account,
            isValid,
            smtp: smtpResult,
            imap: imapResult,
            errors: [
                ...(smtpResult.success ? [] : [smtpResult.error]),
                ...(imapResult.success ? [] : [imapResult.error])
            ]
        };
    }
}

async function seedEmailPool() {
    try {
        console.log('🔄 Connecting to database...');
        await sequelize.authenticate();
        console.log('✅ Database connected successfully');

        // Sync model (creates table if not exists)
        await EmailPool.sync();
        console.log('✅ Table synced/created');

        console.log('\n🚀 Starting email account validation...');

        // Validate all accounts before seeding
        const validationResults = [];
        const validAccounts = [];

        for (const account of poolAccounts) {
            const result = await EmailValidator.validateAccount(account);
            validationResults.push(result);

            if (result.isValid) {
                validAccounts.push(account);
            }

            // Add small delay between validations to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Show validation summary
        console.log('\n📊 VALIDATION SUMMARY:');
        console.log(`   Total Accounts: ${poolAccounts.length}`);
        console.log(`   Valid Accounts: ${validAccounts.length}`);
        console.log(`   Failed Accounts: ${poolAccounts.length - validAccounts.length}`);

        // Show failed accounts
        const failedAccounts = validationResults.filter(r => !r.isValid);
        if (failedAccounts.length > 0) {
            console.log('\n❌ FAILED ACCOUNTS:');
            failedAccounts.forEach(failed => {
                console.log(`   - ${failed.account.email}:`);
                failed.errors.forEach(error => console.log(`     ${error}`));
            });
        }

        // Only seed valid accounts
        if (validAccounts.length === 0) {
            console.log('\n⚠️  No valid accounts to seed. Please fix the failed accounts and try again.');
            return;
        }

        // Clear existing data
        await EmailPool.destroy({ where: {} });
        console.log('\n✅ Cleared existing data');

        // Insert only valid accounts
        const createdAccounts = await EmailPool.bulkCreate(validAccounts);
        console.log(`✅ Successfully seeded ${createdAccounts.length} valid accounts`);

        // Show seeding summary
        console.log('\n📊 SEEDING SUMMARY:');
        const byProvider = createdAccounts.reduce((acc, account) => {
            acc[account.providerType] = (acc[account.providerType] || 0) + 1;
            return acc;
        }, {});

        Object.entries(byProvider).forEach(([provider, count]) => {
            console.log(`   📧 ${provider}: ${count} accounts`);
        });

        console.log('\n🔍 Successfully seeded accounts:');
        createdAccounts.forEach(account => {
            console.log(`   ✅ ${account.email} (${account.providerType})`);
        });

        // Show troubleshooting tips for failed accounts
        if (failedAccounts.length > 0) {
            console.log('\n🔧 TROUBLESHOOTING TIPS:');
            console.log('   For GMAIL accounts:');
            console.log('   1. Enable 2FA at https://myaccount.google.com/security');
            console.log('   2. Generate app password at https://myaccount.google.com/apppasswords');
            console.log('   3. Use the 16-character app password (not your regular password)');
            console.log('');
            console.log('   For CUSTOM domains:');
            console.log('   1. Verify SMTP/IMAP settings with your email provider');
            console.log('   2. Check if your provider allows external connections');
            console.log('   3. Verify username/password credentials');
            console.log('   4. Check if port 587/465 (SMTP) and 993 (IMAP) are open');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await sequelize.close();
        console.log('\n🔌 Database connection closed');
    }
}

// Run if called directly
if (require.main === module) {
    seedEmailPool();
}

