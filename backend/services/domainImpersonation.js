// services/domainImpersonation.js
const dns = require("dns").promises;

/**
* Generate typo/impersonation candidates
*/
function generateImpersonationCandidates(domain) {
    const results = new Set();
    const parts = domain.split(".");
    const name = parts[0];
    const tld = parts.slice(1).join(".");

    // Remove one character
    for (let i = 0; i < name.length; i++) {
        results.add(name.slice(0, i) + name.slice(i + 1) + "." + tld);
    }

    // Swap adjacent characters
    for (let i = 0; i < name.length - 1; i++) {
        const swapped =
            name.slice(0, i) +
            name[i + 1] +
            name[i] +
            name.slice(i + 2);
        results.add(swapped + "." + tld);
    }

    // Add dash
    for (let i = 1; i < name.length; i++) {
        results.add(name.slice(0, i) + "-" + name.slice(i) + "." + tld);
    }

    // Character substitutions
    const subs = { o: "0", l: "1", i: "1", e: "3", a: "4" };
    let substituted = name;
    for (const [k, v] of Object.entries(subs)) {
        substituted = substituted.replaceAll(k, v);
    }
    results.add(substituted + "." + tld);

    return Array.from(results);
}


async function checkDomainRecords(domain) {
    let hasMx = false, hasSpf = false;
    let dmarcStatus = "not_found"; // not_found | policy_not_enabled | valid
    let dmarcPolicy = null;

    try {
        const mx = await dns.resolveMx(domain);
        hasMx = mx && mx.length > 0;
    } catch { }

    try {
        const txtRecords = await dns.resolveTxt(domain);
        const flat = txtRecords.map(r => r.join(""));
        hasSpf = flat.some(r => r.toLowerCase().startsWith("v=spf1"));
    } catch { }

    try {
        const txtRecords = await dns.resolveTxt(`_dmarc.${domain}`);
        const flat = txtRecords.map(r => r.join("").toLowerCase());
        const dmarcRecord = flat.find(r => r.startsWith("v=dmarc1"));

        if (dmarcRecord) {
            const match = dmarcRecord.match(/p=([a-z]+)/);
            if (match) {
                dmarcPolicy = match[1];
                if (dmarcPolicy === "none") {
                    dmarcStatus = "policy_not_enabled";
                } else {
                    dmarcStatus = "valid";
                }
            }
        }
    } catch { }

    return { hasMx, hasSpf, dmarcStatus, dmarcPolicy };
}
/**
* Detect impersonation domains that actually receive email
* - Only runs if main domain has DMARC published
*/
async function detectImpersonations(domain) {
    const mainRecords = await checkDomainRecords(domain);

    // Skip impersonation detection if no DMARC
    if (!mainRecords.hasDmarc) {
        return {
            status: "skipped",
            detected: []
        };
    }

    const candidates = generateImpersonationCandidates(domain);
    const detected = [];

    for (const c of candidates) {
        const { hasMx } = await checkDomainRecords(c);
        if (hasMx) detected.push(c);
    }

    return {
        status: detected.length > 0 ? "risky" : "safe",
        detected
    };
}

// Export functions
module.exports = {
    generateImpersonationCandidates,
    detectImpersonations,
    checkDomainRecords
};