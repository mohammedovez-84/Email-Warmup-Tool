const dns = require("dns").promises;
// const axios = require("axios");

// ---------- HELPERS ----------

const getSPF = async (domain) => {
    try {
        const records = await dns.resolveTxt(domain);
        const spfRecord = records.flat().find((r) => r.startsWith("v=spf1"));
        return spfRecord || "No SPF record found";
    } catch {
        return "No SPF record found";
    }
};

const getDKIM = async (domain) => {
    try {
        const selectors = ["default", "mail", "selector1", "google"]; // common DKIM prefixes
        for (const sel of selectors) {
            try {
                const records = await dns.resolveTxt(`${sel}._domainkey.${domain}`);
                const dkimRecord = records.flat().join("");
                if (dkimRecord.includes("v=DKIM1")) return dkimRecord;
            } catch {
                continue;
            }
        }
        return "No DKIM record found";
    } catch {
        return "No DKIM record found";
    }
};

const getDMARC = async (domain) => {
    try {
        const dmarcDomain = `_dmarc.${domain}`;
        const records = await dns.resolveTxt(dmarcDomain);
        const dmarcRecord = records.flat().join("");
        return dmarcRecord || "No DMARC record found";
    } catch {
        return "No DMARC record found";
    }
};

const getBlacklistStatus = async (domain) => {
    try {
        // Simple DNSBL check with public services
        const blacklists = [
            "zen.spamhaus.org",
            "bl.spamcop.net",
            "b.barracudacentral.org",
            "dnsbl.sorbs.net",
            "spam.dnsbl.sorbs.net",
        ];

        const results = [];
        for (const bl of blacklists) {
            try {
                await dns.resolve4(`${domain}.${bl}`);
                results.push({ list: bl, status: "Listed" });
            } catch {
                results.push({ list: bl, status: "Clean" });
            }
        }

        const listed = results.some((r) => r.status === "Listed");
        return { listed, details: results };
    } catch {
        return { listed: false, details: [] };
    }
};

// ---------- ANALYSIS & SCORING ----------

const calculateSecurityScore = (spf, dkim, dmarc, blacklist) => {
    let score = 0;
    if (spf.includes("v=spf1")) score += 25;
    if (dkim.includes("v=DKIM1")) score += 25;
    if (dmarc.includes("v=DMARC1")) score += 30;
    if (!blacklist.listed) score += 20;
    return Math.min(score, 100);
};

const getRecommendations = (spf, dkim, dmarc, blacklist) => {
    const recs = [];

    if (!spf.includes("v=spf1"))
        recs.push("Add an SPF record to authorize sending servers (e.g., v=spf1 include:_spf.google.com -all).");

    if (!dkim.includes("v=DKIM1"))
        recs.push("Set up a DKIM record to digitally sign outgoing emails and improve trust.");

    if (!dmarc.includes("v=DMARC1"))
        recs.push("Add a DMARC record to monitor and enforce your domain’s authentication policy.");

    if (blacklist.listed)
        recs.push("Your domain or IP appears on one or more blacklists. Investigate and request delisting.");

    if (recs.length === 0)
        recs.push("Your domain authentication looks healthy! Keep monitoring for changes or blacklist events.");

    return recs;
};

// ---------- MAIN CONTROLLER ----------

exports.checkEmailAuthRecords = async (req, res) => {
    try {
        const { domain } = req.body;
        if (!domain) {
            return res.status(400).json({ error: "Domain is required" });
        }

        const [spf, dkim, dmarc, blacklist] = await Promise.all([
            getSPF(domain),
            getDKIM(domain),
            getDMARC(domain),
            getBlacklistStatus(domain),
        ]);

        const securityScore = calculateSecurityScore(spf, dkim, dmarc, blacklist);
        const recommendations = getRecommendations(spf, dkim, dmarc, blacklist);

        res.json({
            domain,
            securityScore,
            records: {
                spf,
                dkim,
                dmarc,
                blacklist,
            },
            recommendations,
            lastChecked: new Date().toISOString(),
        });
    } catch (error) {
        console.error("Auth Check Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
