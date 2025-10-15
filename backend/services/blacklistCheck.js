//blacklistCheck.js

const dns = require("dns").promises;

const DNSBLS = [
    "zen.spamhaus.org",
    "bl.spamcop.net",
    "b.barracudacentral.org",
    "dnsbl.sorbs.net",
    // add more providers here
];

function reverseIp(ip) {
    return ip.split(".").reverse().join(".");
}

async function checkIpAgainstDNSBL(ip) {
    const reversed = reverseIp(ip);
    const results = [];

    for (const bl of DNSBLS) {
        const query = `${reversed}.${bl}`;
        try {
            await dns.resolve4(query);
            results.push({ blacklist: bl, listed: true });
        } catch (err) {
            results.push({ blacklist: bl, listed: false });
        }
    }

    return results;
}

module.exports = { checkIpAgainstDNSBL };
