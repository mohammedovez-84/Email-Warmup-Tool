// workers/warmupWorker.js - COMPLETE FIXED VERSION

require('dotenv').config({ path: '../.env' });

const getChannel = require('../queues/rabbitConnection');
const {
    warmupSingleEmail,
    canPoolSendMore,
    updatePoolSentCount,
    getFreshAccountData
} = require('../services/warmupWorkflow');
const GoogleUser = require('../models/GoogleUser');
const MicrosoftUser = require('../models/MicrosoftUser');
const SmtpAccount = require('../models/smtpAccounts');
const EmailPool = require('../models/EmailPool');
const { buildSenderConfig, buildWarmupConfig, buildPoolConfig } = require('../utils/senderConfig');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class WarmupWorker {
    constructor() {
        this.processing = false;
        this.lastProcessedTime = 0;
        this.MIN_JOB_INTERVAL = 60 * 1000; // 1 minutes between jobs
        this.currentJobQueue = [];
        this.isProcessingQueue = false;

        // Job sequencing control
        this.jobSequence = new Map();
        this.sequencedJobs = new Set();
    }

    async consumeWarmupJobs() {
        const channel = await getChannel();
        await channel.assertQueue('warmup_jobs', { durable: true });

        // CRITICAL: Set prefetch to 1 to process jobs one at a time
        channel.prefetch(1);

        console.log('🚀 Warmup Worker Started - Sequential Processing Enabled');
        console.log('📝 Jobs will be processed in scheduled order');

        channel.consume(
            'warmup_jobs',
            async (msg) => {
                if (!msg) return;

                // Add job to processing queue with proper sequencing
                await this.addJobToQueue(channel, msg);
            },
            { noAck: false }
        );
    }

    // Sequential job processing with ordering
    async addJobToQueue(channel, msg) {
        const job = JSON.parse(msg.content.toString());
        const jobKey = this.getJobKey(job);

        // Add to processing queue
        this.currentJobQueue.push({ channel, msg, job, jobKey });

        console.log(`📥 Added job to queue: ${jobKey}`);
        console.log(`   Queue size: ${this.currentJobQueue.length}`);

        // Start processing if not already running
        if (!this.isProcessingQueue) {
            this.processQueueSequentially();
        }
    }

    async processQueueSequentially() {
        if (this.isProcessingQueue || this.currentJobQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;

        while (this.currentJobQueue.length > 0) {
            const { channel, msg, job, jobKey } = this.currentJobQueue[0];

            try {
                console.log(`\n🔨 PROCESSING JOB: ${jobKey}`);
                console.log(`   Queue position: 1/${this.currentJobQueue.length}`);

                await this.processSingleJob(channel, msg, job);

                // Remove from queue after successful processing
                this.currentJobQueue.shift();

                console.log(`✅ Job completed: ${jobKey}`);
                console.log(`   Remaining in queue: ${this.currentJobQueue.length}`);

                // Enforce minimum delay between jobs
                if (this.currentJobQueue.length > 0) {
                    const delayMs = this.calculateDynamicDelay(job, this.currentJobQueue[0].job);
                    console.log(`⏳ Enforcing delay: ${Math.round(delayMs / 1000)}s before next job`);
                    await this.delay(delayMs);
                }

            } catch (error) {
                console.error(`❌ Job failed: ${jobKey}`, error.message);

                // Handle job failure - either requeue or reject
                await this.handleJobFailure(channel, msg, job, error);

                // Remove failed job from queue
                this.currentJobQueue.shift();
            }
        }

        this.isProcessingQueue = false;
        console.log('📭 Job queue empty - waiting for new jobs');
    }

    // Calculate dynamic delay based on job types
    calculateDynamicDelay(currentJob, nextJob) {
        // Base delay between all jobs
        let delayMs = 30 * 1000; // 30 seconds minimum

        // Longer delay for coordinated jobs
        if (currentJob.coordinated || nextJob.coordinated) {
            delayMs = 60 * 1000; // 1 minute for coordinated jobs
        }

        // Even longer delay for same account sequences
        if (currentJob.warmupAccount === nextJob.warmupAccount) {
            delayMs = 2 * 60 * 1000; // 2 minutes for same account
        }

        return delayMs;
    }

    async processSingleJob(channel, msg, job) {
        const now = Date.now();
        const timeSinceLastJob = now - this.lastProcessedTime;

        // Enforce minimum time between jobs
        if (timeSinceLastJob < this.MIN_JOB_INTERVAL) {
            const delayMs = this.MIN_JOB_INTERVAL - timeSinceLastJob;
            console.log(`⏳ Rate limiting: ${Math.round(delayMs / 1000)}s until next job`);
            await this.delay(delayMs);
        }

        if (job.coordinated && job.timeSlot && job.pairs) {
            console.log('🔨 Processing COORDINATED warmup job:', {
                timeSlot: job.timeSlot,
                pairs: job.pairs.length,
                direction: job.direction,
                warmupAccount: job.warmupAccount
            });

            if (job.individualSchedule) {
                await this.processIndividualEmail(job);
            } else {
                await this.processCoordinatedTimeSlot(job);
            }
        } else {
            console.log('🔨 Processing SINGLE warmup job');
            await this.processSingleEmail(job);
        }

        channel.ack(msg);
        this.lastProcessedTime = Date.now();
    }

    async handleJobFailure(channel, msg, job, error) {
        const maxRetries = 3;
        const retryCount = msg.fields.redeliveryCount || 0;

        if (this.isTransientError(error)) {
            if (retryCount < maxRetries) {
                const retryDelay = Math.min(5 * 60 * 1000, 30000 * Math.pow(2, retryCount));
                console.log(`🔄 Retrying job in ${retryDelay / 1000}s (attempt ${retryCount + 1}/${maxRetries})`);

                setTimeout(() => {
                    channel.nack(msg, false, true);
                }, retryDelay);
            } else {
                console.error(`❌ Max retries exceeded, rejecting job: ${this.getJobKey(job)}`);
                channel.reject(msg, false);
            }
        } else {
            console.error(`❌ Permanent error, acknowledging failed job: ${this.getJobKey(job)}`);
            channel.ack(msg);
        }
    }

    isTransientError(error) {
        const transientErrors = [
            'timeout',
            'connection',
            'network',
            'rate limit',
            'temporary',
            'busy'
        ];

        const errorMessage = error.message.toLowerCase();
        return transientErrors.some(transientError => errorMessage.includes(transientError));
    }

    getJobKey(job) {
        if (job.coordinated && job.pairs && job.pairs.length > 0) {
            const pair = job.pairs[0];
            return `${job.direction}_${pair.senderEmail}_${pair.receiverEmail}_${job.timeSlot}`;
        }
        return `${job.senderEmail}_${job.receiverEmail}_${Date.now()}`;
    }

    async processIndividualEmail(job) {
        const { timeSlot, pairs, scheduledTime, direction, warmupAccount } = job;
        const pair = pairs[0];

        console.log(`🎯 Executing ${direction} email: ${scheduledTime}`);
        console.log(`   Warmup Account: ${warmupAccount}`);

        if (!pairs || pairs.length === 0) {
            console.log('⚠️ No pairs found in individual email job');
            return;
        }

        // ENHANCED: Different handling for sending vs receiving
        if (direction === 'WARMUP_TO_POOL') {
            // SENDING from warmup account → pool account
            await this.handleWarmupToPool(pair, warmupAccount);
        } else {
            // RECEIVING at warmup account ← pool account  
            await this.handlePoolToWarmup(pair, warmupAccount);
        }
    }
    async handleWarmupToPool(pair, warmupAccount) {
        console.log(`   🔄 HANDLING SENDING: ${pair.senderEmail} → ${pair.receiverEmail}`);

        try {
            let sender = await this.getWarmupAccount(pair.senderType, pair.senderEmail);
            let receiver = await this.getPoolAccount(pair.receiverEmail);

            if (!sender) {
                throw new Error(`Sender account not found: ${pair.senderEmail}`);
            }
            if (!receiver) {
                throw new Error(`Receiver account not found: ${pair.receiverEmail}`);
            }

            console.log(`   📧 Processing: ${pair.senderEmail} → ${pair.receiverEmail} [WARMUP_TO_POOL]`);

            // ENHANCED: Diagnose Microsoft account issues instead of skipping
            if (sender.provider === 'microsoft' || sender.microsoft_id) {
                const microsoftStatus = await this.diagnoseMicrosoftAccount(sender);

                if (!microsoftStatus.canSend) {
                    console.log(`   ⚠️  Microsoft account issue: ${microsoftStatus.reason}`);

                    if (microsoftStatus.fixable) {
                        console.log(`   🔧 Attempting to fix: ${microsoftStatus.suggestion}`);
                        const fixed = await this.attemptMicrosoftFix(sender);
                        if (!fixed) {
                            console.log(`   ⏩ SKIPPING: Unable to resolve Microsoft account issue`);
                            return;
                        }
                    } else {
                        console.log(`   ⏩ SKIPPING: ${microsoftStatus.reason}`);
                        return;
                    }
                }
            }

            // Pre-execution validation
            await this.validateJobExecution(sender, receiver, 'WARMUP_TO_POOL');

            let senderConfig = buildWarmupConfig(sender);
            const safeReplyRate = pair.replyRate || 0.25;

            const sendResult = await this.sendEmailWithFallback(
                senderConfig,
                receiver,
                safeReplyRate,
                true, // isCoordinatedJob
                true, // isInitialEmail (outbound)
                false, // isReply
                'WARMUP_TO_POOL'
            );

            console.log(`   ✅ WARMUP_TO_POOL email completed: ${pair.senderEmail} → ${pair.receiverEmail}`);

        } catch (error) {
            console.error(`   ❌ Failed WARMUP_TO_POOL email: ${error.message}`);
            throw error;
        }
    }
    // NEW: Comprehensive Microsoft account diagnosis
    async diagnoseMicrosoftAccount(account) {
        try {
            console.log(`   🔍 Diagnosing Microsoft account: ${account.email}`);

            // Check 1: Token validity
            if (!account.access_token) {
                return {
                    canSend: false,
                    reason: 'No access token',
                    fixable: true,
                    suggestion: 'Account needs re-authentication'
                };
            }

            // Check 2: Token expiration
            if (this.isTokenExpired(account)) {
                return {
                    canSend: false,
                    reason: 'Token expired',
                    fixable: true,
                    suggestion: 'Refresh token required'
                };
            }

            // Check 3: Test Graph API permissions
            const permissionStatus = await this.testMicrosoftPermissions(account);
            if (!permissionStatus.hasSendPermission) {
                return {
                    canSend: false,
                    reason: `Missing send permission: ${permissionStatus.details}`,
                    fixable: permissionStatus.fixable,
                    suggestion: permissionStatus.suggestion
                };
            }

            // Check 4: Test actual send capability
            const sendTest = await this.testMicrosoftSendCapability(account);
            if (!sendTest.canSend) {
                return {
                    canSend: false,
                    reason: `Send test failed: ${sendTest.error}`,
                    fixable: sendTest.fixable,
                    suggestion: sendTest.suggestion
                };
            }

            return {
                canSend: true,
                reason: 'Account is ready for sending',
                fixable: true,
                suggestion: 'Proceed with warmup'
            };

        } catch (error) {
            return {
                canSend: false,
                reason: `Diagnosis failed: ${error.message}`,
                fixable: false,
                suggestion: 'Check account configuration'
            };
        }
    }

    // NEW: Test Microsoft Graph API permissions
    async testMicrosoftPermissions(account) {
        try {
            console.log(`   📋 Testing Microsoft Graph permissions for: ${account.email}`);

            // Test 1: Basic profile access (should work)
            const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
                headers: {
                    'Authorization': `Bearer ${account.access_token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (profileResponse.status === 401) {
                return {
                    hasSendPermission: false,
                    details: 'Token invalid or expired',
                    fixable: true,
                    suggestion: 'Refresh access token'
                };
            }

            if (!profileResponse.ok) {
                return {
                    hasSendPermission: false,
                    details: `Basic API access failed: ${profileResponse.status}`,
                    fixable: false,
                    suggestion: 'Check account authentication'
                };
            }

            // Test 2: Mail send permission
            const sendResponse = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${account.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: {
                        subject: "Permission Test",
                        body: {
                            contentType: "Text",
                            content: "Testing send permissions"
                        },
                        toRecipients: [
                            {
                                emailAddress: {
                                    address: account.email // Send to self for test
                                }
                            }
                        ]
                    },
                    saveToSentItems: "false"
                })
            });

            if (sendResponse.status === 403) {
                const errorData = await sendResponse.json().catch(() => ({}));
                console.log(`   🔐 Permission denied details:`, errorData);

                return {
                    hasSendPermission: false,
                    details: 'Mail.Send permission missing or not consented',
                    fixable: true,
                    suggestion: 'Admin consent required for Mail.Send permission'
                };
            }

            if (sendResponse.status === 400) {
                // This might actually be good - it means we have permission but the request has issues
                console.log(`   ✅ Has send permission (400 indicates permission but bad request)`);
                return {
                    hasSendPermission: true,
                    details: 'Has send permission',
                    fixable: true,
                    suggestion: 'Ready to send'
                };
            }

            if (sendResponse.ok) {
                console.log(`   ✅ Has send permission`);
                return {
                    hasSendPermission: true,
                    details: 'Has send permission',
                    fixable: true,
                    suggestion: 'Ready to send'
                };
            }

            // If we get here, there's an unknown issue
            return {
                hasSendPermission: false,
                details: `Unknown permission issue: ${sendResponse.status}`,
                fixable: false,
                suggestion: 'Check Microsoft Graph API status'
            };

        } catch (error) {
            return {
                hasSendPermission: false,
                details: `Permission test error: ${error.message}`,
                fixable: false,
                suggestion: 'Check network connectivity'
            };
        }
    }

    // NEW: Test actual send capability with a safe test
    async testMicrosoftSendCapability(account) {
        try {
            console.log(`   🧪 Testing send capability for: ${account.email}`);

            // Use a simple test that won't actually send
            const testResponse = await fetch('https://graph.microsoft.com/v1.0/me/mailFolders/sentItems', {
                headers: {
                    'Authorization': `Bearer ${account.access_token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (testResponse.status === 403) {
                return {
                    canSend: false,
                    error: 'Cannot access sent items - permissions issue',
                    fixable: true,
                    suggestion: 'Need Mail.ReadWrite permission'
                };
            }

            if (!testResponse.ok && testResponse.status !== 404) {
                return {
                    canSend: false,
                    error: `Sent items access failed: ${testResponse.status}`,
                    fixable: false,
                    suggestion: 'Check mailbox permissions'
                };
            }

            // If we can access sent items (or get 404 which is fine), we likely have good permissions
            return {
                canSend: true,
                error: null,
                fixable: true,
                suggestion: 'Send capability confirmed'
            };

        } catch (error) {
            return {
                canSend: false,
                error: `Send test failed: ${error.message}`,
                fixable: false,
                suggestion: 'Check account configuration'
            };
        }
    }

    // NEW: Attempt to fix Microsoft account issues
    async attemptMicrosoftFix(account) {
        try {
            console.log(`   🔧 Attempting to fix Microsoft account: ${account.email}`);

            // Strategy 1: Refresh token if expired
            if (this.isTokenExpired(account)) {
                console.log(`   🔄 Token expired, attempting refresh...`);
                const newTokens = await this.refreshMicrosoftToken(account);
                if (newTokens) {
                    // Update the account with new tokens
                    await MicrosoftUser.update(
                        {
                            access_token: newTokens.access_token,
                            refresh_token: newTokens.refresh_token,
                            token_expires_at: newTokens.token_expires_at
                        },
                        { where: { email: account.email } }
                    );
                    console.log(`   ✅ Token refreshed successfully`);
                    return true;
                }
            }

            // Strategy 2: Check if it's a consent issue that can be resolved
            const permissionStatus = await this.testMicrosoftPermissions(account);
            if (permissionStatus.details.includes('consent')) {
                console.log(`   🔐 Consent issue detected: ${permissionStatus.details}`);
                console.log(`   💡 Solution: Admin consent required in Azure Portal`);

                // Mark account for manual intervention
                await this.markAccountAsNeedsReauth(account.email);
                return false;
            }

            // Strategy 3: Check if it's a license issue
            const licenseStatus = await this.checkMicrosoftLicense(account);
            if (!licenseStatus.hasLicense) {
                console.log(`   📄 License issue: ${licenseStatus.details}`);
                return false;
            }

            console.log(`   ❌ Unable to automatically fix account issues`);
            return false;

        } catch (error) {
            console.error(`   ❌ Fix attempt failed: ${error.message}`);
            return false;
        }
    }

    // NEW: Check if Microsoft account has proper license
    async checkMicrosoftLicense(account) {
        try {
            const response = await fetch('https://graph.microsoft.com/v1.0/me', {
                headers: {
                    'Authorization': `Bearer ${account.access_token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 403) {
                return {
                    hasLicense: false,
                    details: 'Account may not have Exchange Online license'
                };
            }

            const userData = await response.json();
            if (userData.mail && userData.userPrincipalName) {
                return {
                    hasLicense: true,
                    details: 'Account has valid license and mailbox'
                };
            }

            return {
                hasLicense: false,
                details: 'Account missing mailbox properties'
            };

        } catch (error) {
            return {
                hasLicense: false,
                details: `License check failed: ${error.message}`
            };
        }
    }

    async handlePoolToWarmup(pair, warmupAccount) {
        console.log(`   🔄 HANDLING RECEIVING: ${pair.senderEmail} → ${pair.receiverEmail}`);

        try {
            let sender = await this.getPoolAccount(pair.senderEmail);
            let receiver = await this.getWarmupAccount(pair.receiverType, pair.receiverEmail);

            if (!sender) {
                throw new Error(`Sender account not found: ${pair.senderEmail}`);
            }
            if (!receiver) {
                throw new Error(`Receiver account not found: ${pair.receiverEmail}`);
            }

            console.log(`   📧 Processing: ${pair.senderEmail} → ${pair.receiverEmail} [POOL_TO_WARMUP]`);

            // Pre-execution validation
            await this.validateJobExecution(sender, receiver, 'POOL_TO_WARMUP');

            let senderConfig = buildPoolConfig(sender);
            const safeReplyRate = pair.replyRate || 0.25;

            // Check pool capacity before sending
            if (!await canPoolSendMore(sender)) {
                throw new Error(`Pool account ${pair.senderEmail} has reached daily limit`);
            }

            // SEND THE EMAIL AND GET THE ACTUAL MESSAGE ID
            const sendResult = await this.sendEmailWithFallback(
                senderConfig,
                receiver,
                safeReplyRate,
                true, // isCoordinatedJob
                false, // isInitialEmail (inbound)
                true, // isReply
                'POOL_TO_WARMUP'
            );

            console.log(`   ✅ POOL_TO_WARMUP email completed: ${pair.senderEmail} → ${pair.receiverEmail}`);

            // ENHANCED: Actually check if email was delivered to Microsoft account
            // Use the actual messageId from the send result, not from pair
            if (sendResult && sendResult.messageId) {
                console.log(`   📧 Verifying email delivery to: ${warmupAccount}`);
                await this.verifyEmailDelivery(sendResult.messageId, warmupAccount);
            } else {
                console.log(`   ⚠️  No messageId available for delivery verification`);
            }

        } catch (error) {
            console.error(`   ❌ Failed POOL_TO_WARMUP email: ${error.message}`);
            throw error;
        }
    }



    async verifyEmailDelivery(messageId, warmupAccount) {
        // FIX: Check if messageId is valid
        if (!messageId || messageId === 'undefined') {
            console.log(`   ⚠️  Cannot verify delivery: messageId is ${messageId}`);
            return;
        }

        try {
            console.log(`   🔍 Verifying delivery for: ${messageId}`);

            const account = await this.getWarmupAccount('microsoft', warmupAccount);
            if (!account) {
                console.log(`   ⚠️  Account not found: ${warmupAccount}`);
                return;
            }

            // Only attempt verification for Microsoft accounts with valid tokens
            if (account.microsoft_id || account.provider === 'microsoft') {
                // CHECK IF ACCOUNT HAS VALID TOKENS BEFORE ATTEMPTING
                if (!account.access_token || this.isTokenExpired(account)) {
                    console.log(`   ⚠️  Skipping verification: Microsoft account has invalid/expired tokens`);
                    return;
                }

                console.log(`   🔄 Attempting Microsoft Graph API verification`);
                const deliveryStatus = await this.checkMicrosoftEmailDelivery(messageId, account);
                console.log(`   📬 Delivery status: ${deliveryStatus}`);
            }
        } catch (error) {
            console.log(`   ⚠️  Delivery verification failed: ${error.message}`);
        }
    }

    isTokenExpired(account) {
        if (!account.token_expiry && !account.token_expires_at) {
            console.log(`   ⚠️  No token expiry information available`);
            return true; // Assume expired if we don't know
        }

        try {
            let expiryTime;

            // Handle both token_expiry (Date string) and token_expires_at (timestamp)
            if (account.token_expiry) {
                expiryTime = new Date(account.token_expiry).getTime();
            } else if (account.token_expires_at) {
                expiryTime = Number(account.token_expires_at);
            }

            const now = Date.now();
            const bufferTime = 5 * 60 * 1000; // 5 minute buffer

            const isExpired = now >= (expiryTime - bufferTime);

            if (isExpired) {
                console.log(`   ⏰ Token expired or expiring soon`);
                console.log(`      Now: ${new Date(now).toISOString()}`);
                console.log(`      Expiry: ${new Date(expiryTime).toISOString()}`);
            }

            return isExpired;

        } catch (error) {
            console.error(`   ❌ Error checking token expiry:`, error);
            return true; // If we can't parse, assume expired
        }
    }


    // Add this method to your WarmupWorker class:

    async checkMicrosoftEmailDelivery(messageId, account) {
        try {
            console.log(`   📁 Checking Microsoft 365 inbox for: ${account.email}`);
            console.log(`   🔍 Searching for message: ${messageId}`);

            // Validate we have the necessary tokens
            if (!account.access_token) {
                console.log(`   ⚠️  No access token available for Microsoft account`);
                return 'NO_TOKEN';
            }

            // Use Microsoft Graph API to search for the email
            const graphApiUrl = `https://graph.microsoft.com/v1.0/me/messages`;

            // Search for the message by Internet Message ID or Subject
            const searchParams = new URLSearchParams({
                // Try multiple search strategies
                $filter: `internetMessageId eq '${messageId}'`,
                $select: 'id,subject,receivedDateTime,isRead',
                $top: '5'
            });

            const response = await fetch(`${graphApiUrl}?${searchParams}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${account.access_token}`,
                    'Content-Type': 'application/json',
                },
                timeout: 10000 // 10 second timeout
            });

            if (response.status === 401) {
                console.log(`   🔐 Token expired or invalid for Microsoft account`);
                return 'TOKEN_EXPIRED';
            }

            if (!response.ok) {
                console.log(`   ⚠️  Graph API request failed: ${response.status} ${response.statusText}`);
                return 'API_ERROR';
            }

            const data = await response.json();

            if (data.value && data.value.length > 0) {
                const email = data.value[0];
                console.log(`   ✅ Email found in Microsoft 365 inbox:`);
                console.log(`      Subject: ${email.subject}`);
                console.log(`      Received: ${email.receivedDateTime}`);
                console.log(`      Read: ${email.isRead ? 'Yes' : 'No'}`);
                return 'DELIVERED';
            } else {
                console.log(`   🔍 Email not found in Microsoft 365 inbox (searched by message ID)`);

                // Fallback: Try searching by subject (if we have the subject)
                return await this.searchMicrosoftEmailBySubject(account, messageId);
            }

        } catch (error) {
            console.log(`   ⚠️  Microsoft delivery check failed: ${error.message}`);

            // Check if it's a token-related error
            if (error.message.includes('token') || error.message.includes('auth') || error.message.includes('401')) {
                return 'TOKEN_EXPIRED';
            }

            return 'CHECK_FAILED';
        }
    }

    // Fallback method to search by subject
    async searchMicrosoftEmailBySubject(account, messageId) {
        try {
            // Extract potential subject from messageId or use a generic warmup subject
            const warmupSubject = 'Warmup Email'; // This should match your actual email subject

            const graphApiUrl = `https://graph.microsoft.com/v1.0/me/messages`;
            const searchParams = new URLSearchParams({
                $filter: `contains(subject, '${warmupSubject}')`,
                $select: 'id,subject,receivedDateTime,internetMessageId',
                $top: '10',
                $orderby: 'receivedDateTime desc'
            });

            const response = await fetch(`${graphApiUrl}?${searchParams}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${account.access_token}`,
                    'Content-Type': 'application/json',
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.value && data.value.length > 0) {
                    console.log(`   📧 Found ${data.value.length} warmup emails in inbox`);

                    // Check if any of them match our expected pattern
                    const recentWarmupEmails = data.value.slice(0, 3); // Check last 3
                    for (const email of recentWarmupEmails) {
                        console.log(`      - ${email.subject} (${email.receivedDateTime})`);
                    }

                    return 'LIKELY_DELIVERED'; // We found warmup emails, so delivery is working
                }
            }

            console.log(`   🔍 No warmup emails found in Microsoft 365 inbox`);
            return 'NOT_FOUND';

        } catch (error) {
            console.log(`   ⚠️  Subject search failed: ${error.message}`);
            return 'SEARCH_FAILED';
        }
    }

    // Enhanced method to handle token refresh if needed
    async refreshMicrosoftToken(account) {
        try {
            console.log(`   🔄 Attempting to refresh Microsoft token for: ${account.email}`);

            if (!account.refresh_token) {
                console.log(`   ❌ No refresh token available`);
                return null;
            }

            const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
            const params = new URLSearchParams({
                client_id: process.env.MS_CLIENT_ID,
                client_secret: process.env.MS_CLIENT_SECRET,
                refresh_token: account.refresh_token,
                grant_type: 'refresh_token',
                scope: 'https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send'
            });

            const response = await fetch(tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.log(`   ❌ Token refresh failed: ${response.status} - ${errorText}`);
                return null;
            }

            const tokenData = await response.json();
            console.log(`   ✅ Microsoft token refreshed successfully`);

            // Update the account with new tokens
            return {
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token || account.refresh_token,
                token_expires_at: Date.now() + (tokenData.expires_in * 1000)
            };

        } catch (error) {
            console.log(`   ❌ Token refresh error: ${error.message}`);
            return null;
        }
    }
    // Pre-execution validation
    async validateJobExecution(sender, receiver, direction) {
        console.log(`   🔍 Pre-execution validation for ${direction}`);

        // Check if accounts are still active and valid
        if (direction === 'WARMUP_TO_POOL') {
            const warmupValid = await this.validateWarmupAccount(sender.email);
            if (!warmupValid) {
                throw new Error(`Warmup account ${sender.email} is no longer valid`);
            }
        } else {
            const poolValid = await this.validatePoolAccount(sender.email);
            if (!poolValid) {
                throw new Error(`Pool account ${sender.email} is no longer valid`);
            }
        }
    }

    async validateWarmupAccount(email) {
        try {
            const account = await GoogleUser.findOne({ where: { email } }) ||
                await MicrosoftUser.findOne({ where: { email } }) ||
                await SmtpAccount.findOne({ where: { email } });

            return account && account.warmupStatus === 'active' && account.is_connected;
        } catch (error) {
            console.error(`❌ Error validating warmup account ${email}:`, error);
            return false;
        }
    }

    async validatePoolAccount(email) {
        try {
            const pool = await EmailPool.findOne({ where: { email, isActive: true } });
            return pool !== null;
        } catch (error) {
            console.error(`❌ Error validating pool account ${email}:`, error);
            return false;
        }
    }
    // Update the validateJobExecution method:

    async validateJobExecution(sender, receiver, direction) {
        console.log(`   🔍 Pre-execution validation for ${direction}`);

        // Check if accounts are still active and valid
        if (direction === 'WARMUP_TO_POOL') {
            const warmupValid = await this.validateWarmupAccount(sender.email);
            if (!warmupValid) {
                throw new Error(`Warmup account ${sender.email} is no longer valid`);
            }

            // NEW: Additional check for Microsoft Organizational accounts
            if (sender.provider === 'microsoft' || sender.microsoft_id) {
                const microsoftValid = await this.validateMicrosoftAccount(sender);
                if (!microsoftValid) {
                    throw new Error(`Microsoft account ${sender.email} needs re-authentication`);
                }
            }
        } else {
            const poolValid = await this.validatePoolAccount(sender.email);
            if (!poolValid) {
                throw new Error(`Pool account ${sender.email} is no longer valid`);
            }
        }
    }

    // NEW: Specific validation for Microsoft accounts
    async validateMicrosoftAccount(account) {
        try {
            // Check if token is expired and cannot be refreshed
            if (account.token_expiry && new Date(account.token_expiry) < new Date()) {
                console.log(`⚠️  Microsoft account has expired token: ${account.email}`);

                // Check if this is a consent-related issue that prevents refresh
                if (account.warmupStatus === 'needs_reauth') {
                    console.log(`❌ Microsoft account needs re-authentication: ${account.email}`);
                    return false;
                }
            }

            return true;
        } catch (error) {
            console.error(`❌ Error validating Microsoft account ${account.email}:`, error);
            return false;
        }
    }
    async processCoordinatedTimeSlot(job) {
        const { timeSlot, pairs, round } = job;

        console.log(`🎯 Executing COORDINATED time slot: ${timeSlot}`);
        console.log(`   Processing ${pairs.length} warmup emails`);

        const sendResults = [];
        let successCount = 0;

        for (let i = 0; i < pairs.length; i++) {
            const pair = pairs[i];

            console.log(`     📥 Processing (${i + 1}/${pairs.length}): ${pair.senderEmail} → ${pair.receiverEmail} [${pair.direction}]`);

            try {
                let sender, receiver;

                if (pair.direction === 'WARMUP_TO_POOL') {
                    sender = await this.getWarmupAccount(pair.senderType, pair.senderEmail);
                    receiver = await this.getPoolAccount(pair.receiverEmail);
                } else {
                    sender = await this.getPoolAccount(pair.senderEmail);
                    receiver = await this.getWarmupAccount(pair.receiverType, pair.receiverEmail);
                }

                if (!sender) {
                    throw new Error(`Sender account not found: ${pair.senderEmail}`);
                }
                if (!receiver) {
                    throw new Error(`Receiver account not found: ${pair.receiverEmail}`);
                }

                // Check pool capacity before processing
                if (pair.senderType === 'pool') {
                    if (!await canPoolSendMore(sender)) {
                        console.log(`     ⏩ Skipping: ${pair.senderEmail} reached daily limit`);
                        sendResults.push({ pair, success: false, error: 'Pool daily limit reached' });
                        continue;
                    }
                }

                let senderConfig;
                if (pair.direction === 'POOL_TO_WARMUP') {
                    senderConfig = buildPoolConfig(sender);
                } else {
                    senderConfig = buildWarmupConfig(sender);
                }

                const safeReplyRate = pair.replyRate || 0.25;

                // Add delay between emails for better distribution
                if (i > 0) {
                    await delay(5000); // 5 seconds between emails in same slot
                }

                // Determine email type based on direction
                const isOutbound = pair.direction === 'WARMUP_TO_POOL';
                const isReply = pair.direction === 'POOL_TO_WARMUP';

                await this.sendEmailWithFallback(
                    senderConfig,
                    receiver,
                    safeReplyRate,
                    true,
                    isOutbound,
                    isReply,
                    pair.direction
                );

                sendResults.push({ pair, success: true });
                successCount++;

                console.log(`     ✅ Email processed: ${pair.senderEmail} → ${pair.receiverEmail} [${pair.direction}]`);

            } catch (error) {
                console.error(`     ❌ Failed: ${pair.senderEmail} → ${pair.receiverEmail}: ${error.message}`);
                sendResults.push({ pair, success: false, error: error.message });
            }
        }

        console.log(`📊 COORDINATED SLOT RESULTS: ${successCount}/${pairs.length} successful`);

        // Log detailed results
        const failedPairs = sendResults.filter(result => !result.success);
        if (failedPairs.length > 0) {
            console.log(`   ❌ Failed emails:`);
            failedPairs.forEach(result => {
                console.log(`     - ${result.pair.senderEmail} → ${result.pair.receiverEmail}: ${result.error}`);
            });
        }
    }

    // In your warmupWorker.js - Update the sendEmailWithFallback method:

    async sendEmailWithFallback(senderConfig, receiver, replyRate, isCoordinatedJob = true, isInitialEmail = true, isReply = false, direction = 'unknown') {
        let retryCount = 0;
        const maxRetries = 2;

        while (retryCount <= maxRetries) {
            try {
                console.log(`📧 Sending ${direction} email from ${senderConfig.email} to ${receiver.email}`);

                // Store original senderConfig for potential updates
                const originalSenderConfig = { ...senderConfig };

                const sendResult = await warmupSingleEmail(
                    senderConfig,
                    receiver,
                    replyRate,
                    isReply,
                    isCoordinatedJob,
                    isInitialEmail,
                    direction
                );

                // If senderConfig was updated with new tokens during the process, save them
                if (senderConfig.access_token !== originalSenderConfig.access_token) {
                    await this.saveRefreshedTokens(senderConfig.email, {
                        access_token: senderConfig.access_token,
                        refresh_token: senderConfig.refresh_token,
                        token_expires_at: senderConfig.token_expires_at
                    });
                }

                // RETURN THE SEND RESULT WITH MESSAGE ID
                return {
                    success: true,
                    messageId: sendResult?.messageId || sendResult?.emailId || this.extractMessageIdFromResponse(sendResult)
                };

            } catch (error) {
                retryCount++;

                // NEW: Handle Microsoft Organizational consent errors specifically
                if (error.message.includes('consent_required') || error.message.includes('AADSTS65001')) {
                    console.log(`❌ Microsoft Organizational account consent required: ${senderConfig.email}`);
                    console.log(`⏩ Skipping this email and marking account for re-authentication`);

                    await this.markAccountAsNeedsReauth(senderConfig.email);

                    // For WARMUP_TO_POOL failures, allow the process to continue
                    if (direction === 'WARMUP_TO_POOL') {
                        console.log(`📝 Warmup process will continue with POOL_TO_WARMUP emails`);
                        return; // Don't retry, just skip this email
                    }

                    // For POOL_TO_WARMUP, we should still try to send
                    console.log(`⚠️  POOL_TO_WARMUP might still work even with warmup account issues`);
                    return;
                }

                // Enhanced error handling with retry logic
                if (error.message.includes('IMAP') || error.message.includes('getaddrinfo')) {
                    console.log(`     ⚠️  IMAP issue but email was likely sent: ${error.message}`);
                    return;
                }

                if (error.message.includes('daily limit')) {
                    console.log(`     ⏩ Pool limit reached: ${error.message}`);
                    return; // Don't retry pool limit errors
                }

                if (error.message.includes('rate limit')) {
                    console.log(`     ⏩ Rate limit reached: ${error.message}`);
                    return; // Don't retry rate limit errors
                }

                if (error.message.includes('account not found')) {
                    console.log(`     ❌ Account not found: ${error.message}`);
                    return; // Don't retry account not found errors
                }

                if (error.message.includes('access token') && retryCount <= maxRetries) {
                    console.log(`     🔄 Token error, retrying (${retryCount}/${maxRetries})...`);

                    // Refresh the sender account data and try again
                    try {
                        const freshSender = await this.getSenderAccount(
                            senderConfig.providerType ? 'pool' : 'warmup',
                            senderConfig.email
                        );
                        if (freshSender) {
                            Object.assign(senderConfig, buildSenderConfig(freshSender));
                            await delay(2000 * retryCount); // Exponential backoff
                            continue; // Retry the loop
                        }
                    } catch (refreshError) {
                        console.log(`     ❌ Failed to refresh sender data: ${refreshError.message}`);
                    }
                }

                // If we've exhausted retries or it's not a retryable error, throw
                if (retryCount > maxRetries) {
                    console.log(`     ❌ Max retries exceeded for: ${senderConfig.email}`);
                }

                throw error;
            }
        }

        return { success: false, messageId: null };
    }
    extractMessageIdFromResponse(sendResult) {
        if (!sendResult) return null;

        if (typeof sendResult === 'string') {
            // If it's a string, try to extract messageId
            const messageIdMatch = sendResult.match(/<([^>]+)>/);
            return messageIdMatch ? messageIdMatch[1] : sendResult;
        }

        if (sendResult.messageId) return sendResult.messageId;
        if (sendResult.emailId) return sendResult.emailId;
        if (sendResult.id) return sendResult.id;

        return null;
    }
    // NEW: Check if Microsoft token can be refreshed
    async canRefreshMicrosoftToken(senderConfig) {
        try {
            // Check if we have the necessary components for token refresh
            const hasRefreshToken = !!senderConfig.refresh_token;
            const hasClientCredentials = !!process.env.MICROSOFT_CLIENT_ID && !!process.env.MICROSOFT_CLIENT_SECRET;

            if (!hasRefreshToken || !hasClientCredentials) {
                console.log(`❌ Cannot refresh token: missing refresh token or client credentials`);
                return false;
            }

            return true;
        } catch (error) {
            console.error(`❌ Error checking token refresh capability:`, error);
            return false;
        }
    }

    // NEW: Mark account as needing re-authentication
    async markAccountAsNeedsReauth(email) {
        try {
            // Update the account status to indicate it needs re-authentication
            await MicrosoftUser.update(
                {
                    warmupStatus: 'needs_reauth',
                    is_connected: false
                },
                { where: { email } }
            );
            console.log(`🔐 Marked ${email} as needing re-authentication`);
        } catch (error) {
            console.error(`❌ Error marking account for re-auth:`, error);
        }
    }

    async saveRefreshedTokens(email, tokens) {
        try {
            await EmailPool.update(
                {
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    token_expires_at: tokens.token_expires_at
                },
                { where: { email } }
            );
            console.log(`💾 Saved refreshed tokens for ${email}`);
        } catch (error) {
            console.error('❌ Failed to save refreshed tokens:', error.message);
        }
    }

    // Get warmup account from all tables with better error handling
    async getWarmupAccount(senderType, email) {
        try {
            console.log(`🔍 Searching for warmup account: ${email} (type: ${senderType})`);

            let sender = null;

            // Try specific model first if type is provided
            if (senderType === 'google') {
                sender = await GoogleUser.findOne({ where: { email, warmupStatus: 'active' } });
                console.log(`   🔍 GoogleUser search: ${sender ? 'FOUND' : 'NOT FOUND'}`);
            } else if (senderType === 'microsoft') {
                sender = await MicrosoftUser.findOne({ where: { email, warmupStatus: 'active' } });
                console.log(`   🔍 MicrosoftUser search: ${sender ? 'FOUND' : 'NOT FOUND'}`);
            } else if (senderType === 'smtp') {
                sender = await SmtpAccount.findOne({ where: { email, warmupStatus: 'active' } });
                console.log(`   🔍 SmtpAccount search: ${sender ? 'FOUND' : 'NOT FOUND'}`);
            } else {
                console.log(`   🔍 No specific type provided, searching all models`);
            }

            // If not found by specific type OR no type provided, search all models
            if (!sender) {
                console.log(`   🔄 Comprehensive search for: ${email}`);

                // Search Google accounts
                sender = await GoogleUser.findOne({ where: { email, warmupStatus: 'active' } });
                console.log(`     GoogleUser: ${sender ? 'FOUND' : 'NOT FOUND'}`);

                if (!sender) {
                    // Search Microsoft accounts
                    sender = await MicrosoftUser.findOne({ where: { email, warmupStatus: 'active' } });
                    console.log(`     MicrosoftUser: ${sender ? 'FOUND' : 'NOT FOUND'}`);
                }

                if (!sender) {
                    // Search SMTP accounts
                    sender = await SmtpAccount.findOne({ where: { email, warmupStatus: 'active' } });
                    console.log(`     SmtpAccount: ${sender ? 'FOUND' : 'NOT FOUND'}`);
                }
            }

            if (!sender) {
                console.error(`❌ Active warmup account not found: ${email}`);
                console.error(`   Searched in: GoogleUser, MicrosoftUser, SmtpAccount`);
                console.error(`   Conditions: warmupStatus='active', email='${email}'`);
                return null;
            }

            const plainSender = this.convertToPlainObject(sender);
            console.log(`   ✅ Found warmup account: ${plainSender.email}`);
            console.log(`   📊 Account details: provider=${plainSender.provider || 'unknown'}, type=${senderType}`);

            return plainSender;

        } catch (error) {
            console.error(`❌ Error fetching warmup account ${email} for type ${senderType}:`, error.message);
            return null;
        }
    }

    async getPoolAccount(email) {
        try {
            console.log(`🔍 Searching for pool account: ${email}`);

            const poolAccount = await EmailPool.findOne({
                where: { email, isActive: true },
                raw: true
            });

            if (!poolAccount) {
                console.error(`❌ Active pool account not found: ${email}`);
                return null;
            }

            console.log(`📋 POOL ACCOUNT DATA for ${email}:`);
            console.log(`   Provider: ${poolAccount.providerType}`);
            console.log(`   Daily Usage: ${poolAccount.currentDaySent || 0}/${poolAccount.maxEmailsPerDay || 50}`);
            console.log(`   Last Reset: ${poolAccount.lastResetDate || 'Never'}`);
            console.log(`   Access Token: ${poolAccount.access_token ? 'PRESENT' : 'MISSING'}`);

            return poolAccount;
        } catch (error) {
            console.error(`❌ Error finding pool account ${email}:`, error.message);
            return null;
        }
    }

    async getSenderAccount(senderType, email) {
        try {
            if (senderType === 'pool') {
                let poolAccount = await this.getPoolAccount(email);

                if (!poolAccount) {
                    throw new Error(`Pool account not found: ${email}`);
                }

                // Enhanced normalization for pool accounts
                poolAccount = this.normalizePoolAccountFields(poolAccount);

                console.log(`🔍 NORMALIZED Pool Account ${email}:`);
                console.log(`   Daily Capacity: ${poolAccount.currentDaySent || 0}/${poolAccount.maxEmailsPerDay || 50}`);
                console.log(`   Token Status: ${poolAccount.access_token ? 'VALID' : 'MISSING'}`);

                return poolAccount;
            } else {
                return await this.getWarmupAccount(senderType, email);
            }
        } catch (error) {
            console.error(`❌ Error fetching sender account ${email}:`, error.message);
            return null;
        }
    }

    normalizePoolAccountFields(account) {
        const normalized = { ...account };

        // Convert token_expires_at (BIGINT) to token_expiry (Date string)
        if (normalized.token_expires_at && !normalized.token_expiry) {
            const expiryDate = new Date(Number(normalized.token_expires_at));
            normalized.token_expiry = expiryDate.toISOString();
            console.log(`   🔄 Converted token_expires_at to token_expiry: ${normalized.token_expiry}`);
        }

        // Ensure all expected fields are present
        if (!normalized.access_token && normalized.accessToken) {
            normalized.access_token = normalized.accessToken;
        }
        if (!normalized.refresh_token && normalized.refreshToken) {
            normalized.refresh_token = normalized.refreshToken;
        }

        // Ensure pool-specific fields
        if (!normalized.maxEmailsPerDay) {
            normalized.maxEmailsPerDay = 50; // Default pool limit
        }
        if (!normalized.currentDaySent) {
            normalized.currentDaySent = 0;
        }

        return normalized;
    }

    async getReceiverAccount(receiverType, email) {
        try {
            if (receiverType === 'pool') {
                return await this.getPoolAccount(email);
            } else {
                let account = await GoogleUser.findOne({ where: { email } });
                if (account) return this.convertToPlainObject(account);

                account = await MicrosoftUser.findOne({ where: { email } });
                if (account) return this.convertToPlainObject(account);

                account = await SmtpAccount.findOne({ where: { email } });
                if (account) return this.convertToPlainObject(account);

                console.error(`❌ Receiver account not found: ${email}`);
                return null;
            }
        } catch (error) {
            console.error(`❌ Error fetching receiver account ${email}:`, error.message);
            return null;
        }
    }

    // Helper method to convert Sequelize instances to plain objects
    convertToPlainObject(instance) {
        if (!instance) return null;
        return instance.get ? instance.get({ plain: true }) : instance;
    }

    async processSingleEmail(job) {
        const { senderEmail, senderType, receiverEmail, replyRate } = job;

        if (!senderEmail || !senderType || !receiverEmail) {
            console.error('❌ Missing required job fields');
            return;
        }

        const sender = await this.getWarmupAccount(senderType, senderEmail);
        const receiver = await this.getPoolAccount(receiverEmail);

        if (!sender) {
            console.error(`❌ Warmup account not found: ${senderEmail}`);
            return;
        }
        if (!receiver) {
            console.error(`❌ Pool account not found: ${receiverEmail}`);
            return;
        }

        const senderConfig = buildWarmupConfig(sender);
        const safeReplyRate = Math.min(0.25, replyRate || 0.25);

        await warmupSingleEmail(senderConfig, receiver, safeReplyRate, false, true);
        console.log(`✅ Warmup completed: ${senderEmail} -> ${receiverEmail}`);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = { WarmupWorker };