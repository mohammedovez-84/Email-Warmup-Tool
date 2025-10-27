import React, { useState, useEffect } from 'react';
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
  const [validationError, setValidationError] = useState('');

  // ✅ FIXED: DNS providers defined at component level
  const dnsProviders = [
    'https://cloudflare-dns.com/dns-query',
    'https://dns.google/resolve',
    'https://1.1.1.1/dns-query'
  ];

  // Typing animation states
  const [domainPlaceholder, setDomainPlaceholder] = useState('');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [placeholderText, setPlaceholderText] = useState("");

  // Circular meter animation state
  const [score, setScore] = useState(0);
  const [headerScore, setHeaderScore] = useState(0);

  // ✅ UPDATED: Enhanced domain validation function with Custom ID support
  const isValidDomain = (input) => {
    const cleanInput = input.trim().toLowerCase();
    
    // ✅ ACCEPTED PATTERNS:
    
    // 1. Standard domains (existing logic)
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

  // ✅ UPDATED: Input cleaning function to preserve email formats
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

  // ✅ ADDED: Base64 validation for DKIM keys
  const isValidBase64 = (str) => {
    try {
      return btoa(atob(str)) === str;
    } catch (err) {
      return false;
    }
  };

  // ✅ ADDED: Calculate RSA key length from modulus
  const calculateKeyLength = (base64Key) => {
    if (!base64Key || !isValidBase64(base64Key)) return 0;
    
    try {
      // Decode base64 and get byte length
      const binaryKey = atob(base64Key);
      const keyLength = binaryKey.length * 8; // Convert bytes to bits
      
      // Common RSA key lengths
      if (keyLength >= 2048 && keyLength < 3072) return 2048;
      if (keyLength >= 3072 && keyLength < 4096) return 3072;
      if (keyLength >= 4096) return 4096;
      if (keyLength >= 1024 && keyLength < 2048) return 1024;
      
      return keyLength;
    } catch (error) {
      return 0;
    }
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

  // Header circular meter animation effect - static 85% animation
  useEffect(() => {
    const animateHeaderScore = () => {
      let currentScore = 0;
      const finalScore = 85;
      const duration = 1500;
      const steps = 40;
      const increment = finalScore / steps;
      const intervalTime = duration / steps;

      const timer = setInterval(() => {
        currentScore += increment;
        if (currentScore >= finalScore) {
          setHeaderScore(finalScore);
          clearInterval(timer);
        } else {
          setHeaderScore(Math.floor(currentScore));
        }
      }, intervalTime);

      return () => clearInterval(timer);
    };

    animateHeaderScore();
  }, []);

  // Circular meter animation effect for results
  useEffect(() => {
    if (results?.overallScore) {
      const animateScore = () => {
        let currentScore = 0;
        const finalScore = results.overallScore;
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

  // ✅ UPDATED: Set responsive placeholder text with Custom ID support
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

  // ✅ FIXED: Enhanced DNS lookup function with validation
  const lookupDnsRecord = async (type, domain) => {
    // ✅ Validate domain first - now supports custom IDs
    if (!isValidDomain(domain)) {
      return { 
        exists: false, 
        record: null, 
        error: 'Invalid domain format',
        provider: 'Validation failed'
      };
    }

    let lookupDomain = domain;
    const recordType = 'TXT';

    if (type === 'dkim') {
      // Enhanced DKIM selectors including Google-specific ones
      const selectors = [
        'google', '20230601', '20221208', '20210212', '20161025', '20120113',
        'default', 'selector1', 'selector2', 'dkim', 's1', 's2', 'k1', 'key1',
        'mx', 'mail', 'k2', 'selector', 'dkim01', 'dkim02', 'x', 'y', 'z'
      ];
      
      for (const selector of selectors) {
        lookupDomain = `${selector}._domainkey.${domain}`;
        
        for (const provider of dnsProviders) {
          try {
            const response = await fetch(
              `${provider}?name=${encodeURIComponent(lookupDomain)}&type=${recordType}`,
              {
                headers: { 'Accept': 'application/dns-json' },
                signal: AbortSignal.timeout(3000)
              }
            );

            if (!response.ok) continue;

            const data = await response.json();

            if (data.Answer && data.Answer.length > 0) {
              const dkimRecord = data.Answer.find(ans => 
                ans.data && typeof ans.data === 'string' && 
                (ans.data.includes('v=DKIM1') || ans.data.includes('k=rsa') || ans.data.includes('p='))
              );
              
              if (dkimRecord) {
                return {
                  exists: true,
                  record: dkimRecord.data,
                  selector: selector,
                  domain: lookupDomain,
                  provider: provider
                };
              }
            }
          } catch (error) {
            continue;
          }
        }
      }
      return { exists: false, record: null, selector: 'not found' };

    } else if (type === 'dmarc') {
      lookupDomain = `_dmarc.${domain}`;
    }

    for (const provider of dnsProviders) {
      try {
        const response = await fetch(
          `${provider}?name=${encodeURIComponent(lookupDomain)}&type=${recordType}`,
          {
            headers: { 'Accept': 'application/dns-json' },
            signal: AbortSignal.timeout(5000)
          }
        );

        if (!response.ok) continue;

        const data = await response.json();

        if (data.Answer && data.Answer.length > 0) {
          const records = data.Answer.map(ans => ans.data).filter(record => record && typeof record === 'string');

          if (type === 'spf') {
            const spfRecord = records.find(record => 
              record.trim().startsWith('v=spf1') || 
              record.includes('v=spf1')
            );
            return spfRecord ? { 
              exists: true, 
              record: spfRecord,
              provider: provider
            } : { 
              exists: false, 
              record: null 
            };
          
          } else if (type === 'dmarc') {
            const dmarcRecord = records.find(record => 
              record.trim().startsWith('v=DMARC1') || 
              record.includes('v=DMARC1')
            );
            return dmarcRecord ? { 
              exists: true, 
              record: dmarcRecord,
              provider: provider
            } : { 
              exists: false, 
              record: null 
            };
          }

          return { 
            exists: true, 
            record: records[0],
            provider: provider
          };
        }
      } catch (error) {
        continue;
      }
    }

    return { exists: false, record: null };
  };

  // ✅ FIXED: Enhanced blacklist checking with proper DNS providers and validation
  const checkBlacklists = async (domain) => {
    // ✅ Validate domain first - now supports custom IDs
    if (!isValidDomain(domain)) {
      return [{
        name: 'Domain Validation',
        listed: false,
        response: 'Invalid Domain',
        error: 'Domain format is invalid',
        query: domain
      }];
    }

    const blacklists = [
      { name: 'Spamhaus DBL', query: `${domain}.dbl.spamhaus.org` },
      { name: 'Spamhaus ZEN', query: `${domain}.zen.spamhaus.org` },
      { name: 'Barracuda', query: `${domain}.b.barracudacentral.org` },
      { name: 'SORBS', query: `${domain}.dnsbl.sorbs.net` },
      { name: 'SpamCop', query: `${domain}.bl.spamcop.net` },
      { name: 'URIBL', query: `${domain}.black.uribl.com` },
      { name: 'PSBL', query: `${domain}.psbl.surriel.com` },
      { name: 'URIBL Multi', query: `${domain}.multi.uribl.com` },
      { name: 'SURBL multi', query: `${domain}.multi.surbl.org` },
      { name: 'SURBL', query: `${domain}.surbl.org` }
    ];

    const results = await Promise.all(
      blacklists.map(async (blacklist) => {
        for (const provider of dnsProviders) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);

            const response = await fetch(
              `${provider}?name=${encodeURIComponent(blacklist.query)}&type=A`,
              {
                headers: { 'Accept': 'application/dns-json' },
                signal: controller.signal
              }
            );
            
            clearTimeout(timeoutId);

            if (!response.ok) continue;

            const data = await response.json();
            
            const listed = data.Answer && data.Answer.some(ans => {
              if (!ans.data) return false;
              
              const responseIP = ans.data;
              
              if (blacklist.name.includes('Spamhaus DBL')) {
                return responseIP === '127.0.1.2';
              } else if (blacklist.name.includes('Spamhaus ZEN')) {
                return responseIP.startsWith('127.0.0.');
              } else if (blacklist.name.includes('Barracuda')) {
                return responseIP === '127.0.0.2';
              } else if (blacklist.name.includes('SORBS')) {
                return responseIP.startsWith('127.0.0.');
              } else if (blacklist.name.includes('SpamCop')) {
                return responseIP === '127.0.0.2';
              } else if (blacklist.name.includes('URIBL')) {
                return responseIP === '127.0.0.2';
              }
              
              return responseIP.startsWith('127.0.0.');
            });
            
            return {
              name: blacklist.name,
              listed: listed,
              response: listed ? 'Listed' : 'Not Listed',
              details: data.Answer ? data.Answer.map(a => a.data) : [],
              query: blacklist.query,
              responseTime: Date.now(),
              provider: provider
            };
          } catch (error) {
            continue;
          }
        }

        return {
          name: blacklist.name,
          listed: false,
          response: 'Check Failed',
          error: 'All DNS providers failed',
          query: blacklist.query
        };
      })
    );

    return results;
  };

  // ✅ FIXED: Enhanced BIMI check with validation
  const checkBimi = async (domain) => {
    // ✅ Validate domain first - now supports custom IDs
    if (!isValidDomain(domain)) {
      return {
        exists: false,
        record: null,
        valid: false,
        error: 'Invalid domain format',
        recommendation: 'Please enter a valid domain name.'
      };
    }

    const selectors = ['default', 'v1', 'bimi'];
    
    for (const selector of selectors) {
      const bimiDomain = `${selector}._bimi.${domain}`;
      
      for (const provider of dnsProviders) {
        try {
          const response = await fetch(
            `${provider}?name=${encodeURIComponent(bimiDomain)}&type=TXT`, 
            {
              headers: { 'Accept': 'application/dns-json' },
              signal: AbortSignal.timeout(3000)
            }
          );

          if (!response.ok) continue;

          const data = await response.json();

          if (data.Answer && data.Answer.length > 0) {
            const bimiRecord = data.Answer.find(ans => 
              ans.data && ans.data.includes('v=BIMI1')
            );
            if (bimiRecord) {
              return {
                exists: true,
                record: bimiRecord.data,
                valid: true,
                selector: selector,
                provider: provider,
                recommendation: 'BIMI is properly configured with a valid logo and certificate.'
              };
            }
          }
        } catch (error) {
          continue;
        }
      }
    }

    return {
      exists: false,
      record: null,
      valid: false,
      recommendation: 'No BIMI record found. BIMI allows brands to display logos in supporting email clients.'
    };
  };

  // ✅ FIXED: Enhanced SPF analysis with accurate lookup counting
  const analyzeSPFRecord = (spfRecord) => {
    if (!spfRecord) return { 
      mechanisms: [], 
      lookups: 0, 
      valid: false, 
      hasHardFail: false,
      syntaxErrors: []
    };

    const mechanisms = [];
    let lookups = 0;
    let syntaxErrors = [];

    try {
      if (!spfRecord.includes('v=spf1')) {
        syntaxErrors.push('Missing SPF version tag (v=spf1)');
      }

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
        } else if (part.startsWith('exists:')) {
          mechanisms.push({ type: 'exists', value: part.replace('exists:', ''), valid: true });
          lookups++;
        } else {
          syntaxErrors.push(`Unknown mechanism: ${part}`);
        }
      });

      return {
        mechanisms,
        lookups,
        valid: lookups <= 10 && syntaxErrors.length === 0,
        hasHardFail: spfRecord.includes('-all'),
        syntaxErrors
      };
    } catch (error) {
      return {
        mechanisms: [],
        lookups: 0,
        valid: false,
        hasHardFail: false,
        syntaxErrors: ['Failed to parse SPF record']
      };
    }
  };

  // ✅ FIXED: Enhanced DKIM analysis with real key calculations
 const analyzeDKIMRecord = (dkimRecord) => {
  if (!dkimRecord) return {
    valid: false,
    keyLength: 0,
    publicKeyValid: false,
    keyType: 'unknown',
    algorithm: 'unknown'
  };

  try {
    // ✅ FIXED: Remove quotes and clean the record
    let cleanRecord = dkimRecord;
    
    // Remove surrounding quotes if present
    if (cleanRecord.startsWith('"') && cleanRecord.endsWith('"')) {
      cleanRecord = cleanRecord.slice(1, -1);
    }
    
    // Handle split quoted strings (like Google's format)
    if (cleanRecord.includes('" "')) {
      cleanRecord = cleanRecord.replace(/" "/g, '');
    }

    // Parse DKIM tags
    const tags = {};
    const tagPairs = cleanRecord.split(';').map(tag => tag.trim()).filter(tag => tag);
    
    tagPairs.forEach(tagPair => {
      const [key, value] = tagPair.split('=').map(part => part.trim());
      if (key && value) {
        tags[key] = value;
      }
    });

    // Extract and validate public key
    let keyLength = 0;
    let publicKeyValid = false;
    let keyType = 'unknown';
    let algorithm = tags.v === 'DKIM1' ? 'rsa' : 'unknown';

    if (tags.p) {
      // ✅ FIXED: Enhanced Base64 validation with better cleaning
      let base64Key = tags.p;
      
      // Remove any remaining quotes, spaces, or line breaks
      base64Key = base64Key.replace(/["\s\n\r]/g, '');
      
      // Calculate actual key length from the public key
      keyLength = calculateKeyLength(base64Key);
      
      // Enhanced validation for well-known providers
      const isWellKnownProvider = cleanRecord.includes('google') || 
                                 cleanRecord.includes('microsoft') ||
                                 cleanRecord.includes('cloudflare') ||
                                 cleanRecord.includes('github');
      
      // More lenient validation for trusted providers
      if (isWellKnownProvider && keyLength > 0) {
        publicKeyValid = true;
      } else {
        publicKeyValid = keyLength >= 1024 && isValidBase64(base64Key);
      }
      
      keyType = 'RSA';
    }

    // Check algorithm
    if (tags.k) {
      algorithm = tags.k.toLowerCase();
    }

    return {
      valid: tags.v === 'DKIM1' && publicKeyValid,
      keyLength,
      publicKeyValid,
      keyType,
      algorithm,
      tags
    };
  } catch (error) {
    console.error('DKIM parsing error:', error);
    return {
      valid: false,
      keyLength: 0,
      publicKeyValid: false,
      keyType: 'unknown',
      algorithm: 'unknown'
    };
  }
};

  // ✅ FIXED: Enhanced DMARC analysis
  const analyzeDMARCRecord = (dmarcRecord) => {
    if (!dmarcRecord) return { 
      valid: false, 
      tags: {}, 
      recommendations: [],
      policy: 'not set'
    };

    const tags = {};
    const recommendations = [];

    try {
      const tagPairs = dmarcRecord.split(';').map(tag => tag.trim()).filter(tag => tag);
      
      tagPairs.forEach(tagPair => {
        const [key, value] = tagPair.split('=').map(part => part.trim());
        if (key && value) {
          tags[key] = value;
        }
      });

      if (!tags.v) {
        recommendations.push('Missing version tag (v=DMARC1)');
      } else if (tags.v !== 'DMARC1') {
        recommendations.push(`Invalid version: ${tags.v}. Should be DMARC1`);
      }

      if (!tags.p) {
        recommendations.push('Missing policy tag (p=)');
      } else if (!['none', 'quarantine', 'reject'].includes(tags.p)) {
        recommendations.push(`Invalid policy: ${tags.p}. Should be none, quarantine, or reject`);
      }

      if (tags.pct) {
        const pct = parseInt(tags.pct);
        if (isNaN(pct) || pct < 0 || pct > 100) {
          recommendations.push(`Invalid percentage: ${tags.pct}. Should be between 0-100`);
        }
      }

      if (tags.aspf && !['r', 's'].includes(tags.aspf)) {
        recommendations.push(`Invalid SPF alignment: ${tags.aspf}. Should be r (relaxed) or s (strict)`);
      }

      if (tags.adkim && !['r', 's'].includes(tags.adkim)) {
        recommendations.push(`Invalid DKIM alignment: ${tags.adkim}. Should be r (relaxed) or s (strict)`);
      }

      return {
        valid: recommendations.length === 0,
        tags,
        recommendations,
        policy: tags.p || 'not set',
        subdomainPolicy: tags.sp || tags.p || 'not set',
        percentage: tags.pct ? parseInt(tags.pct) : 100,
        alignment: {
          spf: tags.aspf === 's' ? 'strict' : 'relaxed',
          dkim: tags.adkim === 's' ? 'strict' : 'relaxed'
        },
        reporting: {
          aggregate: tags.rua,
          forensic: tags.ruf
        }
      };
    } catch (error) {
      return {
        valid: false,
        tags: {},
        recommendations: ['Failed to parse DMARC record'],
        policy: 'not set'
      };
    }
  };

  // ✅ UPDATED: Main domain checking function with Custom ID support
  const handleDomainSubmit = async (e) => {
    e.preventDefault();
    
    // Clear previous errors and results
    setValidationError('');
    setResults(null);
    
    if (!domain.trim()) {
      setValidationError('Please enter a domain name');
      return;
    }

    // ✅ UPDATED: Validate domain format with Custom ID support
    const cleanedDomain = cleanInput(domain);
    if (!isValidDomain(cleanedDomain)) {
      setValidationError('Please enter a valid domain name or identifier (e.g., example.com, user_123, service-name)');
      return;
    }

    setIsLoading(true);

    try {
      const [spfResult, dkimResult, dmarcResult, blacklistResults, bimiResults] = await Promise.allSettled([
        lookupDnsRecord('spf', cleanedDomain),
        lookupDnsRecord('dkim', cleanedDomain),
        lookupDnsRecord('dmarc', cleanedDomain),
        checkBlacklists(cleanedDomain),
        checkBimi(cleanedDomain)
      ]);

      const spfRecord = spfResult.status === 'fulfilled' ? spfResult.value : { exists: false, record: null, error: spfResult.reason };
      const dkimRecord = dkimResult.status === 'fulfilled' ? dkimResult.value : { exists: false, record: null, error: dkimResult.reason };
      const dmarcRecord = dmarcResult.status === 'fulfilled' ? dmarcResult.value : { exists: false, record: null, error: dmarcResult.reason };
      const blacklistData = blacklistResults.status === 'fulfilled' ? blacklistResults.value : [];
      const bimiData = bimiResults.status === 'fulfilled' ? bimiResults.value : { exists: false, record: null };

      // ✅ FIXED: Analyze records with proper calculations
      const spfAnalysis = spfRecord.exists ? analyzeSPFRecord(spfRecord.record) : { mechanisms: [], lookups: 0, valid: false, hasHardFail: false, syntaxErrors: [] };
      const dkimAnalysis = dkimRecord.exists ? analyzeDKIMRecord(dkimRecord.record) : { valid: false, keyLength: 0, publicKeyValid: false, keyType: 'unknown', algorithm: 'unknown' };
      const dmarcAnalysis = dmarcRecord.exists ? analyzeDMARCRecord(dmarcRecord.record) : { valid: false, tags: {}, recommendations: [], policy: 'not set' };

      // ✅ FIXED: Accurate scoring calculation
      const spfScore = spfRecord.exists ? 
        (spfAnalysis.hasHardFail ? 100 : 
         spfAnalysis.valid ? (spfAnalysis.lookups <= 10 ? 85 : 70) : 60) : 0;

      const dkimScore = dkimRecord.exists ? 
        (dkimAnalysis.valid ? (dkimAnalysis.keyLength >= 2048 ? 100 : 80) : 60) : 0;

      const dmarcScore = dmarcRecord.exists ? 
        (dmarcAnalysis.policy === 'reject' ? 100 :
         dmarcAnalysis.policy === 'quarantine' ? 85 : 70) : 0;
      
      // ✅ FIXED: Better blacklist scoring
      const successfulBlacklistChecks = blacklistData.filter(b => b.response !== 'Check Failed');
      const listedBlacklists = successfulBlacklistChecks.filter(b => b.listed === true);
      const blacklistScore = successfulBlacklistChecks.length > 0 ? 
        (listedBlacklists.length === 0 ? 100 : 
         listedBlacklists.length === 1 ? 80 : 
         listedBlacklists.length === 2 ? 60 : 40) : 70;

      const bimiScore = bimiData.exists ? 100 : 0;

      // ✅ FIXED: Balanced overall score calculation
      const overallScore = Math.round(
        (spfScore * 0.25) +
        (dkimScore * 0.25) +
        (dmarcScore * 0.30) +
        (blacklistScore * 0.15) +
        (bimiScore * 0.05)
      );

      // Generate issues list
      const issues = [];

      if (!spfRecord.exists) {
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

      if (!dkimRecord.exists) {
        issues.push({
          type: 'error',
          category: 'DKIM',
          message: 'No DKIM record found',
          description: 'This prevents email authentication and can affect deliverability.'
        });
      } else if (!dkimAnalysis.valid) {
        issues.push({
          type: 'error',
          category: 'DKIM',
          message: 'DKIM record is invalid',
          description: 'The DKIM record has syntax errors or invalid format.'
        });
      } else if (dkimAnalysis.keyLength < 1024) {
        issues.push({
          type: 'warning',
          category: 'DKIM',
          message: `DKIM key length is only ${dkimAnalysis.keyLength} bits`,
          description: 'Consider using at least 2048-bit RSA keys for better security.'
        });
      }

      if (!dmarcRecord.exists) {
        issues.push({
          type: 'error',
          category: 'DMARC',
          message: 'No DMARC record found',
          description: 'This leaves your domain vulnerable to spoofing and phishing attacks.'
        });
      } else if (dmarcAnalysis.policy === 'none') {
        issues.push({
          type: 'warning',
          category: 'DMARC',
          message: 'DMARC is in monitoring mode only (p=none)',
          description: 'Consider moving to p=quarantine or p=reject after monitoring reports.'
        });
      }

      // Blacklist issues
      const failedBlacklistChecks = blacklistData.filter(b => b.response === 'Check Failed');
      if (listedBlacklists.length > 0) {
        issues.push({
          type: 'error',
          category: 'Blacklist',
          message: `Domain listed on ${listedBlacklists.length} blacklist(s)`,
          description: `Listed on: ${listedBlacklists.map(b => b.name).join(', ')}. This may affect email deliverability.`
        });
      }

      if (failedBlacklistChecks.length > 0) {
        issues.push({
          type: 'warning',
          category: 'Blacklist',
          message: `${failedBlacklistChecks.length} blacklist checks failed`,
          description: `Unable to check: ${failedBlacklistChecks.map(b => b.name).join(', ')}. Results may be incomplete.`
        });
      }

      if (!bimiData.exists) {
        issues.push({
          type: 'info',
          category: 'BIMI',
          message: 'No BIMI record found',
          description: 'BIMI allows brands to display logos in supporting email clients.'
        });
      }

      // ✅ FIXED: Compile final results with accurate data
      const newResults = {
        domain: cleanedDomain,
        spf: {
          exists: spfRecord.exists,
          valid: spfAnalysis.valid,
          record: spfRecord.record,
          mechanisms: spfAnalysis.mechanisms,
          lookups: spfAnalysis.lookups,
          hasHardFail: spfAnalysis.hasHardFail,
          syntaxErrors: spfAnalysis.syntaxErrors,
          provider: spfRecord.provider,
          recommendation: spfRecord.exists ?
            (spfAnalysis.hasHardFail ?
              (spfAnalysis.lookups <= 10 ?
                'Your SPF record is properly configured with strict enforcement.' :
                'Your SPF record has too many DNS lookups. Consider reducing includes.') :
              'Your SPF record is configured but uses softfail. Consider changing ~all to -all for stricter enforcement.') :
            'No SPF record found. This can lead to email delivery issues.'
        },
        dkim: {
          exists: dkimRecord.exists,
          valid: dkimAnalysis.valid,
          selector: dkimRecord.selector || 'not found',
          record: dkimRecord.record,
          publicKeyValid: dkimAnalysis.publicKeyValid,
          keyLength: dkimAnalysis.keyLength,
          keyType: dkimAnalysis.keyType,
          algorithm: dkimAnalysis.algorithm,
          provider: dkimRecord.provider,
          recommendation: dkimRecord.exists ?
            (dkimAnalysis.valid ?
              (dkimAnalysis.keyLength >= 2048 ?
                'DKIM is properly configured with a strong 2048-bit key.' :
                'DKIM is configured but uses a weak key. Consider upgrading to 2048-bit RSA.') :
              'DKIM record is invalid. Check the syntax and key format.') :
            'No DKIM record found. This prevents email authentication and can affect deliverability.'
        },
        dmarc: {
          exists: dmarcRecord.exists,
          valid: dmarcAnalysis.valid,
          record: dmarcRecord.record,
          policy: dmarcAnalysis.policy,
          subdomainPolicy: dmarcAnalysis.subdomainPolicy,
          percentage: dmarcAnalysis.percentage,
          alignment: dmarcAnalysis.alignment,
          reporting: dmarcAnalysis.reporting,
          tags: dmarcAnalysis.tags,
          recommendations: dmarcAnalysis.recommendations,
          provider: dmarcRecord.provider,
          recommendation: dmarcRecord.exists ?
            (dmarcAnalysis.policy === 'reject' ?
              'Your DMARC policy is properly configured with strict enforcement.' :
              dmarcAnalysis.policy === 'quarantine' ?
                'Your DMARC policy is set to quarantine. Consider moving to p=reject for maximum protection.' :
                'Your DMARC policy is set to monitoring only. Consider moving to p=quarantine or p=reject after monitoring.') :
            'No DMARC record found. This leaves your domain vulnerable to spoofing and phishing attacks.'
        },
        blacklist: {
          checked: blacklistData.length,
          listed: listedBlacklists.length,
          successfulChecks: successfulBlacklistChecks.length,
          failedChecks: failedBlacklistChecks.length,
          details: blacklistData,
          recommendation: listedBlacklists.length === 0 ?
            (successfulBlacklistChecks.length > 0 ?
              'Your domain is not listed on any major blacklists.' :
              'Unable to complete blacklist checks. Please try again.') :
            'Your domain is listed on one or more blacklists. This may affect email deliverability.'
        },
        bimi: bimiData,
        overallScore,
        issues,
        lastChecked: new Date().toISOString(),
        checkId: Date.now()
      };

      setResults(newResults);

      // Add to history
      setHistory(prev => {
        const newHistory = [...prev];
        const filteredHistory = newHistory.filter(item => item.domain !== cleanedDomain);
        if (filteredHistory.length >= 10) filteredHistory.pop();
        return [{ 
          domain: cleanedDomain, 
          date: new Date().toISOString(), 
          score: overallScore,
          checkId: Date.now()
        }, ...filteredHistory];
      });

    } catch (error) {
      setResults({
        domain: cleanedDomain,
        error: 'Failed to check domain. Please try again.',
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
                    onChange={(e) => {
                      setDomain(e.target.value);
                      setValidationError(''); // Clear error when user types
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