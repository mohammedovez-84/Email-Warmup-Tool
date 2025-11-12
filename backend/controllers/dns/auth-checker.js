const axios = require('axios');
const dns = require('dns').promises;

// DoH Providers
const DOH_PROVIDERS = [
    'https://cloudflare-dns.com/dns-query',
    'https://dns.google/resolve'
];

// Simple DoH functions
const dohResolveTxt = async (domain) => {
    for (const provider of DOH_PROVIDERS) {
        try {
            const response = await axios.get(provider, {
                params: { name: domain, type: 'TXT' },
                headers: { 'Accept': 'application/dns-json' },
                timeout: 5000
            });

            if (response.data.Status === 0 && response.data.Answer) {
                return response.data.Answer.map(answer =>
                    answer.data.replace(/"/g, '').replace(/\s+/g, ' ').trim()
                );
            }
            return [];
        } catch (error) {
            continue;
        }
    }
    throw new Error('All DoH providers failed');
};

const dohResolveMx = async (domain) => {
    for (const provider of DOH_PROVIDERS) {
        try {
            const response = await axios.get(provider, {
                params: { name: domain, type: 'MX' },
                headers: { 'Accept': 'application/dns-json' },
                timeout: 5000
            });

            if (response.data.Status === 0 && response.data.Answer) {
                return response.data.Answer.map(answer => {
                    const [priority, exchange] = answer.data.split(' ');
                    return {
                        priority: parseInt(priority),
                        exchange: exchange.replace(/\.$/, '')
                    };
                }).sort((a, b) => a.priority - b.priority);
            }
            return [];
        } catch (error) {
            continue;
        }
    }
    throw new Error('All DoH providers failed');
};

const dohResolve4 = async (domain) => {
    for (const provider of DOH_PROVIDERS) {
        try {
            const response = await axios.get(provider, {
                params: { name: domain, type: 'A' },
                headers: { 'Accept': 'application/dns-json' },
                timeout: 5000
            });

            if (response.data.Status === 0 && response.data.Answer) {
                return response.data.Answer.map(answer => answer.data);
            }
            return [];
        } catch (error) {
            continue;
        }
    }
    throw new Error('All DoH providers failed');
};

// DoH Helper functions
const getSPF_DOH = async (domain) => {
    try {
        const records = await dohResolveTxt(domain);
        const spfRecords = records.filter(r => r.includes("v=spf1"));

        return {
            exists: spfRecords.length > 0,
            records: spfRecords,
            primary: spfRecords[0] || null,
            isValid: spfRecords.length > 0
        };
    } catch (error) {
        return {
            exists: false,
            records: [],
            primary: null,
            isValid: false,
            error: error.message
        };
    }
};

const getDKIM_DOH = async (domain, selectors = ["default", "mail", "selector1", "google", "k1", "dkim"]) => {
    const results = [];

    for (const selector of selectors) {
        try {
            const dkimDomain = `${selector}._domainkey.${domain}`;
            const records = await dohResolveTxt(dkimDomain);
            const dkimRecord = records.find(r => r.includes("v=DKIM1"));

            if (dkimRecord) {
                results.push({
                    selector,
                    record: dkimRecord,
                    isValid: true
                });
            }
        } catch (error) {
            continue;
        }
    }

    return {
        exists: results.length > 0,
        records: results,
        primary: results[0] || null
    };
};

const getDMARC_DOH = async (domain) => {
    try {
        const dmarcDomain = `_dmarc.${domain}`;
        const records = await dohResolveTxt(dmarcDomain);
        const dmarcRecords = records.filter(r => r.includes("v=DMARC1"));

        return {
            exists: dmarcRecords.length > 0,
            records: dmarcRecords,
            primary: dmarcRecords[0] || null,
            isValid: dmarcRecords.length > 0
        };
    } catch (error) {
        return {
            exists: false,
            records: [],
            primary: null,
            isValid: false,
            error: error.message
        };
    }
};

const getMX_DOH = async (domain) => {
    try {
        const records = await dohResolveMx(domain);
        return {
            exists: records.length > 0,
            records: records,
            count: records.length
        };
    } catch (error) {
        return {
            exists: false,
            records: [],
            count: 0,
            error: error.message
        };
    }
};

// FIXED: Proper blacklist checking
const getBlacklistStatus_DOH = async (domain) => {
    try {
        const addresses = await dohResolve4(domain);
        const ip = addresses[0];

        if (!ip) {
            return {
                listed: false,
                ip: null,
                listedCount: 0,
                details: [],
                error: "Could not resolve domain to IP"
            };
        }

        const blacklists = [
            "zen.spamhaus.org",
            "bl.spamcop.net",
            "b.barracudacentral.org",
            "dnsbl.sorbs.net",
            "spam.dnsbl.sorbs.net",
            "psbl.surriel.com"
        ];

        const results = [];
        for (const bl of blacklists) {
            try {
                // Reverse the IP for proper blacklist lookup
                const reversedIp = ip.split('.').reverse().join('.');
                const lookupAddr = `${reversedIp}.${bl}`;

                // Try to resolve the blacklist lookup
                const blacklistResult = await dohResolve4(lookupAddr);

                // If we get results, the IP is listed
                if (blacklistResult && blacklistResult.length > 0) {
                    results.push({
                        list: bl,
                        status: "LISTED",
                        severity: bl.includes("spamhaus") ? "HIGH" : "MEDIUM"
                    });
                } else {
                    results.push({
                        list: bl,
                        status: "CLEAN",
                        severity: "NONE"
                    });
                }
            } catch (error) {
                // If DNS resolution fails, it means the IP is NOT listed
                results.push({
                    list: bl,
                    status: "CLEAN",
                    severity: "NONE"
                });
            }
        }

        const listed = results.some(r => r.status === "LISTED");
        return {
            listed,
            ip,
            listedCount: results.filter(r => r.status === "LISTED").length,
            details: results
        };
    } catch (error) {
        return {
            listed: false,
            ip: null,
            listedCount: 0,
            details: [],
            error: error.message
        };
    }
};

// System DNS Helper functions
const getSPF_System = async (domain) => {
    try {
        const records = await dns.resolveTxt(domain);
        const spfRecords = records.flat().filter(r =>
            Array.isArray(r) ? r.join('').includes("v=spf1") : r.includes("v=spf1")
        ).map(r => Array.isArray(r) ? r.join('') : r);

        return {
            exists: spfRecords.length > 0,
            records: spfRecords,
            primary: spfRecords[0] || null,
            isValid: spfRecords.length > 0
        };
    } catch (error) {
        return {
            exists: false,
            records: [],
            primary: null,
            isValid: false,
            error: error.message
        };
    }
};

const getDKIM_System = async (domain, selectors = ["default", "mail", "selector1", "google", "k1", "dkim"]) => {
    const results = [];

    for (const selector of selectors) {
        try {
            const dkimDomain = `${selector}._domainkey.${domain}`;
            const records = await dns.resolveTxt(dkimDomain);
            const dkimRecord = records.flat().find(r =>
                Array.isArray(r) ? r.join('').includes("v=DKIM1") : r.includes("v=DKIM1")
            );

            if (dkimRecord) {
                results.push({
                    selector,
                    record: Array.isArray(dkimRecord) ? dkimRecord.join('') : dkimRecord,
                    isValid: true
                });
            }
        } catch (error) {
            continue;
        }
    }

    return {
        exists: results.length > 0,
        records: results,
        primary: results[0] || null
    };
};

const getDMARC_System = async (domain) => {
    try {
        const dmarcDomain = `_dmarc.${domain}`;
        const records = await dns.resolveTxt(dmarcDomain);
        const dmarcRecords = records.flat().filter(r =>
            Array.isArray(r) ? r.join('').includes("v=DMARC1") : r.includes("v=DMARC1")
        ).map(r => Array.isArray(r) ? r.join('') : r);

        return {
            exists: dmarcRecords.length > 0,
            records: dmarcRecords,
            primary: dmarcRecords[0] || null,
            isValid: dmarcRecords.length > 0
        };
    } catch (error) {
        return {
            exists: false,
            records: [],
            primary: null,
            isValid: false,
            error: error.message
        };
    }
};

const getMX_System = async (domain) => {
    try {
        const records = await dns.resolveMx(domain);
        return {
            exists: records.length > 0,
            records: records,
            count: records.length
        };
    } catch (error) {
        return {
            exists: false,
            records: [],
            count: 0,
            error: error.message
        };
    }
};

// FIXED: Proper blacklist checking for system DNS
const getBlacklistStatus_System = async (domain) => {
    try {
        const addresses = await dns.resolve4(domain);
        const ip = addresses[0];

        if (!ip) {
            return {
                listed: false,
                ip: null,
                listedCount: 0,
                details: []
            };
        }

        const blacklists = [
            "zen.spamhaus.org",
            "bl.spamcop.net",
            "b.barracudacentral.org",
            "dnsbl.sorbs.net",
            "spam.dnsbl.sorbs.net",
            "psbl.surriel.com"
        ];

        const results = [];
        for (const bl of blacklists) {
            try {
                const reversedIp = ip.split('.').reverse().join('.');
                const lookupAddr = `${reversedIp}.${bl}`;

                // Try to resolve the blacklist lookup
                await dns.resolve4(lookupAddr);

                // If we get here, the IP is listed
                results.push({
                    list: bl,
                    status: "LISTED",
                    severity: bl.includes("spamhaus") ? "HIGH" : "MEDIUM"
                });
            } catch (error) {
                // ENOTFOUND means the IP is NOT listed
                if (error.code === 'ENOTFOUND') {
                    results.push({
                        list: bl,
                        status: "CLEAN",
                        severity: "NONE"
                    });
                } else {
                    results.push({
                        list: bl,
                        status: "ERROR",
                        error: error.message,
                        severity: "NONE"
                    });
                }
            }
        }

        const listed = results.some(r => r.status === "LISTED");
        return {
            listed,
            ip,
            listedCount: results.filter(r => r.status === "LISTED").length,
            details: results
        };
    } catch (error) {
        return {
            listed: false,
            ip: null,
            listedCount: 0,
            details: [],
            error: error.message
        };
    }
};

// Enhanced Scoring Logic
const calculateSecurityScore = (spf, dkim, dmarc, mx, blacklist) => {
    let score = 0;
    const maxScore = 100;

    // SPF Scoring (25 points)
    if (spf.exists && spf.isValid) {
        score += 20;
        // Bonus for strict policy
        if (spf.primary && spf.primary.includes("-all")) score += 5;
        else if (spf.primary && spf.primary.includes("~all")) score += 3;
    } else if (spf.exists) {
        score += 10;
    }

    // DKIM Scoring (25 points)
    if (dkim.exists) {
        score += 20;
        // Bonus for multiple selectors
        if (dkim.records && dkim.records.length > 1) score += 5;
    }

    // DMARC Scoring (30 points)
    if (dmarc.exists && dmarc.isValid) {
        score += 20;
        // Analyze DMARC policy for bonuses
        if (dmarc.primary) {
            if (dmarc.primary.includes("p=reject")) score += 10;
            else if (dmarc.primary.includes("p=quarantine")) score += 8;
            else if (dmarc.primary.includes("p=none")) score += 2;
        }
    } else if (dmarc.exists) {
        score += 10;
    }

    // MX Scoring (10 points)
    if (mx.exists && mx.count > 0) {
        score += 8;
        if (mx.count > 1) score += 2; // Bonus for redundancy
    }

    // Blacklist Scoring (10 points)
    if (!blacklist.listed) {
        score += 10;
    } else {
        // Deduct points based on severity
        const highSeverityLists = blacklist.details.filter(d =>
            d.severity === "HIGH" && d.status === "LISTED"
        ).length;
        score += Math.max(0, 10 - (highSeverityLists * 3));
    }

    const finalScore = Math.min(score, maxScore);

    return {
        score: finalScore,
        maxScore,
        percentage: Math.min(Math.round((finalScore / maxScore) * 100), 100),
        breakdown: {
            spf: spf.exists ? (spf.isValid ? (spf.primary && spf.primary.includes("-all") ? 25 : spf.primary && spf.primary.includes("~all") ? 23 : 20) : 10) : 0,
            dkim: dkim.exists ? (dkim.records && dkim.records.length > 1 ? 25 : 20) : 0,
            dmarc: dmarc.exists ? (dmarc.isValid ? (dmarc.primary && dmarc.primary.includes("p=reject") ? 30 : dmarc.primary && dmarc.primary.includes("p=quarantine") ? 28 : dmarc.primary && dmarc.primary.includes("p=none") ? 22 : 20) : 10) : 0,
            mx: mx.exists ? (mx.count > 1 ? 10 : 8) : 0,
            blacklist: !blacklist.listed ? 10 : Math.max(0, 10 - (blacklist.details.filter(d => d.severity === "HIGH" && d.status === "LISTED").length * 3))
        }
    };
};

// Domain Health Score Calculation
const calculateDomainHealthScore = (spf, dkim, dmarc, mx, blacklist, securityScore) => {
    // Base health score starts with security score (70% weight)
    let healthScore = securityScore.percentage * 0.7;

    // MX Record Health (15% weight)
    let mxHealth = 0;
    if (mx.exists) {
        mxHealth = 80; // Base score for having MX
        if (mx.count > 1) mxHealth += 20; // Bonus for redundancy
        if (mx.records && mx.records.some(r => r.exchange.includes('google.com') || r.exchange.includes('outlook.com'))) {
            mxHealth += 10; // Bonus for reputable providers
        }
    }
    healthScore += mxHealth * 0.15;

    // DNS Configuration Health (15% weight)
    let dnsHealth = 0;
    if (spf.exists && spf.isValid) dnsHealth += 25;
    if (dkim.exists) dnsHealth += 25;
    if (dmarc.exists && dmarc.isValid) dnsHealth += 25;
    if (!blacklist.listed) dnsHealth += 25;
    healthScore += dnsHealth * 0.15;

    // Cap at 100 and ensure minimum of 0
    const finalHealthScore = Math.min(Math.max(Math.round(healthScore), 0), 100);

    // Determine health status
    let healthStatus;
    if (finalHealthScore >= 90) healthStatus = "EXCELLENT";
    else if (finalHealthScore >= 75) healthStatus = "GOOD";
    else if (finalHealthScore >= 60) healthStatus = "FAIR";
    else if (finalHealthScore >= 40) healthStatus = "POOR";
    else healthStatus = "CRITICAL";

    return {
        score: finalHealthScore,
        status: healthStatus,
        factors: {
            security: securityScore.percentage,
            mx: mxHealth,
            dns: dnsHealth
        }
    };
};

// FIXED: Dynamic recommendations based on actual domain data
const getRecommendations = (spf, dkim, dmarc, mx, blacklist, healthScore) => {
    const recs = [];

    // Health-based recommendations
    if (healthScore.score < 60) {
        recs.push({
            priority: "HIGH",
            category: "OVERALL",
            message: "Domain health is poor. Immediate attention required.",
            fix: "Focus on implementing basic email authentication (SPF, DKIM, DMARC) and check blacklist status"
        });
    }

    // SPF Recommendations - ONLY if needed
    if (!spf.exists) {
        recs.push({
            priority: "HIGH",
            category: "SPF",
            message: "Add an SPF record to prevent email spoofing",
            fix: "Create a TXT record with: v=spf1 include:_spf.google.com -all (adjust includes as needed)"
        });
    } else if (spf.primary) {
        // Only recommend changes if they don't already have the best configuration
        if (!spf.primary.includes("-all") && spf.primary.includes("~all")) {
            recs.push({
                priority: "MEDIUM",
                category: "SPF",
                message: "Strengthen your SPF policy with -all",
                fix: "Change ~all to -all in your SPF record to enforce strict policy"
            });
        }
        // Don't recommend anything if they already have -all
    }

    // DKIM Recommendations - ONLY if needed
    if (!dkim.exists) {
        recs.push({
            priority: "HIGH",
            category: "DKIM",
            message: "Implement DKIM for email signing",
            fix: "Generate DKIM keys and add TXT records for your email service provider"
        });
    } else if (dkim.records && dkim.records.length === 1) {
        recs.push({
            priority: "LOW",
            category: "DKIM",
            message: "Consider adding additional DKIM selectors",
            fix: "Add DKIM records for common selectors like 'google', 'selector1', 'k1'"
        });
    }

    // DMARC Recommendations - ONLY if needed
    if (!dmarc.exists) {
        recs.push({
            priority: "HIGH",
            category: "DMARC",
            message: "Add DMARC record for email validation",
            fix: "Create TXT record at _dmarc.yourdomain.com with: v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com"
        });
    } else if (dmarc.primary) {
        // Only recommend policy upgrades
        if (dmarc.primary.includes("p=none")) {
            recs.push({
                priority: "MEDIUM",
                category: "DMARC",
                message: "Strengthen DMARC policy to quarantine or reject",
                fix: "Change p=none to p=quarantine or p=reject in your DMARC record"
            });
        } else if (dmarc.primary.includes("p=quarantine")) {
            recs.push({
                priority: "LOW",
                category: "DMARC",
                message: "Consider strengthening DMARC policy to reject",
                fix: "Change p=quarantine to p=reject in your DMARC record for maximum protection"
            });
        }
        // Don't recommend anything if they already have p=reject

        // Check for reporting - ONLY if missing
        if (!dmarc.primary.includes("rua=") && !dmarc.primary.includes("ruf=")) {
            recs.push({
                priority: "LOW",
                category: "DMARC",
                message: "Add reporting to your DMARC policy",
                fix: "Add rua=mailto:dmarc@yourdomain.com and ruf=mailto:dmarc@yourdomain.com for reports"
            });
        }
    }

    // MX Recommendations - ONLY if needed
    if (!mx.exists) {
        recs.push({
            priority: "HIGH",
            category: "MX",
            message: "No MX records found - email delivery will fail",
            fix: "Add MX records pointing to your email service provider"
        });
    } else if (mx.count === 1) {
        recs.push({
            priority: "LOW",
            category: "MX",
            message: "Consider adding backup MX records",
            fix: "Add secondary MX records for redundancy with lower priority values"
        });
    }

    // Blacklist Recommendations - ONLY if actually listed
    if (blacklist.listed && blacklist.listedCount > 0) {
        const listedServices = blacklist.details.filter(d => d.status === "LISTED").map(d => d.list);
        recs.push({
            priority: "HIGH",
            category: "REPUTATION",
            message: `Domain IP ${blacklist.ip} listed on ${blacklist.listedCount} blacklist(s)`,
            fix: `Investigate and request removal from: ${listedServices.join(', ')}. This may be a false positive if using shared hosting.`
        });
    }

    // If everything is excellent and no issues found, show positive feedback
    if (recs.length === 0) {
        recs.push({
            priority: "INFO",
            category: "OVERALL",
            message: "Excellent domain health and authentication configuration!",
            fix: "Continue monitoring and consider implementing BIMI for brand visibility"
        });
    }

    // Sort by priority
    const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1, INFO: 0 };
    return recs.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);
};

// Main function with better logging
const checkEmailAuthRecords = async (req, res) => {
    const startTime = Date.now();

    try {
        const { domain, dkimSelectors, forceSystemDns = false } = req.body;

        if (!domain) {
            return res.status(400).json({ error: "Domain is required" });
        }

        console.log(`🔍 Starting domain check for: ${domain}`);

        // Validate domain format
        const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/;
        if (!domainRegex.test(domain)) {
            return res.status(400).json({ error: "Invalid domain format" });
        }

        let useSystemDns = forceSystemDns;
        let dnsMethod = "DoH";

        // Test DoH first unless forced to use system DNS
        if (!forceSystemDns) {
            try {
                await dohResolveTxt('google.com');
                console.log(`✅ Using DoH for domain: ${domain}`);
            } catch (error) {
                useSystemDns = true;
                dnsMethod = "System DNS";
                console.log(`🔄 Falling back to system DNS for ${domain}`);
            }
        } else {
            useSystemDns = true;
            dnsMethod = "System DNS";
            console.log(`🔧 Using system DNS (forced) for domain: ${domain}`);
        }

        let spf, dkim, dmarc, mx, blacklist;

        if (useSystemDns) {
            [spf, dkim, dmarc, mx, blacklist] = await Promise.allSettled([
                getSPF_System(domain),
                getDKIM_System(domain, dkimSelectors),
                getDMARC_System(domain),
                getMX_System(domain),
                getBlacklistStatus_System(domain)
            ]).then(results => results.map(result =>
                result.status === 'fulfilled' ? result.value : {
                    exists: false,
                    records: [],
                    error: result.reason.message
                }
            ));
        } else {
            [spf, dkim, dmarc, mx, blacklist] = await Promise.allSettled([
                getSPF_DOH(domain),
                getDKIM_DOH(domain, dkimSelectors),
                getDMARC_DOH(domain),
                getMX_DOH(domain),
                getBlacklistStatus_DOH(domain)
            ]).then(results => results.map(result =>
                result.status === 'fulfilled' ? result.value : {
                    exists: false,
                    records: [],
                    error: result.reason.message
                }
            ));
        }

        // Log actual results for debugging
        console.log(`📊 Domain ${domain} results:`, {
            SPF: spf.exists ? '✅' : '❌',
            DKIM: dkim.exists ? '✅' : '❌',
            DMARC: dmarc.exists ? '✅' : '❌',
            MX: mx.exists ? `✅ (${mx.count} records)` : '❌',
            Blacklisted: blacklist.listed ? `❌ (${blacklist.listedCount} lists)` : '✅'
        });

        // Add DNS method to results
        spf.dnsProvider = dnsMethod;
        dkim.dnsProvider = dnsMethod;
        dmarc.dnsProvider = dnsMethod;
        mx.dnsProvider = dnsMethod;
        blacklist.dnsProvider = dnsMethod;

        const securityScore = calculateSecurityScore(spf, dkim, dmarc, mx, blacklist);
        const domainHealth = calculateDomainHealthScore(spf, dkim, dmarc, mx, blacklist, securityScore);
        const recommendations = getRecommendations(spf, dkim, dmarc, mx, blacklist, domainHealth);

        console.log(`💡 Generated ${recommendations.length} recommendations for ${domain}`);

        const response = {
            domain,
            securityScore,
            domainHealth,
            summary: {
                hasSPF: spf.exists,
                hasDKIM: dkim.exists,
                hasDMARC: dmarc.exists,
                hasMX: mx.exists,
                isBlacklisted: blacklist.listed,
                overallHealth: domainHealth.status,
                securityHealth: securityScore.percentage >= 90 ? "EXCELLENT" :
                    securityScore.percentage >= 75 ? "GOOD" :
                        securityScore.percentage >= 60 ? "FAIR" : "POOR"
            },
            records: {
                spf,
                dkim,
                dmarc,
                mx,
                blacklist
            },
            recommendations,
            lastChecked: new Date().toISOString(),
            metadata: {
                checkId: `chk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                duration: `${Date.now() - startTime}ms`,
                dnsMethod,
                providers: dnsMethod === "DoH" ? DOH_PROVIDERS : ["System DNS"]
            }
        };

        console.log(`✅ Domain check completed for ${domain} in ${Date.now() - startTime}ms using ${dnsMethod}`);
        res.json(response);

    } catch (error) {
        console.error("❌ Domain check error:", error);
        res.status(500).json({
            error: "Domain check failed",
            message: error.message,
            reference: `ERR_${Date.now()}`,
            duration: `${Date.now() - startTime}ms`
        });
    }
};

module.exports = {
    checkEmailAuthRecords
};
