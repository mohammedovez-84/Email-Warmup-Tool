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

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Simulate DNS record lookup
  const lookupDnsRecord = async (type, domain) => {
    // In a real application, you would make API calls to DNS servers
    // This is a simulation of what the responses might look like

    // Simulate different scenarios based on domain
    const scenarios = {
      'good.com': {
        spf: `v=spf1 include:spf.${domain} include:_spf.google.com -all`,
        dkim: `v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAujYxD04JSq3`,
        dmarc: `v=DMARC1; p=reject; rua=mailto:dmarc@${domain}; ruf=mailto:dmarc-forensics@${domain}; fo=1`
      },
      'warning.com': {
        spf: `v=spf1 include:spf.${domain} ~all`,
        dkim: `v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAujYxD04JSq3`,
        dmarc: `v=DMARC1; p=none; rua=mailto:dmarc@${domain}`
      },
      'error.com': {
        spf: null,
        dkim: null,
        dmarc: null
      }
    };

    // Default to good configuration if domain doesn't match scenarios
    const scenario = Object.keys(scenarios).find(s => domain.includes(s)) || 'good.com';

    return scenarios[scenario][type] || null;
  };

  // Simulate blacklist check
  const checkBlacklists = async (domain) => {
    // In a real application, you would check multiple blacklist databases
    const blacklists = [
      { name: 'Spamhaus', listed: false },
      { name: 'Barracuda', listed: false },
      { name: 'SORBS', listed: false },
      { name: 'SpamCop', listed: false },
      { name: 'URIBL', listed: false },
      { name: 'PSBL', listed: false }
    ];

    // For error.com domain, simulate some blacklist issues
    if (domain.includes('error.com')) {
      blacklists[0].listed = true;
      blacklists[3].listed = true;
    }

    return blacklists;
  };

  // Simulate BIMI check
  const checkBimi = async (domain) => {
    // Simulate different scenarios
    if (domain.includes('good.com')) {
      return {
        exists: true,
        record: `v=BIMI1; l=https://${domain}/logo.svg; a=https://${domain}/cert.pem`,
        valid: true,
        recommendation: 'BIMI is properly configured with a valid logo and certificate.'
      };
    }

    return {
      exists: false,
      record: null,
      valid: false,
      recommendation: 'No BIMI record found. BIMI allows brands to display logos in supporting email clients.'
    };
  };

  const handleDomainSubmit = async (e) => {
    e.preventDefault();
    if (!domain) return;

    setIsLoading(true);

    try {
      // Simulate API calls with timeouts
      const [spfRecord, dkimRecord, dmarcRecord, blacklistResults, bimiResults] = await Promise.all([
        lookupDnsRecord('spf', domain),
        lookupDnsRecord('dkim', domain),
        lookupDnsRecord('dmarc', domain),
        checkBlacklists(domain),
        checkBimi(domain)
      ]);

      // Calculate scores based on results
      const spfScore = spfRecord ? (spfRecord.includes('-all') ? 100 : 80) : 0;
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

      // Generate issues list
      const issues = [];

      if (!spfRecord) {
        issues.push({
          type: 'error',
          category: 'SPF',
          message: 'No SPF record found',
          description: 'This can lead to email delivery issues and spoofing.'
        });
      } else if (!spfRecord.includes('-all')) {
        issues.push({
          type: 'warning',
          category: 'SPF',
          message: 'SPF uses softfail (~all) instead of hardfail (-all)',
          description: 'Consider changing ~all to -all for stricter enforcement.'
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
          valid: !!spfRecord,
          record: spfRecord,
          mechanisms: spfRecord ? [
            { type: 'include', value: `spf.${domain}`, valid: true },
            { type: 'include', value: '_spf.google.com', valid: true },
            { type: 'all', value: spfRecord.includes('-all') ? '-all' : '~all', valid: true }
          ] : [],
          lookups: spfRecord ? 2 : 0,
          pass: !!spfRecord,
          recommendation: spfRecord ?
            (spfRecord.includes('-all') ?
              'Your SPF record is properly configured with strict enforcement.' :
              'Your SPF record is configured but uses softfail. Consider changing ~all to -all for stricter enforcement.') :
            'No SPF record found. This can lead to email delivery issues.'
        },
        dkim: {
          exists: !!dkimRecord,
          valid: !!dkimRecord,
          selector: 'default',
          record: dkimRecord,
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
            dmarcRecord.match(/sp=(reject|quarantine|none)/)[1] : null,
          percentage: dmarcRecord && dmarcRecord.includes('pct=') ?
            parseInt(dmarcRecord.match(/pct=(\d+)/)[1]) : 100,
          aggregateReporting: dmarcRecord && dmarcRecord.includes('rua=') ?
            dmarcRecord.match(/rua=mailto:([^;]+)/)[1] : 'not set',
          forensicReporting: dmarcRecord && dmarcRecord.includes('ruf=') ?
            dmarcRecord.match(/ruf=mailto:([^;]+)/)[1] : 'not set',
          alignment: {
            spf: dmarcRecord && dmarcRecord.includes('aspf=') ?
              dmarcRecord.match(/aspf=([r|s])/)[1] === 'r' ? 'relaxed' : 'strict' : 'relaxed',
            dkim: dmarcRecord && dmarcRecord.includes('adkim=') ?
              dmarcRecord.match(/adkim=([r|s])/)[1] === 'r' ? 'relaxed' : 'strict' : 'relaxed'
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
      <FiCheckCircle className="text-green-500 text-xl" />
    ) : (
      <FiAlertTriangle className="text-yellow-500 text-xl" />
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
          <div className="p-0 font-['Poppins']">
            {results && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 flex items-center gap-3 sm:gap-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center text-xl sm:text-2xl">
                      <FiMail />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm text-gray-600 font-medium mb-1">SPF</h4>
                      <p className={results.spf.exists ? 'text-green-600 text-lg sm:text-xl font-bold' : 'text-red-600 text-lg sm:text-xl font-bold'}>
                        {results.spf.exists ? 'Configured' : 'Not Found'}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 flex items-center gap-3 sm:gap-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center text-xl sm:text-2xl">
                      <FiLock />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm text-gray-600 font-medium mb-1">DKIM</h4>
                      <p className={results.dkim.exists ? 'text-green-600 text-lg sm:text-xl font-bold' : 'text-red-600 text-lg sm:text-xl font-bold'}>
                        {results.dkim.exists ? 'Configured' : 'Not Found'}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 flex items-center gap-3 sm:gap-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-teal-100 text-teal-600 rounded-2xl flex items-center justify-center text-xl sm:text-2xl">
                      <FiShield />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm text-gray-600 font-medium mb-1">DMARC</h4>
                      <p className={results.dmarc.exists ? 'text-green-600 text-lg sm:text-xl font-bold' : 'text-red-600 text-lg sm:text-xl font-bold'}>
                        {results.dmarc.exists ? 'Configured' : 'Not Found'}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 flex items-center gap-3 sm:gap-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center text-xl sm:text-2xl">
                      <FiList />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm text-gray-600 font-medium mb-1">Blacklists</h4>
                      <p className={results.blacklist.listed === 0 ? 'text-green-600 text-lg sm:text-xl font-bold' : 'text-red-600 text-lg sm:text-xl font-bold'}>
                        {results.blacklist.listed === 0 ? 'Clean' : `${results.blacklist.listed} Listed`}
                      </p>
                    </div>
                  </div>
                </div>

                {results.issues && results.issues.length > 0 && (
                  <div className="bg-white rounded-2xl p-4 sm:p-6 mb-6 shadow-sm font-['Poppins']">
                    <h3 className="text-lg sm:text-xl font-bold mb-4 flex items-center">
                      <FiAlertTriangle className="mr-2 text-orange-500" />
                      Domain Health Issues
                    </h3>
                    <div className="space-y-4">
                      {results.issues.map((issue, index) => (
                        <div key={index} className={`flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl ${issue.type === 'error'
                            ? 'bg-red-50 border-l-4 border-red-500'
                            : issue.type === 'warning'
                              ? 'bg-yellow-50 border-l-4 border-yellow-500'
                              : 'bg-blue-50 border-l-4 border-blue-500'
                          }`}>
                          <div className="flex-shrink-0 mt-1">
                            {issue.type === 'error' && <FiAlertTriangle className="text-red-500 text-lg sm:text-xl" />}
                            {issue.type === 'warning' && <FiAlertTriangle className="text-yellow-500 text-lg sm:text-xl" />}
                            {issue.type === 'info' && <FiInfo className="text-blue-500 text-lg sm:text-xl" />}
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

                <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm font-['Poppins']">
                  <h3 className="text-lg sm:text-xl font-bold mb-4 flex items-center">
                    <FiCheckCircle className="mr-2 text-green-500" />
                    Recommendations
                  </h3>
                  <div className="space-y-3">
                    {results.spf.recommendation && (
                      <div className="bg-blue-50 rounded-xl p-3 sm:p-4 border-l-4 border-blue-500">
                        <div className="flex items-start">
                          <FiArrowRight className="mt-1 mr-2 text-blue-500 flex-shrink-0" />
                          <p className="text-gray-700 text-sm sm:text-base">{results.spf.recommendation}</p>
                        </div>
                      </div>
                    )}

                    {results.dkim.recommendation && (
                      <div className="bg-blue-50 rounded-xl p-3 sm:p-4 border-l-4 border-blue-500">
                        <div className="flex items-start">
                          <FiArrowRight className="mt-1 mr-2 text-blue-500 flex-shrink-0" />
                          <p className="text-gray-700 text-sm sm:text-base">{results.dkim.recommendation}</p>
                        </div>
                      </div>
                    )}

                    {results.dmarc.recommendation && (
                      <div className="bg-blue-50 rounded-xl p-3 sm:p-4 border-l-4 border-blue-500">
                        <div className="flex items-start">
                          <FiArrowRight className="mt-1 mr-2 text-blue-500 flex-shrink-0" />
                          <p className="text-gray-700 text-sm sm:text-base">{results.dmarc.recommendation}</p>
                        </div>
                      </div>
                    )}

                    {results.blacklist.recommendation && (
                      <div className="bg-blue-50 rounded-xl p-3 sm:p-4 border-l-4 border-blue-500">
                        <div className="flex items-start">
                          <FiArrowRight className="mt-1 mr-2 text-blue-500 flex-shrink-0" />
                          <p className="text-gray-700 text-sm sm:text-base">{results.blacklist.recommendation}</p>
                        </div>
                      </div>
                    )}

                    {results.bimi.recommendation && (
                      <div className="bg-blue-50 rounded-xl p-3 sm:p-4 border-l-4 border-blue-500">
                        <div className="flex items-start">
                          <FiArrowRight className="mt-1 mr-2 text-blue-500 flex-shrink-0" />
                          <p className="text-gray-700 text-sm sm:text-base">{results.bimi.recommendation}</p>
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
          <div className="border border-gray-200 rounded-2xl mb-6 overflow-hidden transition-all duration-300 hover:shadow-lg font-['Poppins']">
            <div
              className="bg-gray-50 border-b border-gray-200 px-4 sm:px-6 py-4 sm:py-5 cursor-pointer flex justify-between items-center hover:bg-gray-100 transition-colors"
              onClick={() => toggleSection('spf')}
            >
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center">
                <FiMail className="inline mr-2" />
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
                        ? 'bg-green-50 border-l-4 border-green-500'
                        : 'bg-yellow-50 border-l-4 border-yellow-500'
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
                            <SyntaxHighlighter language="dns" style={atomOneDark} className="rounded-md text-xs sm:text-sm">
                              {results.spf.record}
                            </SyntaxHighlighter>
                            <CopyToClipboard text={results.spf.record} onCopy={() => setCopied(true)}>
                              <button className="inline-flex items-center gap-2 bg-gradient-to-r from-teal-800 to-teal-600 text-white border-none px-4 sm:px-5 py-2 sm:py-3 rounded-full mt-3 text-sm font-medium cursor-pointer transition-all duration-200 hover:opacity-90 hover:-translate-y-0.5 shadow-md">
                                <FiCopy /> Copy Record
                              </button>
                            </CopyToClipboard>
                          </div>

                          <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm">
                            <h4 className="font-semibold text-gray-900 mb-3">Mechanisms</h4>
                            <ul className="space-y-2">
                              {results.spf.mechanisms.map((mechanism, idx) => (
                                <li key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                                  <div className="flex items-center gap-2 sm:gap-3">
                                    <span className="font-medium text-gray-700 text-xs sm:text-sm w-16 sm:w-20">{mechanism.type}</span>
                                    <span className="font-mono text-xs sm:text-sm text-gray-600 flex-1 truncate">{mechanism.value}</span>
                                  </div>
                                  {mechanism.valid ? (
                                    <FiCheckCircle className="text-green-500 flex-shrink-0" />
                                  ) : (
                                    <FiAlertTriangle className="text-yellow-500 flex-shrink-0" />
                                  )}
                                </li>
                              ))}
                            </ul>
                            <p className="text-sm text-gray-500 mt-3">Total lookups: {results.spf.lookups}/10</p>
                          </div>
                        </div>
                      )}

                      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 mt-4 shadow-sm">
                        <h4 className="font-semibold text-gray-900 mb-2">Recommendation</h4>
                        <p className="text-gray-700 text-sm sm:text-base">{results.spf.recommendation}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 shadow-sm">
                    <h4 className="font-semibold text-gray-900 mb-3">SPF Check</h4>
                    <p className="text-gray-600 mb-4 text-sm sm:text-base">SPF (Sender Policy Framework) is an email authentication method designed to detect forging sender addresses during the delivery of the email.</p>
                    <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                      <h5 className="font-semibold text-gray-900 mb-2">How it works:</h5>
                      <ul className="list-disc list-inside space-y-1 text-gray-600 text-sm sm:text-base">
                        <li>SPF allows receiving mail servers to check that incoming mail from a domain comes from a host authorized by that domain's administrators</li>
                        <li>It lists designated mail servers in a DNS TXT record</li>
                        <li>Receiving servers verify the sending server's IP against the published SPF record</li>
                        <li>If the check fails, the receiving server can reject or mark the email as suspicious</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 'dkim':
        return (
          <div className="border border-gray-200 rounded-2xl mb-6 overflow-hidden transition-all duration-300 hover:shadow-lg font-['Poppins']">
            <div
              className="bg-gray-50 border-b border-gray-200 px-4 sm:px-6 py-4 sm:py-5 cursor-pointer flex justify-between items-center hover:bg-gray-100 transition-colors"
              onClick={() => toggleSection('dkim')}
            >
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center">
                <FiLock className="inline mr-2" />
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
                        ? 'bg-green-50 border-l-4 border-green-500'
                        : 'bg-yellow-50 border-l-4 border-yellow-500'
                      }`}>
                      <div className="mb-4">
                        <p className="font-semibold text-lg text-gray-900 mb-1">
                          {results.dkim.exists ? `DKIM is properly configured for selector '${results.dkim.selector}'` : 'No DKIM record found'}
                        </p>
                        <span className="text-sm text-gray-500">Last checked: {new Date(results.lastChecked).toLocaleString()}</span>
                      </div>

                      {results.dkim.exists && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-4">
                          <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm">
                            <h4 className="font-semibold text-gray-900 mb-3">Record Details</h4>
                            <SyntaxHighlighter language="dns" style={atomOneDark} className="rounded-md text-xs sm:text-sm">
                              {results.dkim.record}
                            </SyntaxHighlighter>
                            <CopyToClipboard text={results.dkim.record} onCopy={() => setCopied(true)}>
                              <button className="inline-flex items-center gap-2 bg-gradient-to-r from-teal-800 to-teal-600 text-white border-none px-4 sm:px-5 py-2 sm:py-3 rounded-full mt-3 text-sm font-medium cursor-pointer transition-all duration-200 hover:opacity-90 hover:-translate-y-0.5 shadow-md">
                                <FiCopy /> Copy Record
                              </button>
                            </CopyToClipboard>
                          </div>

                          <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm">
                            <h4 className="font-semibold text-gray-900 mb-3">Key Information</h4>
                            <ul className="space-y-2 sm:space-y-3">
                              <li className="flex justify-between items-center py-2 border-b border-gray-100">
                                <span className="text-gray-600 text-sm sm:text-base">Key Type:</span>
                                <span className="font-medium text-gray-900 text-sm sm:text-base">RSA</span>
                              </li>
                              <li className="flex justify-between items-center py-2 border-b border-gray-100">
                                <span className="text-gray-600 text-sm sm:text-base">Key Length:</span>
                                <span className="font-medium text-gray-900 text-sm sm:text-base">{results.dkim.keyLength} bits</span>
                              </li>
                              <li className="flex justify-between items-center py-2">
                                <span className="text-gray-600 text-sm sm:text-base">Public Key Valid:</span>
                                <span className="font-medium text-gray-900 text-sm sm:text-base">{results.dkim.publicKeyValid ? 'Yes' : 'No'}</span>
                              </li>
                            </ul>
                          </div>
                        </div>
                      )}

                      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 mt-4 shadow-sm">
                        <h4 className="font-semibold text-gray-900 mb-2">Recommendation</h4>
                        <p className="text-gray-700 text-sm sm:text-base">{results.dkim.recommendation}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 shadow-sm">
                    <h4 className="font-semibold text-gray-900 mb-3">DKIM Check</h4>
                    <p className="text-gray-600 mb-4 text-sm sm:text-base">DKIM (DomainKeys Identified Mail) is an email authentication method that allows the receiver to check that an email was indeed sent and authorized by the owner of that domain.</p>
                    <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                      <h5 className="font-semibold text-gray-900 mb-2">How it works:</h5>
                      <ul className="list-disc list-inside space-y-1 text-gray-600 text-sm sm:text-base">
                        <li>DKIM uses cryptographic signatures to verify that message content hasn't been altered in transit</li>
                        <li>The sending server signs the email with a private key</li>
                        <li>The receiving server retrieves the public key from DNS records to verify the signature</li>
                        <li>If verification fails, the email may be rejected or marked as suspicious</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 'dmarc':
        return (
          <div className="border border-gray-200 rounded-2xl mb-6 overflow-hidden transition-all duration-300 hover:shadow-lg font-['Poppins']">
            <div
              className="bg-gray-50 border-b border-gray-200 px-4 sm:px-6 py-4 sm:py-5 cursor-pointer flex justify-between items-center hover:bg-gray-100 transition-colors"
              onClick={() => toggleSection('dmarc')}
            >
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center">
                <FiShield className="inline mr-2" />
                DMARC (Domain-based Message Authentication, Reporting & Conformance)
                {results?.dmarc && getStatusIcon(results.dmarc.valid)}
              </h3>
              {expandedSections.dmarc ? <FiChevronUp className="text-gray-500" /> : <FiChevronDown className="text-gray-500" />}
            </div>

            {expandedSections.dmarc && (
              <div className="bg-white p-4 sm:p-6 animate-fade-in">
                {results ? (
                  <>
                    <div className={`rounded-xl p-4 sm:p-6 ${results.dmarc.valid
                        ? 'bg-green-50 border-l-4 border-green-500'
                        : 'bg-yellow-50 border-l-4 border-yellow-500'
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
                            <SyntaxHighlighter language="dns" style={atomOneDark} className="rounded-md text-xs sm:text-sm">
                              {results.dmarc.record}
                            </SyntaxHighlighter>
                            <CopyToClipboard text={results.dmarc.record} onCopy={() => setCopied(true)}>
                              <button className="inline-flex items-center gap-2 bg-gradient-to-r from-teal-800 to-teal-600 text-white border-none px-4 sm:px-5 py-2 sm:py-3 rounded-full mt-3 text-sm font-medium cursor-pointer transition-all duration-200 hover:opacity-90 hover:-translate-y-0.5 shadow-md">
                                <FiCopy /> Copy Record
                              </button>
                            </CopyToClipboard>
                          </div>

                          <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm">
                            <h4 className="font-semibold text-gray-900 mb-3">Policy Details</h4>
                            <ul className="space-y-2">
                              <li className="flex justify-between items-center py-2 border-b border-gray-100">
                                <span className="text-gray-600 text-sm sm:text-base">Policy:</span>
                                <span className="font-medium text-gray-900 text-sm sm:text-base capitalize">{results.dmarc.policy}</span>
                              </li>
                              <li className="flex justify-between items-center py-2 border-b border-gray-100">
                                <span className="text-gray-600 text-sm sm:text-base">Subdomain Policy:</span>
                                <span className="font-medium text-gray-900 text-sm sm:text-base">{results.dmarc.subdomainPolicy || 'Inherits from parent'}</span>
                              </li>
                              <li className="flex justify-between items-center py-2 border-b border-gray-100">
                                <span className="text-gray-600 text-sm sm:text-base">Percentage:</span>
                                <span className="font-medium text-gray-900 text-sm sm:text-base">{results.dmarc.percentage}%</span>
                              </li>
                              <li className="flex justify-between items-center py-2 border-b border-gray-100">
                                <span className="text-gray-600 text-sm sm:text-base">Aggregate Reports:</span>
                                <span className="font-medium text-gray-900 text-sm sm:text-base">{results.dmarc.aggregateReporting}</span>
                              </li>
                              <li className="flex justify-between items-center py-2 border-b border-gray-100">
                                <span className="text-gray-600 text-sm sm:text-base">Forensic Reports:</span>
                                <span className="font-medium text-gray-900 text-sm sm:text-base">{results.dmarc.forensicReporting || 'Not configured'}</span>
                              </li>
                              <li className="flex justify-between items-center py-2 border-b border-gray-100">
                                <span className="text-gray-600 text-sm sm:text-base">SPF Alignment:</span>
                                <span className="font-medium text-gray-900 text-sm sm:text-base capitalize">{results.dmarc.alignment.spf}</span>
                              </li>
                              <li className="flex justify-between items-center py-2">
                                <span className="text-gray-600 text-sm sm:text-base">DKIM Alignment:</span>
                                <span className="font-medium text-gray-900 text-sm sm:text-base capitalize">{results.dmarc.alignment.dkim}</span>
                              </li>
                            </ul>
                          </div>
                        </div>
                      )}

                      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 mt-4 shadow-sm">
                        <h4 className="font-semibold text-gray-900 mb-2">Recommendation</h4>
                        <p className="text-gray-700 text-sm sm:text-base">{results.dmarc.recommendation}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 shadow-sm">
                    <h4 className="font-semibold text-gray-900 mb-3">DMARC Check</h4>
                    <p className="text-gray-600 mb-4 text-sm sm:text-base">DMARC (Domain-based Message Authentication, Reporting & Conformance) is an email authentication protocol that builds on SPF and DKIM protocols.</p>
                    <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                      <h5 className="font-semibold text-gray-900 mb-2">How it works:</h5>
                      <ul className="list-disc list-inside space-y-1 text-gray-600 text-sm sm:text-base">
                        <li>DMARC allows domain owners to publish policies that specify how to handle emails that fail SPF and/or DKIM checks</li>
                        <li>It provides reporting mechanisms so domain owners can monitor authentication results</li>
                        <li>Receiving mail servers can reject or quarantine emails that fail DMARC checks</li>
                        <li>DMARC helps protect against phishing and spoofing attacks</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 'blacklist':
        return (
          <div className="border border-gray-200 rounded-2xl mb-6 overflow-hidden transition-all duration-300 hover:shadow-lg font-['Poppins']">
            <div
              className="bg-gray-50 border-b border-gray-200 px-4 sm:px-6 py-4 sm:py-5 cursor-pointer flex justify-between items-center hover:bg-gray-100 transition-colors"
              onClick={() => toggleSection('blacklist')}
            >
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center">
                <FiList className="inline mr-2" />
                Blacklist Check
                {results?.blacklist && getStatusIcon(results.blacklist.listed === 0)}
              </h3>
              {expandedSections.blacklist ? <FiChevronUp className="text-gray-500" /> : <FiChevronDown className="text-gray-500" />}
            </div>

            {expandedSections.blacklist && (
              <div className="bg-white p-4 sm:p-6 animate-fade-in">
                {results ? (
                  <div className={`rounded-xl p-4 sm:p-6 ${results.blacklist.listed === 0
                      ? 'bg-green-50 border-l-4 border-green-500'
                      : 'bg-yellow-50 border-l-4 border-yellow-500'
                    }`}>
                    <div className="mb-4">
                      <p className="font-semibold text-lg text-gray-900 mb-1">
                        {results.blacklist.listed === 0 ?
                          'Your domain is not listed on any major blacklists' :
                          `Your domain is listed on ${results.blacklist.listed} blacklist(s)`}
                      </p>
                      <span className="text-sm text-gray-500">Last checked: {new Date(results.lastChecked).toLocaleString()}</span>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm">
                      <h4 className="font-semibold text-gray-900 mb-3">Blacklist Results</h4>
                      <div className="space-y-2">
                        {results.blacklist.details.map((blacklist, index) => (
                          <div key={index} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
                            <span className="font-medium text-gray-900 text-sm sm:text-base">{blacklist.name}</span>
                            <span className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${blacklist.listed
                                ? 'bg-red-100 text-red-800'
                                : 'bg-green-100 text-green-800'
                              }`}>
                              {blacklist.listed ? 'Listed' : 'Not Listed'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 mt-4 shadow-sm">
                      <h4 className="font-semibold text-gray-900 mb-2">Recommendation</h4>
                      <p className="text-gray-700 text-sm sm:text-base">{results.blacklist.recommendation}</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 shadow-sm">
                    <h4 className="font-semibold text-gray-900 mb-3">Blacklist Monitoring</h4>
                    <p className="text-gray-600 mb-4 text-sm sm:text-base">Check if your domain or IP address is listed on any major email blacklists that could affect email deliverability.</p>
                    <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                      <h5 className="font-semibold text-gray-900 mb-2">About Blacklists:</h5>
                      <ul className="list-disc list-inside space-y-1 text-gray-600 text-sm sm:text-base">
                        <li>Blacklists are databases of IP addresses or domains known for sending spam</li>
                        <li>Being listed can significantly impact your email deliverability</li>
                        <li>Regular monitoring helps identify and resolve issues quickly</li>
                        <li>Common blacklists include Spamhaus, Barracuda, SORBS, and others</li>
                      </ul>
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
    <div className={`min-h-screen bg-gray-50 font-['Poppins',_-apple-system,_BlinkMacSystemFont,_'Segoe_UI',_Roboto,_sans-serif] transition-colors duration-300 ${darkMode ? 'dark bg-gray-900' : ''}`}>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Header */}
        <div className="bg-white border-2 border-transparent bg-gradient-to-r from-teal-800 to-teal-600 bg-origin-border rounded-2xl p-4 sm:p-8 text-gray-900 mb-6 sm:mb-8 shadow-xl relative overflow-hidden">
          <div className="bg-white rounded-xl p-4 sm:p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-teal-800 to-teal-600 bg-clip-text text-transparent">
                Email Authentication Checker
              </h2>
              <div className="flex gap-2">
                {/* Settings and Download buttons removed */}
              </div>
            </div>

            <p className="text-gray-600 mb-4 sm:mb-6 text-base sm:text-lg">
              Comprehensive tool for SPF, DKIM, and DMARC configuration, validation, and deployment
            </p>

            <AnimatePresence>
              {showSettings && (
                <motion.div
                  className="bg-gray-50 border border-gray-200 rounded-xl mb-4 overflow-hidden"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <div className="flex justify-between items-center p-4 border-b border-gray-200">
                    <h3 className="text-gray-900 font-semibold">Settings</h3>
                    <button
                      onClick={() => setShowSettings(false)}
                      className="text-gray-600 hover:text-gray-900"
                    >
                      <FiX />
                    </button>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex items-center">
                      <label className="flex items-center gap-2 cursor-pointer text-gray-700">
                        <input
                          type="checkbox"
                          checked={autoRefresh}
                          onChange={(e) => setAutoRefresh(e.target.checked)}
                          className="rounded border-gray-300 text-teal-800 focus:ring-teal-800"
                        />
                        Auto-refresh results
                      </label>
                    </div>
                    <div className="flex items-center">
                      <label className="flex items-center gap-2 cursor-pointer text-gray-700">
                        <input
                          type="checkbox"
                          checked={darkMode}
                          onChange={(e) => setDarkMode(e.target.checked)}
                          className="rounded border-gray-300 text-teal-800 focus:ring-teal-800"
                        />
                        Dark mode
                      </label>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleDomainSubmit} className="max-w-2xl mx-auto">
              <div className="flex flex-col">
                <label className="text-gray-700 font-medium mb-2 text-left">
                  Enter your domain (example.com):
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="example.com"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className="flex-1 px-4 sm:px-6 py-3 sm:py-4 border-2 border-gray-300 rounded-full text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:border-teal-800 focus:ring-2 focus:ring-teal-800 focus:ring-opacity-20 font-['Poppins'] transition-all duration-300"
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !domain}
                    className="px-6 sm:px-8 bg-gradient-to-r from-teal-800 to-teal-600 text-white border-none rounded-full font-semibold cursor-pointer transition-all duration-300 hover:opacity-90 hover:-translate-y-1 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none font-['Poppins'] py-3 sm:py-4 text-sm sm:text-base"
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <FiRefreshCw className="animate-spin" />
                        Checking...
                      </span>
                    ) : (
                      'Check Authentication'
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* Overall Score */}
        {results && (
          <div className="flex justify-center mb-6 sm:mb-8">
            <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 text-center shadow-xl animate-fade-in w-full max-w-xs sm:max-w-sm font-['Poppins']">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">Domain Health Score</h3>
              <div className="mb-4 sm:mb-6 relative flex justify-center items-center">
                <div className="relative w-24 h-24 sm:w-32 sm:h-32">
                  <svg viewBox="0 0 36 36" className="w-full h-full">
                    <path
                      className="stroke-gray-200 fill-none stroke-[3.8]"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className={`fill-none stroke-[2.8] stroke-linecap-round transition-all duration-1000 ${getScoreClass(results.overallScore) === 'excellent' ? 'stroke-green-500' :
                          getScoreClass(results.overallScore) === 'good' ? 'stroke-green-400' :
                            getScoreClass(results.overallScore) === 'fair' ? 'stroke-yellow-500' : 'stroke-red-500'
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
                    getScoreClass(results.overallScore) === 'fair' ? 'text-teal-400' : 'text-teal-300'
                }`}>
                Your email authentication is {getScoreClass(results.overallScore)}
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden animate-slide-up font-['Poppins']">
          <div className="bg-gradient-to-r from-teal-800 to-teal-600 overflow-x-auto">
            <div className="flex min-w-max">
              <button
                className={`px-4 sm:px-6 py-4 sm:py-5 bg-none border-none cursor-pointer font-medium text-white/80 flex items-center gap-2 transition-all duration-300 whitespace-nowrap hover:text-white hover:bg-white/10 relative ${activeTab === 'overview' ? 'text-white font-semibold' : ''
                  }`}
                onClick={() => setActiveTab('overview')}
              >
                <FiGlobe className="text-base sm:text-lg" />
                Overview
                {activeTab === 'overview' && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-white animate-expand-line"></div>
                )}
              </button>
              <button
                className={`px-4 sm:px-6 py-4 sm:py-5 bg-none border-none cursor-pointer font-medium text-white/80 flex items-center gap-2 transition-all duration-300 whitespace-nowrap hover:text-white hover:bg-white/10 relative ${activeTab === 'spf' ? 'text-white font-semibold' : ''
                  }`}
                onClick={() => setActiveTab('spf')}
              >
                <FiMail className="text-base sm:text-lg" />
                SPF
                {activeTab === 'spf' && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-white animate-expand-line"></div>
                )}
              </button>
              <button
                className={`px-4 sm:px-6 py-4 sm:py-5 bg-none border-none cursor-pointer font-medium text-white/80 flex items-center gap-2 transition-all duration-300 whitespace-nowrap hover:text-white hover:bg-white/10 relative ${activeTab === 'dkim' ? 'text-white font-semibold' : ''
                  }`}
                onClick={() => setActiveTab('dkim')}
              >
                <FiLock className="text-base sm:text-lg" />
                DKIM
                {activeTab === 'dkim' && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-white animate-expand-line"></div>
                )}
              </button>
              <button
                className={`px-4 sm:px-6 py-4 sm:py-5 bg-none border-none cursor-pointer font-medium text-white/80 flex items-center gap-2 transition-all duration-300 whitespace-nowrap hover:text-white hover:bg-white/10 relative ${activeTab === 'dmarc' ? 'text-white font-semibold' : ''
                  }`}
                onClick={() => setActiveTab('dmarc')}
              >
                <FiShield className="text-base sm:text-lg" />
                DMARC
                {activeTab === 'dmarc' && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-white animate-expand-line"></div>
                )}
              </button>
              <button
                className={`px-4 sm:px-6 py-4 sm:py-5 bg-none border-none cursor-pointer font-medium text-white/80 flex items-center gap-2 transition-all duration-300 whitespace-nowrap hover:text-white hover:bg-white/10 relative ${activeTab === 'blacklist' ? 'text-white font-semibold' : ''
                  }`}
                onClick={() => setActiveTab('blacklist')}
              >
                <FiList className="text-base sm:text-lg" />
                Blacklist
                {activeTab === 'blacklist' && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-white animate-expand-line"></div>
                )}
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-8">
            {renderTabContent()}
          </div>
        </div>

        {/* History Panel */}
{history.length > 0 && (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 mt-6 sm:mt-8 text-left shadow-sm font-['Poppins']">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Recent Checks</h4>
        
        {/* Headers */}
        <div className="hidden sm:flex justify-between items-center mb-3 px-3 text-sm font-semibold text-gray-600">
            <span className="w-2/5">Domain</span>
            <span className="w-1/4 text-center">Date</span>
            <span className="w-1/3 text-center">Score</span>
        </div>
        
        <div className="space-y-2 mb-4">
            {history.map((item, index) => (
                <div
                    key={index}
                    className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 rounded-xl cursor-pointer transition-colors hover:bg-gray-50 gap-2 sm:gap-0"
                    onClick={() => loadFromHistory(item.domain)}
                >
                    {/* Domain */}
                    <span className="font-medium text-gray-900 text-sm sm:text-base sm:w-2/5">{item.domain}</span>
                    
                    {/* Date - Centered and properly aligned */}
                    <span className="text-xs sm:text-sm text-gray-500 sm:w-1/4 text-center">{new Date(item.date).toLocaleDateString()}</span>
                    
                    {/* Score with progress bar - Centered and properly aligned */}
                    <div className="flex items-center gap-2 sm:w-1/3 justify-center">
                        <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                    getScoreClass(item.score) === 'excellent' ? 'bg-green-500' :
                                    getScoreClass(item.score) === 'good' ? 'bg-green-400' :
                                    getScoreClass(item.score) === 'fair' ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${item.score}%` }}
                            ></div>
                        </div>
                        <span className="text-xs sm:text-sm font-medium text-gray-700">{item.score}%</span>
                    </div>
                </div>
            ))}
        </div>
        
        <button
            className="bg-gradient-to-r from-teal-800 to-teal-600 text-white border-none px-4 sm:px-6 py-2 sm:py-3 rounded-full cursor-pointer text-sm font-medium transition-all duration-300 hover:opacity-90 hover:-translate-y-0.5 shadow-md w-full sm:w-auto"
            onClick={clearHistory}
        >
            Clear History
        </button>
    </div>
)}


        {/* Copy Notification */}
        {copied && (
          <motion.div
            className="fixed bottom-4 right-4 bg-gradient-to-r from-teal-800 to-teal-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-full shadow-lg z-50 font-medium font-['Poppins'] text-sm sm:text-base"
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