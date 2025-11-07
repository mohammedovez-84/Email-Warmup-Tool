const imaps = require('imap-simple');
const { getSenderType } = require('../../utils/senderConfig');
const trackingService = require('../tracking/trackingService');

function detectAccountType(account) {
    if (account.providerType) {
        const poolType = account.providerType.toLowerCase();
        const poolTypeMap = {
            'gmail': 'google',
            'outlook': 'outlook_personal',
            'outlook_personal': 'outlook_personal',
            'microsoft_organizational': 'microsoft_organizational',
            'custom': 'smtp'
        };
        return poolTypeMap[poolType] || poolType;
    }
    return getSenderType(account);
}

function isSpamFolder(folderName) {
    if (!folderName) return false;

    const spamIndicators = [
        'spam', 'junk', 'bulk', 'trash', 'deleted',
        'quarantine', 'blocked', 'suspicious', 'phishing'
    ];

    const folderLower = folderName.toLowerCase();
    return spamIndicators.some(indicator => folderLower.includes(indicator));
}

function calculateSpamRiskFromFolder(folderName) {
    if (!folderName) return 'unknown';

    const folderLower = folderName.toLowerCase();

    if (folderLower.includes('spam') || folderLower.includes('junk')) {
        return 'high';
    } else if (folderLower.includes('bulk') || folderLower.includes('promotion')) {
        return 'medium';
    } else if (folderLower.includes('social') || folderLower.includes('update')) {
        return 'low';
    } else if (folderLower.includes('inbox') || folderLower.includes('important')) {
        return 'none';
    }

    return 'unknown';
}

function detectISP(email) {
    if (!email) return 'unknown';

    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) return 'unknown';

    const ispMap = {
        'gmail.com': 'Google',
        'googlemail.com': 'Google',
        'outlook.com': 'Microsoft',
        'hotmail.com': 'Microsoft',
        'live.com': 'Microsoft',
        'yahoo.com': 'Yahoo',
        'ymail.com': 'Yahoo',
        'aol.com': 'AOL',
        'icloud.com': 'Apple',
        'me.com': 'Apple',
        'protonmail.com': 'ProtonMail',
        'zoho.com': 'Zoho'
    };

    return ispMap[domain] || domain;
}

function getFilterStrengthAnalysis(strength, ratio) {
    const analyses = {
        'AGGRESSIVE': `High spam filtering (${ratio}% spam rate). Warmup emails may be flagged.`,
        'MODERATE': `Moderate spam filtering (${ratio}% spam rate). Standard warmup approach should work.`,
        'LENIENT': `Lenient spam filtering (${ratio}% spam rate). Good for warmup progression.`,
        'VERY_LENIENT': `Very lenient filtering (${ratio}% spam rate). Ideal for warmup.`,
        'UNKNOWN': 'Insufficient data to determine filter strength.'
    };

    return analyses[strength] || analyses.UNKNOWN;
}

// Email operations
async function replyToEmail(account, options, direction = 'WARMUP_TO_POOL') {
    const { sendEmail } = require('./emailSender');
    console.log(`📧 Sending reply for ${direction}: ${account.email}`);

    try {
        const result = await sendEmail(account, {
            ...options,
            subject: options.subject.startsWith('Re:') ? options.subject : `Re: ${options.subject}`
        });

        if (result.success) {
            console.log(`✅ Reply sent successfully: ${account.email} -> ${options.to}`);
            return {
                success: true,
                messageId: result.messageId,
                direction: direction
            };
        } else {
            console.error(`❌ Reply failed: ${account.email} -> ${options.to}: ${result.error}`);
            return {
                success: false,
                error: result.error,
                direction: direction
            };
        }
    } catch (error) {
        console.error(`❌ Error in replyToEmail for ${account.email}:`, error.message);
        return {
            success: false,
            error: error.message,
            direction: direction
        };
    }
}

async function markEmailAsSeenAndFlagged(account, messageId, direction = 'WARMUP_TO_POOL') {
    // Skip for pool accounts in inbound direction
    if (direction === 'POOL_TO_WARMUP' && account.providerType) {
        console.log(`⏩ Skipping mark as seen for pool account in inbound direction`);
        return { success: true, skipped: true };
    }

    let connection;
    try {
        const config = getImapConfig(account);
        connection = await imaps.connect(config);
        await connection.openBox('INBOX', false);

        const searchCriteria = [['HEADER', 'Message-ID', messageId]];
        const results = await connection.search(searchCriteria, { bodies: [''], struct: true });

        if (results.length > 0) {
            const uid = results[0].attributes.uid;
            await connection.imap.addFlags(uid, ['\\Seen', '\\Flagged']);
            console.log(`✅ Email marked as Seen + Flagged for ${direction}`);
        } else {
            console.log(`⚠️  Email not found for marking: ${messageId}`);
        }

        await connection.end();
        return { success: true };
    } catch (err) {
        console.error(`❌ Error marking email: ${err.message}`);
        if (connection) {
            try {
                await connection.end();
            } catch (e) {
                console.error('   ⚠️  Error closing connection:', e.message);
            }
        }
        return { success: false, error: err.message };
    }
}

// Connection and stats functions
async function testImapConnection(account, context = 'warmup') {
    let connection;

    try {
        console.log(`🔌 Testing IMAP connection for ${context}: ${account.email}`);
        const config = getImapConfig(account);
        connection = await imaps.connect(config);

        await connection.openBox('INBOX', false);
        const boxes = await connection.getBoxes();

        const folderCount = Object.keys(boxes).length;
        const sampleFolders = Object.keys(boxes).slice(0, 5).join(', ');

        console.log(`   📂 Available folders: ${sampleFolders}${folderCount > 5 ? '...' : ''}`);
        console.log(`   📊 Total folders: ${folderCount}`);

        await connection.end();

        console.log(`✅ IMAP connection successful for ${context}: ${account.email}`);
        return {
            success: true,
            message: 'IMAP connection successful',
            folders: folderCount,
            sampleFolders: sampleFolders
        };

    } catch (error) {
        console.error(`❌ IMAP connection failed for ${account.email}:`, error.message);

        // Provide specific solutions based on error type
        if (error.message.includes('Authentication failed')) {
            console.error(`   🔐 AUTHENTICATION ISSUE: Check your password/app password`);
            if (account.providerType === 'google') {
                console.error(`   💡 For Gmail: Use App Password (16 characters), not your regular password`);
            } else if (account.providerType === 'outlook_personal') {
                console.error(`   💡 For Outlook Personal: Enable IMAP access in settings or use OAuth2`);
            }
        } else if (error.message.includes('ECONNREFUSED')) {
            console.error(`   🌐 CONNECTION REFUSED: Check IMAP host/port settings`);
        } else if (error.message.includes('ETIMEDOUT')) {
            console.error(`   ⏰ TIMEOUT: Server might be down or network issue`);
        } else if (error.message.includes('OAUTH')) {
            console.error(`   🔑 OAUTH ISSUE: Token might be expired or invalid`);
        }

        if (connection) {
            try {
                await connection.end();
            } catch (e) {
                console.error('   ⚠️  Error closing connection:', e.message);
            }
        }
        return {
            success: false,
            error: error.message,
            details: 'Check credentials and IMAP settings',
            accountType: detectAccountType(account)
        };
    }
}

async function getMailboxStats(account, context = 'warmup') {
    let connection;
    try {
        console.log(`📊 Getting mailbox stats for ${context}: ${account.email}`);
        const config = getImapConfig(account);
        connection = await imaps.connect(config);
        await connection.openBox('INBOX', false);

        const status = await connection.status('INBOX', { messages: true, recent: true, unseen: true });
        await connection.end();

        console.log(`   Messages: ${status.messages}, Recent: ${status.recent}, Unseen: ${status.unseen}`);

        return {
            success: true,
            totalMessages: status.messages,
            recentMessages: status.recent,
            unseenMessages: status.unseen,
            context: context
        };
    } catch (error) {
        console.error(`❌ Error getting mailbox stats for ${account.email}: ${error.message}`);
        if (connection) {
            try {
                await connection.end();
            } catch (e) {
                console.error('   ⚠️  Error closing connection:', e.message);
            }
        }
        return {
            success: false,
            error: error.message,
            context: context
        };
    }
}

async function getFolderStats(account) {
    let connection;
    try {
        const config = getImapConfig(account);
        connection = await imaps.connect(config);

        const boxes = await connection.getBoxes();
        const folderStats = {};

        // Check main folders
        const mainFolders = ['INBOX', 'Spam', 'Junk', 'Important', 'Sent'];

        for (const folderName of mainFolders) {
            try {
                await connection.openBox(folderName, false);
                const status = await connection.status(folderName, { messages: true, recent: true, unseen: true });
                folderStats[folderName] = {
                    total: status.messages,
                    recent: status.recent,
                    unseen: status.unseen
                };
            } catch (folderError) {
                folderStats[folderName] = { error: folderError.message };
            }
        }

        await connection.end();
        return {
            success: true,
            folderStats: folderStats,
            totalFolders: Object.keys(boxes).length
        };
    } catch (error) {
        console.error(`❌ Error getting folder stats: ${error.message}`);
        if (connection) await connection.end().catch(() => { });
        return { success: false, error: error.message };
    }
}

async function bulkCheckEmailStatus(receiver, messageIds, direction = 'WARMUP_TO_POOL') {
    const results = {};

    for (const messageId of messageIds) {
        try {
            const result = await checkEmailStatus(receiver, messageId, direction);
            results[messageId] = result;
        } catch (error) {
            results[messageId] = {
                success: false,
                error: error.message,
                exists: false,
                deliveredInbox: false
            };
        }
    }

    return results;
}

// Spam analysis functions
async function analyzeSpamPatterns(account, days = 7) {
    let connection;
    try {
        console.log(`🔍 Analyzing spam patterns for: ${account.email}`);
        const config = getImapConfig(account);
        connection = await imaps.connect(config);

        const spamStats = {
            totalSpam: 0,
            spamFolders: [],
            recentSpam: 0,
            spamSources: new Map()
        };

        // Check spam folders
        const spamFolders = ['Spam', 'Junk', 'Bulk'];

        for (const folderName of spamFolders) {
            try {
                await connection.openBox(folderName, false);
                const sinceDate = new Date();
                sinceDate.setDate(sinceDate.getDate() - days);

                const searchCriteria = ['SINCE', sinceDate];
                const results = await connection.search(searchCriteria, {
                    bodies: ['HEADER.FIELDS (FROM SUBJECT)'],
                    struct: true
                });

                if (results.length > 0) {
                    spamStats.totalSpam += results.length;
                    spamStats.spamFolders.push({
                        name: folderName,
                        count: results.length
                    });

                    // Analyze spam sources
                    for (const message of results.slice(0, 50)) { // Sample first 50
                        const fromHeader = message.parts.find(part => part.which === 'HEADER.FIELDS (FROM SUBJECT)');
                        if (fromHeader && fromHeader.body) {
                            const fromMatch = fromHeader.body.match(/From:\s*(.*)/i);
                            if (fromMatch) {
                                const fromEmail = fromMatch[1];
                                const domain = fromEmail.split('@')[1];
                                if (domain) {
                                    spamStats.spamSources.set(domain, (spamStats.spamSources.get(domain) || 0) + 1);
                                }
                            }
                        }
                    }
                }
            } catch (folderError) {
                console.log(`   ⚠️  Cannot analyze folder ${folderName}: ${folderError.message}`);
            }
        }

        await connection.end();

        // Calculate spam rate
        const inboxStats = await getMailboxStats(account);
        const totalRecent = inboxStats.success ? inboxStats.totalMessages : 0;
        const spamRate = totalRecent > 0 ? (spamStats.totalSpam / totalRecent) * 100 : 0;

        return {
            success: true,
            analysisPeriod: `${days} days`,
            totalEmails: totalRecent,
            spamEmails: spamStats.totalSpam,
            spamRate: parseFloat(spamRate.toFixed(2)),
            spamFolders: spamStats.spamFolders,
            topSpamSources: Array.from(spamStats.spamSources.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10),
            riskLevel: spamRate > 10 ? 'HIGH' : spamRate > 5 ? 'MEDIUM' : 'LOW'
        };

    } catch (error) {
        console.error(`❌ Error analyzing spam patterns: ${error.message}`);
        if (connection) await connection.end().catch(() => { });
        return { success: false, error: error.message };
    }
}

async function monitorSpamFolderForWarmup(account, warmupDomains = []) {
    let connection;
    try {
        console.log(`👀 Monitoring spam folder for warmup emails: ${account.email}`);
        const config = getImapConfig(account);
        connection = await imaps.connect(config);

        const foundWarmupEmails = [];
        const spamFolders = ['Spam', 'Junk'];

        for (const folderName of spamFolders) {
            try {
                await connection.openBox(folderName, false);

                // Search for warmup-related emails
                const searchCriteria = [
                    'OR',
                    ['SUBJECT', 'Warmup'],
                    ['SUBJECT', 'Test'],
                    ['FROM', warmupDomains.map(domain => `@${domain}`).join(' ')]
                ];

                const results = await connection.search(searchCriteria, {
                    bodies: ['HEADER.FIELDS (FROM SUBJECT MESSAGE-ID)'],
                    struct: true
                });

                for (const message of results) {
                    const headerPart = message.parts.find(part => part.which === 'HEADER.FIELDS (FROM SUBJECT MESSAGE-ID)');
                    if (headerPart && headerPart.body) {
                        const fromMatch = headerPart.body.match(/From:\s*(.*)/i);
                        const subjectMatch = headerPart.body.match(/Subject:\s*(.*)/i);
                        const messageIdMatch = headerPart.body.match(/Message-ID:\s*(.*)/i);

                        if (fromMatch && subjectMatch) {
                            foundWarmupEmails.push({
                                folder: folderName,
                                from: fromMatch[1],
                                subject: subjectMatch[1],
                                messageId: messageIdMatch ? messageIdMatch[1] : null,
                                detectedAt: new Date()
                            });
                        }
                    }
                }

            } catch (folderError) {
                console.log(`   ⚠️  Cannot monitor folder ${folderName}: ${folderError.message}`);
            }
        }

        await connection.end();

        return {
            success: true,
            warmupEmailsInSpam: foundWarmupEmails.length,
            details: foundWarmupEmails,
            recommendation: foundWarmupEmails.length > 0 ?
                `Found ${foundWarmupEmails.length} warmup emails in spam folders. Consider adjusting warmup strategy.` :
                'No warmup emails detected in spam folders.'
        };

    } catch (error) {
        console.error(`❌ Error monitoring spam folder: ${error.message}`);
        if (connection) await connection.end().catch(() => { });
        return { success: false, error: error.message };
    }
}

async function analyzeSpamFilterStrength(account) {
    const stats = await getFolderStats(account);

    if (!stats.success) {
        return { success: false, error: stats.error };
    }

    const folderStats = stats.folderStats;
    const spamCount = (folderStats.Spam?.total || 0) + (folderStats.Junk?.total || 0);
    const inboxCount = folderStats.INBOX?.total || 0;
    const totalCount = spamCount + inboxCount;

    let filterStrength = 'UNKNOWN';
    let spamRatio = totalCount > 0 ? (spamCount / totalCount) * 100 : 0;

    if (spamRatio > 20) {
        filterStrength = 'AGGRESSIVE';
    } else if (spamRatio > 10) {
        filterStrength = 'MODERATE';
    } else if (spamRatio > 5) {
        filterStrength = 'LENIENT';
    } else if (totalCount > 0) {
        filterStrength = 'VERY_LENIENT';
    }

    return {
        success: true,
        totalEmails: totalCount,
        spamEmails: spamCount,
        inboxEmails: inboxCount,
        spamRatio: parseFloat(spamRatio.toFixed(2)),
        filterStrength: filterStrength,
        analysis: getFilterStrengthAnalysis(filterStrength, spamRatio)
    };
}

// Enhanced functions with spam tracking
async function checkEmailStatusWithSpamTracking(receiver, messageId, direction = 'WARMUP_TO_POOL', senderEmail = null) {
    const result = await checkEmailStatus(receiver, messageId, direction);

    // 🚨 TRACK SPAM FOLDER PLACEMENT
    if (result.success && result.exists) {
        const isSpamFolderResult = isSpamFolder(result.folder);

        if (isSpamFolderResult && senderEmail) {
            console.log(`⚠️  SPAM DETECTED: Email placed in ${result.folder} folder`);

            // Track spam complaint
            await trackingService.trackSpamComplaint(messageId, {
                complaintType: 'automated_filter',
                complaintSource: 'ISP_FILTER',
                complaintFeedback: `Automatically placed in ${result.folder} folder by email provider`,
                reportingIsp: detectISP(receiver.email),
                folder: result.folder,
                senderEmail: senderEmail,
                receiverEmail: receiver.email
            }).catch(err => console.error('❌ Error tracking spam complaint:', err));
        }

        // Enhanced result with spam info
        return {
            ...result,
            isSpamFolder: isSpamFolderResult,
            spamRisk: calculateSpamRiskFromFolder(result.folder)
        };
    }

    return result;
}

async function moveEmailToInboxWithTracking(receiver, messageId, currentFolder, direction = 'WARMUP_TO_POOL', senderEmail = null) {
    const wasSpamFolder = isSpamFolder(currentFolder);

    const result = await moveEmailToInbox(receiver, messageId, currentFolder, direction);

    // 🚨 TRACK SPAM RECOVERY ATTEMPT
    if (wasSpamFolder && result.success && !result.skipped && senderEmail) {
        console.log(`🔄 SPAM RECOVERY: Moved email from ${currentFolder} to INBOX`);

        await trackingService.trackSpamComplaint(messageId, {
            complaintType: 'recovered_from_spam',
            complaintSource: 'MANUAL_RECOVERY',
            complaintFeedback: `Successfully moved from ${currentFolder} to INBOX`,
            reportingIsp: detectISP(receiver.email),
            resolved: true,
            resolvedAt: new Date(),
            resolutionNotes: 'Automatically moved from spam folder to inbox'
        }).catch(err => console.error('❌ Error tracking spam recovery:', err));
    }

    return {
        ...result,
        wasSpamFolder: wasSpamFolder,
        spamRecoveryAttempted: wasSpamFolder && !result.skipped
    };
}

// Core email checking functionality (single implementation)
async function checkEmailStatus(receiver, messageId, direction = 'WARMUP_TO_POOL') {
    // 🚨 CRITICAL FIX: Handle undefined messageId
    if (!messageId || messageId === 'undefined') {
        console.log(`❌ INVALID MESSAGE-ID: ${messageId} - cannot check email status`);

        // Track this as a delivery failure due to missing messageId
        await trackingService.trackEmailBounce('unknown-message-id', {
            bounceType: 'soft_bounce',
            bounceReason: 'Missing Message-ID for tracking',
            bounceCategory: 'transient',
            senderEmail: receiver.email,
            direction: direction
        }).catch(err => console.error('❌ Error tracking missing messageId:', err));

        return {
            success: false,
            error: 'Missing Message-ID for email tracking',
            exists: false,
            deliveredInbox: false
        };
    }

    const accountType = detectAccountType(receiver);
    const hasPassword = receiver.smtp_pass || receiver.smtpPassword || receiver.password || receiver.app_password || receiver.imap_pass;
    const hasOAuthToken = receiver.access_token;

    console.log(`🔍 Checking email status for ${direction}: ${messageId}`);
    console.log(`   Receiver: ${receiver.email}, Type: ${accountType}`);

    // 🚨 ENHANCED SKIP LOGIC WITH PROPER TRACKING
    if (messageId.startsWith('graph-')) {
        console.log(`⏩ Skipping IMAP check for Graph API email`);
        await trackSkippedEmail(messageId, 'GRAPH_API', true);
        return {
            success: true,
            folder: 'GRAPH_API',
            exists: true,
            deliveredInbox: true,
            providerType: accountType,
            skipReason: 'GRAPH_API'
        };
    }

    if ((accountType === 'microsoft_organizational' || accountType === 'outlook_personal') && hasOAuthToken && !hasPassword) {
        console.log(`⏩ Skipping IMAP check for OAuth-only account`);
        await trackSkippedEmail(messageId, 'SKIPPED_OAUTH', true);
        return {
            success: true,
            folder: 'SKIPPED_OAUTH',
            exists: true,
            deliveredInbox: true,
            providerType: accountType,
            skipReason: 'OAUTH_ONLY'
        };
    }

    if ((accountType === 'microsoft_organizational' || accountType === 'outlook_personal') && !hasPassword && !hasOAuthToken) {
        console.log(`⏩ Skipping IMAP check - no credentials`);
        await trackSkippedEmail(messageId, 'SKIPPED_NO_CREDENTIALS', false);
        return {
            success: true,
            folder: 'SKIPPED_NO_CREDENTIALS',
            exists: false,
            deliveredInbox: false,
            providerType: accountType,
            skipReason: 'NO_CREDENTIALS'
        };
    }

    if (accountType === 'smtp' && !receiver.imap_host && !receiver.imap_pass) {
        console.log(`⏩ Skipping IMAP check - no IMAP config`);
        await trackSkippedEmail(messageId, 'SKIPPED_NO_IMAP', true);
        return {
            success: true,
            folder: 'SKIPPED_NO_IMAP',
            exists: true,
            deliveredInbox: true,
            providerType: accountType,
            skipReason: 'NO_IMAP_CONFIG'
        };
    }

    if (direction === 'POOL_TO_WARMUP' && receiver.providerType) {
        console.log(`⏩ Skipping IMAP check for pool inbound`);
        await trackSkippedEmail(messageId, 'SKIPPED_POOL_INBOUND', true);
        return {
            success: true,
            folder: 'SKIPPED_POOL_INBOUND',
            exists: true,
            deliveredInbox: true,
            providerType: accountType,
            skipReason: 'POOL_INBOUND'
        };
    }

    // 🚨 ACTUAL IMAP CHECKING WITH PROPER ERROR HANDLING
    let connection;
    try {
        console.log(`🔍 Performing IMAP check for: ${messageId}`);
        const config = getImapConfig(receiver);

        connection = await imaps.connect({
            imap: {
                ...config.imap,
                authTimeout: 15000,
                connTimeout: 20000,
                socketTimeout: 30000
            }
        });

        const foldersToCheck = getFoldersForAccountType(accountType, receiver.email);
        console.log(`   📁 Checking folders: ${foldersToCheck.join(', ')}`);

        let finalResult = await searchFoldersForEmail(connection, foldersToCheck, messageId);

        await connection.end();

        // 🚨 TRACK THE RESULT
        if (finalResult.exists) {
            await trackingService.trackEmailDelivered(messageId, {
                deliveredInbox: finalResult.deliveredInbox,
                deliveryFolder: finalResult.folder
            });
        } else {
            await trackingService.trackEmailBounce(messageId, {
                bounceType: 'soft_bounce',
                bounceReason: 'Email not found in any folder via IMAP',
                bounceCategory: 'transient'
            });
        }

        return finalResult;

    } catch (err) {
        console.error('❌ IMAP check error:', err.message);
        if (connection) await connection.end().catch(() => { });

        await trackingService.trackEmailBounce(messageId, {
            bounceType: 'soft_bounce',
            bounceReason: `IMAP error: ${err.message}`,
            bounceCategory: 'transient'
        });

        return {
            success: false,
            error: err.message,
            exists: false,
            deliveredInbox: false
        };
    }
}

// Helper functions (single implementations)
async function trackSkippedEmail(messageId, reason, deliveredInbox) {
    if (deliveredInbox) {
        await trackingService.trackEmailDelivered(messageId, {
            deliveredInbox: true,
            deliveryFolder: reason,
            skipImapCheck: true
        });
    } else {
        await trackingService.trackEmailBounce(messageId, {
            bounceType: 'soft_bounce',
            bounceReason: `Skipped: ${reason}`,
            bounceCategory: 'transient'
        });
    }
}

function getFoldersForAccountType(accountType) {
    const folderMap = {
        google: ['INBOX', '[Gmail]/Important', '[Gmail]/All Mail', '[Gmail]/Spam'],
        outlook_personal: ['INBOX', 'Important', 'Junk', 'Spam'],
        microsoft_organizational: ['INBOX', 'Important', 'Junk', 'Spam'],
        smtp: ['INBOX', 'Spam', 'Junk', 'Bulk']
    };
    return folderMap[accountType] || ['INBOX', 'Spam', 'Junk'];
}

async function searchFoldersForEmail(connection, folders, messageId) {
    for (const folder of folders) {
        try {
            await connection.openBox(folder, false);
            const searchCriteria = [['HEADER', 'Message-ID', messageId]];
            const results = await connection.search(searchCriteria, {
                bodies: [''],
                struct: true
            });

            if (results.length > 0) {
                const deliveredInbox = folder === 'INBOX' || folder === 'Important' || folder === '[Gmail]/Important';
                console.log(`✅ Email found in: ${folder} (Inbox: ${deliveredInbox})`);
                return {
                    success: true,
                    folder: folder,
                    exists: true,
                    deliveredInbox: deliveredInbox,
                    messageCount: results.length
                };
            }
        } catch (folderError) {
            console.log(`   ⚠️  Cannot access folder ${folder}: ${folderError.message}`);
            continue;
        }
    }

    console.log(`❌ Email not found in any folder: ${messageId}`);
    return {
        success: true,
        folder: 'NOT_FOUND',
        exists: false,
        deliveredInbox: false
    };
}

// 🚨 FIXED: Get IMAP Configuration
function getImapConfig(account) {
    const { email } = account;

    if (!email) {
        throw new Error('Email address is required for IMAP configuration');
    }

    const accountType = detectAccountType(account);

    const baseConfig = {
        imap: {
            user: email,
            host: '',
            port: 993,
            tls: true,
            tlsOptions: { rejectUnauthorized: false },
            authTimeout: 15000,
            connTimeout: 20000
        }
    };

    try {
        switch (accountType) {
            case 'google':
                const gmailPassword = account.app_password || account.smtp_pass || account.smtpPassword || account.appPassword;
                if (!gmailPassword) {
                    throw new Error(`Gmail account ${email} requires app_password`);
                }
                return {
                    imap: {
                        ...baseConfig.imap,
                        user: email,
                        password: gmailPassword,
                        host: 'imap.gmail.com',
                        port: 993
                    }
                };

            case 'outlook_personal':
                // For Outlook personal accounts, we need to use OAuth2
                if (!account.access_token) {
                    throw new Error(`Outlook personal account ${email} requires OAuth 2.0 access_token. Basic authentication is disabled by Microsoft.`);
                }

                return {
                    imap: {
                        ...baseConfig.imap,
                        user: email,
                        password: account.access_token,
                        host: 'outlook.office365.com',
                        port: 993,
                        auth: {
                            type: 'OAUTH2',
                            user: email,
                            accessToken: account.access_token
                        }
                    }
                };

            case 'microsoft_organizational':
                const orgPassword = account.smtp_pass || account.smtpPassword || account.password || account.appPassword;
                if (!orgPassword) {
                    throw new Error(`Microsoft organizational account ${email} requires password for IMAP`);
                }
                return {
                    imap: {
                        ...baseConfig.imap,
                        user: email,
                        password: orgPassword,
                        host: 'outlook.office365.com',
                        port: 993
                    }
                };



            case 'smtp':
                const finalImapHost = account.imap_host || account.smtp_host;
                const finalImapUser = account.imap_user || account.smtp_user || email;
                const finalImapPass = account.imap_pass || account.smtp_pass || account.imapPassword || account.smtpPassword || account.appPassword;

                if (!finalImapHost) {
                    throw new Error(`IMAP host required for SMTP account: ${email}`);
                }
                if (!finalImapPass) {
                    throw new Error(`IMAP password required for SMTP account: ${email}`);
                }

                return {
                    imap: {
                        ...baseConfig.imap,
                        user: finalImapUser,
                        password: finalImapPass,
                        host: finalImapHost,
                        port: account.imap_port || 993,
                        tls: account.imap_encryption !== 'None',
                        tlsOptions: account.imap_encryption !== 'None' ? { rejectUnauthorized: false } : undefined
                    }
                };

            default:
                throw new Error(`Unsupported account type: ${accountType}`);
        }
    } catch (error) {
        console.error(`❌ IMAP config error for ${email}:`, error.message);
        throw error;
    }
}

// 🚨 FIXED: Move Email to Inbox with bidirectional awareness
async function moveEmailToInbox(receiver, messageId, currentFolder, direction = 'WARMUP_TO_POOL') {
    const accountType = detectAccountType(receiver);
    const hasOAuthToken = receiver.access_token;
    const hasPassword = receiver.smtp_pass || receiver.smtpPassword || receiver.password || receiver.app_password;

    console.log(`📦 Attempting to move email for ${direction}: ${messageId}`);
    console.log(`   Current folder: ${currentFolder}, Account: ${receiver.email}`);

    // Skip for OAuth accounts without passwords
    if ((accountType === 'microsoft_organizational' || accountType === 'outlook_personal') &&
        hasOAuthToken && !hasPassword) {
        console.log(`⏩ Skipping move to inbox for ${accountType} account (OAuth token only)`);
        return {
            success: true,
            message: 'Skipped for OAuth account',
            skipped: true
        };
    }

    // Skip moving for Graph API emails
    if (messageId && messageId.startsWith('graph-')) {
        console.log(`⏩ Skipping move for Graph API email: ${messageId}`);
        return { success: true, skipped: true };
    }

    // Skip if already in inbox or doesn't exist
    if (currentFolder === 'INBOX' || currentFolder === 'NOT_FOUND' ||
        currentFolder === 'GRAPH_API' || currentFolder.includes('SKIPPED')) {
        console.log(`⏩ Skipping move - email is in ${currentFolder}`);
        return { success: true, skipped: true };
    }

    // Skip for pool accounts in inbound direction
    if (direction === 'POOL_TO_WARMUP' && receiver.providerType) {
        console.log(`⏩ Skipping move for pool account in inbound direction`);
        return { success: true, skipped: true };
    }

    let connection;

    try {
        console.log(`📦 Moving email from ${currentFolder} to INBOX: ${messageId}`);
        const config = getImapConfig(receiver);
        connection = await imaps.connect(config);

        await connection.openBox(currentFolder, false);
        const searchCriteria = [['HEADER', 'Message-ID', messageId]];
        const results = await connection.search(searchCriteria, { bodies: [''], struct: true });

        if (results.length === 0) {
            await connection.end();
            console.log(`❌ Email not found in current folder: ${currentFolder}`);
            return { success: false, error: 'Email not found in current folder' };
        }

        const uid = results[0].attributes.uid;
        await connection.moveMessage(uid, 'INBOX');
        console.log(`✅ Email moved from ${currentFolder} to INBOX`);

        await connection.end();
        return {
            success: true,
            message: 'Email moved to INBOX'
        };

    } catch (err) {
        console.error('❌ Error moving email to inbox:', err.message);
        if (connection) {
            try {
                await connection.end();
            } catch (e) {
                console.error('   ⚠️  Error closing connection:', e.message);
            }
        }
        return {
            success: false,
            error: err.message
        };
    }
}

module.exports = {
    getImapConfig,
    checkEmailStatus,
    moveEmailToInbox,
    replyToEmail,
    markEmailAsSeenAndFlagged,
    testImapConnection,
    detectAccountType,
    getMailboxStats,
    getFolderStats,
    bulkCheckEmailStatus,

    checkEmailStatusWithSpamTracking,
    isSpamFolder,
    calculateSpamRiskFromFolder,
    detectISP,
    moveEmailToInboxWithTracking,
    analyzeSpamPatterns,
    monitorSpamFolderForWarmup,
    analyzeSpamFilterStrength,
    getFilterStrengthAnalysis
};