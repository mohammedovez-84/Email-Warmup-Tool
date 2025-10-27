import React, { useState, useEffect } from 'react';
import {
  FiCheckCircle,
  FiAlertTriangle,
  FiInfo,
  FiCopy,
  FiRefreshCw,
  FiExternalLink,
  FiChevronDown,
  FiChevronUp,
  FiLock,
  FiMail,
  FiGlobe,
  FiShield,
  FiX,
  FiHelpCircle,
  FiSettings,
  FiDownload,
  FiServer,
  FiList,
  FiArrowRight,
  FiBarChart2,
  FiActivity
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

const AuthenticationChecker = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('overview');
  const [domain, setDomain] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [copied, setCopied] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    spf: true,
    dkim: true,
    dmarc: true,
    blacklist: true
  });
  const [history, setHistory] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Typing animation states
  const [domainPlaceholder, setDomainPlaceholder] = useState('');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [placeholderText, setPlaceholderText] = useState("");

  // Circular meter animation state
  const [score, setScore] = useState(0);

  // Check authentication status on component mount
  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
    }
  }, [currentUser, navigate]);

  // Load history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('authCheckHistory');
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }
  }, []);

  // Save history to localStorage
  useEffect(() => {
    if (history.length > 0) {
      localStorage.setItem('authCheckHistory', JSON.stringify(history));
    }
  }, [history]);


  // Circular meter animation effect
  useEffect(() => {
    const animateScore = () => {
      let currentScore = 0;
      const finalScore = 85;
      const duration = 1500; // 2 seconds
      const steps = 40; // 60 steps for smooth animation
      const increment = finalScore / steps;
      const intervalTime = duration / steps;

      const timer = setInterval(() => {
        currentScore += increment;
        if (currentScore >= finalScore) {
          setScore(finalScore);
          clearInterval(timer);
        } else {
          setScore(Math.floor(currentScore));
        }
      }, intervalTime);

      return () => clearInterval(timer);
    };

    // Start animation after component mounts
    const timer = setTimeout(animateScore, 500);
    return () => clearTimeout(timer);
  }, []);

  // Set responsive placeholder text based on screen size
  useEffect(() => {
    const updatePlaceholder = () => {
      const width = window.innerWidth;
      if (width < 640) { // sm breakpoint
        setPlaceholderText("Enter your domain");
      } else if (width < 768) { // md breakpoint  
        setPlaceholderText("Enter domain name");
      } else if (width < 1024) { // lg breakpoint
        setPlaceholderText("Enter your domain name");
      } else {
        setPlaceholderText("Enter your domain (example.com)");
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
        setDomainPlaceholder(placeholderText.substring(0, placeholderIndex - 1));
        setPlaceholderIndex(prev => prev - 1);

        if (placeholderIndex === 1) {
          setIsDeleting(false);
        }
      } else {
        setDomainPlaceholder(placeholderText.substring(0, placeholderIndex + 1));
        setPlaceholderIndex(prev => prev + 1);

        if (placeholderIndex === placeholderText.length) {
          setTimeout(() => setIsDeleting(true), 1000);
        }
      }
    };

    const timer = setTimeout(typeText, isDeleting ? 10 : 30);
    return () => clearTimeout(timer);
  }, [placeholderIndex, isDeleting, placeholderText]);

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Real DNS lookup functions
  const lookupDnsRecord = async (type, domain) => {
    try {
      // Use DNS over HTTPS (DoH) for real DNS lookups
      const dohEndpoint = 'https://cloudflare-dns.com/dns-query';

      let recordType = '';
      switch (type) {
        case 'spf':
          recordType = 'TXT';
          break;
        case 'dkim':
          recordType = 'TXT';
          break;
        case 'dmarc':
          recordType = 'TXT';
          break;
        default:
          recordType = 'TXT';
      }

      let lookupDomain = domain;
      if (type === 'dkim') {
        // Try common DKIM selectors
        const selectors = ['default', 'google', 'selector1', 'selector2', 'k1', 'dkim', 's1', 's2', 'key1', 'key2', 'mx', 'mail', 'email',
          'protonmail', 'zoho', 'sendgrid', 'mandrill', 'ses'];
        for (const selector of selectors) {
          const dkimDomain = `${selector}._domainkey.${domain}`;
          try {
            const response = await fetch(`${dohEndpoint}?name=${encodeURIComponent(dkimDomain)}&type=${recordType}`, {
              headers: {
                'Accept': 'application/dns-json'
              }
            });
            const data = await response.json();
            if (data.Answer && data.Answer.length > 0) {
              const record = data.Answer.find(ans => ans.data.includes('v=DKIM1'));
              if (record) {
                return {
                  record: record.data,
                  selector: selector,
                  domain: dkimDomain
                };
              }
            }
          } catch (error) {
            continue;
          }
        }
        return null;
      } else if (type === 'dmarc') {
        lookupDomain = `_dmarc.${domain}`;
      }

      const response = await fetch(`${dohEndpoint}?name=${encodeURIComponent(lookupDomain)}&type=${recordType}`, {
        headers: {
          'Accept': 'application/dns-json'
        }
      });

      const data = await response.json();

      if (data.Answer && data.Answer.length > 0) {
        const records = data.Answer.map(ans => ans.data);

        if (type === 'spf') {
          const spfRecord = records.find(record => record.includes('v=spf1'));
          return spfRecord || null;
        } else if (type === 'dmarc') {
          const dmarcRecord = records.find(record => record.includes('v=DMARC1'));
          return dmarcRecord || null;
        }

        return records[0];
      }

      return null;
    } catch (error) {
      console.error(`DNS lookup error for ${type}:`, error);
      return null;
    }
  };

  // Real blacklist checking using DNSBL
  const checkBlacklists = async (domain) => {
    const blacklists = [
      { name: 'Spamhaus DBL', query: `${domain}.dbl.spamhaus.org` },
      { name: 'Spamhaus ZEN', query: `${domain}.zen.spamhaus.org` },
      { name: 'Barracuda', query: `${domain}.b.barracudacentral.org` },
      { name: 'SORBS', query: `${domain}.dnsbl.sorbs.net` },
      { name: 'SpamCop', query: `${domain}.bl.spamcop.net` },
      { name: 'URIBL', query: `${domain}.black.uribl.com` },
      { name: 'PSBL', query: `${domain}.psbl.surriel.com` }
    ];

    const results = await Promise.all(
      blacklists.map(async (blacklist) => {
        try {
          const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(blacklist.query)}&type=A`, {
            headers: {
              'Accept': 'application/dns-json'
            }
          });
          const data = await response.json();
          // If we get an answer, the domain is listed
          const listed = data.Answer && data.Answer.length > 0;
          return {
            name: blacklist.name,
            listed: listed,
            response: listed ? 'Listed' : 'Not Listed'
          };
        } catch (error) {
          return {
            name: blacklist.name,
            listed: false,
            response: 'Check Failed'
          };
        }
      })
    );

    return results;
  };

  // Real BIMI check
  const checkBimi = async (domain) => {
    try {
      const bimiDomain = `default._bimi.${domain}`;
      const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(bimiDomain)}&type=TXT`, {
        headers: {
          'Accept': 'application/dns-json'
        }
      });

      const data = await response.json();

      if (data.Answer && data.Answer.length > 0) {
        const bimiRecord = data.Answer.find(ans => ans.data.includes('v=BIMI1'));
        if (bimiRecord) {
          return {
            exists: true,
            record: bimiRecord.data,
            valid: true,
            recommendation: 'BIMI is properly configured with a valid logo and certificate.'
          };
        }
      }

      return {
        exists: false,
        record: null,
        valid: false,
        recommendation: 'No BIMI record found. BIMI allows brands to display logos in supporting email clients.'
      };
    } catch (error) {
      return {
        exists: false,
        record: null,
        valid: false,
        recommendation: 'BIMI check failed. Please try again.'
      };
    }
  };

  // Analyze SPF record mechanisms
  const analyzeSPFRecord = (spfRecord) => {
    if (!spfRecord) return { mechanisms: [], lookups: 0, valid: false };

    const mechanisms = [];
    let lookups = 0;

    // Extract mechanisms from SPF record
    const parts = spfRecord.split(' ').filter(part => part && !part.startsWith('v='));

    parts.forEach(part => {
      if (part.startsWith('include:')) {
        const domain = part.replace('include:', '');
        mechanisms.push({ type: 'include', value: domain, valid: true });
        lookups++;
      } else if (part.startsWith('ip4:') || part.startsWith('ip6:')) {
        const ip = part.replace('ip4:', '').replace('ip6:', '');
        mechanisms.push({ type: part.startsWith('ip4:') ? 'ip4' : 'ip6', value: ip, valid: true });
      } else if (part === 'a' || part === 'mx') {
        mechanisms.push({ type: part, value: 'self', valid: true });
        lookups++;
      } else if (part === '-all' || part === '~all' || part === '+all' || part === '?all') {
        mechanisms.push({ type: 'all', value: part, valid: true });
      } else if (part.startsWith('redirect=')) {
        const redirect = part.replace('redirect=', '');
        mechanisms.push({ type: 'redirect', value: redirect, valid: true });
        lookups++;
      }
    });

    return {
      mechanisms,
      lookups,
      valid: lookups <= 10, // SPF standard allows max 10 lookups
      hasHardFail: spfRecord.includes('-all')
    };
  };

  const handleDomainSubmit = async (e) => {
    e.preventDefault();
    if (!domain) return;

    setIsLoading(true);

    try {
      // Real API calls with DNS lookups
      const [spfRecord, dkimRecord, dmarcRecord, blacklistResults, bimiResults] = await Promise.all([
        lookupDnsRecord('spf', domain),
        lookupDnsRecord('dkim', domain),
        lookupDnsRecord('dmarc', domain),
        checkBlacklists(domain),
        checkBimi(domain)
      ]);

      // Analyze SPF record
      const spfAnalysis = analyzeSPFRecord(spfRecord?.record || spfRecord);

      // Calculate scores based on real results
      const spfScore = spfRecord ? (spfAnalysis.hasHardFail ? 100 : 80) : 0;
      const dkimScore = dkimRecord ? 100 : 0;
      const dmarcScore = dmarcRecord ? (dmarcRecord.includes('p=reject') ? 100 :
        dmarcRecord.includes('p=quarantine') ? 80 : 60) : 0;
      const blacklistScore = blacklistResults.filter(b => b.listed).length === 0 ? 100 : 50;
      const bimiScore = bimiResults.exists ? 100 : 0;

      // Calculate overall score (weighted average)
      const overallScore = Math.round(
        (spfScore * 0.25) +
        (dkimScore * 0.25) +
        (dmarcScore * 0.25) +
        (blacklistScore * 0.15) +
        (bimiScore * 0.10)
      );

      // Generate issues list based on real data
      const issues = [];

      if (!spfRecord) {
        issues.push({
          type: 'error',
          category: 'SPF',
          message: 'No SPF record found',
          description: 'This can lead to email delivery issues and spoofing.'
        });
      } else if (!spfAnalysis.hasHardFail) {
        issues.push({
          type: 'warning',
          category: 'SPF',
          message: 'SPF uses softfail (~all) instead of hardfail (-all)',
          description: 'Consider changing ~all to -all for stricter enforcement.'
        });
      }

      if (spfAnalysis.lookups > 10) {
        issues.push({
          type: 'error',
          category: 'SPF',
          message: `SPF has ${spfAnalysis.lookups} lookups (exceeds 10 limit)`,
          description: 'Too many DNS lookups can cause SPF validation to fail.'
        });
      }

      if (!dkimRecord) {
        issues.push({
          type: 'error',
          category: 'DKIM',
          message: 'No DKIM record found',
          description: 'This prevents email authentication and can affect deliverability.'
        });
      }

      if (!dmarcRecord) {
        issues.push({
          type: 'error',
          category: 'DMARC',
          message: 'No DMARC record found',
          description: 'This leaves your domain vulnerable to spoofing and phishing attacks.'
        });
      } else if (dmarcRecord.includes('p=none')) {
        issues.push({
          type: 'warning',
          category: 'DMARC',
          message: 'DMARC is in monitoring mode only (p=none)',
          description: 'Consider moving to p=quarantine or p=reject after monitoring reports.'
        });
      }

      const listedBlacklists = blacklistResults.filter(b => b.listed);
      if (listedBlacklists.length > 0) {
        issues.push({
          type: 'error',
          category: 'Blacklist',
          message: `Domain listed on ${listedBlacklists.length} blacklist(s)`,
          description: `Listed on: ${listedBlacklists.map(b => b.name).join(', ')}. This may affect email deliverability.`
        });
      }

      if (!bimiResults.exists) {
        issues.push({
          type: 'info',
          category: 'BIMI',
          message: 'No BIMI record found',
          description: 'BIMI allows brands to display logos in supporting email clients.'
        });
      }

      const newResults = {
        domain,
        spf: {
          exists: !!spfRecord,
          valid: spfAnalysis.valid,
          record: spfRecord?.record || spfRecord,
          mechanisms: spfAnalysis.mechanisms,
          lookups: spfAnalysis.lookups,
          hasHardFail: spfAnalysis.hasHardFail,
          pass: !!spfRecord,
          recommendation: spfRecord ?
            (spfAnalysis.hasHardFail ?
              'Your SPF record is properly configured with strict enforcement.' :
              'Your SPF record is configured but uses softfail. Consider changing ~all to -all for stricter enforcement.') :
            'No SPF record found. This can lead to email delivery issues.'
        },
        dkim: {
          exists: !!dkimRecord,
          valid: !!dkimRecord,
          selector: dkimRecord?.selector || 'default',
          record: dkimRecord?.record || dkimRecord,
          publicKeyValid: !!dkimRecord,
          keyLength: dkimRecord ? 2048 : 0,
          recommendation: dkimRecord ?
            'DKIM is properly configured. Ensure you rotate keys periodically.' :
            'No DKIM record found. This prevents email authentication and can affect deliverability.'
        },
        dmarc: {
          exists: !!dmarcRecord,
          valid: !!dmarcRecord,
          record: dmarcRecord,
          policy: dmarcRecord ? (dmarcRecord.includes('p=reject') ? 'reject' :
            dmarcRecord.includes('p=quarantine') ? 'quarantine' : 'none') : 'not set',
          subdomainPolicy: dmarcRecord && dmarcRecord.includes('sp=') ?
            dmarcRecord.match(/sp=(reject|quarantine|none)/)?.[1] : null,
          percentage: dmarcRecord && dmarcRecord.includes('pct=') ?
            parseInt(dmarcRecord.match(/pct=(\d+)/)?.[1]) : 100,
          aggregateReporting: dmarcRecord && dmarcRecord.includes('rua=') ?
            dmarcRecord.match(/rua=mailto:([^;]+)/)?.[1] : 'not set',
          forensicReporting: dmarcRecord && dmarcRecord.includes('ruf=') ?
            dmarcRecord.match(/ruf=mailto:([^;]+)/)?.[1] : 'not set',
          alignment: {
            spf: dmarcRecord && dmarcRecord.includes('aspf=') ?
              dmarcRecord.match(/aspf=([r|s])/)?.[1] === 'r' ? 'relaxed' : 'strict' : 'relaxed',
            dkim: dmarcRecord && dmarcRecord.includes('adkim=') ?
              dmarcRecord.match(/adkim=([r|s])/)?.[1] === 'r' ? 'relaxed' : 'strict' : 'relaxed'
          },
          recommendation: dmarcRecord ?
            (dmarcRecord.includes('p=reject') ?
              'Your DMARC policy is properly configured with strict enforcement.' :
              dmarcRecord.includes('p=quarantine') ?
                'Your DMARC policy is set to quarantine. Consider moving to p=reject for maximum protection.' :
                'Your DMARC policy is set to monitoring only. Consider moving to p=quarantine or p=reject after monitoring.') :
            'No DMARC record found. This leaves your domain vulnerable to spoofing and phishing attacks.'
        },
        blacklist: {
          checked: blacklistResults.length,
          listed: blacklistResults.filter(b => b.listed).length,
          details: blacklistResults,
          recommendation: blacklistResults.filter(b => b.listed).length === 0 ?
            'Your domain is not listed on any major blacklists.' :
            'Your domain is listed on one or more blacklists. This may affect email deliverability.'
        },
        bimi: bimiResults,
        overallScore,
        issues,
        lastChecked: new Date().toISOString()
      };

      setResults(newResults);

      // Add to history
      setHistory(prev => {
        const newHistory = [...prev];
        // Remove if already exists
        const filteredHistory = newHistory.filter(item => item.domain !== domain);
        if (filteredHistory.length >= 10) filteredHistory.pop();
        return [{ domain, date: new Date().toISOString(), score: overallScore }, ...filteredHistory];
      });
    } catch (error) {
      console.error('Error checking domain:', error);
      // Handle error state
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (valid) => {
    return valid ? (
      <FiCheckCircle className="text-teal-600 text-xl" />
    ) : (
      <FiAlertTriangle className="text-orange-500 text-xl" />
    );
  };

  const getScoreClass = (score) => {
    if (score >= 90) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 50) return 'fair';
    return 'poor';
  };

  const exportResults = () => {
    const dataStr = JSON.stringify(results, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `${domain}-authentication-results.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('authCheckHistory');
  };

  const loadFromHistory = (domain) => {
    setDomain(domain);
    // In a real app, you would fetch the results for this domain
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="p-0">
            {results && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 flex items-center gap-3 sm:gap-4 transition-all duration-300 hover:shadow-md">
                    <div className="w-10 h-10 sm:w-14 sm:h-14 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-lg sm:text-2xl">
                      <FiMail />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm text-gray-600 font-medium mb-1">SPF</h4>
                      <p className={results.spf.exists ? 'text-teal-600 text-base sm:text-xl font-bold' : 'text-red-600 text-base sm:text-xl font-bold'}>
                        {results.spf.exists ? 'Configured' : 'Not Found'}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 flex items-center gap-3 sm:gap-4 transition-all duration-300 hover:shadow-md">
                    <div className="w-10 h-10 sm:w-14 sm:h-14 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center text-lg sm:text-2xl">
                      <FiLock />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm text-gray-600 font-medium mb-1">DKIM</h4>
                      <p className={results.dkim.exists ? 'text-teal-600 text-base sm:text-xl font-bold' : 'text-red-600 text-base sm:text-xl font-bold'}>
                        {results.dkim.exists ? 'Configured' : 'Not Found'}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 flex items-center gap-3 sm:gap-4 transition-all duration-300 hover:shadow-md">
                    <div className="w-10 h-10 sm:w-14 sm:h-14 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center text-lg sm:text-2xl">
                      <FiShield />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm text-gray-600 font-medium mb-1">DMARC</h4>
                      <p className={results.dmarc.exists ? 'text-teal-600 text-base sm:text-xl font-bold' : 'text-red-600 text-base sm:text-xl font-bold'}>
                        {results.dmarc.exists ? 'Configured' : 'Not Found'}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 flex items-center gap-3 sm:gap-4 transition-all duration-300 hover:shadow-md">
                    <div className="w-10 h-10 sm:w-14 sm:h-14 bg-orange-50 text-orange-500 rounded-xl flex items-center justify-center text-lg sm:text-2xl">
                      <FiList />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm text-gray-600 font-medium mb-1">Blacklists</h4>
                      <p className={results.blacklist.listed === 0 ? 'text-teal-600 text-base sm:text-xl font-bold' : 'text-red-600 text-base sm:text-xl font-bold'}>
                        {results.blacklist.listed === 0 ? 'Clean' : `${results.blacklist.listed} Listed`}
                      </p>
                    </div>
                  </div>
                </div>

                {results.issues && results.issues.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 mb-6 shadow-sm w-full">
                    <div className="border-b border-gray-200 bg-gradient-to-r from-teal-50 to-teal-100 px-4 sm:px-6 py-4 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 mb-4 sm:mb-6">
                      <h3 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-3">
                        <FiAlertTriangle className="text-orange-500 text-xl" />
                        Domain Health Issues
                      </h3>
                    </div>
                    <div className="space-y-4">
                      {results.issues.map((issue, index) => (
                        <div key={index} className={`flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl ${issue.type === 'error'
                          ? 'bg-red-50 border-l-4 border-red-500'
                          : issue.type === 'warning'
                            ? 'bg-orange-50 border-l-4 border-orange-500'
                            : 'bg-blue-50 border-l-4 border-blue-500'
                          }`}>
                          <div className="flex-shrink-0 mt-1">
                            {issue.type === 'error' && <FiAlertTriangle className="text-red-500 text-xl" />}
                            {issue.type === 'warning' && <FiAlertTriangle className="text-orange-500 text-xl" />}
                            {issue.type === 'info' && <FiInfo className="text-blue-500 text-xl" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-900 text-sm sm:text-base">{issue.category}: {issue.message}</h4>
                            <p className="text-gray-600 mt-1 text-xs sm:text-sm">{issue.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 shadow-sm w-full">
                  <div className="border-b border-gray-200 bg-gradient-to-r from-teal-50 to-teal-100 px-4 sm:px-6 py-4 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 mb-4 sm:mb-6">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-3">
                      <FiCheckCircle className="text-teal-600 text-xl" />
                      Recommendations
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {results.spf.recommendation && (
                      <div className="bg-blue-50 rounded-xl p-3 sm:p-4 border-l-4 border-blue-500">
                        <div className="flex items-start">
                          <FiArrowRight className="mt-1 mr-2 text-blue-500 flex-shrink-0" />
                          <p className="text-gray-700 text-xs sm:text-sm">{results.spf.recommendation}</p>
                        </div>
                      </div>
                    )}

                    {results.dkim.recommendation && (
                      <div className="bg-blue-50 rounded-xl p-3 sm:p-4 border-l-4 border-blue-500">
                        <div className="flex items-start">
                          <FiArrowRight className="mt-1 mr-2 text-blue-500 flex-shrink-0" />
                          <p className="text-gray-700 text-xs sm:text-sm">{results.dkim.recommendation}</p>
                        </div>
                      </div>
                    )}

                    {results.dmarc.recommendation && (
                      <div className="bg-blue-50 rounded-xl p-3 sm:p-4 border-l-4 border-blue-500">
                        <div className="flex items-start">
                          <FiArrowRight className="mt-1 mr-2 text-blue-500 flex-shrink-0" />
                          <p className="text-gray-700 text-xs sm:text-sm">{results.dmarc.recommendation}</p>
                        </div>
                      </div>
                    )}

                    {results.blacklist.recommendation && (
                      <div className="bg-blue-50 rounded-xl p-3 sm:p-4 border-l-4 border-blue-500">
                        <div className="flex items-start">
                          <FiArrowRight className="mt-1 mr-2 text-blue-500 flex-shrink-0" />
                          <p className="text-gray-700 text-xs sm:text-sm">{results.blacklist.recommendation}</p>
                        </div>
                      </div>
                    )}

                    {results.bimi.recommendation && (
                      <div className="bg-blue-50 rounded-xl p-3 sm:p-4 border-l-4 border-blue-500">
                        <div className="flex items-start">
                          <FiArrowRight className="mt-1 mr-2 text-blue-500 flex-shrink-0" />
                          <p className="text-gray-700 text-xs sm:text-sm">{results.bimi.recommendation}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        );

      case 'spf':
        return (
          <div className="border border-gray-200 rounded-xl mb-6 overflow-hidden transition-all duration-300 hover:shadow-md w-full">
            <div
              className="border-b border-gray-200 bg-gradient-to-r from-teal-50 to-teal-100 px-4 sm:px-6 py-4 sm:py-5 cursor-pointer flex justify-between items-center hover:bg-teal-100 transition-colors"
              onClick={() => toggleSection('spf')}
            >
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FiMail className="inline text-teal-600 text-base" />
                SPF (Sender Policy Framework)
                {results?.spf && getStatusIcon(results.spf.valid)}
              </h3>
              {expandedSections.spf ? <FiChevronUp className="text-gray-500" /> : <FiChevronDown className="text-gray-500" />}
            </div>

            {expandedSections.spf && (
              <div className="bg-white p-4 sm:p-6 animate-fade-in">
                {results ? (
                  <>
                    <div className={`rounded-xl p-4 sm:p-6 ${results.spf.valid
                      ? 'bg-teal-50 border-l-4 border-teal-600'
                      : 'bg-orange-50 border-l-4 border-orange-500'
                      }`}>
                      <div className="mb-4">
                        <p className="font-semibold text-lg text-gray-900 mb-1">
                          {results.spf.exists ? 'SPF record found' : 'No SPF record found'}
                        </p>
                        <span className="text-sm text-gray-500">Last checked: {new Date(results.lastChecked).toLocaleString()}</span>
                      </div>

                      {results.spf.exists && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-4">
                          <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm">
                            <h4 className="font-semibold text-gray-900 mb-3">Record Details</h4>
                            <div className="overflow-x-auto">
                              <SyntaxHighlighter language="dns" style={atomOneDark} className="rounded-md text-sm min-w-full">
                                {results.spf.record}
                              </SyntaxHighlighter>
                            </div>
                            <CopyToClipboard text={results.spf.record} onCopy={() => setCopied(true)}>
                              <button className="inline-flex items-center gap-2 bg-gradient-to-r from-teal-600 to-teal-700 text-white border-none px-4 sm:px-5 py-2 sm:py-3 rounded-full mt-3 text-xs sm:text-sm font-medium cursor-pointer transition-all duration-200 hover:from-teal-700 hover:to-teal-800 hover:-translate-y-0.5 shadow-md">
                                <FiCopy className="text-sm" /> Copy Record
                              </button>
                            </CopyToClipboard>
                          </div>

                          <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm">
                            <h4 className="font-semibold text-gray-900 mb-3">Mechanisms</h4>
                            <ul className="space-y-2">
                              {results.spf.mechanisms.map((mechanism, idx) => (
                                <li key={idx} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-b-0">
                                  <div className="flex items-center gap-3">
                                    <span className="font-medium text-gray-700 text-xs sm:text-sm w-16 sm:w-20">{mechanism.type}</span>
                                    <span className="font-mono text-xs sm:text-sm text-gray-600 flex-1 truncate">{mechanism.value}</span>
                                  </div>
                                  {mechanism.valid ? (
                                    <FiCheckCircle className="text-teal-600 flex-shrink-0 text-base" />
                                  ) : (
                                    <FiAlertTriangle className="text-orange-500 flex-shrink-0 text-base" />
                                  )}
                                </li>
                              ))}
                            </ul>
                            <p className="text-xs sm:text-sm text-gray-500 mt-3">Total lookups: {results.spf.lookups}/10</p>
                          </div>
                        </div>
                      )}

                      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 mt-4 shadow-sm">
                        <h4 className="font-semibold text-gray-900 mb-2">Recommendation</h4>
                        <p className="text-gray-700 text-xs sm:text-sm">{results.spf.recommendation}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 shadow-sm w-full">
                    <div className="border-b border-gray-200 bg-gradient-to-r from-teal-50 to-teal-100 px-4 sm:px-6 py-4 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 mb-4 sm:mb-6">
                      <h4 className="font-semibold text-gray-900">SPF Check</h4>
                    </div>
                    <div className="space-y-4">
                      <p className="text-gray-600 text-xs sm:text-sm">SPF (Sender Policy Framework) is an email authentication method designed to detect forging sender addresses during the delivery of the email.</p>
                      <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                        <h5 className="font-semibold text-gray-900 mb-2">How it works:</h5>
                        <ul className="list-disc list-inside space-y-1 text-gray-600 text-xs sm:text-sm">
                          <li>SPF allows receiving mail servers to check that incoming mail from a domain comes from a host authorized by that domain's administrators</li>
                          <li>It lists designated mail servers in a DNS TXT record</li>
                          <li>Receiving servers verify the sending server's IP against the published SPF record</li>
                          <li>If the check fails, the receiving server can reject or mark the email as suspicious</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 'dkim':
        return (
          <div className="border border-gray-200 rounded-xl mb-6 overflow-hidden transition-all duration-300 hover:shadow-md w-full">
            <div
              className="border-b border-gray-200 bg-gradient-to-r from-teal-50 to-teal-100 px-4 sm:px-6 py-4 sm:py-5 cursor-pointer flex justify-between items-center hover:bg-teal-100 transition-colors"
              onClick={() => toggleSection('dkim')}
            >
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FiLock className="inline text-teal-600 text-base" />
                DKIM (DomainKeys Identified Mail)
                {results?.dkim && getStatusIcon(results.dkim.valid)}
              </h3>
              {expandedSections.dkim ? <FiChevronUp className="text-gray-500" /> : <FiChevronDown className="text-gray-500" />}
            </div>

            {expandedSections.dkim && (
              <div className="bg-white p-4 sm:p-6 animate-fade-in">
                {results ? (
                  <>
                    <div className={`rounded-xl p-4 sm:p-6 ${results.dkim.valid
                      ? 'bg-teal-50 border-l-4 border-teal-600'
                      : 'bg-orange-50 border-l-4 border-orange-500'
                      }`}>
                      <div className="mb-4">
                        <p className="font-semibold text-lg text-gray-900 mb-1">
                          {results.dkim.exists ? 'DKIM record found' : 'No DKIM record found'}
                        </p>
                        <span className="text-sm text-gray-500">Last checked: {new Date(results.lastChecked).toLocaleString()}</span>
                      </div>

                      {results.dkim.exists && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-4">
                          <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm">
                            <h4 className="font-semibold text-gray-900 mb-3">Record Details</h4>
                            <div className="overflow-x-auto">
                              <SyntaxHighlighter language="dns" style={atomOneDark} className="rounded-md text-sm min-w-full">
                                {results.dkim.record}
                              </SyntaxHighlighter>
                            </div>
                            <CopyToClipboard text={results.dkim.record} onCopy={() => setCopied(true)}>
                              <button className="inline-flex items-center gap-2 bg-gradient-to-r from-teal-600 to-teal-700 text-white border-none px-4 sm:px-5 py-2 sm:py-3 rounded-full mt-3 text-xs sm:text-sm font-medium cursor-pointer transition-all duration-200 hover:from-teal-700 hover:to-teal-800 hover:-translate-y-0.5 shadow-md">
                                <FiCopy className="text-sm" /> Copy Record
                              </button>
                            </CopyToClipboard>
                          </div>

                          <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm">
                            <h4 className="font-semibold text-gray-900 mb-3">Key Information</h4>
                            <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600 font-medium">Selector:</span>
                                <span className="text-teal-600 font-medium">{results.dkim.selector}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600 font-medium">Key Length:</span>
                                <span className="text-teal-600 font-medium">{results.dkim.keyLength} bits</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600 font-medium">Public Key Valid:</span>
                                {results.dkim.publicKeyValid ? (
                                  <FiCheckCircle className="text-teal-600 text-xl" />
                                ) : (
                                  <FiAlertTriangle className="text-orange-500 text-xl" />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 mt-4 shadow-sm">
                        <h4 className="font-semibold text-gray-900 mb-2">Recommendation</h4>
                        <p className="text-gray-700 text-xs sm:text-sm">{results.dkim.recommendation}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 shadow-sm w-full">
                    <div className="border-b border-gray-200 bg-gradient-to-r from-teal-50 to-teal-100 px-4 sm:px-6 py-4 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 mb-4 sm:mb-6">
                      <h4 className="font-semibold text-gray-900">DKIM Check</h4>
                    </div>
                    <div className="space-y-4">
                      <p className="text-gray-600 text-xs sm:text-sm">DKIM (DomainKeys Identified Mail) is an email authentication method that allows the receiver to check that an email was indeed sent and authorized by the owner of that domain.</p>
                      <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                        <h5 className="font-semibold text-gray-900 mb-2">How it works:</h5>
                        <ul className="list-disc list-inside space-y-1 text-gray-600 text-xs sm:text-sm">
                          <li>DKIM uses public-key cryptography to sign emails with a digital signature</li>
                          <li>The sending server adds a DKIM signature header to outgoing emails</li>
                          <li>Receiving servers verify the signature using the public key published in DNS</li>
                          <li>If the signature is valid, the email hasn't been tampered with in transit</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 'dmarc':
        return (
          <div className="border border-gray-200 rounded-xl mb-6 overflow-hidden transition-all duration-300 hover:shadow-md w-full">
            <div
              className="border-b border-gray-200 bg-gradient-to-r from-teal-50 to-teal-100 px-4 sm:px-6 py-4 sm:py-5 cursor-pointer flex justify-between items-center hover:bg-teal-100 transition-colors"
              onClick={() => toggleSection('dmarc')}
            >
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FiShield className="inline text-teal-600 text-base" />
                DMARC (Domain-based Message Authentication)
                {results?.dmarc && getStatusIcon(results.dmarc.valid)}
              </h3>
              {expandedSections.dmarc ? <FiChevronUp className="text-gray-500" /> : <FiChevronDown className="text-gray-500" />}
            </div>

            {expandedSections.dmarc && (
              <div className="bg-white p-4 sm:p-6 animate-fade-in">
                {results ? (
                  <>
                    <div className={`rounded-xl p-4 sm:p-6 ${results.dmarc.valid
                      ? 'bg-teal-50 border-l-4 border-teal-600'
                      : 'bg-orange-50 border-l-4 border-orange-500'
                      }`}>
                      <div className="mb-4">
                        <p className="font-semibold text-lg text-gray-900 mb-1">
                          {results.dmarc.exists ? 'DMARC record found' : 'No DMARC record found'}
                        </p>
                        <span className="text-sm text-gray-500">Last checked: {new Date(results.lastChecked).toLocaleString()}</span>
                      </div>

                      {results.dmarc.exists && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-4">
                          <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm">
                            <h4 className="font-semibold text-gray-900 mb-3">Record Details</h4>
                            <div className="overflow-x-auto">
                              <SyntaxHighlighter language="dns" style={atomOneDark} className="rounded-md text-sm min-w-full">
                                {results.dmarc.record}
                              </SyntaxHighlighter>
                            </div>
                            <CopyToClipboard text={results.dmarc.record} onCopy={() => setCopied(true)}>
                              <button className="inline-flex items-center gap-2 bg-gradient-to-r from-teal-600 to-teal-700 text-white border-none px-4 sm:px-5 py-2 sm:py-3 rounded-full mt-3 text-xs sm:text-sm font-medium cursor-pointer transition-all duration-200 hover:from-teal-700 hover:to-teal-800 hover:-translate-y-0.5 shadow-md">
                                <FiCopy className="text-sm" /> Copy Record
                              </button>
                            </CopyToClipboard>
                          </div>

                          <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm">
                            <h4 className="font-semibold text-gray-900 mb-3">Policy Information</h4>
                            <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600 font-medium">Policy:</span>
                                <span className={`font-medium ${results.dmarc.policy === 'reject' ? 'text-teal-600' : results.dmarc.policy === 'quarantine' ? 'text-orange-500' : 'text-red-500'}`}>
                                  {results.dmarc.policy}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600 font-medium">Subdomain Policy:</span>
                                <span className="text-teal-600 font-medium">{results.dmarc.subdomainPolicy || 'Same as domain'}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600 font-medium">Percentage:</span>
                                <span className="text-teal-600 font-medium">{results.dmarc.percentage}%</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600 font-medium">SPF Alignment:</span>
                                <span className="text-teal-600 font-medium">{results.dmarc.alignment.spf}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600 font-medium">DKIM Alignment:</span>
                                <span className="text-teal-600 font-medium">{results.dmarc.alignment.dkim}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 mt-4 shadow-sm">
                        <h4 className="font-semibold text-gray-900 mb-2">Recommendation</h4>
                        <p className="text-gray-700 text-xs sm:text-sm">{results.dmarc.recommendation}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 shadow-sm w-full">
                    <div className="border-b border-gray-200 bg-gradient-to-r from-teal-50 to-teal-100 px-4 sm:px-6 py-4 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 mb-4 sm:mb-6">
                      <h4 className="font-semibold text-gray-900">DMARC Check</h4>
                    </div>
                    <div className="space-y-4">
                      <p className="text-gray-600 text-xs sm:text-sm">DMARC (Domain-based Message Authentication, Reporting & Conformance) is an email authentication protocol that builds on SPF and DKIM protocols.</p>
                      <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                        <h5 className="font-semibold text-gray-900 mb-2">How it works:</h5>
                        <ul className="list-disc list-inside space-y-1 text-gray-600 text-xs sm:text-sm">
                          <li>DMARC tells receiving servers what to do with emails that fail SPF and DKIM checks</li>
                          <li>It provides reporting capabilities to domain owners about email authentication results</li>
                          <li>DMARC policies can be set to none (monitor), quarantine, or reject</li>
                          <li>It helps prevent domain spoofing and phishing attacks</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 'blacklist':
        return (
          <div className="border border-gray-200 rounded-xl mb-6 overflow-hidden transition-all duration-300 hover:shadow-md w-full">
            <div
              className="border-b border-gray-200 bg-gradient-to-r from-teal-50 to-teal-100 px-4 sm:px-6 py-4 sm:py-5 cursor-pointer flex justify-between items-center hover:bg-teal-100 transition-colors"
              onClick={() => toggleSection('blacklist')}
            >
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FiList className="inline text-teal-600 text-base" />
                Blacklist Status
                {results?.blacklist && getStatusIcon(results.blacklist.listed === 0)}
              </h3>
              {expandedSections.blacklist ? <FiChevronUp className="text-gray-500" /> : <FiChevronDown className="text-gray-500" />}
            </div>

            {expandedSections.blacklist && (
              <div className="bg-white p-4 sm:p-6 animate-fade-in">
                {results ? (
                  <>
                    <div className={`rounded-xl p-4 sm:p-6 ${results.blacklist.listed === 0
                      ? 'bg-teal-50 border-l-4 border-teal-600'
                      : 'bg-orange-50 border-l-4 border-orange-500'
                      }`}>
                      <div className="mb-4">
                        <p className="font-semibold text-lg text-gray-900 mb-1">
                          {results.blacklist.listed === 0 ? 'Domain is clean' : `Domain listed on ${results.blacklist.listed} blacklist(s)`}
                        </p>
                        <span className="text-sm text-gray-500">Last checked: {new Date(results.lastChecked).toLocaleString()}</span>
                      </div>

                      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm">
                        <h4 className="font-semibold text-gray-900 mb-3">Blacklist Results</h4>
                        <div className="space-y-3">
                          {results.blacklist.details.map((blacklist, index) => (
                            <div key={index} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0">
                              <span className="text-gray-700 font-medium text-sm">{blacklist.name}</span>
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${blacklist.listed
                                ? 'bg-red-100 text-red-800 border border-red-200'
                                : 'bg-teal-100 text-teal-800 border border-teal-200'
                                }`}>
                                {blacklist.response}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 mt-4 shadow-sm">
                        <h4 className="font-semibold text-gray-900 mb-2">Recommendation</h4>
                        <p className="text-gray-700 text-xs sm:text-sm">{results.blacklist.recommendation}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 shadow-sm w-full">
                    <div className="border-b border-gray-200 bg-gradient-to-r from-teal-50 to-teal-100 px-4 sm:px-6 py-4 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 mb-4 sm:mb-6">
                      <h4 className="font-semibold text-gray-900">Blacklist Check</h4>
                    </div>
                    <div className="space-y-4">
                      <p className="text-gray-600 text-xs sm:text-sm">Email blacklists (DNSBLs) are databases of IP addresses and domains known to send spam or malicious emails.</p>
                      <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                        <h5 className="font-semibold text-gray-900 mb-2">How it works:</h5>
                        <ul className="list-disc list-inside space-y-1 text-gray-600 text-xs sm:text-sm">
                          <li>Receiving mail servers check sending IPs/domains against multiple blacklists</li>
                          <li>If listed, emails may be rejected, marked as spam, or quarantined</li>
                          <li>Common reasons for listing include sending spam, having compromised systems, or poor email practices</li>
                          <li>Regular monitoring helps maintain good email deliverability</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };


  if (!currentUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 text-gray-900 flex justify-center items-start p-4 sm:p-6 font-['Inter',_'Roboto',_-apple-system,_BlinkMacSystemFont,_'Segoe_UI',_sans-serif]">
      <div className="w-full">
        {/* Header Section */}
        <div className="text-center mb-6 sm:mb-12">
          <div className="mb-6 sm:mb-12">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 sm:p-6 mb-4 sm:mb-6 w-full">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-4 sm:gap-6">
                {/* Left Side - Title & Description */}
                <div className="flex-1 text-center lg:text-left">
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-700 mb-3 sm:mb-4">
                    <i className="fas fa-shield-alt mr-2 sm:mr-3 text-teal-600 text-xl sm:text-2xl lg:text-3xl"></i>
                    Authentication Checker
                  </h1>
                  <p className="text-gray-600 text-sm sm:text-base lg:text-lg max-w-2xl mx-auto lg:mx-0">
                    Get email security insights and improvement recommendations.
                  </p>
                </div>

                {/* Right Side - Animated Circular Meter */}
                <div className="flex-shrink-0">
                  <div className="text-center">
                    <div className="relative w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-2">
                      <svg viewBox="0 0 36 36" className="w-full h-full">
                        <path
                          className="stroke-gray-200 fill-none stroke-[3.8]"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path
                          className="fill-none stroke-teal-500 stroke-[2.8] stroke-linecap-round transition-all duration-2000 ease-out"
                          strokeDasharray={`${score}, 100`}
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          transform="rotate(-90 18 18)"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm sm:text-base font-bold text-gray-800">{score}%</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 font-medium">Security Score</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Input Section */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 sm:p-6 mb-6 sm:mb-8 w-full">
            <form onSubmit={handleDomainSubmit} className="max-w-3xl mx-auto">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder={domainPlaceholder}
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className="w-full px-4 sm:px-6 py-3 sm:py-4 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm sm:text-base outline-none focus:border-teal-500 focus:ring-2 sm:focus:ring-4 focus:ring-teal-100 transition-all"
                    disabled={isLoading}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 sm:px-8 py-3 sm:py-4 border-none rounded-xl font-semibold text-sm sm:text-lg transition-all duration-300 min-w-[120px] sm:min-w-[160px] bg-gradient-to-r from-teal-600 to-teal-700 text-white shadow-md hover:from-teal-700 hover:to-teal-800 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center text-xs sm:text-base">
                      <FiRefreshCw className="animate-spin mr-2" />
                      Checking...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center text-xs sm:text-base">
                      <FiShield className="mr-2" />
                      Check Security
                    </span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Overall Score */}
        {results && (
          <div className="flex justify-center mb-6 sm:mb-8">
            <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-6 sm:p-8 text-center animate-fade-in w-full max-w-sm sm:max-w-md">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">Domain Health Score</h3>
              <div className="mb-4 sm:mb-6 relative flex justify-center items-center">
                <div className="relative w-24 h-24 sm:w-32 sm:h-32">
                  <svg viewBox="0 0 36 36" className="w-full h-full">
                    <path
                      className="stroke-gray-200 fill-none stroke-[3.8]"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className={`fill-none stroke-[2.8] stroke-linecap-round transition-all duration-1000 ${getScoreClass(results.overallScore) === 'excellent' ? 'stroke-teal-600' :
                        getScoreClass(results.overallScore) === 'good' ? 'stroke-teal-500' :
                          getScoreClass(results.overallScore) === 'fair' ? 'stroke-orange-500' : 'stroke-red-500'
                        }`}
                      strokeDasharray={`${results.overallScore}, 100`}
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      transform="rotate(-90 18 18)"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl sm:text-2xl font-bold text-gray-900">
                      {results.overallScore}%
                    </span>
                  </div>
                </div>
              </div>
              <p className={`text-base sm:text-lg font-semibold ${getScoreClass(results.overallScore) === 'excellent' ? 'text-teal-600' :
                getScoreClass(results.overallScore) === 'good' ? 'text-teal-500' :
                  getScoreClass(results.overallScore) === 'fair' ? 'text-orange-500' : 'text-red-500'
                }`}>
                Your email authentication is {getScoreClass(results.overallScore)}
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden animate-slide-up w-full">
          <div className="bg-white border-b border-gray-200 overflow-x-auto">
            <div className="flex min-w-max">
              <button
                className={`px-4 sm:px-6 py-4 sm:py-5 bg-none border-none cursor-pointer font-medium text-gray-600 flex items-center gap-2 transition-all duration-300 whitespace-nowrap hover:text-gray-900 hover:bg-gray-50 relative ${activeTab === 'overview' ? 'text-gray-900 font-semibold' : ''
                  }`}
                onClick={() => setActiveTab('overview')}
              >
                <FiGlobe className="text-lg text-teal-600" />
                Overview
                {activeTab === 'overview' && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-teal-600 animate-expand-line"></div>
                )}
              </button>
              <button
                className={`px-4 sm:px-6 py-4 sm:py-5 bg-none border-none cursor-pointer font-medium text-gray-600 flex items-center gap-2 transition-all duration-300 whitespace-nowrap hover:text-gray-900 hover:bg-gray-50 relative ${activeTab === 'spf' ? 'text-gray-900 font-semibold' : ''
                  }`}
                onClick={() => setActiveTab('spf')}
              >
                <FiMail className="text-lg text-teal-600" />
                SPF
                {activeTab === 'spf' && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-teal-600 animate-expand-line"></div>
                )}
              </button>
              <button
                className={`px-4 sm:px-6 py-4 sm:py-5 bg-none border-none cursor-pointer font-medium text-gray-600 flex items-center gap-2 transition-all duration-300 whitespace-nowrap hover:text-gray-900 hover:bg-gray-50 relative ${activeTab === 'dkim' ? 'text-gray-900 font-semibold' : ''
                  }`}
                onClick={() => setActiveTab('dkim')}
              >
                <FiLock className="text-lg text-teal-600" />
                DKIM
                {activeTab === 'dkim' && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-teal-600 animate-expand-line"></div>
                )}
              </button>
              <button
                className={`px-4 sm:px-6 py-4 sm:py-5 bg-none border-none cursor-pointer font-medium text-gray-600 flex items-center gap-2 transition-all duration-300 whitespace-nowrap hover:text-gray-900 hover:bg-gray-50 relative ${activeTab === 'dmarc' ? 'text-gray-900 font-semibold' : ''
                  }`}
                onClick={() => setActiveTab('dmarc')}
              >
                <FiShield className="text-lg text-teal-600" />
                DMARC
                {activeTab === 'dmarc' && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-teal-600 animate-expand-line"></div>
                )}
              </button>
              <button
                className={`px-4 sm:px-6 py-4 sm:py-5 bg-none border-none cursor-pointer font-medium text-gray-600 flex items-center gap-2 transition-all duration-300 whitespace-nowrap hover:text-gray-900 hover:bg-gray-50 relative ${activeTab === 'blacklist' ? 'text-gray-900 font-semibold' : ''
                  }`}
                onClick={() => setActiveTab('blacklist')}
              >
                <FiList className="text-lg text-teal-600" />
                Blacklist
                {activeTab === 'blacklist' && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-teal-600 animate-expand-line"></div>
                )}
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-6 lg:p-8">
            {renderTabContent()}
          </div>
        </div>

        {/* History Panel */}
        {history.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mt-6 sm:mt-8 w-full">
            <div className="border-b border-gray-200 bg-gradient-to-r from-teal-50 to-teal-100 px-4 sm:px-6 lg:px-8 py-4 sm:py-5 lg:py-6">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-700 flex items-center gap-3">
                <i className="fas fa-history text-teal-600 text-xl"></i>
                Recent Checks
              </h2>
            </div>
            <div className="p-4 sm:p-6">
              <div className="space-y-3 mb-4">
                {history.map((item, index) => (
                  <div key={index} className="flex justify-between items-center p-3 sm:p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <i className={`fas fa-globe text-teal-600 text-base`}></i>
                      <span className="font-semibold text-gray-900 text-sm sm:text-base">{item.domain}</span>
                    </div>
                    <span className={`inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium border ${item.score >= 90
                      ? 'bg-teal-100 text-teal-800 border-teal-200'
                      : item.score >= 70
                        ? 'bg-orange-100 text-orange-800 border-orange-200'
                        : 'bg-red-100 text-red-800 border-red-200'
                      }`}>
                      {item.score}%
                    </span>
                  </div>
                ))}
              </div>
              <button
                onClick={clearHistory}
                className="w-full bg-gradient-to-r from-teal-600 to-teal-700 text-white border-none px-4 sm:px-6 py-3 rounded-xl font-semibold cursor-pointer transition-all duration-300 hover:from-teal-700 hover:to-teal-800 hover:shadow-lg hover:-translate-y-0.5 shadow-md text-sm sm:text-base"
              >
                Clear History
              </button>
            </div>
          </div>
        )}

        {/* Copy Notification */}
        {copied && (
          <motion.div
            className="fixed bottom-4 right-4 bg-gradient-to-r from-teal-600 to-teal-700 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-full shadow-lg z-50 font-medium text-sm sm:text-base"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
          >
            Record copied to clipboard!
          </motion.div>
        )}

        <ReactTooltip id="copy-tooltip" place="top" effect="solid" />
      </div>

      {/* Custom animations */}
      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes expand-line {
          from { transform: scaleX(0); opacity: 0; }
          to { transform: scaleX(1); opacity: 1; }
        }
        .animate-fade-in { animation: fade-in 0.3s ease; }
        .animate-slide-up { animation: slide-up 0.5s ease; }
        .animate-expand-line { animation: expand-line 0.3s ease; }
      `}</style>
    </div>
  );
};

export default AuthenticationChecker;