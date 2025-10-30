// test-smtp.js
const nodemailer = require('nodemailer');

async function testSMTP(email, config) {
    console.log(`\n🔧 Testing SMTP for: ${email}`);

    const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
            user: config.user,
            pass: config.pass
        },
        tls: {
            rejectUnauthorized: false
        }
    });

    try {
        await transporter.verify();
        console.log(`✅ SMTP connection successful: ${email}`);

        // Try to send test email
        const result = await transporter.sendMail({
            from: config.user,
            to: config.user, // Send to self for testing
            subject: 'SMTP Test',
            text: 'This is a test email'
        });

        console.log(`✅ Test email sent: ${result.messageId}`);
        return true;
    } catch (error) {
        console.log(`❌ SMTP failed: ${error.message}`);
        return false;
    }
}

// Test your domains
const tests = [
    // Updated test for Anna Claire
    {
        email: 'anna.claire@techno-trendz.com',
        config: {
            host: 'postal.techno-trendz.com',
            port: 587,
            secure: false,
            user: 'anna.claire@techno-trendz.com', // Use email as username
            pass: 'hxQa11n791VfqmIPqq1QZ2BZ' // Remove trailing tab
        }
    },
    {
        email: 'ivy.clementine@tech-advancement.com',
        config: {
            host: 'postal.tech-advancement.com',
            port: 587,
            secure: false,
            user: 'ivy.clementine@tech-advancement.com',
            pass: 'puGUKoZMGe6mapWAZiqF3fPc'
        }
    }
];

async function runTests() {
    for (const test of tests) {
        await testSMTP(test.email, test.config);
    }
}

runTests();