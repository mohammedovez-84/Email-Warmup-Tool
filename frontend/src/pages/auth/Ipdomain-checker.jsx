import React, { useState } from 'react';

const IpDomainChecker = () => {
    const [input, setInput] = useState('');
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState([
        { address: 'example.com', status: 'available', type: 'domain' },
        { address: '8.8.8.8', status: 'taken', message: 'Google DNS', type: 'ip' }
    ]);

    // Enhanced sample data for demonstration
    const sampleData = {
        '8.8.8.8': {
            type: 'ip',
            // Basic Information
            address: '8.8.8.8',
            ipType: 'IPv4 Public',
            location: 'Mountain View, California, US',
            isp: 'Google LLC',

            // Network Information
            asn: 'AS15169',
            organization: 'Google LLC',
            hostname: 'dns.google',

            // Geolocation
            countryCode: 'US',
            coordinates: '37.4056° N, 122.0775° W',
            timezone: 'GMT-07:00',
            postalCode: '94043',

            // Security & Reputation
            proxyVPN: 'No',
            threatLevel: 'Low',
            blacklistStatus: 'Clean',
            abuseContact: 'network-abuse@google.com',

            // Technical Details
            networkRange: '8.8.8.0/24',
            bgpPrefix: '8.8.8.0/24',
            portStatus: {
                '22': 'Closed',
                '80': 'Open',
                '443': 'Open'
            },

            status: 'taken',
            message: 'Google Public DNS'
        },
        'example.com': {
            type: 'domain',
            // Registration Information
            address: 'example.com',
            domainStatus: 'Active',
            created: '1995-08-14',
            updated: '2023-08-14',
            expires: '2024-08-13',
            registrar: 'Example Registrar LLC',
            domainAge: '28 years',

            // DNS Records
            dnsRecords: {
                a: ['93.184.216.34'],
                aaaa: ['2606:2800:220:1:248:1893:25c8:1946'],
                mx: ['mail.example.com'],
                ns: ['ns1.example.com', 'ns2.example.com'],
                txt: ['v=spf1 include:_spf.example.com ~all'],
                cname: ['www.example.com']
            },

            // SSL Certificate
            ssl: {
                issuer: 'Let\'s Encrypt',
                validFrom: '2024-01-01',
                validTo: '2024-04-01',
                subject: 'CN=example.com',
                sans: ['example.com', 'www.example.com'],
                grade: 'A+'
            },

            // Server Information
            server: {
                webServer: 'nginx/1.18.0',
                technologies: ['HTML5', 'CSS3', 'JavaScript'],
                headers: {
                    'Server': 'nginx/1.18.0',
                    'X-Powered-By': 'PHP/7.4'
                },
                pageTitle: 'Example Domain'
            },

            // Domain Reputation
            reputation: {
                blacklistStatus: 'Clean',
                redirectChain: ['http://example.com → https://example.com'],
                seoRank: '1,234,567'
            },

            status: 'available',
            dns: 'NS1.EXAMPLE.COM, NS2.EXAMPLE.COM'
        },
        '192.168.1.1': {
            type: 'ip',
            address: '192.168.1.1',
            ipType: 'IPv4 Private',
            isp: 'Private Network',
            location: 'Local Network',
            timezone: 'N/A',
            coordinates: 'N/A',
            status: 'taken',
            message: 'Private IP Range',
            asn: 'N/A',
            organization: 'Private Network',
            hostname: 'N/A',
            countryCode: 'N/A',
            postalCode: 'N/A',
            proxyVPN: 'No',
            threatLevel: 'Low',
            blacklistStatus: 'Clean',
            abuseContact: 'N/A',
            networkRange: '192.168.0.0/16',
            bgpPrefix: 'N/A',
            portStatus: {}
        }
    };

    // Function to validate IP address
    const isValidIP = (ip) => {
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        return ipRegex.test(ip);
    };

    // Function to validate domain name
    const isValidDomain = (domain) => {
        const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
        return domainRegex.test(domain);
    };

    const handleCheck = () => {
        if (!input.trim()) {
            setResults({
                type: 'error',
                message: 'Please enter an IP address or domain name'
            });
            return;
        }

        // Validate input
        const trimmedInput = input.trim();
        const isIP = isValidIP(trimmedInput);
        const isDomain = isValidDomain(trimmedInput);

        if (!isIP && !isDomain) {
            setResults({
                type: 'error',
                message: 'Please enter a valid IP address or domain name'
            });
            return;
        }

        setLoading(true);

        // Simulate API call with timeout
        setTimeout(() => {
            let result;

            // Check if input is in sample data
            if (sampleData[trimmedInput]) {
                result = sampleData[trimmedInput];
            } else {
                // Generate enhanced random result for demonstration
                if (isIP) {
                    result = {
                        type: 'ip',
                        address: trimmedInput,
                        ipType: 'IPv4 Public',
                        location: `City ${Math.floor(Math.random() * 100)}, Country`,
                        isp: `ISP ${Math.floor(Math.random() * 1000)}`,
                        asn: `AS${Math.floor(Math.random() * 100000)}`,
                        organization: `Organization ${Math.floor(Math.random() * 100)}`,
                        hostname: `host-${Math.floor(Math.random() * 1000)}.com`,
                        countryCode: 'US',
                        coordinates: `${Math.floor(Math.random() * 90)}° N, ${Math.floor(Math.random() * 180)}° W`,
                        timezone: `GMT${Math.random() > 0.5 ? '+' : '-'}${Math.floor(Math.random() * 12)}`,
                        postalCode: `${Math.floor(Math.random() * 90000) + 10000}`,
                        proxyVPN: Math.random() > 0.8 ? 'Yes' : 'No',
                        threatLevel: ['Low', 'Medium', 'High'][Math.floor(Math.random() * 3)],
                        blacklistStatus: Math.random() > 0.2 ? 'Clean' : 'Listed',
                        abuseContact: `abuse@isp${Math.floor(Math.random() * 100)}.com`,
                        networkRange: `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.0.0/24`,
                        bgpPrefix: `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.0.0/24`,
                        portStatus: {
                            '22': Math.random() > 0.5 ? 'Open' : 'Closed',
                            '80': Math.random() > 0.3 ? 'Open' : 'Closed',
                            '443': Math.random() > 0.3 ? 'Open' : 'Closed'
                        },
                        status: Math.random() > 0.5 ? 'available' : 'taken',
                        message: 'Simulated result for demonstration'
                    };
                } else {
                    result = {
                        type: 'domain',
                        address: trimmedInput,
                        domainStatus: 'Active',
                        created: '2020-01-01',
                        updated: '2023-01-01',
                        expires: '2025-01-01',
                        registrar: 'Registrar ' + Math.floor(Math.random() * 1000),
                        domainAge: Math.floor(Math.random() * 10) + 1 + ' years',
                        dnsRecords: {
                            a: [`${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`],
                            aaaa: ['2606:2800:220:1:248:1893:25c8:1946'],
                            mx: [`mail.${trimmedInput}`],
                            ns: [`ns1.${trimmedInput}`, `ns2.${trimmedInput}`],
                            txt: ['v=spf1 include:_spf.example.com ~all'],
                            cname: [`www.${trimmedInput}`]
                        },
                        ssl: {
                            issuer: 'Let\'s Encrypt',
                            validFrom: '2024-01-01',
                            validTo: '2024-12-31',
                            subject: `CN=${trimmedInput}`,
                            sans: [trimmedInput, `www.${trimmedInput}`],
                            grade: ['A+', 'A', 'B', 'C'][Math.floor(Math.random() * 4)]
                        },
                        server: {
                            webServer: 'nginx/1.18.0',
                            technologies: ['HTML5', 'CSS3', 'JavaScript', 'React'],
                            headers: {
                                'Server': 'nginx/1.18.0',
                                'X-Powered-By': 'PHP/7.4'
                            },
                            pageTitle: trimmedInput.charAt(0).toUpperCase() + trimmedInput.slice(1)
                        },
                        reputation: {
                            blacklistStatus: Math.random() > 0.2 ? 'Clean' : 'Listed',
                            redirectChain: [`http://${trimmedInput} → https://${trimmedInput}`],
                            seoRank: Math.floor(Math.random() * 10000000).toLocaleString()
                        },
                        status: Math.random() > 0.5 ? 'available' : 'taken',
                        message: 'Simulated result for demonstration'
                    };
                }
            }

            setResults(result);
            setLoading(false);

            // Add to history only if it's a valid result (not error)
            if (result.type !== 'error') {
                setHistory(prevHistory => {
                    const newHistory = [{ ...result }, ...prevHistory];
                    // Keep only the last 5 history items
                    return newHistory.slice(0, 5);
                });
            }
        }, 1500);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleCheck();
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-white via-white to-white text-black flex justify-center items-center p-5 font-['Segoe_UI',_Tahoma,_Geneva,_Verdana,_sans-serif]">
            <div className="w-full max-w-full mx-4 bg-[rgba(6,42,90,0.08)] backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-[rgba(255,255,255,0.1)]">
                <header className="text-center mb-8">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-black to-black bg-clip-text text-transparent mb-3">
                        <i className="fas fa-search mr-3"></i> IP Domain Checker
                    </h1>
                    <p className="text-[#141313] text-lg">Check IP addresses and domain availability quickly and easily</p>
                </header>

                <div className="flex mb-6">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Enter IP address or domain name (e.g., 8.8.8.8 or example.com)"
                        className="flex-1 px-5 py-4 border-none rounded-l-full bg-white text-black text-base outline-none shadow-lg border border-gray-200"
                        disabled={loading}
                    />
                    <button
                        onClick={handleCheck}
                        disabled={loading}
                        className={`px-6 py-4 border-none rounded-r-full font-semibold transition-all duration-300 ${loading
                                ? 'bg-gradient-to-r from-teal-800 to-teal-600 text-white shadow-lg opacity-70 cursor-not-allowed'
                                : 'bg-gradient-to-r from-teal-800 to-teal-600 text-white shadow-lg hover:opacity-90 hover:-translate-y-1 cursor-pointer'
                            }`}
                    >
                        {loading ? 'Checking...' : 'Check Now'}
                    </button>
                </div>

                <div className="bg-white border-t-7 border-teal-800 rounded-t-2xl p-6 mt-16">
                    <h2 className="text-2xl text-teal-800 mb-4 flex items-center gap-3">
                        <i className="fas fa-info-circle"></i> Results
                    </h2>
                    <div>
                        {loading ? (
                            <div className="text-center py-8 text-black text-xl">
                                <i className="fas fa-spinner animate-spin mr-3"></i> Checking {input}...
                            </div>
                        ) : results ? (
                            results.type === 'error' ? (
                                // Error message display
                                <div className="text-center py-8">
                                    <div className="bg-red-50 border border-red-200 rounded-2xl p-6 max-w-md mx-auto">
                                        <i className="fas fa-exclamation-triangle text-red-500 text-4xl mb-4"></i>
                                        <h3 className="text-red-800 text-xl font-semibold mb-2">Invalid Input</h3>
                                        <p className="text-red-600">{results.message}</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {results.type === 'ip' ? (
                                        <>
                                            {/* Basic Information */}
                                            <div className="bg-gray-50 p-6 rounded-2xl transition-transform duration-300 hover:translate-y-[-2px]">
                                                <h3 className="text-black mb-4 text-xl flex items-center gap-3 -ml-3 font-bold">
                                                    <i className="fas fa-info-circle"></i> Basic Information
                                                </h3>
                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-black font-normal">IP Address:</span>
                                                        <span className="text-teal-600 font-semibold">{results.address}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-black font-normal">IP Type:</span>
                                                        <span className="text-teal-600 font-semibold">{results.ipType}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-black font-normal">Location:</span>
                                                        <span className="text-teal-600 font-semibold text-right max-w-[60%] break-words">{results.location}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-black font-normal">ISP:</span>
                                                        <span className="text-teal-600 font-semibold text-right max-w-[60%] break-words">{results.isp}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Network Information */}
                                            <div className="bg-gray-50 p-6 rounded-2xl transition-transform duration-300 hover:translate-y-[-2px]">
                                                <h3 className="text-black mb-4 text-xl flex items-center gap-3 -ml-3 font-bold">
                                                    <i className="fas fa-sitemap"></i> Network Information
                                                </h3>
                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-black font-normal">ASN:</span>
                                                        <span className="text-teal-600 font-semibold">{results.asn}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-black font-normal">Organization:</span>
                                                        <span className="text-teal-600 font-semibold text-right max-w-[60%] break-words">{results.organization}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-black font-normal">Hostname:</span>
                                                        <span className="text-teal-600 font-semibold">{results.hostname}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Geolocation */}
                                            <div className="bg-gray-50 p-6 rounded-2xl transition-transform duration-300 hover:translate-y-[-2px]">
                                                <h3 className="text-black mb-4 text-xl flex items-center gap-3 -ml-3 font-bold">
                                                    <i className="fas fa-globe-americas"></i> Geolocation
                                                </h3>
                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-black font-normal">Country Code:</span>
                                                        <span className="text-teal-600 font-semibold">{results.countryCode}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-black font-normal">Coordinates:</span>
                                                        <span className="text-teal-600 font-semibold">{results.coordinates}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-black font-normal">Timezone:</span>
                                                        <span className="text-teal-600 font-semibold">{results.timezone}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-black font-normal">Postal Code:</span>
                                                        <span className="text-teal-600 font-semibold">{results.postalCode}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Security & Reputation */}
                                            <div className="bg-gray-50 p-6 rounded-2xl transition-transform duration-300 hover:translate-y-[-2px]">
                                                <h3 className="text-black mb-4 text-xl flex items-center gap-3 -ml-3 font-bold">
                                                    <i className="fas fa-shield-alt"></i> Security & Reputation
                                                </h3>
                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-black font-normal">Proxy/VPN:</span>
                                                        <span className={`font-semibold ${results.proxyVPN === 'No' ? 'text-green-600' : 'text-red-600'}`}>
                                                            {results.proxyVPN}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-black font-normal">Threat Level:</span>
                                                        <span className={`font-semibold ${results.threatLevel === 'Low' ? 'text-green-600' :
                                                                results.threatLevel === 'Medium' ? 'text-yellow-600' : 'text-red-600'
                                                            }`}>
                                                            {results.threatLevel}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-black font-normal">Blacklist Status:</span>
                                                        <span className={`font-semibold ${results.blacklistStatus === 'Clean' ? 'text-green-600' : 'text-red-600'}`}>
                                                            {results.blacklistStatus}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-black font-normal">Abuse Contact:</span>
                                                        <span className="text-teal-600 font-semibold text-right max-w-[60%] break-words">{results.abuseContact}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Technical Details */}
                                            <div className="bg-gray-50 p-6 rounded-2xl transition-transform duration-300 hover:translate-y-[-2px]">
                                                <h3 className="text-black mb-4 text-xl flex items-center gap-3 -ml-3 font-bold">
                                                    <i className="fas fa-cogs"></i> Technical Details
                                                </h3>
                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-black font-normal">Network Range:</span>
                                                        <span className="text-teal-600 font-semibold">{results.networkRange}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-black font-normal">BGP Prefix:</span>
                                                        <span className="text-teal-600 font-semibold">{results.bgpPrefix}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-black font-normal">Port Status:</span>
                                                        <div className="text-right">
                                                            {Object.entries(results.portStatus || {}).map(([port, status]) => (
                                                                <div key={port} className="text-teal-600 font-semibold">
                                                                    Port {port}: <span className={status === 'Open' ? 'text-green-600' : 'text-red-600'}>{status}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Status */}
                                            <div className="bg-gray-50 p-6 rounded-2xl transition-transform duration-300 hover:translate-y-[-2px]">
                                                <h3 className="text-black mb-4 text-xl flex items-center gap-3 -ml-3 font-bold">
                                                    <i className="fas fa-check-circle"></i> Status
                                                </h3>
                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-black font-normal">Availability:</span>
                                                        <span className={`inline-block px-3 py-1 rounded-2xl text-sm font-semibold ${results.status === 'available'
                                                                ? 'bg-green-100 text-green-800'
                                                                : 'bg-red-100 text-red-800'
                                                            }`}>
                                                            {results.status === 'available' ? 'Available' : (results.message || 'Taken')}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-black font-normal">Response Time:</span>
                                                        <span className="text-teal-600 font-semibold">{Math.floor(Math.random() * 100)} ms</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            {/* Domain Registration */}
                                            <div className="bg-gray-50 p-6 rounded-2xl transition-transform duration-300 hover:translate-y-[-2px]">
                                                <h3 className="text-black mb-4 text-xl flex items-center gap-3 -ml-3 font-bold">
                                                    <i className="fas fa-globe"></i> Registration Information
                                                </h3>
                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-black font-normal">Domain:</span>
                                                        <span className="text-teal-600 font-semibold">{results.address}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-black font-normal">Status:</span>
                                                        <span className="text-teal-600 font-semibold">{results.domainStatus}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-black font-normal">Registrar:</span>
                                                        <span className="text-teal-600 font-semibold text-right max-w-[60%] break-words">{results.registrar}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-black font-normal">Created:</span>
                                                        <span className="text-teal-600 font-semibold">{results.created}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-black font-normal">Updated:</span>
                                                        <span className="text-teal-600 font-semibold">{results.updated}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-black font-normal">Expires:</span>
                                                        <span className="text-teal-600 font-semibold">{results.expires}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-black font-normal">Domain Age:</span>
                                                        <span className="text-teal-600 font-semibold">{results.domainAge}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* DNS Records */}
                                            <div className="bg-gray-50 p-6 rounded-2xl transition-transform duration-300 hover:translate-y-[-2px]">
                                                <h3 className="text-black mb-4 text-xl flex items-center gap-3 -ml-3 font-bold">
                                                    <i className="fas fa-server"></i> DNS Records
                                                </h3>
                                                <div className="space-y-3">
                                                    {Object.entries(results.dnsRecords || {}).map(([type, records]) => (
                                                        <div key={type} className="flex justify-between items-start">
                                                            <span className="text-black font-normal">{type.toUpperCase()} Records:</span>
                                                            <div className="text-right max-w-[60%]">
                                                                {records.map((record, idx) => (
                                                                    <div key={idx} className="text-teal-600 font-semibold break-words">
                                                                        {record}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* SSL Certificate */}
                                            <div className="bg-gray-50 p-6 rounded-2xl transition-transform duration-300 hover:translate-y-[-2px]">
                                                <h3 className="text-black mb-4 text-xl flex items-center gap-3 -ml-3 font-bold">
                                                    <i className="fas fa-lock"></i> SSL Certificate
                                                </h3>
                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-black font-normal">Issuer:</span>
                                                        <span className="text-teal-600 font-semibold text-right max-w-[60%] break-words">{results.ssl?.issuer}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-black font-normal">Valid From:</span>
                                                        <span className="text-teal-600 font-semibold">{results.ssl?.validFrom}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-black font-normal">Valid To:</span>
                                                        <span className="text-teal-600 font-semibold">{results.ssl?.validTo}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-black font-normal">Subject:</span>
                                                        <span className="text-teal-600 font-semibold text-right max-w-[60%] break-words">{results.ssl?.subject}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-black font-normal">SSL Grade:</span>
                                                        <span className={`font-semibold ${results.ssl?.grade === 'A+' ? 'text-green-600' :
                                                                results.ssl?.grade === 'A' ? 'text-green-500' :
                                                                    results.ssl?.grade === 'B' ? 'text-yellow-600' : 'text-red-600'
                                                            }`}>
                                                            {results.ssl?.grade}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Server Information */}
                                            <div className="bg-gray-50 p-6 rounded-2xl transition-transform duration-300 hover:translate-y-[-2px]">
                                                <h3 className="text-black mb-4 text-xl flex items-center gap-3 -ml-3 font-bold">
                                                    <i className="fas fa-desktop"></i> Server Information
                                                </h3>
                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-black font-normal">Web Server:</span>
                                                        <span className="text-teal-600 font-semibold">{results.server?.webServer}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-black font-normal">Page Title:</span>
                                                        <span className="text-teal-600 font-semibold text-right max-w-[60%] break-words">{results.server?.pageTitle}</span>
                                                    </div>
                                                    <div className="flex justify-between items-start">
                                                        <span className="text-black font-normal">Technologies:</span>
                                                        <div className="text-right max-w-[60%]">
                                                            {results.server?.technologies?.map((tech, idx) => (
                                                                <div key={idx} className="text-teal-600 font-semibold">
                                                                    {tech}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Domain Reputation */}
                                            <div className="bg-gray-50 p-6 rounded-2xl transition-transform duration-300 hover:translate-y-[-2px]">
                                                <h3 className="text-black mb-4 text-xl flex items-center gap-3 -ml-3 font-bold">
                                                    <i className="fas fa-chart-line"></i> Domain Reputation
                                                </h3>
                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-black font-normal">Blacklist Status:</span>
                                                        <span className={`font-semibold ${results.reputation?.blacklistStatus === 'Clean' ? 'text-green-600' : 'text-red-600'}`}>
                                                            {results.reputation?.blacklistStatus}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-black font-normal">SEO Rank:</span>
                                                        <span className="text-teal-600 font-semibold">{results.reputation?.seoRank}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Status */}
                                            <div className="bg-gray-50 p-6 rounded-2xl transition-transform duration-300 hover:translate-y-[-2px]">
                                                <h3 className="text-black mb-4 text-xl flex items-center gap-3 -ml-3 font-bold">
                                                    <i className="fas fa-check-circle"></i> Status
                                                </h3>
                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-black font-normal">Availability:</span>
                                                        <span className={`inline-block px-3 py-1 rounded-2xl text-sm font-semibold ${results.status === 'available'
                                                                ? 'bg-green-100 text-green-800'
                                                                : 'bg-red-100 text-red-800'
                                                            }`}>
                                                            {results.status === 'available' ? 'Available' : (results.message || 'Taken')}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-black font-normal">Response Time:</span>
                                                        <span className="text-teal-600 font-semibold">{Math.floor(Math.random() * 100)} ms</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )
                        ) : (
                            <div className="text-center py-8 text-black text-xl">
                                {/* <i className="fas fa-info-circle mr-3"></i> Enter an IP or domain to check */}
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-8">
                    <h2 className="text-2xl text-[#4facfe] mb-4 flex items-center gap-3">
                        <i className="fas fa-history"></i> Recent Checks
                    </h2>
                    <div>
                        {history.map((item, index) => (
                            <div key={index} className="flex justify-between px-4 py-3 bg-[rgba(255,255,255,0.05)] rounded-xl mb-3 items-center">
                                <span className="font-semibold">{item.address}</span>
                                <span className={`text-sm px-3 py-1 rounded-2xl ${item.status === 'available'
                                        ? 'bg-[rgba(76,175,80,0.2)] text-[#4caf50]'
                                        : 'bg-[rgba(244,67,54,0.2)] text-[#f44336]'
                                    }`}>
                                    {item.status === 'available' ? 'Available' : (item.message || 'Taken')}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IpDomainChecker;