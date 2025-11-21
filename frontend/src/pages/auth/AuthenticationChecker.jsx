import React, { useState, useEffect, lazy, Suspense } from 'react';
import {
  FiCheckCircle,
  FiAlertTriangle,
  FiInfo,
  FiCopy,
  FiRefreshCw,
  FiChevronDown,
  FiChevronUp,
  FiLock,
  FiMail,
  FiGlobe,
  FiShield,
  FiList,
  FiArrowRight,
  FiXCircle,
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// Lazy load heavy components
const CopyToClipboard = lazy(() => 
  import('react-copy-to-clipboard').then(module => ({
    default: module.CopyToClipboard
  }))
);

// Fallback components for lazy loading
const CodeBlockFallback = ({ children }) => (
  <div className="bg-gray-800 rounded-md p-4 text-sm overflow-x-auto">
    <pre className="text-white font-mono text-xs sm:text-sm whitespace-pre-wrap break-words">{children}</pre>
  </div>
);

const CopyButtonFallback = ({ children }) => (
  <button className="inline-flex items-center gap-2 bg-gradient-to-r from-teal-600 to-teal-700 text-white border-none px-4 sm:px-5 py-2 sm:py-3 rounded-full mt-3 text-xs sm:text-sm font-medium cursor-pointer transition-all duration-200 hover:from-teal-700 hover:to-teal-800 hover:-translate-y-0.5 shadow-md">
    {children}
  </button>
);

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
  const [validationError, setValidationError] = useState('');

  // Typing animation states
  const [domainPlaceholder, setDomainPlaceholder] = useState('');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [placeholderText, setPlaceholderText] = useState("");

  // Circular meter animation state - NOW DYNAMIC
  const [score, setScore] = useState(0);
  const [headerScore, setHeaderScore] = useState(0);

  // Enhanced domain validation function with Custom ID support
  const isValidDomain = (input) => {
    const cleanInput = input.trim().toLowerCase();
    
    // ACCEPTED PATTERNS:
    
    // 1. Standard domains
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
    
    // 2. Custom IDs: alphanumeric, underscores, hyphens, dots (but not IPs)
    const customIdRegex = /^[a-zA-Z0-9]([a-zA-Z0-9_\-\.]{0,61}[a-zA-Z0-9])?$/;
    
    // 3. Email-like patterns (user@domain)
    const emailLikeRegex = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;
    
    // ❌ REJECTED PATTERNS:
    const invalidPatterns = [
      /^[0-9\.]+$/, // All numbers and dots (like IP addresses)
      /\.\./, // Double dots
      /^-|-$/, // Starts or ends with hyphen
      /^\.|\.$/, // Starts or ends with dot
      /^https?:\/\//, // URLs with protocol
      /\//, // Contains paths
      /\s/, // Contains spaces
      /[^a-zA-Z0-9_\-\.@]/, // Special characters except allowed ones
    ];
    
    // Check length constraints
    if (cleanInput.length < 3 || cleanInput.length > 253) {
      return false;
    }
    
    // Check for invalid patterns
    if (invalidPatterns.some(pattern => pattern.test(cleanInput))) {
      return false;
    }
    
    // ✅ ACCEPT if matches any valid pattern
    return domainRegex.test(cleanInput) || 
           customIdRegex.test(cleanInput) || 
           emailLikeRegex.test(cleanInput);
  };

  // Input cleaning function to preserve email formats
  const cleanInput = (input) => {
    let clean = input.trim().toLowerCase();
    
    // Remove protocol
    clean = clean.replace(/^https?:\/\//, '');
    
    // Remove www. prefix for consistency
    clean = clean.replace(/^www\./, '');
    
    // For non-email inputs, remove paths and ports
    if (!clean.includes('@')) {
      clean = clean.split('/')[0];
      clean = clean.split('?')[0];
      clean = clean.split('#')[0];
      clean = clean.replace(/:\d+$/, '');
    }
    
    return clean;
  };

  // Get authentication token
  const getAuthToken = () => {
    // Try different ways to get the token based on your AuthContext implementation
    if (currentUser?.token) {
      return currentUser.token;
    }
    if (currentUser?.accessToken) {
      return currentUser.accessToken;
    }
    // Check localStorage as fallback
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    return token;
  };

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

  // Header circular meter animation effect - FIXED 85% for marketing
  useEffect(() => {
    const animateHeaderScore = () => {
      const marketingScore = 85; // Fixed 85% for marketing
      let currentScore = 0;
      const duration = 1500;
      const steps = 40;
      const increment = marketingScore / steps;
      const intervalTime = duration / steps;

      const timer = setInterval(() => {
        currentScore += increment;
        if (currentScore >= marketingScore) {
          setHeaderScore(marketingScore);
          clearInterval(timer);
        } else {
          setHeaderScore(Math.floor(currentScore));
        }
      }, intervalTime);

      return () => clearInterval(timer);
    };

    animateHeaderScore();
  }, []); // Remove history dependency since we're using fixed value

  // Circular meter animation effect for results
  useEffect(() => {
    if (results?.securityScore?.percentage) {
      const animateScore = () => {
        let currentScore = 0;
        const finalScore = results.securityScore.percentage;
        const duration = 1500;
        const steps = 40;
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

      animateScore();
    }
  }, [results]);

  // Set responsive placeholder text with Custom ID support
  useEffect(() => {
    const updatePlaceholder = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setPlaceholderText("Enter domain or ID");
      } else if (width < 768) {
        setPlaceholderText("Enter domain or identifier");
      } else if (width < 1024) {
        setPlaceholderText("Enter domain name or custom ID");
      } else {
        setPlaceholderText("Enter domain or identifier (e.g., example.com, user_123)");
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

  // API call to check domain authentication
  const checkDomainAuth = async (domain) => {
    try {
      const token = getAuthToken();
      
      if (!token) {
        throw new Error('Authentication token not found. Please log in again.');
      }

      const response = await fetch('http://localhost:5000/api/dns/check-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ domain }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please log in again.');
        }
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw new Error(error.message || 'Failed to check domain authentication. Please try again.');
    }
  };

  // Transform API response to match existing component structure
  const transformApiResponse = (apiData) => {
    // Check if apiData has error property
    if (apiData.error) {
      throw new Error(apiData.error);
    }

    const { securityScore, summary, records, recommendations, domainHealth, lastChecked } = apiData;

    // Generate issues based on API data
    const issues = [];

    if (!summary.hasSPF) {
      issues.push({
        type: 'error',
        category: 'SPF',
        message: 'No SPF record found',
        description: 'This can lead to email delivery issues and spoofing.'
      });
    }

    if (!summary.hasDKIM) {
      issues.push({
        type: 'error',
        category: 'DKIM',
        message: 'No DKIM record found',
        description: 'This prevents email authentication and can affect deliverability.'
      });
    }

    if (!summary.hasDMARC) {
      issues.push({
        type: 'error',
        category: 'DMARC',
        message: 'No DMARC record found',
        description: 'This leaves your domain vulnerable to spoofing and phishing attacks.'
      });
    }

    if (summary.isBlacklisted) {
      const listedBlacklists = records.blacklist.details.filter(d => d.status === 'LISTED');
      issues.push({
        type: 'error',
        category: 'Blacklist',
        message: `Domain listed on ${listedBlacklists.length} blacklist(s)`,
        description: `Listed on: ${listedBlacklists.map(d => d.list).join(', ')}. This may affect email deliverability.`
      });
    }

    // Add recommendation issues
    recommendations.forEach(rec => {
      if (rec.priority === 'HIGH') {
        issues.push({
          type: 'error',
          category: rec.category,
          message: rec.message,
          description: rec.fix
        });
      } else if (rec.priority === 'MEDIUM') {
        issues.push({
          type: 'warning',
          category: rec.category,
          message: rec.message,
          description: rec.fix
        });
      } else {
        issues.push({
          type: 'info',
          category: rec.category,
          message: rec.message,
          description: rec.fix
        });
      }
    });

    return {
      domain: apiData.domain,
      securityScore: {
        overall: securityScore.percentage,
        breakdown: securityScore.breakdown
      },
      domainHealth,
      summary,
      records,
      recommendations,
      overallScore: securityScore.percentage,
      issues,
      lastChecked,
      checkId: apiData.metadata?.checkId || Date.now(),
      
      // Transform records to match existing component structure
      spf: {
        exists: records.spf.exists,
        valid: records.spf.isValid,
        record: records.spf.primary,
        mechanisms: records.spf.exists ? analyzeSPFRecord(records.spf.primary) : [],
        lookups: records.spf.exists ? countSPFLookups(records.spf.primary) : 0,
        hasHardFail: records.spf.exists ? records.spf.primary.includes('-all') : false,
        provider: records.spf.dnsProvider,
        recommendation: getSPFRecommendation(records.spf, summary.hasSPF)
      },
      
      dkim: {
        exists: records.dkim.exists,
        valid: records.dkim.primary?.isValid || false,
        selector: records.dkim.primary?.selector || 'not found',
        record: records.dkim.primary?.record || null,
        publicKeyValid: records.dkim.primary?.isValid || false,
        keyLength: records.dkim.primary?.record ? calculateKeyLengthFromRecord(records.dkim.primary.record) : 0,
        keyType: 'RSA',
        algorithm: 'rsa',
        provider: records.dkim.dnsProvider,
        recommendation: getDKIMRecommendation(records.dkim, summary.hasDKIM)
      },
      
      dmarc: {
        exists: records.dmarc.exists,
        valid: records.dmarc.isValid,
        record: records.dmarc.primary,
        policy: records.dmarc.primary ? extractDMARCPolicy(records.dmarc.primary) : 'not set',
        subdomainPolicy: records.dmarc.primary ? extractDMARCSubdomainPolicy(records.dmarc.primary) : 'not set',
        percentage: records.dmarc.primary ? extractDMARCPercentage(records.dmarc.primary) : 100,
        alignment: {
          spf: 'relaxed',
          dkim: 'relaxed'
        },
        provider: records.dmarc.dnsProvider,
        recommendation: getDMARCRecommendation(records.dmarc, summary.hasDMARC)
      },
      
      blacklist: {
        checked: records.blacklist.details.length,
        listed: records.blacklist.listedCount,
        successfulChecks: records.blacklist.details.filter(d => d.status !== 'ERROR').length,
        failedChecks: records.blacklist.details.filter(d => d.status === 'ERROR').length,
        details: records.blacklist.details.map(d => ({
          name: d.list,
          listed: d.status === 'LISTED',
          response: d.status,
          severity: d.severity
        })),
        recommendation: getBlacklistRecommendation(records.blacklist, summary.isBlacklisted)
      },
      
      bimi: {
        exists: false,
        record: null,
        valid: false,
        recommendation: 'No BIMI record found. BIMI allows brands to display logos in supporting email clients.'
      }
    };
  };

  // Helper functions for data transformation
  const analyzeSPFRecord = (spfRecord) => {
    if (!spfRecord) return [];
    
    const mechanisms = [];
    const parts = spfRecord.split(' ').filter(part => part && !part.startsWith('v='));
    
    parts.forEach(part => {
      if (part.startsWith('include:')) {
        mechanisms.push({ type: 'include', value: part.replace('include:', ''), valid: true });
      } else if (part.startsWith('ip4:') || part.startsWith('ip6:')) {
        mechanisms.push({ type: part.startsWith('ip4:') ? 'ip4' : 'ip6', value: part.replace('ip4:', '').replace('ip6:', ''), valid: true });
      } else if (part === 'a' || part === 'mx') {
        mechanisms.push({ type: part, value: 'self', valid: true });
      } else if (part === '-all' || part === '~all' || part === '+all' || part === '?all') {
        mechanisms.push({ type: 'all', value: part, valid: true });
      }
    });
    
    return mechanisms;
  };

  const countSPFLookups = (spfRecord) => {
    if (!spfRecord) return 0;
    const parts = spfRecord.split(' ');
    return parts.filter(part => 
      part.startsWith('include:') || part === 'a' || part === 'mx' || part.startsWith('redirect=')
    ).length;
  };

  const calculateKeyLengthFromRecord = (dkimRecord) => {
    // Extract base64 key and calculate length
    const match = dkimRecord.match(/p=([^;]+)/);
    if (match && match[1]) {
      try {
        const base64Key = match[1].replace(/\s/g, '');
        const binaryKey = atob(base64Key);
        return binaryKey.length * 8;
      } catch (error) {
        return 0;
      }
    }
    return 0;
  };

  const extractDMARCPolicy = (dmarcRecord) => {
    const match = dmarcRecord.match(/p=([^;]+)/);
    return match ? match[1] : 'not set';
  };

  const extractDMARCSubdomainPolicy = (dmarcRecord) => {
    const match = dmarcRecord.match(/sp=([^;]+)/);
    return match ? match[1] : 'not set';
  };

  const extractDMARCPercentage = (dmarcRecord) => {
    const match = dmarcRecord.match(/pct=([^;]+)/);
    return match ? parseInt(match[1]) : 100;
  };

  // Recommendation functions
  const getSPFRecommendation = (spfData, hasSPF) => {
    if (!hasSPF) {
      return 'No SPF record found. This can lead to email delivery issues and spoofing.';
    }
    if (!spfData.isValid) {
      return 'SPF record is invalid. Please check the syntax.';
    }
    if (spfData.primary && spfData.primary.includes('-all')) {
      return 'Your SPF record is properly configured with strict enforcement.';
    }
    return 'Your SPF record is configured but uses softfail. Consider changing ~all to -all for stricter enforcement.';
  };

  const getDKIMRecommendation = (dkimData, hasDKIM) => {
    if (!hasDKIM) {
      return 'No DKIM record found. This prevents email authentication and can affect deliverability.';
    }
    if (!dkimData.primary?.isValid) {
      return 'DKIM record is invalid. Check the syntax and key format.';
    }
    const keyLength = calculateKeyLengthFromRecord(dkimData.primary.record);
    if (keyLength >= 2048) {
      return 'DKIM is properly configured with a strong 2048-bit key.';
    }
    return 'DKIM is configured but uses a weak key. Consider upgrading to 2048-bit RSA.';
  };

  const getDMARCRecommendation = (dmarcData, hasDMARC) => {
    if (!hasDMARC) {
      return 'No DMARC record found. This leaves your domain vulnerable to spoofing and phishing attacks.';
    }
    const policy = dmarcData.primary ? extractDMARCPolicy(dmarcData.primary) : 'not set';
    if (policy === 'reject') {
      return 'Your DMARC policy is properly configured with strict enforcement.';
    }
    if (policy === 'quarantine') {
      return 'Your DMARC policy is set to quarantine. Consider moving to p=reject for maximum protection.';
    }
    return 'Your DMARC policy is set to monitoring only. Consider moving to p=quarantine or p=reject after monitoring.';
  };

  const getBlacklistRecommendation = (blacklistData, isBlacklisted) => {
    if (!isBlacklisted) {
      return 'Your domain is not listed on any major blacklists.';
    }
    return `Your domain is listed on ${blacklistData.listedCount} blacklist(s). This may affect email deliverability.`;
  };

  // Main domain checking function with API integration
  const handleDomainSubmit = async (e) => {
    e.preventDefault();
    
    // Clear previous errors and results
    setValidationError('');
    setResults(null);
    
    if (!domain.trim()) {
      setValidationError('Please enter a domain name');
      return;
    }

    // Validate domain format with Custom ID support
    const cleanedDomain = cleanInput(domain);
    if (!isValidDomain(cleanedDomain)) {
      setValidationError('Please enter a valid domain name or identifier (e.g., example.com, user_123, service-name)');
      return;
    }

    setIsLoading(true);

    try {
      // Call the backend API
      const apiData = await checkDomainAuth(cleanedDomain);
      
      // Transform API response to match component structure
      const transformedResults = transformApiResponse(apiData);
      
      setResults(transformedResults);

      // Add to history
      setHistory(prev => {
        const newHistory = [...prev];
        const filteredHistory = newHistory.filter(item => item.domain !== cleanedDomain);
        if (filteredHistory.length >= 10) filteredHistory.pop();
        return [{ 
          domain: cleanedDomain, 
          date: new Date().toISOString(), 
          score: transformedResults.overallScore,
          checkId: transformedResults.checkId
        }, ...filteredHistory];
      });

    } catch (error) {
      console.error('Error in handleDomainSubmit:', error);
      setValidationError(error.message);
      setResults({
        domain: cleanedDomain,
        error: error.message,
        lastChecked: new Date().toISOString()
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Function to handle domain click from history
  const handleHistoryDomainClick = (domainName) => {
    setDomain(domainName);
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

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('authCheckHistory');
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
                      {results.blacklist.failedChecks > 0 && (
                        <p className="text-xs text-orange-500 mt-1">
                          {results.blacklist.failedChecks} checks failed
                        </p>
                      )}
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
                        {results.spf.provider && (
                          <span className="text-sm text-teal-600 ml-2">• Source: {results.spf.provider}</span>
                        )}
                        </div>

                      {results.spf.exists && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-4">
                          <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm">
                            <h4 className="font-semibold text-gray-900 mb-3">Record Details</h4>
                            <div className="overflow-x-auto">
                              <CodeBlockFallback>{results.spf.record}</CodeBlockFallback>
                            </div>
                            <Suspense fallback={
                              <CopyButtonFallback>
                                <FiCopy className="text-sm" /> Copy Record
                              </CopyButtonFallback>
                            }>
                              <CopyToClipboard text={results.spf.record} onCopy={() => setCopied(true)}>
                                <button className="inline-flex items-center gap-2 bg-gradient-to-r from-teal-600 to-teal-700 text-white border-none px-4 sm:px-5 py-2 sm:py-3 rounded-full mt-3 text-xs sm:text-sm font-medium cursor-pointer transition-all duration-200 hover:from-teal-700 hover:to-teal-800 hover:-translate-y-0.5 shadow-md">
                                  <FiCopy className="text-sm" /> Copy Record
                                </button>
                              </CopyToClipboard>
                            </Suspense>
                          </div>

                            <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm">
                              <h4 className="font-semibold text-gray-900 mb-3">Mechanisms Analysis</h4>
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
                              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                              <p className="text-xs sm:text-sm text-gray-600">
                                <strong>DNS Lookups:</strong> {results.spf.lookups}/10
                                {results.spf.lookups > 10 && (
                                  <span className="text-red-600 ml-2">❌ Exceeds limit</span>
                                )}
                              </p>
                              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                                <strong>Policy:</strong> {results.spf.hasHardFail ? 'Hard fail (-all) ✅' : 'Soft fail (~all) ⚠️'}
                              </p>
                            </div>
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
                        {results.dkim.provider && (
                          <span className="text-sm text-teal-600 ml-2">• Source: {results.dkim.provider}</span>
                        )}
                        </div>

                      {results.dkim.exists && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-4">
                          <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm">
                            <h4 className="font-semibold text-gray-900 mb-3">Record Details</h4>
                            <div className="overflow-x-auto">
                              <CodeBlockFallback>{results.dkim.record}</CodeBlockFallback>
                            </div>
                            <Suspense fallback={
                              <CopyButtonFallback>
                                <FiCopy className="text-sm" /> Copy Record
                              </CopyButtonFallback>
                            }>
                              <CopyToClipboard text={results.dkim.record} onCopy={() => setCopied(true)}>
                                <button className="inline-flex items-center gap-2 bg-gradient-to-r from-teal-600 to-teal-700 text-white border-none px-4 sm:px-5 py-2 sm:py-3 rounded-full mt-3 text-xs sm:text-sm font-medium cursor-pointer transition-all duration-200 hover:from-teal-700 hover:to-teal-800 hover:-translate-y-0.5 shadow-md">
                                  <FiCopy className="text-sm" /> Copy Record
                                </button>
                              </CopyToClipboard>
                            </Suspense>
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
                                  <span className={`font-medium ${results.dkim.keyLength >= 2048 ? 'text-teal-600' : results.dkim.keyLength >= 1024 ? 'text-orange-500' : 'text-red-500'}`}>
                                  {results.dkim.keyLength} bits
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600 font-medium">Key Type:</span>
                                <span className="text-teal-600 font-medium">{results.dkim.keyType}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600 font-medium">Algorithm:</span>
                                <span className="text-teal-600 font-medium">{results.dkim.algorithm}</span>
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
                        {results.dmarc.provider && (
                          <span className="text-sm text-teal-600 ml-2">• Source: {results.dmarc.provider}</span>
                        )}
                        </div>

                      {results.dmarc.exists && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-4">
                          <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm">
                            <h4 className="font-semibold text-gray-900 mb-3">Record Details</h4>
                            <div className="overflow-x-auto">
                              <CodeBlockFallback>{results.dmarc.record}</CodeBlockFallback>
                            </div>
                            <Suspense fallback={
                              <CopyButtonFallback>
                                <FiCopy className="text-sm" /> Copy Record
                              </CopyButtonFallback>
                            }>
                              <CopyToClipboard text={results.dmarc.record} onCopy={() => setCopied(true)}>
                                <button className="inline-flex items-center gap-2 bg-gradient-to-r from-teal-600 to-teal-700 text-white border-none px-4 sm:px-5 py-2 sm:py-3 rounded-full mt-3 text-xs sm:text-sm font-medium cursor-pointer transition-all duration-200 hover:from-teal-700 hover:to-teal-800 hover:-translate-y-0.5 shadow-md">
                                  <FiCopy className="text-sm" /> Copy Record
                                </button>
                              </CopyToClipboard>
                            </Suspense>
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
                        {results.blacklist.failedChecks > 0 && (
                          <p className="text-sm text-orange-500 mt-1">
                            {results.blacklist.failedChecks} of {results.blacklist.checked} checks failed
                          </p>
                        )}
                        </div>

                        <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm">
                          <h4 className="font-semibold text-gray-900 mb-3">Blacklist Results</h4>
                          <div className="space-y-3">
                            {results.blacklist.details.map((blacklist, index) => (
                              <div key={index} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0">
                              <div className="flex-1 min-w-0">
                                  <span className="text-gray-700 font-medium text-sm block">{blacklist.name}</span>
                                {blacklist.error && (
                                  <span className="text-xs text-orange-500">({blacklist.error})</span>
                                )}
                              </div>
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${blacklist.listed
                                  ? 'bg-red-100 text-red-800 border border-red-200'
                                  : blacklist.response === 'Check Failed'
                                    ? 'bg-gray-100 text-gray-800 border border-gray-200'
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
    <div className="min-h-screen text-gray-900 flex justify-center items-start p-4 sm:p-6 font-['Inter',_'Roboto',_-apple-system,_BlinkMacSystemFont,_'Segoe_UI',_sans-serif]">
      <div className="w-full">
        {/* Header Section */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 sm:p-6 mb-6 sm:mb-8 w-full mt-6">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4 sm:gap-6">
            {/* Left Side - Icon, Title & Description */}
            <div className="flex-1 text-center lg:text-left">
              <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                {/* Icon */}
                <div className="inline-flex items-center justify-center w-12 h-12 md:w-18 md:h-18 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl md:rounded-2xl shadow-xl mb-3 md:mb-4">
                  <FiLock className="w-5 h-5 md:w-9 md:h-9 text-white" />
                </div>
                
                {/* Title & Description */}
                <div className="flex-1">
                  <h1 className="text-2xl md:text-4xl font-bold text-gray-900 mb-2 md:mb-3 bg-gradient-to-r from-teal-600 to-teal-700 bg-clip-text text-transparent">
                    Authentication Checker
                  </h1>
                  <p className="text-base md:text-lg text-gray-600 max-w-3xl mx-auto lg:mx-0 leading-relaxed">
                    Get email security insights and improvement recommendations
                  </p>
                </div>
              </div>
            </div>

            {/* Right Side - Animated Circular Meter - NOW DYNAMIC */}
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
                      strokeDasharray={`${headerScore}, 100`}
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      transform="rotate(-90 18 18)"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm sm:text-base font-bold text-gray-800">{headerScore}%</span>
                  </div>
                </div>
                <p className="text-xs text-gray-600 font-medium">Security Score</p>
              </div>
            </div>
          </div>

          {/* Input Field and Button */}
          <div className="mt-10 mb-6 sm:mb-8">
            <form onSubmit={handleDomainSubmit} className="max-w-3xl mx-auto">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder={domainPlaceholder}
                    value={domain}
                    onChange={(e) => {
                      setDomain(e.target.value);
                      setValidationError('');
                    }}
                    className={`w-full px-4 sm:px-6 py-3 sm:py-4 border rounded-xl bg-white text-gray-900 text-sm sm:text-base outline-none focus:ring-2 sm:focus:ring-4 focus:ring-teal-100 transition-all ${
                      validationError 
                        ? 'border-red-300 focus:border-red-500' 
                        : 'border-gray-300 focus:border-teal-500'
                    }`}
                    disabled={isLoading}
                  />
                  {validationError && (
                    <div className="flex items-center gap-2 mt-2 text-red-600 text-sm">
                      <FiXCircle className="flex-shrink-0" />
                      <span>{validationError}</span>
                    </div>
                  )}
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
          <div className="bg-white border-b border-gray-200">
            <div className="grid grid-cols-5 w-full">
              <button
                className={`px-2 sm:px-4 py-4 sm:py-5 bg-none border-none cursor-pointer font-medium text-gray-600 flex items-center justify-center gap-2 transition-all duration-300 whitespace-nowrap hover:text-gray-900 hover:bg-gray-50 relative ${activeTab === 'overview' ? 'text-gray-900 font-semibold' : ''
                  }`}
                onClick={() => setActiveTab('overview')}
              >
                <FiGlobe className="text-lg text-teal-600" />
                <span className="hidden sm:inline">Overview</span>
                {activeTab === 'overview' && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-teal-600 animate-expand-line"></div>
                )}
              </button>
              
              <button
                className={`px-2 sm:px-4 py-4 sm:py-5 bg-none border-none cursor-pointer font-medium text-gray-600 flex items-center justify-center gap-2 transition-all duration-300 whitespace-nowrap hover:text-gray-900 hover:bg-gray-50 relative ${activeTab === 'spf' ? 'text-gray-900 font-semibold' : ''
                  }`}
                onClick={() => setActiveTab('spf')}
              >
                <FiMail className="text-lg text-teal-600" />
                <span className="hidden sm:inline">SPF</span>
                {activeTab === 'spf' && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-teal-600 animate-expand-line"></div>
                )}
              </button>
              
              <button
                className={`px-2 sm:px-4 py-4 sm:py-5 bg-none border-none cursor-pointer font-medium text-gray-600 flex items-center justify-center gap-2 transition-all duration-300 whitespace-nowrap hover:text-gray-900 hover:bg-gray-50 relative ${activeTab === 'dkim' ? 'text-gray-900 font-semibold' : ''
                  }`}
                onClick={() => setActiveTab('dkim')}
              >
                <FiLock className="text-lg text-teal-600" />
                <span className="hidden sm:inline">DKIM</span>
                {activeTab === 'dkim' && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-teal-600 animate-expand-line"></div>
                )}
              </button>
              
              <button
                className={`px-2 sm:px-4 py-4 sm:py-5 bg-none border-none cursor-pointer font-medium text-gray-600 flex items-center justify-center gap-2 transition-all duration-300 whitespace-nowrap hover:text-gray-900 hover:bg-gray-50 relative ${activeTab === 'dmarc' ? 'text-gray-900 font-semibold' : ''
                  }`}
                onClick={() => setActiveTab('dmarc')}
              >
                <FiShield className="text-lg text-teal-600" />
                <span className="hidden sm:inline">DMARC</span>
                {activeTab === 'dmarc' && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-teal-600 animate-expand-line"></div>
                )}
              </button>
              
              <button
                className={`px-2 sm:px-4 py-4 sm:py-5 bg-none border-none cursor-pointer font-medium text-gray-600 flex items-center justify-center gap-2 transition-all duration-300 whitespace-nowrap hover:text-gray-900 hover:bg-gray-50 relative ${activeTab === 'blacklist' ? 'text-gray-900 font-semibold' : ''
                  }`}
                onClick={() => setActiveTab('blacklist')}
              >
                <FiList className="text-lg text-teal-600" />
                <span className="hidden sm:inline">Blacklist</span>
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
                  <div 
                    key={index} 
                    className="flex justify-between items-center p-3 sm:p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer"
                    onClick={() => handleHistoryDomainClick(item.domain)}
                  >
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

        <AnimatePresence>
          {copied && (
            <motion.div
              className="fixed bottom-4 right-4 bg-gradient-to-r from-teal-600 to-teal-700 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-full shadow-lg z-50 font-medium text-sm sm:text-base"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              onAnimationComplete={() => {
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              Record copied to clipboard!
            </motion.div>
          )}
        </AnimatePresence>
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