import React, { useState, useEffect } from 'react';

const IpDomainChecker = () => {
    const [input, setInput] = useState('');
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState([]);

    // Typing animation states
    const [inputPlaceholder, setInputPlaceholder] = useState('');
    const [placeholderIndex, setPlaceholderIndex] = useState(0);
    const [isDeleting, setIsDeleting] = useState(false);
    const [placeholderText, setPlaceholderText] = useState("");

    // Load history from localStorage on component mount
    useEffect(() => {
        const savedHistory = localStorage.getItem('ipDomainCheckHistory');
        if (savedHistory) {
            setHistory(JSON.parse(savedHistory));
        } else {
            // Set default history only if no saved history exists
            setHistory([
                { address: 'example.com', status: 'available', type: 'domain' },
                { address: '8.8.8.8', status: 'taken', message: 'Google DNS', type: 'ip' }
            ]);
        }
    }, []);

    // Save history to localStorage whenever history changes
    useEffect(() => {
        localStorage.setItem('ipDomainCheckHistory', JSON.stringify(history));
    }, [history]);

    // Set responsive placeholder text based on screen size
    useEffect(() => {
        const updatePlaceholder = () => {
            const width = window.innerWidth;
            if (width < 640) { // sm breakpoint
                setPlaceholderText("Enter IP or domain");
            } else if (width < 768) { // md breakpoint  
                setPlaceholderText("Enter IP or domain name");
            } else if (width < 1024) { // lg breakpoint
                setPlaceholderText("Enter IP address or domain");
            } else {
                setPlaceholderText("Enter IP address or domain name (e.g., 8.8.8.8 or example.com)");
            }
        };

        updatePlaceholder();
        window.addEventListener('resize', updatePlaceholder);
        return () => window.removeEventListener('resize', updatePlaceholder);
    }, []);

    // Typing animation effect
    useEffect(() => {
        if (!placeholderText) return;
        
        const typeText = () => {
            if (isDeleting) {
                setInputPlaceholder(placeholderText.substring(0, placeholderIndex - 1));
                setPlaceholderIndex(prev => prev - 1);
                
                if (placeholderIndex === 1) {
                    setIsDeleting(false);
                }
            } else {
                setInputPlaceholder(placeholderText.substring(0, placeholderIndex + 1));
                setPlaceholderIndex(prev => prev + 1);
                
                if (placeholderIndex === placeholderText.length) {
                    setTimeout(() => setIsDeleting(true), 1000);
                }
            }
        };

        const timer = setTimeout(typeText, isDeleting ? 10 : 30);
        return () => clearTimeout(timer);
    }, [placeholderIndex, isDeleting, placeholderText]);

    // Enhanced sample data for demonstration
    const sampleData = {
        '8.8.8.8': {
            type: 'ip',
            address: '8.8.8.8',
            ipType: 'IPv4 Public',
            location: 'Mountain View, California, US',
            isp: 'Google LLC',
            asn: 'AS15169',
            organization: 'Google LLC',
            hostname: 'dns.google',
            countryCode: 'US',
            coordinates: '37.4056° N, 122.0775° W',
            timezone: 'GMT-07:00',
            postalCode: '94043',
            proxyVPN: 'No',
            threatLevel: 'Low',
            blacklistStatus: 'Clean',
            abuseContact: 'network-abuse@google.com',
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
            address: 'example.com',
            domainStatus: 'Active',
            created: '1995-08-14',
            updated: '2023-08-14',
            expires: '2024-08-13',
            registrar: 'Example Registrar LLC',
            domainAge: '28 years',
            dnsRecords: {
                a: ['93.184.216.34'],
                aaaa: ['2606:2800:220:1:248:1893:25c8:1946'],
                mx: ['mail.example.com'],
                ns: ['ns1.example.com', 'ns2.example.com'],
                txt: ['v=spf1 include:_spf.example.com ~all'],
                cname: ['www.example.com']
            },
            ssl: {
                issuer: 'Let\'s Encrypt',
                validFrom: '2024-01-01',
                validTo: '2024-04-01',
                subject: 'CN=example.com',
                sans: ['example.com', 'www.example.com'],
                grade: 'A+'
            },
            server: {
                webServer: 'nginx/1.18.0',
                technologies: ['HTML5', 'CSS3', 'JavaScript'],
                headers: {
                    'Server': 'nginx/1.18.0',
                    'X-Powered-By': 'PHP/7.4'
                },
                pageTitle: 'Example Domain'
            },
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

        setTimeout(() => {
            let result;

            if (sampleData[trimmedInput]) {
                result = sampleData[trimmedInput];
            } else {
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

            if (result.type !== 'error') {
                setHistory(prevHistory => {
                    // Create a simple history item with only the needed data
                    const newHistoryItem = {
                        address: result.address,
                        status: result.status,
                        type: result.type,
                        message: result.message
                    };
                    
                    // Remove if already exists and add to beginning
                    const filteredHistory = prevHistory.filter(item => item.address !== result.address);
                    const newHistory = [newHistoryItem, ...filteredHistory];
                    
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

    const clearHistory = () => {
        setHistory([]);
        // Also remove from localStorage
        localStorage.removeItem('ipDomainCheckHistory');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 text-gray-900 p-4 sm:p-6 font-['Inter',_'Roboto',_-apple-system,_BlinkMacSystemFont,_'Segoe_UI',_sans-serif]">
            {/* Header Section - Extra Wide */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 sm:p-6 mb-6 sm:mb-8 w-full">
                <div className="text-center">
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-700 mb-3 sm:mb-4">
                        <i className="fas fa-shield-alt mr-2 sm:mr-3 text-teal-600 text-xl sm:text-2xl lg:text-3xl"></i> 
                        IP Domain Checker
                    </h1>
                    <p className="text-gray-600 text-sm sm:text-base lg:text-lg">
                        Get detailed insights for any IP address or domain name.
                    </p>
                    
                    {/* Stats Grid - Option 4 with Icons */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 p-4 bg-gradient-to-br from-teal-50 via-teal-50 to-cyan-50 border border-teal-100 rounded-xl">
    <div className="group relative text-center p-4 bg-gradient-to-br from-white to-slate-50 rounded-xl border border-slate-200 shadow-lg hover:shadow-xl hover:border-blue-300 hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        <div className="relative z-10">
            <i className="fas fa-chart-bar text-blue-500 text-xl mb-2"></i>
            <div className="text-2xl font-bold font-mono bg-gradient-to-br from-slate-800 to-slate-600 bg-clip-text text-transparent mb-1">1,247</div>
            <div className="text-xs font-semibold text-slate-600 tracking-wide">Total Checks</div>
            <div className="absolute bottom--9 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-cyan-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left rounded-b-xl"></div>
        </div>
    </div>
    
    <div className="group relative text-center p-4 bg-gradient-to-br from-white to-slate-50 rounded-xl border border-slate-200 shadow-lg hover:shadow-xl hover:border-emerald-300 hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        <div className="relative z-10">
            <i className="fas fa-check-circle text-emerald-500 text-xl mb-2"></i>
            <div className="text-2xl font-bold font-mono bg-gradient-to-br from-emerald-700 to-teal-600 bg-clip-text text-transparent mb-1">84%</div>
            <div className="text-xs font-semibold text-slate-600 tracking-wide">Success Rate</div>
            <div className="absolute bottom--9 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left rounded-b-xl"></div>
        </div>
    </div>
    
    <div className="group relative text-center p-4 bg-gradient-to-br from-white to-slate-50 rounded-xl border border-slate-200 shadow-lg hover:shadow-xl hover:border-purple-300 hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        <div className="relative z-10">
            <i className="fas fa-network-wired text-purple-500 text-xl mb-2"></i>
            <div className="text-2xl font-bold font-mono bg-gradient-to-br from-purple-700 to-indigo-600 bg-clip-text text-transparent mb-1">563</div>
            <div className="text-xs font-semibold text-slate-600 tracking-wide">IP Checks</div>
            <div className="absolute bottom--9 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-indigo-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left rounded-b-xl"></div>
        </div>
    </div>
    
    <div className="group relative text-center p-4 bg-gradient-to-br from-white to-slate-50 rounded-xl border border-slate-200 shadow-lg hover:shadow-xl hover:border-orange-300 hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        <div className="relative z-10">
            <i className="fas fa-globe text-orange-500 text-xl mb-2"></i>
            <div className="text-2xl font-bold font-mono bg-gradient-to-br from-orange-700 to-amber-600 bg-clip-text text-transparent mb-1">684</div>
            <div className="text-xs font-semibold text-slate-600 tracking-wide">Domain Checks</div>
            <div className="absolute bottom--9 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-500 to-amber-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left rounded-b-xl"></div>
        </div>
    </div>
</div>
                </div>
            </div>

            {/* Input Section - Extra Wide */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 sm:p-6 mb-6 sm:mb-8 w-full">
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                    <div className="flex-1">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder={inputPlaceholder}
                            className="w-full px-4 sm:px-6 py-3 sm:py-4 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm sm:text-base outline-none focus:border-teal-500 focus:ring-2 sm:focus:ring-4 focus:ring-teal-100 transition-all"
                            disabled={loading}
                        />
                    </div>
                    <button
                        onClick={handleCheck}
                        disabled={loading}
                        className={`px-4 sm:px-8 py-3 sm:py-4 border-none rounded-xl font-semibold text-sm sm:text-lg transition-all duration-300 min-w-[120px] sm:min-w-[160px] ${loading
                                ? 'bg-gradient-to-r from-teal-400 to-teal-500 text-white shadow-md opacity-70 cursor-not-allowed'
                                : 'bg-gradient-to-r from-teal-600 to-teal-700 text-white shadow-md hover:from-teal-700 hover:to-teal-800 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer'
                            }`}
                    >
                        {loading ? (
                            <span className="flex items-center justify-center text-xs sm:text-base">
                                <i className="fas fa-spinner animate-spin mr-2"></i>
                                Checking...
                            </span>
                        ) : (
                            <span className="flex items-center justify-center text-xs sm:text-base">
                                <i className="fas fa-search mr-2"></i>
                                Check Now
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Results Section - Extra Wide */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-6 sm:mb-8 w-full">
                <div className="border-b border-gray-200 bg-gradient-to-r from-teal-50 to-teal-100 px-4 sm:px-6 py-4 sm:py-5">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-700 flex items-center gap-3">
                        <i className="fas fa-history text-teal-600 text-xl"></i>
                        Analysis Results
                    </h2>
                </div>
                
                <div className="p-4 sm:p-6">
                    {loading ? (
                        <div className="text-center py-8">
                            <div className="flex flex-col items-center justify-center">
                                <i className="fas fa-spinner animate-spin text-4xl text-teal-600 mb-4"></i>
                                <p className="text-gray-700 text-xl font-medium">Analyzing {input}...</p>
                                <p className="text-gray-500 text-base mt-2">This may take a few moments</p>
                            </div>
                        </div>
                    ) : results ? (
                        results.type === 'error' ? (
                            <div className="text-center py-8">
                                <div className="bg-red-50 border border-red-200 rounded-xl p-6 sm:p-8 max-w-md mx-auto">
                                    <i className="fas fa-exclamation-triangle text-red-500 text-4xl sm:text-5xl mb-4"></i>
                                    <h3 className="text-red-800 text-lg sm:text-xl font-semibold mb-3">Invalid Input</h3>
                                    <p className="text-red-600 text-sm sm:text-base">{results.message}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4 sm:gap-6">
                                {results.type === 'ip' ? (
                                    <>
                                        {/* Basic Information */}
                                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 sm:p-6 hover:shadow-md transition-all duration-300">
                                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2 -ml-2">
                                                <i className="fas fa-info-circle text-teal-600 text-base"></i>
                                                Basic Information
                                            </h3>
                                            <div className="space-y-3">
                                                <FixedInfoRow label="IP Address" value={results.address} />
                                                <FixedInfoRow label="IP Type" value={results.ipType} />
                                                <FixedInfoRow label="Location" value={results.location} />
                                                <FixedInfoRow label="ISP" value={results.isp} />
                                            </div>
                                        </div>

                                        {/* Network Information */}
                                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 sm:p-6 hover:shadow-md transition-all duration-300">
                                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2 -ml-2">
                                                <i className="fas fa-sitemap text-teal-600 text-base"></i>
                                                Network Information
                                            </h3>
                                            <div className="space-y-3">
                                                <FixedInfoRow label="ASN" value={results.asn} />
                                                <FixedInfoRow label="Organization" value={results.organization} />
                                                <FixedInfoRow label="Hostname" value={results.hostname} />
                                            </div>
                                        </div>

                                        {/* Geolocation */}
                                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 sm:p-6 hover:shadow-md transition-all duration-300">
                                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2 -ml-2">
                                                <i className="fas fa-globe-americas text-teal-600 text-base"></i>
                                                Geolocation
                                            </h3>
                                            <div className="space-y-3">
                                                <FixedInfoRow label="Country Code" value={results.countryCode} />
                                                <FixedInfoRow label="Coordinates" value={results.coordinates} />
                                                <FixedInfoRow label="Timezone" value={results.timezone} />
                                                <FixedInfoRow label="Postal Code" value={results.postalCode} />
                                            </div>
                                        </div>

                                        {/* Security & Reputation */}
                                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 sm:p-6 hover:shadow-md transition-all duration-300">
                                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2 -ml-2">
                                                <i className="fas fa-shield-alt text-teal-600 text-base"></i>
                                                Security & Reputation
                                            </h3>
                                            <div className="space-y-3">
                                                <FixedStatusRow 
                                                    label="Proxy/VPN" 
                                                    value={results.proxyVPN} 
                                                    isGood={results.proxyVPN === 'No'} 
                                                />
                                                <FixedStatusRow 
                                                    label="Threat Level" 
                                                    value={results.threatLevel} 
                                                    isGood={results.threatLevel === 'Low'} 
                                                    isWarning={results.threatLevel === 'Medium'}
                                                />
                                                <FixedStatusRow 
                                                    label="Blacklist Status" 
                                                    value={results.blacklistStatus} 
                                                    isGood={results.blacklistStatus === 'Clean'} 
                                                />
                                                <FixedInfoRow label="Abuse Contact" value={results.abuseContact} />
                                            </div>
                                        </div>

                                        {/* Technical Details */}
                                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 sm:p-6 hover:shadow-md transition-all duration-300">
                                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2 -ml-2">
                                                <i className="fas fa-cogs text-teal-600 text-base"></i>
                                                Technical Details
                                            </h3>
                                            <div className="space-y-3">
                                                <FixedInfoRow label="Network Range" value={results.networkRange} />
                                                <FixedInfoRow label="BGP Prefix" value={results.bgpPrefix} />
                                                <div className="flex justify-between items-center">
                                                    <span className="text-gray-600 font-medium text-base">Port Status:</span>
                                                    <div className="text-right">
                                                        {Object.entries(results.portStatus || {}).map(([port, status]) => (
                                                            <div key={port} className="text-sm">
                                                                Port {port}: <span className={`font-medium ${status === 'Open' ? 'text-teal-600' : 'text-red-600'}`}>
                                                                    {status}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Status */}
                                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 sm:p-6 hover:shadow-md transition-all duration-300">
                                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2 -ml-2">
                                                <i className="fas fa-check-circle text-teal-600 text-base"></i>
                                                Status
                                            </h3>
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-gray-600 font-medium text-base">Availability:</span>
                                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${results.status === 'available'
                                                            ? 'bg-teal-100 text-teal-800 border border-teal-200'
                                                            : 'bg-red-100 text-red-800 border border-red-200'
                                                        }`}>
                                                        {results.status === 'available' ? 'Available' : (results.message || 'Taken')}
                                                    </span>
                                                </div>
                                                <FixedInfoRow label="Response Time" value="42 ms" />
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {/* Domain Registration */}
                                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 sm:p-6 hover:shadow-md transition-all duration-300">
                                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2 -ml-2">
                                                <i className="fas fa-globe text-teal-600 text-base"></i>
                                                Registration Information
                                            </h3>
                                            <div className="space-y-3">
                                                <FixedInfoRow label="Domain" value={results.address} />
                                                <FixedInfoRow label="Status" value={results.domainStatus} />
                                                <FixedInfoRow label="Registrar" value={results.registrar} />
                                                <FixedInfoRow label="Created" value={results.created} />
                                                <FixedInfoRow label="Updated" value={results.updated} />
                                                <FixedInfoRow label="Expires" value={results.expires} />
                                                <FixedInfoRow label="Domain Age" value={results.domainAge} />
                                            </div>
                                        </div>

                                        {/* DNS Records */}
                                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 sm:p-6 hover:shadow-md transition-all duration-300">
                                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2 -ml-2">
                                                <i className="fas fa-server text-teal-600 text-base"></i>
                                                DNS Records
                                            </h3>
                                            <div className="space-y-3">
                                                {Object.entries(results.dnsRecords || {}).map(([type, records]) => (
                                                    <div key={type} className="flex justify-between items-start">
                                                        <span className="text-gray-600 font-medium text-base">{type.toUpperCase()} Records:</span>
                                                        <div className="text-right">
                                                            {records.map((record, idx) => (
                                                                <div key={idx} className="text-teal-600 font-medium text-sm break-words">
                                                                    {record}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* SSL Certificate */}
                                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 sm:p-6 hover:shadow-md transition-all duration-300">
                                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2 -ml-2">
                                                <i className="fas fa-lock text-teal-600 text-base"></i>
                                                SSL Certificate
                                            </h3>
                                            <div className="space-y-3">
                                                <FixedInfoRow label="Issuer" value={results.ssl?.issuer} />
                                                <FixedInfoRow label="Valid From" value={results.ssl?.validFrom} />
                                                <FixedInfoRow label="Valid To" value={results.ssl?.validTo} />
                                                <FixedInfoRow label="Subject" value={results.ssl?.subject} />
                                                <FixedStatusRow 
                                                    label="SSL Grade" 
                                                    value={results.ssl?.grade} 
                                                    isGood={results.ssl?.grade === 'A+' || results.ssl?.grade === 'A'}
                                                    isWarning={results.ssl?.grade === 'B'}
                                                />
                                            </div>
                                        </div>

                                        {/* Server Information */}
                                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 sm:p-6 hover:shadow-md transition-all duration-300">
                                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2 -ml-2">
                                                <i className="fas fa-desktop text-teal-600 text-base"></i>
                                                Server Information
                                            </h3>
                                            <div className="space-y-3">
                                                <FixedInfoRow label="Web Server" value={results.server?.webServer} />
                                                <FixedInfoRow label="Page Title" value={results.server?.pageTitle} />
                                                <div className="flex justify-between items-start">
                                                    <span className="text-gray-600 font-medium text-base">Technologies:</span>
                                                    <div className="text-right">
                                                        {results.server?.technologies?.map((tech, idx) => (
                                                            <div key={idx} className="text-teal-600 font-medium text-sm">
                                                                {tech}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Domain Reputation */}
                                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 sm:p-6 hover:shadow-md transition-all duration-300">
                                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2 -ml-2">
                                                <i className="fas fa-chart-line text-teal-600 text-base"></i>
                                                Domain Reputation
                                            </h3>
                                            <div className="space-y-3">
                                                <FixedStatusRow 
                                                    label="Blacklist Status" 
                                                    value={results.reputation?.blacklistStatus} 
                                                    isGood={results.reputation?.blacklistStatus === 'Clean'} 
                                                />
                                                <FixedInfoRow label="SEO Rank" value={results.reputation?.seoRank} />
                                            </div>
                                        </div>

                                        {/* Status */}
                                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 sm:p-6 hover:shadow-md transition-all duration-300">
                                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2 -ml-2">
                                                <i className="fas fa-check-circle text-teal-600 text-base"></i>
                                                Status
                                            </h3>
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-gray-600 font-medium text-base">Availability:</span>
                                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${results.status === 'available'
                                                            ? 'bg-teal-100 text-teal-800 border border-teal-200'
                                                            : 'bg-red-100 text-red-800 border border-red-200'
                                                        }`}>
                                                        {results.status === 'available' ? 'Available' : (results.message || 'Taken')}
                                                    </span>
                                                </div>
                                                <FixedInfoRow label="Response Time" value="42 ms" />
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        )
                    ) : (
                        <div className="text-center py-8 sm:py-12">
                            <div className="text-gray-400 text-lg">
                                <i className="fas fa-search text-4xl mb-4"></i>
                                <p>Enter an IP address or domain name to begin analysis</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* History Section - Extra Wide */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden w-full">
                <div className="border-b border-gray-200 bg-gradient-to-r from-teal-50 to-teal-100 px-4 sm:px-6 py-4 sm:py-5">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-700 flex items-center gap-3">
                        <i className="fas fa-history text-teal-600 text-xl"></i>
                        Recent Checks
                    </h2>
                </div>
                <div className="p-4 sm:p-6">
                    <div className="space-y-3 mb-4">
                        {history.map((item, index) => (
                            <div key={index} className="flex justify-between items-center p-3 sm:p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors">
                                <div className="flex items-center gap-3">
                                    <i className={`fas ${item.type === 'ip' ? 'fa-network-wired' : 'fa-globe'} text-teal-600 text-base`}></i>
                                    <span className="font-semibold text-gray-900 text-sm sm:text-base">{item.address}</span>
                                </div>
                                <span className={`inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium border ${item.status === 'available'
                                        ? 'bg-teal-100 text-teal-800 border-teal-200'
                                        : 'bg-red-100 text-red-800 border-red-200'
                                    }`}>
                                    {item.status === 'available' ? 'Available' : (item.message || 'Taken')}
                                </span>
                            </div>
                        ))}
                    </div>
                    
                    {/* Clear History Button */}
                    {history.length > 0 && (
                        <button
                            onClick={clearHistory}
                            className="w-full bg-gradient-to-r from-teal-600 to-teal-700 text-white border-none px-4 sm:px-6 py-3 rounded-xl font-semibold cursor-pointer transition-all duration-300 hover:from-teal-700 hover:to-teal-800 hover:shadow-lg hover:-translate-y-0.5 shadow-md text-sm sm:text-base"
                        >
                            Clear History
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// Fixed Helper component for info rows - Perfect alignment
const FixedInfoRow = ({ label, value }) => (
    <div className="flex items-center justify-between">
        <span className="text-gray-600 font-medium text-sm sm:text-base flex-shrink-0 mr-2">{label}:</span>
        <span className="text-teal-600 font-medium text-right text-xs sm:text-sm break-words flex-1 min-w-0">{value}</span>
    </div>
);

// Fixed Helper component for status rows with color coding - Perfect alignment
const FixedStatusRow = ({ label, value, isGood = false, isWarning = false }) => {
    const getColorClass = () => {
        if (isGood) return 'text-teal-600';
        if (isWarning) return 'text-orange-500';
        return 'text-red-600';
    };

    return (
        <div className="flex items-center justify-between">
            <span className="text-gray-600 font-medium text-sm sm:text-base flex-shrink-0 mr-2">{label}:</span>
            <span className={`font-medium text-xs sm:text-sm ${getColorClass()} text-right flex-1 min-w-0`}>{value}</span>
        </div>
    );
};

export default IpDomainChecker;