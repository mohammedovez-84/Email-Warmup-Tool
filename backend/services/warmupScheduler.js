const getChannel = require('../queues/rabbitConnection');
const GoogleUser = require('../models/GoogleUser');
const MicrosoftUser = require('../models/MicrosoftUser');
const SmtpAccount = require('../models/smtpAccounts');
const { computeEmailsToSend, computeReplyRate } = require('./warmupWorkflow');

class WarmupPairingStrategy {
  // Strategy 1: Bidirectional Round Robin (everyone connects with everyone)
  static bidirectionalRoundRobin(accounts) {
    const pairs = [];
    const availableAccounts = [...accounts];

    for (let i = 0; i < availableAccounts.length; i++) {
      for (let j = 0; j < availableAccounts.length; j++) {
        if (i !== j) { // Don't pair with self
          pairs.push([availableAccounts[i], availableAccounts[j]]);
        }
      }
    }

    return pairs;
  }

  // Strategy 2: Circular Pairing with Bidirectional
  static circularPairing(accounts) {
    const pairs = [];
    const n = accounts.length;

    if (n < 2) return pairs;

    // For 2 accounts, create bidirectional pairs
    if (n === 2) {
      pairs.push([accounts[0], accounts[1]]); // A -> B
      pairs.push([accounts[1], accounts[0]]); // B -> A
      return pairs;
    }

    // For 3+ accounts, create bidirectional circular pairs
    for (let i = 0; i < n; i++) {
      for (let j = 1; j <= Math.floor((n - 1) / 2); j++) {
        const receiverIndex = (i + j) % n;
        // Create both directions
        pairs.push([accounts[i], accounts[receiverIndex]]); // A -> B
        pairs.push([accounts[receiverIndex], accounts[i]]); // B -> A
      }
    }

    return pairs;
  }

  // Strategy 3: Complete Bidirectional Pairs
  static completeBidirectionalPairs(accounts) {
    const pairs = [];

    for (let i = 0; i < accounts.length; i++) {
      for (let j = 0; j < accounts.length; j++) {
        if (i !== j) {
          pairs.push([accounts[i], accounts[j]]);
        }
      }
    }

    return pairs;
  }

  // Strategy 4: Smart Bidirectional Distribution
  static smartBidirectionalDistribution(accounts) {
    const pairs = [];

    // For small numbers, use complete bidirectional
    if (accounts.length <= 4) {
      return this.completeBidirectionalPairs(accounts);
    }

    // Group accounts by warmup day count
    const beginners = accounts.filter(acc => (acc.warmupDayCount || 0) <= 3);
    const intermediate = accounts.filter(acc => (acc.warmupDayCount || 0) > 3 && (acc.warmupDayCount || 0) <= 10);
    const advanced = accounts.filter(acc => (acc.warmupDayCount || 0) > 10);

    // Ensure everyone sends to everyone in their group + some cross-group
    const allGroups = [beginners, intermediate, advanced].filter(group => group.length > 0);

    allGroups.forEach(group => {
      group.forEach(sender => {
        // Send to everyone in same group (except self)
        group.forEach(receiver => {
          if (sender.email !== receiver.email) {
            pairs.push([sender, receiver]);
          }
        });

        // Send to some accounts in other groups
        allGroups.forEach(otherGroup => {
          if (otherGroup !== group) {
            const selectedReceivers = this.selectRandomPartners(otherGroup, 2);
            selectedReceivers.forEach(receiver => {
              pairs.push([sender, receiver]);
            });
          }
        });
      });
    });

    return this.shuffleArray(pairs);
  }

  static selectRandomPartners(partners, maxCount) {
    const shuffled = this.shuffleArray([...partners]);
    return shuffled.slice(0, Math.min(maxCount, shuffled.length));
  }

  static shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}

function getPairsByStrategy(accounts, strategy) {
  console.log(`🔍 Generating pairs for ${accounts.length} accounts using ${strategy} strategy`);

  let pairs;
  switch (strategy) {
    case 'roundRobin':
      pairs = WarmupPairingStrategy.bidirectionalRoundRobin(accounts);
      break;
    case 'circular':
      pairs = WarmupPairingStrategy.circularPairing(accounts);
      break;
    case 'smart':
      pairs = WarmupPairingStrategy.smartBidirectionalDistribution(accounts);
      break;
    case 'completeBidirectional':
    default:
      pairs = WarmupPairingStrategy.completeBidirectionalPairs(accounts);
      break;
  }

  console.log(`✅ Generated ${pairs.length} unique directional pairs`);
  return pairs;
}

// Updated strategy selection
async function startWarmupScheduler() {
  try {
    const channel = await getChannel();
    await channel.assertQueue('warmup_jobs', { durable: true });

    const runCycle = async () => {
      try {
        console.log(`\n[${new Date().toISOString()}] 🔄 Starting warmup scheduler cycle`);

        // --- FETCH ALL ACTIVE WARMUP ACCOUNTS ---
        const googleAccounts = await GoogleUser.findAll({
          where: { warmupStatus: 'active' }
        });
        const smtpAccounts = await SmtpAccount.findAll({
          where: { warmupStatus: 'active' }
        });
        const microsoftAccounts = await MicrosoftUser.findAll({
          where: { warmupStatus: 'active' }
        });

        const allAccounts = [...googleAccounts, ...smtpAccounts, ...microsoftAccounts];
        console.log(`📊 Active warmup accounts: ${allAccounts.length}`);

        if (allAccounts.length < 2) {
          console.log('⚠️ Need at least 2 active accounts for warmup. Skipping cycle.');
          setTimeout(runCycle, getNextRunDelay());
          return;
        }

        // Display account status
        console.log('\n📋 Account Status:');
        allAccounts.forEach(account => {
          console.log(`   ${account.email}: Day ${account.warmupDayCount || 0}, Status: ${account.warmupStatus}`);
        });

        let totalJobsEnqueued = 0;

        // --- STRATEGY: Use completeBidirectional for guaranteed bidirectional ---
        const pairingStrategy = 'completeBidirectional';

        console.log(`\n🎯 Using ${pairingStrategy} pairing strategy for ${allAccounts.length} accounts`);

        // Get pairs based on strategy - now each pair is directional
        const directionalPairs = getPairsByStrategy(allAccounts, pairingStrategy);

        if (directionalPairs.length === 0) {
          console.log('❌ No pairs generated! Creating manual bidirectional pairs...');
          // Manual fallback: create bidirectional pairs for all combinations
          for (let i = 0; i < allAccounts.length; i++) {
            for (let j = 0; j < allAccounts.length; j++) {
              if (i !== j) {
                const jobsForDirection = await enqueueDirectionalJob(channel, allAccounts[i], allAccounts[j]);
                totalJobsEnqueued += jobsForDirection;
              }
            }
          }
        } else {
          // Enqueue jobs for each directional pair
          for (const [sender, receiver] of directionalPairs) {
            const jobsForDirection = await enqueueDirectionalJob(channel, sender, receiver);
            totalJobsEnqueued += jobsForDirection;
          }
        }

        console.log(`\n✅ Total warmup jobs enqueued: ${totalJobsEnqueued}`);

        if (totalJobsEnqueued === 0) {
          console.log('❌ WARNING: No jobs were enqueued!');
        } else {
          console.log(`📧 Email distribution:`);
          allAccounts.forEach(account => {
            const sentCount = directionalPairs.filter(([sender]) => sender.email === account.email).length;
            const receivedCount = directionalPairs.filter(([, receiver]) => receiver.email === account.email).length;
            console.log(`   ${account.email}: Will send ${sentCount}, receive ${receivedCount} emails`);
          });
        }

        // Update last run time and increment day count
        await updateLastRunTime(allAccounts);
        await incrementWarmupDayCount(allAccounts);

        console.log(`\n📈 Warmup day incremented for all accounts`);
        setTimeout(runCycle, getNextRunDelay());

      } catch (err) {
        console.error('❌ Error in scheduler cycle:', err);
        setTimeout(runCycle, 60 * 60 * 1000);
      }
    };

    runCycle();

  } catch (err) {
    console.error('❌ Scheduler initialization error:', err);
    setTimeout(startWarmupScheduler, 60 * 60 * 1000);
  }
}

// Updated to handle directional pairs (sender -> receiver)
async function enqueueDirectionalJob(channel, sender, receiver) {
  let jobsCount = 0;

  // Calculate emails for this specific direction with gradual increase
  const emailsToSend = calculateEmailsForDirection(sender, receiver);

  console.log(`\n🔄 Direction: ${sender.email} -> ${receiver.email}`);
  console.log(`   ${sender.email} (Day ${sender.warmupDayCount || 0}) -> ${receiver.email}: ${emailsToSend} emails`);

  // Enqueue emails from sender to receiver
  for (let i = 0; i < emailsToSend; i++) {
    const jobPayload = createJobPayload(sender, receiver, 'outbound');
    channel.sendToQueue('warmup_jobs', Buffer.from(JSON.stringify(jobPayload)), {
      persistent: true,
      priority: 5
    });
    jobsCount++;
    console.log(`   📨 ${sender.email} -> ${receiver.email} (Reply: ${(jobPayload.replyRate * 100).toFixed(1)}%)`);
  }

  console.log(`   ✅ Created ${jobsCount} jobs for this direction`);
  return jobsCount;
}

// Enhanced calculateEmailsForDirection for bidirectional balance with gradual increase
function calculateEmailsForDirection(sender, receiver) {
  const baseEmails = computeEmailsToSend(sender);

  const senderDays = sender.warmupDayCount || 0;
  let emailsToSend = baseEmails;

  // More gradual increase
  if (senderDays === 1) emailsToSend = 2;
  else if (senderDays === 2) emailsToSend = 3;
  else if (senderDays === 3) emailsToSend = 4;
  else if (senderDays <= 7) emailsToSend = Math.min(6, baseEmails);
  else if (senderDays <= 14) emailsToSend = Math.min(8, baseEmails);
  else emailsToSend = Math.min(10, baseEmails);

  // Ensure bidirectional balance - if accounts are at similar levels, send similar amounts
  const receiverDays = receiver.warmupDayCount || 0;
  if (Math.abs(senderDays - receiverDays) <= 2) {
    // Similar levels, ensure balanced communication
    emailsToSend = Math.max(1, Math.min(emailsToSend, 4)); // Cap at 4 for balance
  }

  return Math.max(1, emailsToSend);
}

function createJobPayload(sender, receiver, direction) {
  return {
    senderEmail: sender.email,
    senderType: getSenderType(sender),
    receiverEmail: receiver.email,
    replyRate: computeReplyRate(sender),
    warmupDay: sender.warmupDayCount || 0,
    timestamp: new Date().toISOString(),
    direction: direction,
    pairId: `${sender.email}-${receiver.email}`
  };
}

function getNextRunDelay() {
  // Run less frequently to avoid rapid email sending
  return process.env.NODE_ENV === 'production'
    ? 24 * 60 * 60 * 1000 // Once per day in production
    : 6 * 60 * 60 * 1000; // Every 6 hours in development
}

async function updateLastRunTime(accounts) {
  try {
    for (const account of accounts) {
      const updateData = {
        lastWarmupRun: new Date()
      };
      await updateAccount(account, updateData);
    }
  } catch (error) {
    console.error('Error updating last run time:', error);
  }
}

async function incrementWarmupDayCount(accounts) {
  try {
    for (const account of accounts) {
      const updateData = {
        warmupDayCount: (account.warmupDayCount || 0) + 1
      };
      await updateAccount(account, updateData);
    }
  } catch (error) {
    console.error('Error incrementing warmup day count:', error);
  }
}

async function updateAccount(account, updateData) {
  try {
    if (account.roundRobinIndexGoogle !== undefined) {
      await GoogleUser.update(updateData, { where: { email: account.email } });
    } else if (account.roundRobinIndexMicrosoft !== undefined) {
      await MicrosoftUser.update(updateData, { where: { email: account.email } });
    } else {
      await SmtpAccount.update(updateData, { where: { email: account.email } });
    }
  } catch (error) {
    console.error(`Error updating account ${account.email}:`, error);
  }
}

function getSenderType(sender) {
  if (sender.provider === 'google' || sender.roundRobinIndexGoogle !== undefined) {
    return 'google';
  } else if (sender.provider === 'microsoft' || sender.roundRobinIndexMicrosoft !== undefined) {
    return 'microsoft';
  } else if (sender.smtp_host || sender.roundRobinIndexCustom !== undefined) {
    return 'smtp';
  }
  return 'unknown';
}

module.exports = {
  startWarmupScheduler
};