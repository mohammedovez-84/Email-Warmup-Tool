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
          <div className="overview-tab">
            {results && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="stat-card">
                    <div className="stat-icon bg-blue-100 text-blue-600">
                      <FiMail />
                    </div>
                    <div className="stat-content">
                      <h4>SPF</h4>
                      <p className={results.spf.exists ? 'text-green-600' : 'text-red-600'}>
                        {results.spf.exists ? 'Configured' : 'Not Found'}
                      </p>
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-icon bg-purple-100 text-purple-600">
                      <FiLock />
                    </div>
                    <div className="stat-content">
                      <h4>DKIM</h4>
                      <p className={results.dkim.exists ? 'text-green-600' : 'text-red-600'}>
                        {results.dkim.exists ? 'Configured' : 'Not Found'}
                      </p>
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-icon bg-teal-100 text-teal-600">
                      <FiShield />
                    </div>
                    <div className="stat-content">
                      <h4>DMARC</h4>
                      <p className={results.dmarc.exists ? 'text-green-600' : 'text-red-600'}>
                        {results.dmarc.exists ? 'Configured' : 'Not Found'}
                      </p>
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-icon bg-orange-100 text-orange-600">
                      <FiList />
                    </div>
                    <div className="stat-content">
                      <h4>Blacklists</h4>
                      <p className={results.blacklist.listed === 0 ? 'text-green-600' : 'text-red-600'}>
                        {results.blacklist.listed === 0 ? 'Clean' : `${results.blacklist.listed} Listed`}
                      </p>
                    </div>
                  </div>
                </div>

                {results.issues && results.issues.length > 0 && (
                  <div className="issues-section mb-6">
                    <h3 className="text-xl font-bold mb-4 flex items-center">
                      <FiAlertTriangle className="mr-2 text-orange-500" />
                      Domain Health Issues
                    </h3>
                    <div className="issues-grid">
                      {results.issues.map((issue, index) => (
                        <div key={index} className={`issue-item ${issue.type}`}>
                          <div className="issue-icon">
                            {issue.type === 'error' && <FiAlertTriangle className="text-red-500" />}
                            {issue.type === 'warning' && <FiAlertTriangle className="text-yellow-500" />}
                            {issue.type === 'info' && <FiInfo className="text-blue-500" />}
                          </div>
                          <div className="issue-content">
                            <h4 className="font-semibold">{issue.category}: {issue.message}</h4>
                            <p>{issue.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="recommendations-section">
                  <h3 className="text-xl font-bold mb-4 flex items-center">
                    <FiCheckCircle className="mr-2 text-green-500" />
                    Recommendations
                  </h3>
                  <div className="recommendations-grid">
                    {results.spf.recommendation && (
                      <div className="recommendation-item">
                        <div className="flex items-start">
                          <FiArrowRight className="mt-1 mr-2 text-blue-500 flex-shrink-0" />
                          <p>{results.spf.recommendation}</p>
                        </div>
                      </div>
                    )}

                    {results.dkim.recommendation && (
                      <div className="recommendation-item">
                        <div className="flex items-start">
                          <FiArrowRight className="mt-1 mr-2 text-blue-500 flex-shrink-0" />
                          <p>{results.dkim.recommendation}</p>
                        </div>
                      </div>
                    )}

                    {results.dmarc.recommendation && (
                      <div className="recommendation-item">
                        <div className="flex items-start">
                          <FiArrowRight className="mt-1 mr-2 text-blue-500 flex-shrink-0" />
                          <p>{results.dmarc.recommendation}</p>
                        </div>
                      </div>
                    )}

                    {results.blacklist.recommendation && (
                      <div className="recommendation-item">
                        <div className="flex items-start">
                          <FiArrowRight className="mt-1 mr-2 text-blue-500 flex-shrink-0" />
                          <p>{results.blacklist.recommendation}</p>
                        </div>
                      </div>
                    )}

                    {results.bimi.recommendation && (
                      <div className="recommendation-item">
                        <div className="flex items-start">
                          <FiArrowRight className="mt-1 mr-2 text-blue-500 flex-shrink-0" />
                          <p>{results.bimi.recommendation}</p>
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
          <div className="checker-section">
            <div className="section-header" onClick={() => toggleSection('spf')}>
              <h3>
                <FiMail className="inline mr-2" />
                SPF (Sender Policy Framework)
                {results?.spf && getStatusIcon(results.spf.valid)}
              </h3>
              {expandedSections.spf ? <FiChevronUp /> : <FiChevronDown />}
            </div>

            {expandedSections.spf && (
              <div className="section-content">
                {results ? (
                  <>
                    <div className={`result-card ${results.spf.valid ? 'valid' : 'invalid'}`}>
                      <div className="result-summary">
                        <p>{results.spf.exists ? 'SPF record found' : 'No SPF record found'}</p>
                        <span className="text-sm text-gray-500">Last checked: {new Date(results.lastChecked).toLocaleString()}</span>
                      </div>

                      {results.spf.exists && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                          <div className="details-card">
                            <h4>Record Details</h4>
                            <SyntaxHighlighter language="dns" style={atomOneDark} className="rounded-md">
                              {results.spf.record}
                            </SyntaxHighlighter>
                            <CopyToClipboard text={results.spf.record} onCopy={() => setCopied(true)}>
                              <button className="copy-btn">
                                <FiCopy /> Copy Record
                              </button>
                            </CopyToClipboard>
                          </div>

                          <div className="details-card">
                            <h4>Mechanisms</h4>
                            <ul className="mechanisms-list">
                              {results.spf.mechanisms.map((mechanism, idx) => (
                                <li key={idx} className={mechanism.valid ? 'valid' : 'invalid'}>
                                  <span className="mechanism-type">{mechanism.type}</span>
                                  <span className="mechanism-value">{mechanism.value}</span>
                                  {mechanism.valid ? (
                                    <FiCheckCircle className="text-green-500" />
                                  ) : (
                                    <FiAlertTriangle className="text-yellow-500" />
                                  )}
                                </li>
                              ))}
                            </ul>
                            <p className="text-sm mt-2">Total lookups: {results.spf.lookups}/10</p>
                          </div>
                        </div>
                      )}

                      <div className="recommendation-card">
                        <h4>Recommendation</h4>
                        <p>{results.spf.recommendation}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="info-card">
                    <h4>SPF Check</h4>
                    <p>SPF (Sender Policy Framework) is an email authentication method designed to detect forging sender addresses during the delivery of the email.</p>
                    <div className="deployment-instructions">
                      <h5>How it works:</h5>
                      <ul className="instruction-list">
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
          <div className="checker-section">
            <div className="section-header" onClick={() => toggleSection('dkim')}>
              <h3>
                <FiLock className="inline mr-2" />
                DKIM (DomainKeys Identified Mail)
                {results?.dkim && getStatusIcon(results.dkim.valid)}
              </h3>
              {expandedSections.dkim ? <FiChevronUp /> : <FiChevronDown />}
            </div>

            {expandedSections.dkim && (
              <div className="section-content">
                {results ? (
                  <>
                    <div className={`result-card ${results.dkim.valid ? 'valid' : 'invalid'}`}>
                      <div className="result-summary">
                        <p>{results.dkim.exists ? `DKIM is properly configured for selector '${results.dkim.selector}'` : 'No DKIM record found'}</p>
                        <span className="text-sm text-gray-500">Last checked: {new Date(results.lastChecked).toLocaleString()}</span>
                      </div>

                      {results.dkim.exists && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                          <div className="details-card">
                            <h4>Record Details</h4>
                            <SyntaxHighlighter language="dns" style={atomOneDark} className="rounded-md">
                              {results.dkim.record}
                            </SyntaxHighlighter>
                            <CopyToClipboard text={results.dkim.record} onCopy={() => setCopied(true)}>
                              <button className="copy-btn">
                                <FiCopy /> Copy Record
                              </button>
                            </CopyToClipboard>
                          </div>

                          <div className="details-card">
                            <h4>Key Information</h4>
                            <ul className="key-details">
                              <li>
                                <span>Key Type:</span>
                                <span>RSA</span>
                              </li>
                              <li>
                                <span>Key Length:</span>
                                <span>{results.dkim.keyLength} bits</span>
                              </li>
                              <li>
                                <span>Public Key Valid:</span>
                                <span>{results.dkim.publicKeyValid ? 'Yes' : 'No'}</span>
                              </li>
                            </ul>
                          </div>
                        </div>
                      )}

                      <div className="recommendation-card">
                        <h4>Recommendation</h4>
                        <p>{results.dkim.recommendation}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="info-card">
                    <h4>DKIM Check</h4>
                    <p>DKIM (DomainKeys Identified Mail) is an email authentication method that allows the receiver to check that an email was indeed sent and authorized by the owner of that domain.</p>
                    <div className="deployment-instructions">
                      <h5>How it works:</h5>
                      <ul className="instruction-list">
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
          <div className="checker-section">
            <div className="section-header" onClick={() => toggleSection('dmarc')}>
              <h3>
                <FiShield className="inline mr-2" />
                DMARC (Domain-based Message Authentication, Reporting & Conformance)
                {results?.dmarc && getStatusIcon(results.dmarc.valid)}
              </h3>
              {expandedSections.dmarc ? <FiChevronUp /> : <FiChevronDown />}
            </div>

            {expandedSections.dmarc && (
              <div className="section-content">
                {results ? (
                  <>
                    <div className={`result-card ${results.dmarc.valid ? 'valid' : 'invalid'}`}>
                      <div className="result-summary">
                        <p>{results.dmarc.exists ? 'DMARC record found' : 'No DMARC record found'}</p>
                        <span className="text-sm text-gray-500">Last checked: {new Date(results.lastChecked).toLocaleString()}</span>
                      </div>

                      {results.dmarc.exists && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                          <div className="details-card">
                            <h4>Record Details</h4>
                            <SyntaxHighlighter language="dns" style={atomOneDark} className="rounded-md">
                              {results.dmarc.record}
                            </SyntaxHighlighter>
                            <CopyToClipboard text={results.dmarc.record} onCopy={() => setCopied(true)}>
                              <button className="copy-btn">
                                <FiCopy /> Copy Record
                              </button>
                            </CopyToClipboard>
                          </div>

                          <div className="details-card">
                            <h4>Policy Details</h4>
                            <ul className="policy-details">
                              <li>
                                <span>Policy:</span>
                                <span className="capitalize">{results.dmarc.policy}</span>
                              </li>
                              <li>
                                <span>Subdomain Policy:</span>
                                <span>{results.dmarc.subdomainPolicy || 'Inherits from parent'}</span>
                              </li>
                              <li>
                                <span>Percentage:</span>
                                <span>{results.dmarc.percentage}%</span>
                              </li>
                              <li>
                                <span>Aggregate Reports:</span>
                                <span>{results.dmarc.aggregateReporting}</span>
                              </li>
                              <li>
                                <span>Forensic Reports:</span>
                                <span>{results.dmarc.forensicReporting || 'Not configured'}</span>
                              </li>
                              <li>
                                <span>SPF Alignment:</span>
                                <span className="capitalize">{results.dmarc.alignment.spf}</span>
                              </li>
                              <li>
                                <span>DKIM Alignment:</span>
                                <span className="capitalize">{results.dmarc.alignment.dkim}</span>
                              </li>
                            </ul>
                          </div>
                        </div>
                      )}

                      <div className="recommendation-card">
                        <h4>Recommendation</h4>
                        <p>{results.dmarc.recommendation}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="info-card">
                    <h4>DMARC Check</h4>
                    <p>DMARC (Domain-based Message Authentication, Reporting & Conformance) is an email authentication protocol that builds on SPF and DKIM protocols.</p>
                    <div className="deployment-instructions">
                      <h5>How it works:</h5>
                      <ul className="instruction-list">
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
          <div className="checker-section">
            <div className="section-header" onClick={() => toggleSection('blacklist')}>
              <h3>
                <FiList className="inline mr-2" />
                Blacklist Check
                {results?.blacklist && getStatusIcon(results.blacklist.listed === 0)}
              </h3>
              {expandedSections.blacklist ? <FiChevronUp /> : <FiChevronDown />}
            </div>

            {expandedSections.blacklist && (
              <div className="section-content">
                {results ? (
                  <div className={`result-card ${results.blacklist.listed === 0 ? 'valid' : 'invalid'}`}>
                    <div className="result-summary">
                      <p>{results.blacklist.listed === 0 ?
                        'Your domain is not listed on any major blacklists' :
                        `Your domain is listed on ${results.blacklist.listed} blacklist(s)`}
                      </p>
                      <span className="text-sm text-gray-500">Last checked: {new Date(results.lastChecked).toLocaleString()}</span>
                    </div>

                    <div className="details-card">
                      <h4>Blacklist Results</h4>
                      <div className="blacklist-results">
                        {results.blacklist.details.map((blacklist, index) => (
                          <div key={index} className="blacklist-item">
                            <span className="blacklist-name">{blacklist.name}</span>
                            <span className={`blacklist-status ${blacklist.listed ? 'listed' : 'not-listed'}`}>
                              {blacklist.listed ? 'Listed' : 'Not Listed'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="recommendation-card">
                      <h4>Recommendation</h4>
                      <p>{results.blacklist.recommendation}</p>
                    </div>
                  </div>
                ) : (
                  <div className="info-card">
                    <h4>Blacklist Monitoring</h4>
                    <p>Check if your domain or IP address is listed on any major email blacklists that could affect email deliverability.</p>
                    <div className="deployment-instructions">
                      <h5>About Blacklists:</h5>
                      <ul className="instruction-list">
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
    <div className={`authentication-checker ${darkMode ? 'dark-mode' : ''}`}>
      <div className="checker-header">
        <div className="header-top">
          <h2>Email Authentication Checker</h2>
          <div className="header-actions">
            <button className="action-btn" onClick={() => setShowSettings(!showSettings)}>
              <FiSettings />
            </button>
            {results && (
              <button className="action-btn" onClick={exportResults}>
                <FiDownload />
              </button>
            )}
          </div>
        </div>
        <p className="subtitle">
          Comprehensive tool for SPF, DKIM, and DMARC configuration, validation, and deployment
        </p>

        <AnimatePresence>
          {showSettings && (
            <motion.div
              className="settings-panel"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div className="settings-header">
                <h3>Settings</h3>
                <button onClick={() => setShowSettings(false)}>
                  <FiX />
                </button>
              </div>
              <div className="settings-content">
                <div className="setting-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={autoRefresh}
                      onChange={(e) => setAutoRefresh(e.target.checked)}
                    />
                    Auto-refresh results
                  </label>
                </div>
                <div className="setting-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={darkMode}
                      onChange={(e) => setDarkMode(e.target.checked)}
                    />
                    Dark mode
                  </label>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleDomainSubmit} className="domain-form">
          <div className="form-group">
            <label htmlFor="domain">Enter your domain (example.com):</label>
            <div className="input-with-button">
              <input
                type="text"
                id="domain"
                placeholder="example.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
              />
              <button type="submit" disabled={isLoading || !domain}>
                {isLoading ? (
                  <>
                    <FiRefreshCw className="animate-spin mr-2" />
                    Checking...
                  </>
                ) : (
                  'Check Authentication'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {results && (
        <div className="overall-score">
          <div className="score-card">
            <h3>Domain Health Score</h3>
            <div className="score-circle">
              <svg viewBox="0 0 36 36" className="circular-chart">
                <path className="circle-bg"
                  d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path className={`circle ${getScoreClass(results.overallScore)}`}
                  strokeDasharray={`${results.overallScore}, 100`}
                  d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <text x="18" y="20.35" className="percentage">{results.overallScore}%</text>
              </svg>
            </div>
            <p className={getScoreClass(results.overallScore)}>Your email authentication is {getScoreClass(results.overallScore)}</p>
          </div>
        </div>
      )}

      <div className="checker-tabs">
        <div className="tabs-header">
          <button
            className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <FiGlobe className="tab-icon" />
            Overview
          </button>
          <button
            className={`tab-button ${activeTab === 'spf' ? 'active' : ''}`}
            onClick={() => setActiveTab('spf')}
          >
            <FiMail className="tab-icon" />
            SPF
          </button>
          <button
            className={`tab-button ${activeTab === 'dkim' ? 'active' : ''}`}
            onClick={() => setActiveTab('dkim')}
          >
            <FiLock className="tab-icon" />
            DKIM
          </button>
          <button
            className={`tab-button ${activeTab === 'dmarc' ? 'active' : ''}`}
            onClick={() => setActiveTab('dmarc')}
          >
            <FiShield className="tab-icon" />
            DMARC
          </button>
          <button
            className={`tab-button ${activeTab === 'blacklist' ? 'active' : ''}`}
            onClick={() => setActiveTab('blacklist')}
          >
            <FiList className="tab-icon" />
            Blacklist
          </button>
        </div>

        <div className="tabs-content">
          {renderTabContent()}
        </div>
      </div>

      {history.length > 0 && (
        <div className="history-panel">
          <h4>Recent Checks</h4>
          <div className="history-list">
            {history.map((item, index) => (
              <div key={index} className="history-item" onClick={() => loadFromHistory(item.domain)}>
                <span className="history-domain">{item.domain}</span>
                <span className="history-date">{new Date(item.date).toLocaleDateString()}</span>
                <div className="history-score">
                  <div className="score-bar">
                    <div
                      className={`score-fill ${getScoreClass(item.score)}`}
                      style={{ width: `${item.score}%` }}
                    ></div>
                  </div>
                  <span>{item.score}%</span>
                </div>
              </div>
            ))}
          </div>
          <button className="clear-history" onClick={clearHistory}>
            Clear History
          </button>
        </div>
      )}

      {copied && (
        <motion.div
          className="copy-notification"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
        >
          Record copied to clipboard!
        </motion.div>
      )}

      <ReactTooltip id="copy-tooltip" place="top" effect="solid" />

      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
        
        .authentication-checker {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
          font-family: 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif;
          transition: all 0.3s ease;
          background-color: #f8fafc;
        }

        .authentication-checker.dark-mode {
          background-color: #1a202c;
          color: #e2e8f0;
        }

        .dark-mode .checker-tabs,
        .dark-mode .checker-section,
        .dark-mode .details-card,
        .dark-mode .recommendation-card,
        .dark-mode .generator-card,
        .dark-mode .deployment-instructions,
        .dark-mode .timeline-step,
        .dark-mode .history-panel,
        .dark-mode .settings-panel,
        .dark-mode .score-card,
        .dark-mode .stat-card,
        .dark-mode .info-card {
          background-color: #2d3748;
          color: #e2e8f0;
          border-color: #4a5568;
        }

        .dark-mode .section-header {
          background-color: #2d3748;
          border-color: #4a5568;
        }

        .dark-mode .input-with-button input,
        .dark-mode .policy-selector select,
        .dark-mode .input-group select,
        .dark-mode .input-group input {
          background-color: #2d3748;
          color: #e2e8f0;
          border-color: #4a5568;
        }

        .checker-header {
          text-align: center;
          margin-bottom: 2rem;
          position: relative;
          background: linear-gradient(to right, #0B1E3F 0%, #008080 100%);
          padding: 2rem;
          border-radius: 16px;
          color: white;
          box-shadow: 0 10px 30px rgba(11, 30, 63, 0.2);
        }

        .header-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .header-actions {
          display: flex;
          gap: 0.5rem;
        }

        .action-btn {
          background: rgba(255, 255, 255, 0.2);
          border: none;
          border-radius: 50%;
          padding: 0.75rem;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          backdrop-filter: blur(10px);
        }

        .dark-mode .action-btn {
          background: rgba(255, 255, 255, 0.1);
          color: white;
        }

        .action-btn:hover {
          background: rgba(255, 255, 255, 0.3);
          transform: translateY(-2px);
        }

        .checker-header h2 {
          font-size: 2.5rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
          background: linear-gradient(to right, #ffffff 0%, #e6f7ff 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .subtitle {
          color: rgba(255, 255, 255, 0.8);
          margin-bottom: 2rem;
          font-size: 1.1rem;
          font-weight: 300;
        }

        .settings-panel {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 12px;
          padding: 1rem;
          margin-bottom: 1rem;
          overflow: hidden;
          backdrop-filter: blur(10px);
        }

        .settings-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
          color: white;
        }

        .settings-header h3 {
          margin: 0;
          font-size: 1.1rem;
        }

        .settings-content {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .setting-item {
          display: flex;
          align-items: center;
        }

        .setting-item label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          color: white;
        }

        .domain-form {
          max-width: 600px;
          margin: 0 auto;
        }

        .form-group {
          display: flex;
          flex-direction: column;
        }

        .form-group label {
          text-align: left;
          margin-bottom: 0.5rem;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.9);
        }

        .input-with-button {
          display: flex;
          gap: 0.5rem;
        }

        .input-with-button input {
          flex: 1;
          padding: 1rem 1.5rem;
          border: 2px solid rgba(255, 255, 255, 0.2);
          border-radius: 50px;
          font-size: 1rem;
          transition: all 0.3s ease;
          background: rgba(255, 255, 255, 0.1);
          color: white;
          font-family: 'Poppins', sans-serif;
        }

        .input-with-button input::placeholder {
          color: rgba(255, 255, 255, 0.6);
        }

        .input-with-button input:focus {
          outline: none;
          border-color: rgba(255, 255, 255, 0.5);
          box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.1);
        }

        .input-with-button button {
          padding: 0 2rem;
          background: rgba(255, 255, 255, 0.9);
          color: #0B1E3F;
          border: none;
          border-radius: 50px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          font-family: 'Poppins', sans-serif;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
        }

        .input-with-button button:hover:not(:disabled) {
          background: white;
          transform: translateY(-2px);
          box-shadow: 0 6px 15px rgba(0, 0, 0, 0.15);
        }

        .input-with-button button:disabled {
          background: rgba(255, 255, 255, 0.5);
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .overview-tab {
          padding: 1rem 0;
        }

        .stat-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 1.5rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          transition: all 0.3s ease;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
        }

        .stat-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        }

        .stat-icon {
          width: 54px;
          height: 54px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
        }

        .stat-content h4 {
          margin: 0 0 0.25rem 0;
          font-size: 0.875rem;
          color: #718096;
          font-weight: 500;
        }

        .stat-content p {
          margin: 0;
          font-weight: 700;
          font-size: 1.35rem;
        }

        .issues-section {
          background: white;
          border-radius: 16px;
          padding: 1.5rem;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
        }

        .dark-mode .issues-section {
          background: #2d3748;
        }

        .issues-grid {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .issue-item {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          padding: 1rem;
          border-radius: 12px;
          background: #f8fafc;
        }

        .issue-item.error {
          border-left: 4px solid #e53e3e;
          background: #fef5f5;
        }

        .issue-item.warning {
          border-left: 4px solid #dd6b20;
          background: #fffaf0;
        }

        .issue-item.info {
          border-left: 4px solid #3182ce;
          background: #ebf8ff;
        }

        .dark-mode .issue-item {
          background: #2d3748;
        }

        .dark-mode .issue-item.error {
          background: #442727;
        }

        .dark-mode .issue-item.warning {
          background: #443b25;
        }

        .dark-mode .issue-item.info {
          background: #253443;
        }

        .issue-icon {
          font-size: 1.5rem;
          flex-shrink: 0;
        }

        .issue-content h4 {
          margin: 0 0 0.5rem 0;
          font-size: 1rem;
        }

        .issue-content p {
          margin: 0;
          font-size: 0.9rem;
          opacity: 0.8;
        }

        .recommendations-section {
          background: white;
          border-radius: 16px;
          padding: 1.5rem;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
        }

        .dark-mode .recommendations-section {
          background: #2d3748;
        }

        .recommendations-grid {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .recommendation-item {
          background: #f0f9ff;
          border-radius: 12px;
          padding: 1rem;
          border-left: 4px solid #0ea5e9;
        }

        .dark-mode .recommendation-item {
          background: #253443;
          border-left-color: #0ea5e9;
        }

        .recommendation-item p {
          margin: 0;
        }

        .history-panel {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 1.5rem;
          margin-top: 2rem;
          text-align: left;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
        }

        .history-panel h4 {
          margin-top: 0;
          margin-bottom: 1rem;
          font-size: 1.1rem;
          color: #2d3748;
          font-weight: 600;
        }

        .dark-mode .history-panel h4 {
          color: #e2e8f0;
        }

        .history-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .history-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem;
          border-radius: 12px;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .history-item:hover {
          background-color: #f7fafc;
        }

        .dark-mode .history-item:hover {
          background-color: #4a5568;
        }

        .history-domain {
          font-weight: 500;
        }

        .history-date {
          font-size: 0.875rem;
          color: #718096;
        }

        .history-score {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .score-bar {
          width: 50px;
          height: 6px;
          background-color: #edf2f7;
          border-radius: 3px;
          overflow: hidden;
        }

        .dark-mode .score-bar {
          background-color: #4a5568;
        }

        .score-fill {
          height: 100%;
          border-radius: 3px;
          transition: width 0.5s ease;
        }

        .score-fill.excellent {
          background: #38a169;
        }

        .score-fill.good {
          background: #319795;
        }

        .score-fill.fair {
          background: #d69e2e;
        }

        .score-fill.poor {
          background: #e53e3e;
        }

        .clear-history {
          background: linear-gradient(to right, #0B1E3F 0%, #008080 100%);
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 50px;
          cursor: pointer;
          font-size: 0.875rem;
          transition: all 0.3s ease;
          font-weight: 500;
          box-shadow: 0 4px 6px rgba(11, 30, 63, 0.2);
        }

        .clear-history:hover {
          opacity: 0.9;
          transform: translateY(-2px);
          box-shadow: 0 6px 12px rgba(11, 30, 63, 0.3);
        }

        .overall-score {
          display: flex;
          justify-content: center;
          margin-bottom: 2rem;
        }

        .score-card {
          background: white;  
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          padding: 2rem;
          text-align: center;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
          animation: fadeIn 0.5s ease;
          width: 300px;
        }

        .score-card h3 {
          margin-top: 0;
          margin-bottom: 1.5rem;
          color: #2d3748;
          font-weight: 600;
          font-size: 1.25rem;
        }

        .dark-mode .score-card h3 {
          color: #e2e8f0;
        }

        .score-circle {
          margin: 0 auto 1.5rem;
          width: 120px;
        }

        .circular-chart {
          display: block;
          margin: 10px auto;
          max-width: 80%;
          max-height: 120px;
        }

        .circle-bg {
          fill: none;
          stroke: #edf2f7;
          stroke-width: 3.8;
        }

        .dark-mode .circle-bg {
          stroke: #4a5568;
        }

        .circle {
          fill: none;
          stroke-width: 2.8;
          stroke-linecap: round;
          animation: progress 1s ease-out forwards;
        }

        .circle.excellent {
          stroke: #38a169;
        }

        .circle.good {
          stroke: #319795;
        }

        .circle.fair {
          stroke: #d69e2e;
        }

        .circle.poor {
          stroke: #e53e3e;
        }

        @keyframes progress {
          0% {
            stroke-dasharray: 0 100;
          }
        }

        .percentage {
          fill: #4a5568;
          font-size: 0.6em;
          text-anchor: middle;
          font-weight: bold;
          font-family: 'Poppins', sans-serif;
        }

        .dark-mode .percentage {
          fill: #e2e8f0;
        }

        .score-card p {
          margin: 0;
          font-weight: 600;
          font-size: 1.1rem;
        }

        .score-card p.excellent {
          color: #38a169;
        }

        .score-card p.good {
          color: #319795;
        }

        .score-card p.fair {
          color: #d69e2e;
        }

        .score-card p.poor {
          color: #e53e3e;
        }

        .checker-tabs {
          background: white;
          border-radius: 20px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
          overflow: hidden;
          animation: slideUp 0.5s ease;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .tabs-header {
          display: flex;
          border-bottom: 1px solid #e2e8f0;
          overflow-x: auto;
          background: linear-gradient(to right, #0B1E3F 0%, #008080 100%);
        }

        .tab-button {
          padding: 1.25rem 1.5rem;
          background: none;
          border: none;
          cursor: pointer;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.8);
          position: relative;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          white-space: nowrap;
          font-family: 'Poppins', sans-serif;
        }

        .tab-button:hover {
          color: white;
          background-color: rgba(255, 255, 255, 0.1);
        }

        .tab-button.active {
          color: white;
          font-weight: 600;
        }

        .tab-button.active::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: white;
          animation: expandLine 0.3s ease;
        }

        @keyframes expandLine {
          from {
            transform: scaleX(0);
            opacity: 0;
          }
          to {
            transform: scaleX(1);
            opacity: 1;
          }
        }

        .tab-icon {
          font-size: 1.1rem;
        }

        .tabs-content {
          padding: 2rem;
        }

        .checker-section {
          margin-bottom: 1.5rem;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          overflow: hidden;
          transition: all 0.3s ease;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
        }

        .checker-section:hover {
          box-shadow: 0 8px 15px rgba(0, 0, 0, 0.1);
          transform: translateY(-2px);
        }

        .section-header {
          padding: 1.25rem 1.5rem;
          background-color: #f7fafc;
          border-bottom: 1px solid #e2e8f0;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: background-color 0.2s;
        }

        .section-header:hover {
          background-color: #edf2f7;
        }

        .section-header h3 {
          margin: 0;
          font-size: 1.1rem;
          display: flex;
          align-items: center;
          color: #2d3748;
          font-weight: 600;
        }

        .dark-mode .section-header h3 {
          color: #e2e8f0;
        }

        .section-content {
          padding: 1.5rem;
          background-color: white;
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .result-card {
          border-radius: 12px;
          padding: 1.5rem;
          animation: slideIn 0.3s ease;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .result-card.valid {
          background-color: #f0fff4;
          border-left: 4px solid #38a169;
        }

        .result-card.invalid {
          background-color: #fffaf0;
          border-left: 4px solid #dd6b20;
        }

        .dark-mode .result-card.valid {
          background-color: #22543d;
          border-left-color: #48bb78;
        }

        .dark-mode .result-card.invalid {
          background-color: #744210;
          border-left-color: #ed8936;
        }

        .result-summary {
          margin-bottom: 1rem;
        }

        .result-summary p {
          font-weight: 600;
          margin-bottom: 0.25rem;
          color: #2d3748;
          font-size: 1.1rem;
        }

        .dark-mode .result-summary p {
          color: #e2e8f0;
        }

        .details-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 1.25rem;
          margin-bottom: 1rem;
          animation: fadeIn 0.5s ease;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }

        .dark-mode .details-card {
          background: #2d3748;
          border-color: #4a5568;
        }

        .details-card h4 {
          margin-top: 0;
          margin-bottom: 1rem;
          font-size: 1rem;
          color: #2d3748;
          font-weight: 600;
        }

        .dark-mode .details-card h4 {
          color: #e2e8f0;
        }

        .copy-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: linear-gradient(to right, #0B1E3F 0%, #008080 100%);
          color: white;
          border: none;
          padding: 0.75rem 1.25rem;
          border-radius: 50px;
          margin-top: 0.75rem;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
          font-weight: 500;
          box-shadow: 0 2px 4px rgba(11, 30, 63, 0.2);
        }

        .copy-btn:hover {
          opacity: 0.9;
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(11, 30, 63, 0.3);
        }

        .mechanisms-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .mechanisms-list li {
          display: flex;
          align-items: center;
          padding: 0.75rem 0;
          border-bottom: 1px solid #edf2f7;
          animation: fadeIn 0.5s ease;
        }

        .dark-mode .mechanisms-list li {
          border-bottom-color: #4a5568;
        }

        .mechanisms-list li:last-child {
          border-bottom: none;
        }

        .mechanism-type {
          font-weight: 600;
          width: 80px;
          color: #4a5568;
        }

        .dark-mode .mechanism-type {
          color: #a0aec0;
        }

        .mechanism-value {
          flex: 1;
          font-family: 'Fira Code', monospace;
          font-size: 0.875rem;
        }

        .recommendation-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 1.25rem;
          margin-top: 1rem;
          animation: fadeIn 0.5s ease;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }

        .dark-mode .recommendation-card {
          background: #2d3748;
          border-color: #4a5568;
        }

        .recommendation-card h4 {
          margin-top: 0;
          margin-bottom: 0.75rem;
          font-size: 1rem;
          color: #2d3748;
          font-weight: 600;
        }

        .dark-mode .recommendation-card h4 {
          color: #e2e8f0;
        }

        .info-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 1.5rem;
          animation: fadeIn 0.5s ease;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
        }

        .info-card h4 {
          margin-top: 0;
          margin-bottom: 1rem;
          font-size: 1.1rem;
          color: #2d3748;
          font-weight: 600;
        }

        .dark-mode .info-card h4 {
          color: #e2e8f0;
        }

        .info-card p {
          margin-bottom: 1rem;
          color: #4a5568;
          line-height: 1.6;
        }

        .dark-mode .info-card p {
          color: #a0aec0;
        }

        .blacklist-results {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .blacklist-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem;
          border-radius: 8px;
          background-color: #f7fafc;
        }

        .dark-mode .blacklist-item {
          background-color: #4a5568;
        }

        .blacklist-name {
          font-weight: 500;
        }

        .blacklist-status {
          font-size: 0.875rem;
          padding: 0.35rem 0.75rem;
          border-radius: 50px;
          font-weight: 500;
        }

        .blacklist-status.listed {
          background-color: #fed7d7;
          color: #c53030;
        }

        .dark-mode .blacklist-status.listed {
          background-color: #742a2a;
          color: #fc8181;
        }

        .blacklist-status.not-listed {
          background-color: #c6f6d5;
          color: #2d7844;
        }

        .dark-mode .blacklist-status.not-listed {
          background-color: #22543d;
          color: #68d391;
        }

        .copy-notification {
          position: fixed;
          bottom: 1rem;
          right: 1rem;
          background: linear-gradient(to right, #0B1E3F 0%, #008080 100%);
          color: white;
          padding: 1rem 1.5rem;
          border-radius: 50px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 1000;
          font-weight: 500;
        }

        @media (max-width: 768px) {
          .authentication-checker {
            padding: 1rem;
          }

          .checker-header {
            padding: 1.5rem;
          }

          .checker-header h2 {
            font-size: 2rem;
          }

          .tabs-header {
            overflow-x: auto;
            padding-bottom: 0.5rem;
          }

          .tab-button {
            white-space: nowrap;
            padding: 1rem 1.25rem;
          }

          .input-with-button {
            flex-direction: column;
            gap: 0.5rem;
          }

          .input-with-button button {
            width: 100%;
          }

          .header-top {
            flex-direction: column;
            gap: 1rem;
            align-items: flex-start;
          }

          .header-actions {
            align-self: flex-end;
          }

          .score-card {
            width: 100%;
            max-width: 280px;
          }
        }
      `}</style>
    </div>
  );
};

export default AuthenticationChecker;