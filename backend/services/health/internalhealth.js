// internalhealth.js
// to call in google, microsoft or smtpimap controllers
const { getMxRecords, getSpfRecord, getDmarcRecord, getDkimRecord } = require('../dns/dnsChecks');
const { checkIpAgainstDNSBL } = require('../dns/blacklistCheck');
const { detectImpersonations } = require('../dns/domainImpersonation');

async function runHealthCheckInternal({ emails, domain, knownDomains = [] }) {
    if (!emails || emails.length === 0) throw new Error("At least one email is required");
    if (!domain) domain = emails[0].split("@")[1];

    // DNS checks
    const [mxRecords, spf, dmarc, dkim] = await Promise.all([
        getMxRecords(domain),
        getSpfRecord(domain),
        getDmarcRecord(domain),
        getDkimRecord(domain),
    ]);

    // Blacklist scan
    const ipList = mxRecords.map(mx => mx.exchange);
    const blacklistResults = [];
    for (const ip of ipList) {
        const result = await checkIpAgainstDNSBL(ip);
        blacklistResults.push({ ip, checks: result });
    }

    // Domain impersonation detection
    const detectedImpersonations = await detectImpersonations(domain);

    return {
        domain,
        mxRecords,
        spf,
        dmarc,
        dkim,
        blacklist: blacklistResults,
        detectedImpersonations,
    };
}

module.exports = { runHealthCheckInternal };
