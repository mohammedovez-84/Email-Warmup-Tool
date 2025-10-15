
const dns = require("dns").promises;

async function getMxRecords(domain) {
    try {
        const mx = await dns.resolveMx(domain);
        return mx.sort((a, b) => a.priority - b.priority);
    } catch (err) {
        return [];
    }
}

async function getSpfRecord(domain) {
    try {
        const txtRecords = await dns.resolveTxt(domain);
        const flat = txtRecords.map(r => r.join(" "));
        return flat.find(r => r.toLowerCase().startsWith("v=spf1")) || null;
    } catch {
        return null;
    }
}

async function getDmarcRecord(domain) {
    try {
        const txtRecords = await dns.resolveTxt(`_dmarc.${domain}`);
        const flat = txtRecords.map(r => r.join(" "));
        return flat.find(r => r.toLowerCase().startsWith("v=dmarc1")) || null;
    } catch {
        return null;
    }
}

async function getDkimRecord(domain, selector) {
    try {
        const txtRecords = await dns.resolveTxt(`${selector}._domainkey.${domain}`);
        const flat = txtRecords.map(r => r.join(" "));
        return flat.find(r => r.toLowerCase().includes("v=dkim1")) || null;
    } catch {
        return null;
    }
}

module.exports = { getMxRecords, getSpfRecord, getDmarcRecord, getDkimRecord };

