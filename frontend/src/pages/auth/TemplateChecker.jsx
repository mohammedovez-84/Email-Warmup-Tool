import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiCopy,
  FiEdit2,
  FiChevronDown,
  FiChevronUp,
  FiBold,
  FiItalic,
  FiUnderline,
  FiBarChart2,
  FiFileText,
  FiSettings,
  FiShield,
  FiClock,
  FiLink,
  FiUser,
  FiMail,
  FiTarget,
  FiTrendingUp,
  FiZap,
  FiAward,
  FiEyeOff,
  FiUpload,
  FiSave,
  FiRefreshCw
} from 'react-icons/fi';

// API Service
const apiService = {
  async analyzeEmail(subject, body) {
    const API_BASE_URL = 'http://localhost:8000';
    
    console.log('📡 Calling API:', `${API_BASE_URL}/analyze`);
    console.log('📧 Subject:', subject);
    console.log('📝 Content:', body);
    
    try {
      const response = await fetch(`${API_BASE_URL}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject,
          body
        }),
      });

      console.log('📨 Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error Response:', errorText);
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ API Success - Data received');
      return data;
    } catch (error) {
      console.error('🚨 API Call Failed:', error);
      throw new Error(
        error.message === 'Failed to fetch' 
          ? 'Unable to connect to analysis service. Please check if the backend server is running on port 8000.'
          : `Analysis failed: ${error.message}`
      );
    }
  }
};

// Data Transformation Utilities
const mapPriorityToSeverity = (priority) => {
  const priorityMap = {
    'HIGH PRIORITY': 'High',
    'MEDIUM PRIORITY': 'Medium',
    'LOW PRIORITY': 'Low',
    'SUGGESTION': 'Low',
    'NONE PRIORITY': 'None'
  };
  return priorityMap[priority] || 'Low';
};

const getIconForCategory = (category) => {
  const iconMap = {
    'Spam Risk': FiShield,
    'Spam Trigger Words': FiShield,
    'Negative Tone Detected': FiAlertTriangle,
    'Unfilled Personalization Tags': FiUser,
    'Formatting': FiFileText,
    'Content Quality': FiFileText,
    'Subject Optimization': FiTarget,
    'Email Structure': FiFileText,
    'Tone & Voice': FiFileText,
    'Personalization': FiUser,
    'Content Structure': FiFileText,
    'Overall Assessment': FiAward,
    'Positive Feedback': FiAward
  };
  return iconMap[category] || FiFileText;
};

const transformMetrics = (apiMetrics) => {
  if (!apiMetrics) return {};
  
  return {
    subjectLength: apiMetrics.subject?.value || 0,
    wordCount: apiMetrics.words?.value || 0,
    sentenceCount: apiMetrics.sentences?.value || 0,
    paragraphCount: apiMetrics.paragraphs?.value || 0,
    lineCount: apiMetrics.lines?.value || 0,
    readingTime: apiMetrics.read_time?.value || '1 min',
    linkCount: apiMetrics.links?.value || 0,
    questionCount: apiMetrics.questions?.value || 0,
    spammyWordCount: apiMetrics.spam_words?.value || 0,
    personalizationCount: apiMetrics.personal_tags?.value || 0,
    uppercaseCount: apiMetrics.uppercase?.value || 0,
    readabilityScore: apiMetrics.readability?.value || 0
  };
};

const transformApiResponse = (apiData) => {
  if (!apiData || !apiData.result) {
    throw new Error('Invalid API response format');
  }

  const { template_analytics, detailed_analysis, warmup_strategies, positive_aspects } = apiData.result;

  // Transform analysis results
  const analysisResults = [];

  // Transform critical issues
  if (detailed_analysis.critical_issues) {
    detailed_analysis.critical_issues.forEach((issue, index) => {
      analysisResults.push({
        id: `critical-${index}`,
        issue: issue.category,
        severity: mapPriorityToSeverity(issue.priority),
        found: issue.found,
        suggestion: issue.recommendation,
        icon: getIconForCategory(issue.category),
        category: issue.category
      });
    });
  }

  // Transform warnings
  if (detailed_analysis.warnings) {
    detailed_analysis.warnings.forEach((warning, index) => {
      analysisResults.push({
        id: `warning-${index}`,
        issue: warning.category,
        severity: mapPriorityToSeverity(warning.priority),
        found: warning.found,
        suggestion: warning.recommendation,
        icon: getIconForCategory(warning.category),
        category: warning.category
      });
    });
  }

  // Transform suggestions
  if (detailed_analysis.suggestions) {
    detailed_analysis.suggestions.forEach((suggestion, index) => {
      analysisResults.push({
        id: `suggestion-${index}`,
        issue: suggestion.category,
        severity: 'Low',
        found: suggestion.found,
        suggestion: suggestion.recommendation,
        icon: FiFileText,
        category: suggestion.category
      });
    });
  }

  // Add positive aspects
  if (positive_aspects && positive_aspects.found) {
    analysisResults.push({
      id: 'positive',
      issue: positive_aspects.category,
      severity: 'None',
      found: positive_aspects.found,
      suggestion: positive_aspects.recommendation,
      icon: FiAward,
      category: 'Positive Feedback'
    });
  }

  return {
    analysisResults,
    templateAnalytics: template_analytics,
    warmupStrategies: warmup_strategies,
    metrics: transformMetrics(template_analytics?.metrics)
  };
};

const TemplateCheckerPage = () => {
  // State Management
  const [emailSubject, setEmailSubject] = useState('Problem with emails going to SPAM');
  const [emailContent, setEmailContent] = useState(`Hi [Recipient_Name],

I ran into a problem with my email campaigns.
I sent emails to my clients to announce the launch of a new promotion in our company, but most of the recipients received my emails in the SPAM folder.

Perhaps this is due to the fact that my domain is very young and has not participated in mailing lists before?
Could you tell me how I can warm up my domain and mailbox to improve deliverability?

Best regards,
[My_Name]`);

  const [analysisResults, setAnalysisResults] = useState([]);
  const [activeTab, setActiveTab] = useState('editor');
  const [fontFamily, setFontFamily] = useState('Inter');
  const [fontSize, setFontSize] = useState('14px');
  const [showMetrics, setShowMetrics] = useState(true);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [notification, setNotification] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [templateHistory, setTemplateHistory] = useState([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1);
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [templateName, setTemplateName] = useState('');
  const [apiMetrics, setApiMetrics] = useState(null);
  const [warmupStrategies, setWarmupStrategies] = useState([]);
  const [emailHealthScore, setEmailHealthScore] = useState(0);

  const textareaRef = useRef(null);

  // Enhanced Metrics Calculation (Fallback)
  const calculateMetrics = () => {
    const words = emailContent.split(/\s+/).filter(word => word.length > 0);
    const sentences = emailContent.split(/[.!?]+/).filter(s => s.length > 0);
    const paragraphs = emailContent.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    const lines = emailContent.split('\n').filter(line => line.trim().length > 0);

    const spamWords = ['promotion', 'free', 'discount', 'offer', 'win', 'prize', 'buy now',
      'limited time', 'act fast', 'click here', 'money back', 'guarantee',
      'no cost', 'no obligation', 'risk-free', 'special promotion', 'urgent',
      'cash', 'bonus', 'credit', 'deal', 'discount', 'price', 'rate', 'cheap'];

    const spammyWordsFound = words.filter(word =>
      spamWords.includes(word.toLowerCase())
    );

    return {
      subjectLength: emailSubject.length,
      contentLength: emailContent.length,
      wordCount: words.length,
      sentenceCount: sentences.length,
      paragraphCount: paragraphs.length,
      lineCount: lines.length,
      avgWordsPerSentence: words.length / Math.max(sentences.length, 1),
      readingTime: Math.max(1, Math.ceil(words.length / 200)) + ' min',
      linkCount: (emailContent.match(/https?:\/\/[^\s]+/g) || []).length,
      questionCount: (emailContent.match(/\?/g) || []).length,
      spammyWordCount: spammyWordsFound.length,
      personalizationCount: (emailContent.match(/\[[^\]]+\]/g) || []).length,
      uppercaseCount: (emailContent.match(/[A-Z]{3,}/g) || []).length,
      sentimentScore: calculateSentiment(emailContent),
      readabilityScore: calculateReadability(emailContent)
    };
  };

  const calculateSentiment = (text) => {
    const positiveWords = ['great', 'excellent', 'amazing', 'wonderful', 'perfect',
      'outstanding', 'fantastic', 'good', 'happy', 'pleased'];
    const negativeWords = ['problem', 'issue', 'spam', 'failed', 'wrong', 'bad',
      'terrible', 'sorry', 'unfortunately', 'difficult'];

    const words = text.toLowerCase().split(/\s+/);
    let score = 0;

    words.forEach(word => {
      if (positiveWords.includes(word)) score += 1;
      if (negativeWords.includes(word)) score -= 1;
    });

    return Math.max(-1, Math.min(1, score / Math.max(words.length / 10, 1)));
  };

  const calculateReadability = (text) => {
    const words = text.split(/\s+/).filter(word => word.length > 0);
    const sentences = text.split(/[.!?]+/).filter(s => s.length > 0);
    const avgWordsPerSentence = words.length / Math.max(sentences.length, 1);

    let score = 100;
    if (avgWordsPerSentence > 25) score -= 20;
    if (avgWordsPerSentence > 30) score -= 20;
    if (words.length < 50) score -= 10;
    if (words.length > 500) score -= 10;

    return Math.max(0, Math.min(100, score));
  };

  const [metrics, setMetrics] = useState(calculateMetrics());

  // Effects
  useEffect(() => {
    setMetrics(calculateMetrics());
  }, [emailSubject, emailContent]);

  useEffect(() => {
    const newState = { emailSubject, emailContent, timestamp: Date.now() };
    if (templateHistory.length === 0 ||
      JSON.stringify(templateHistory[templateHistory.length - 1]) !== JSON.stringify(newState)) {
      setTemplateHistory(prev => [...prev.slice(0, currentHistoryIndex + 1), newState]);
      setCurrentHistoryIndex(prev => prev + 1);
    }
  }, [emailSubject, emailContent]);

  // Constants
  const fonts = [
    'Inter', 'Arial', 'Helvetica', 'Georgia', 'Times New Roman',
    'Verdana', 'Tahoma', 'Segoe UI', 'Roboto', 'SF Pro Display', 'Courier New'
  ];

  // Core Functions with API Integration
  const handleAnalyze = async () => {
    if (!emailSubject.trim() || !emailContent.trim()) {
      showNotification('Please enter both subject and content', 'error');
      return;
    }

    setIsAnalyzing(true);
    
    try {
      console.log('🚀 Starting API analysis...');
      const apiData = await apiService.analyzeEmail(emailSubject, emailContent);
      console.log('📊 API Data received:', apiData);
      
      const transformedData = transformApiResponse(apiData);
      console.log('🔄 Transformed Data:', transformedData);
      
      setAnalysisResults(transformedData.analysisResults);
      setApiMetrics(transformedData.metrics);
      setWarmupStrategies(transformedData.warmupStrategies);
      setEmailHealthScore(transformedData.templateAnalytics?.email_health_score || getScore());
      
      setActiveTab('results');
      showNotification('Email analysis completed successfully!');
      
    } catch (error) {
      console.error('❌ Analysis error:', error);
      showNotification(error.message, 'error');
      // Fallback to local analysis
      performLocalAnalysis();
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Fallback local analysis
  const performLocalAnalysis = () => {
    console.log('🔄 Falling back to local analysis...');
    const newResults = [];
    const spamWords = emailContent.match(/\b(promotion|free|discount|offer|win|prize|buy now|limited time|act fast|click here|money back|guarantee|no cost|no obligation|risk-free|special promotion|urgent|cash|bonus|credit|deal|price|rate|cheap)\b/gi) || [];
    const personalizationTags = emailContent.match(/\[[^\]]+\]/g) || [];
    const uppercaseWords = emailContent.match(/[A-Z]{3,}/g) || [];
    const linkCount = metrics.linkCount;

    if (spamWords.length > 0) {
      newResults.push({
        id: 1,
        issue: 'Spam Trigger Words Detected',
        severity: 'High',
        found: spamWords.slice(0, 5).join(', ') + (spamWords.length > 5 ? `... and ${spamWords.length - 5} more` : ''),
        suggestion: `Replace ${spamWords.length} spam-triggering words with professional alternatives. Avoid excessive marketing language.`,
        icon: FiShield,
        category: 'Content Quality'
      });
    }

    if (personalizationTags.length > 0) {
      newResults.push({
        id: 2,
        issue: 'Unfilled Personalization Tags',
        severity: personalizationTags.length > 3 ? 'High' : 'Medium',
        found: `${personalizationTags.length} personalization tags found`,
        suggestion: 'Replace all [placeholder] tags with actual recipient data before sending to improve engagement.',
        icon: FiUser,
        category: 'Personalization'
      });
    }

    if (emailSubject.length > 50) {
      newResults.push({
        id: 3,
        issue: 'Subject Line Too Long',
        severity: 'Medium',
        found: `${emailSubject.length} characters (optimal: 35-50 characters)`,
        suggestion: 'Shorten subject line to improve open rates. Focus on clarity and value proposition.',
        icon: FiTarget,
        category: 'Subject Optimization'
      });
    }

    const positiveAspects = [];
    if (metrics.personalizationCount > 0) positiveAspects.push('personalization tags');
    if (metrics.questionCount > 0) positiveAspects.push('engaging questions');
    if (metrics.paragraphCount >= 2) positiveAspects.push('good paragraph structure');
    if (emailSubject.length >= 10 && emailSubject.length <= 50) positiveAspects.push('optimal subject length');

    if (positiveAspects.length > 0) {
      newResults.push({
        id: 4,
        issue: 'Positive Aspects Found',
        severity: 'None',
        found: `Well done on: ${positiveAspects.join(', ')}`,
        suggestion: 'Continue maintaining these good practices in your email templates.',
        icon: FiCheckCircle,
        category: 'Positive Feedback'
      });
    }

    setAnalysisResults(newResults);
    setActiveTab('results');
    showNotification('Local analysis completed (API unavailable)');
  };

  const handleCopyToClipboard = () => {
    const template = `Subject: ${emailSubject}\n\n${emailContent}`;
    navigator.clipboard.writeText(template).then(() => {
      showNotification('Email template copied to clipboard!');
    });
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const toggleMetrics = () => {
    setShowMetrics(!showMetrics);
  };

  const applyFormatting = (type) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = emailContent.substring(start, end);
    let newText = emailContent;

    if (selectedText) {
      switch (type) {
        case 'bold':
          newText = emailContent.substring(0, start) + `**${selectedText}**` + emailContent.substring(end);
          setIsBold(!isBold);
          break;
        case 'italic':
          newText = emailContent.substring(0, start) + `*${selectedText}*` + emailContent.substring(end);
          setIsItalic(!isItalic);
          break;
        case 'underline':
          newText = emailContent.substring(0, start) + `_${selectedText}_` + emailContent.substring(end);
          setIsUnderline(!isUnderline);
          break;
        default:
          break;
      }

      setEmailContent(newText);

      setTimeout(() => {
        textarea.selectionStart = start;
        textarea.selectionEnd = end;
        textarea.focus();
      }, 0);
    }
  };

  // Enhanced scoring algorithm
  const getScore = () => {
    let score = 100;

    // Content quality deductions
    if (metrics.spammyWordCount > 0) score -= metrics.spammyWordCount * 4;
    if (metrics.personalizationCount > 0) score -= metrics.personalizationCount * 1;
    if (metrics.uppercaseCount > 2) score -= (metrics.uppercaseCount - 2) * 3;
    if (metrics.linkCount > 2) score -= (metrics.linkCount - 2) * 5;

    // Structure deductions
    if (emailSubject.length > 50) score -= 8;
    if (emailSubject.length < 10) score -= 5;
    if (metrics.wordCount < 50) score -= 12;
    if (metrics.wordCount > 500) score -= 8;
    if (metrics.sentimentScore < -0.1) score -= 6;
    if (metrics.readabilityScore < 60) score -= 10;

    // Positive adjustments
    if (metrics.questionCount > 0) score += 5;
    if (metrics.paragraphCount >= 2) score += 5;
    if (metrics.personalizationCount > 0) score += 3;

    return Math.max(0, Math.min(100, Math.round(score)));
  };

  const score = emailHealthScore || getScore();
  const scoreColor = score >= 80 ? '#0D9488' : score >= 60 ? '#D97706' : '#DC2626';

  // Template Management
  const saveTemplate = () => {
    if (!templateName.trim()) {
      showNotification('Please enter a template name', 'error');
      return;
    }

    const newTemplate = {
      id: Date.now(),
      name: templateName,
      subject: emailSubject,
      content: emailContent,
      createdAt: new Date().toISOString()
    };

    setSavedTemplates(prev => [...prev, newTemplate]);
    setTemplateName('');
    showNotification('Template saved successfully!');
  };

  const loadTemplate = (template) => {
    setEmailSubject(template.subject);
    setEmailContent(template.content);
    showNotification(`Template "${template.name}" loaded`);
  };

  const clearTemplate = () => {
    setEmailSubject('');
    setEmailContent('');
    showNotification('Template cleared!');
  };

  const loadSampleTemplate = () => {
    setEmailSubject('Follow-up: Recent Conversation');
    setEmailContent(`Hi [Recipient_Name],

I hope this email finds you well. I wanted to follow up on our recent conversation about [Topic].

I've attached the document we discussed, which includes the key points and next steps. Please let me know if you have any questions or need additional information.

Looking forward to hearing your thoughts.

Best regards,
[Your_Name]`);
    showNotification('Sample template loaded!');
  };

  // Circular Score Component
  const CircularScore = ({ score, color }) => {
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const strokeDasharray = `${(score / 100) * circumference} ${circumference}`;

    return (
      <div className="relative w-28 h-28">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="56"
            cy="56"
            r={radius}
            stroke="#E5E7EB"
            strokeWidth="8"
            fill="none"
          />
          <circle
            cx="56"
            cy="56"
            r={radius}
            stroke={color}
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={strokeDasharray}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <span className="text-3xl font-bold text-gray-900 block">{score}</span>
            <span className="text-xs text-gray-500 font-medium">SCORE</span>
          </div>
        </div>
      </div>
    );
  };

  // Use API metrics when available, otherwise use local metrics
  const displayMetrics = apiMetrics || metrics;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/40 to-blue-50/30 p-4 font-sans">
      {/* Enhanced Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-10 left-5% w-80 h-80 bg-teal-200/40 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float-slow"></div>
        <div className="absolute top-40 right-10% w-96 h-96 bg-blue-200/30 rounded-full mix-blend-multiply filter blur-3xl opacity-25 animate-float-medium"></div>
        <div className="absolute bottom-20 left-20% w-72 h-72 bg-emerald-200/20 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-float-slow"></div>
        <div className="absolute top-60 left-60% w-64 h-64 bg-cyan-200/25 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float-fast"></div>
      </div>

      {/* Main Container - Responsive */}
      <div className="max-w-9xl mx-auto">
     
        <div className="text-center mb-8 px-4 mt-6">
  <div className="inline-flex items-center justify-center w-14 h-14 md:w-20 md:h-20 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl md:rounded-2xl shadow-xl mb-3 md:mb-4">
    <FiMail className="w-6 h-6 md:w-10 md:h-10 text-white" />
  </div>
  
  <h1 className="text-2xl md:text-4xl font-bold text-gray-900 mb-2 md:mb-3">
    <span className="bg-gradient-to-r from-teal-600 to-teal-700 bg-clip-text text-transparent py-1 inline-block">
      Email Template Analyzer
    </span>
  </h1>
  
  <p className="text-base md:text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed mb-4 md:mb-6">
    Optimize your email templates for maximum deliverability, engagement, and professional impact
  </p>
  
  <div className="flex justify-center items-center gap-3 md:gap-6 text-xs md:text-sm text-gray-500 flex-wrap">
    <div className="flex items-center gap-1 md:gap-2 bg-white/50 px-3 py-1.5 md:px-4 md:py-2 rounded-full backdrop-blur-sm">
      <FiCheckCircle className="w-3 h-3 md:w-4 md:h-4 text-teal-500" />
      <span className="font-medium">Real-time Analysis</span>
    </div>
    <div className="flex items-center gap-1 md:gap-2 bg-white/50 px-3 py-1.5 md:px-4 md:py-2 rounded-full backdrop-blur-sm">
      <FiCheckCircle className="w-3 h-3 md:w-4 md:h-4 text-teal-500" />
      <span className="font-medium">Professional Templates</span>
    </div>
    <div className="flex items-center gap-1 md:gap-2 bg-white/50 px-3 py-1.5 md:px-4 md:py-2 rounded-full backdrop-blur-sm">
      <FiCheckCircle className="w-3 h-3 md:w-4 md:h-4 text-teal-500" />
      <span className="font-medium">Best Practices</span>
    </div>
    <div className="flex items-center gap-1 md:gap-2 bg-white/50 px-3 py-1.5 md:px-4 md:py-2 rounded-full backdrop-blur-sm">
      <FiCheckCircle className="w-3 h-3 md:w-4 md:h-4 text-teal-500" />
      <span className="font-medium">Spam Detection</span>
    </div>
  </div>
</div>

        {/* Premium Main Card - Enhanced & Responsive */}
        <div className="bg-white/90 backdrop-blur-2xl rounded-2xl md:rounded-3xl shadow-2xl border border-white/40 overflow-hidden mx-auto">

          {/* Enhanced Navigation Tabs - Responsive */}
          <div className="flex flex-col sm:flex-row border-b border-gray-200/60 bg-gradient-to-r from-white/80 to-white/60 backdrop-blur-sm">
            <button
              onClick={() => setActiveTab('editor')}
              className={`flex items-center gap-2 md:gap-3 px-4 md:px-8 py-4 md:py-6 font-semibold transition-all duration-300 relative group flex-1 justify-center ${activeTab === 'editor'
                ? 'text-teal-600'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${activeTab === 'editor'
                ? 'bg-teal-500 text-white shadow-lg'
                : 'bg-gray-100 text-gray-600 group-hover:bg-teal-50 group-hover:text-teal-600'
                }`}>
                <FiFileText className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <span className="text-base md:text-lg">Template Editor</span>
              {activeTab === 'editor' && (
                <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-teal-500 to-teal-600"></div>
              )}
            </button>
            <button
              onClick={() => setActiveTab('results')}
              className={`flex items-center gap-2 md:gap-3 px-4 md:px-8 py-4 md:py-6 font-semibold transition-all duration-300 relative group flex-1 justify-center ${activeTab === 'results'
                ? 'text-teal-600'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${activeTab === 'results'
                ? 'bg-teal-500 text-white shadow-lg'
                : 'bg-gray-100 text-gray-600 group-hover:bg-teal-50 group-hover:text-teal-600'
                }`}>
                <FiBarChart2 className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <span className="text-base md:text-lg">Analysis Results</span>
              {analysisResults.length > 0 && (
                <span className="bg-teal-500 text-white text-xs px-2 py-1 rounded-full font-bold min-w-6">
                  {analysisResults.length}
                </span>
              )}
              {activeTab === 'results' && (
                <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-teal-500 to-teal-600"></div>
              )}
            </button>
          </div>

          {/* Enhanced Content Area - Responsive */}
          <div className="p-4 md:p-6 lg:p-8">
            {activeTab === 'editor' ? (
              <div className="space-y-6 md:space-y-8">
                {/* Premium Header with Actions - Improved & Responsive */}
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 md:gap-6">
                  <div className="flex items-start gap-3 md:gap-4 flex-shrink-0">
                    <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl md:rounded-2xl flex items-center justify-center shadow-xl">
                      <FiEdit2 className="w-6 h-6 md:w-8 md:h-8 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Compose Your Email</h2>
                      <p className="text-gray-600 text-base md:text-lg mt-1 md:mt-2">Create professional email templates with real-time optimization</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 md:gap-4 flex-wrap">
                    {/* Template Actions */}
                    <div className="flex gap-2 order-1">
                      <button
                        onClick={loadSampleTemplate}
                        className="flex items-center gap-2 px-3 md:px-4 py-2.5 md:py-3 bg-white border border-gray-300 text-gray-700 rounded-lg md:rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium shadow-sm hover:shadow-md flex-shrink-0 text-sm md:text-base"
                      >
                        <FiFileText className="w-4 h-4" />
                        Sample
                      </button>
                      <button
                        onClick={clearTemplate}
                        className="flex items-center gap-2 px-3 md:px-4 py-2.5 md:py-3 bg-white border border-gray-300 text-gray-700 rounded-lg md:rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium shadow-sm hover:shadow-md flex-shrink-0 text-sm md:text-base"
                      >
                        <FiEyeOff className="w-4 h-4" />
                        Clear
                      </button>
                    </div>

                    {/* Save Template */}
                    <div className="flex gap-2 order-3 lg:order-2 flex-1 min-w-0">
                      <input
                        type="text"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        placeholder="Template name"
                        className="px-3 md:px-4 py-2.5 md:py-3 bg-white border border-gray-300 rounded-lg md:rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent flex-1 min-w-0 text-sm md:text-base"
                      />
                      <button
                        onClick={saveTemplate}
                        className="flex items-center gap-2 px-3 md:px-4 py-2.5 md:py-3 bg-white border border-gray-300 text-gray-700 rounded-lg md:rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium shadow-sm hover:shadow-md flex-shrink-0 text-sm md:text-base"
                      >
                        <FiSave className="w-4 h-4" />
                        Save
                      </button>
                    </div>

                    {/* Enhanced Formatting Toolbar - Responsive */}
                    <div className="flex items-center gap-1 bg-white/80 backdrop-blur-sm border border-gray-300/50 rounded-lg md:rounded-xl p-2 shadow-sm order-4 lg:order-3 flex-shrink-0 overflow-x-auto">
                      <select
                        value={fontFamily}
                        onChange={(e) => setFontFamily(e.target.value)}
                        className="px-2 md:px-3 py-1.5 md:py-2 border-0 bg-transparent text-xs md:text-sm focus:outline-none focus:ring-0 font-medium min-w-20"
                      >
                        {fonts.map(font => (
                          <option key={font} value={font}>{font}</option>
                        ))}
                      </select>

                      <select
                        value={fontSize}
                        onChange={(e) => setFontSize(e.target.value)}
                        className="px-2 md:px-3 py-1.5 md:py-2 border-0 bg-transparent text-xs md:text-sm focus:outline-none focus:ring-0 border-l border-gray-300/50 font-medium min-w-16"
                      >
                        <option value="12px">12px</option>
                        <option value="14px">14px</option>
                        <option value="16px">16px</option>
                        <option value="18px">18px</option>
                        <option value="20px">20px</option>
                      </select>

                      <div className="flex gap-1 border-l border-gray-300/50 pl-2">
                        <button
                          onClick={() => applyFormatting('bold')}
                          className={`p-1.5 md:p-2 rounded-lg transition-all duration-200 ${isBold
                            ? 'bg-teal-500 text-white shadow-md transform scale-105'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-teal-600'
                            }`}
                        >
                          <FiBold className="w-3 h-3 md:w-4 md:h-4" />
                        </button>
                        <button
                          onClick={() => applyFormatting('italic')}
                          className={`p-1.5 md:p-2 rounded-lg transition-all duration-200 ${isItalic
                            ? 'bg-teal-500 text-white shadow-md transform scale-105'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-teal-600'
                            }`}
                        >
                          <FiItalic className="w-3 h-3 md:w-4 md:h-4" />
                        </button>
                        <button
                          onClick={() => applyFormatting('underline')}
                          className={`p-1.5 md:p-2 rounded-lg transition-all duration-200 ${isUnderline
                            ? 'bg-teal-500 text-white shadow-md transform scale-105'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-teal-600'
                            }`}
                        >
                          <FiUnderline className="w-3 h-3 md:w-4 md:h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Enhanced Action Buttons - Responsive */}
                    <div className="flex gap-2 md:gap-3 order-2 lg:order-4">
                      <button
                        onClick={handleCopyToClipboard}
                        className="flex items-center gap-2 px-3 md:px-5 py-2.5 md:py-3 bg-white border border-gray-300 text-gray-700 rounded-lg md:rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium shadow-sm hover:shadow-md hover:border-teal-200 flex-shrink-0 text-sm md:text-base"
                      >
                        <FiCopy className="w-4 h-4" />
                        Copy
                      </button>
                      <button
                        onClick={handleAnalyze}
                        disabled={isAnalyzing}
                        className="flex items-center gap-2 md:gap-3 px-4 md:px-6 py-2.5 md:py-3 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-lg md:rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 font-semibold disabled:opacity-50 disabled:transform-none disabled:hover:shadow-lg flex-shrink-0 text-sm md:text-base"
                      >
                        {isAnalyzing ? (
                          <>
                            <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-sm md:text-lg">Analyzing...</span>
                          </>
                        ) : (
                          <>
                            <FiZap className="w-4 h-4 md:w-5 md:h-5" />
                            <span className="text-sm md:text-lg">Analyze</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Enhanced Subject Field - Responsive */}
                <div className="bg-white/60 backdrop-blur-sm rounded-xl md:rounded-2xl border border-gray-300/50 p-4 md:p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
                  <label className="block text-sm font-semibold text-gray-700 mb-2 md:mb-3 flex items-center gap-2">
                    <FiTarget className="w-4 h-4 md:w-5 md:h-5 text-teal-500" />
                    <span className="text-base md:text-lg">Email Subject Line</span>
                  </label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="w-full px-4 md:px-5 py-3 md:py-4 bg-white/80 border border-gray-300/50 rounded-lg md:rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-200 text-lg md:text-xl font-medium placeholder-gray-400"
                    placeholder="Craft an engaging subject line that drives opens..."
                  />
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-2 md:mt-3 gap-2">
                    <span className="text-xs md:text-sm text-gray-500 font-medium">
                      {emailSubject.length} characters
                    </span>
                    {emailSubject.length > 50 ? (
                      <span className="text-amber-600 text-xs md:text-sm font-medium bg-amber-50 px-2 md:px-3 py-1 md:py-1.5 rounded-lg border border-amber-200 flex items-center gap-1 md:gap-2">
                        <FiAlertTriangle className="w-3 h-3 md:w-4 md:h-4" />
                        Recommended: 50 characters max
                      </span>
                    ) : emailSubject.length < 10 ? (
                      <span className="text-amber-600 text-xs md:text-sm font-medium bg-amber-50 px-2 md:px-3 py-1 md:py-1.5 rounded-lg border border-amber-200 flex items-center gap-1 md:gap-2">
                        <FiAlertTriangle className="w-3 h-3 md:w-4 md:h-4" />
                        Recommended: at least 10 characters
                      </span>
                    ) : (
                      <span className="text-teal-600 text-xs md:text-sm font-medium bg-teal-50 px-2 md:px-3 py-1 md:py-1.5 rounded-lg border border-teal-200 flex items-center gap-1 md:gap-2">
                        <FiCheckCircle className="w-3 h-3 md:w-4 md:h-4" />
                        Optimal length
                      </span>
                    )}
                  </div>
                </div>

                {/* Enhanced Email Editor - Increased Height & Responsive */}
                <div className="bg-white/60 backdrop-blur-sm rounded-xl md:rounded-2xl border border-gray-300/50 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
                  <label className="block text-sm font-semibold text-gray-700 p-4 md:p-5 border-b border-gray-300/50 flex items-center gap-2">
                    <FiFileText className="w-4 h-4 md:w-5 md:h-5 text-teal-500" />
                    <span className="text-base md:text-lg">Email Content</span>
                  </label>
                  <textarea
                    ref={textareaRef}
                    value={emailContent}
                    onChange={(e) => setEmailContent(e.target.value)}
                    className="w-full h-64 md:h-80 lg:h-96 px-4 md:px-6 py-4 md:py-6 bg-white/80 border-0 focus:outline-none focus:ring-0 resize-vertical text-gray-700 leading-relaxed placeholder-gray-400 text-sm md:text-base"
                    style={{
                      fontFamily,
                      fontSize,
                      fontWeight: isBold ? 'bold' : 'normal',
                      fontStyle: isItalic ? 'italic' : 'normal',
                      textDecoration: isUnderline ? 'underline' : 'none'
                    }}
                    placeholder="Write your compelling email content here... Use **bold**, *italic*, or _underline_ formatting for emphasis."
                  />
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 md:px-6 py-3 md:py-4 bg-gray-50/50 border-t border-gray-300/50 gap-2">
                    <span className="text-xs md:text-sm text-gray-500">
                      {displayMetrics.wordCount} words • {displayMetrics.lineCount} lines • {displayMetrics.paragraphCount} paragraphs
                    </span>
                    <span className="text-xs md:text-sm text-gray-500">
                      Reading time: {displayMetrics.readingTime} • {displayMetrics.sentenceCount} sentences
                    </span>
                  </div>
                </div>

                {/* Enhanced Metrics Section - Responsive */}
                <div className="bg-white/60 backdrop-blur-sm rounded-xl md:rounded-2xl border border-gray-300/50 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
                  <button
                    onClick={toggleMetrics}
                    className="w-full flex items-center justify-between p-4 md:p-6 hover:bg-gray-50/50 transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-3 md:gap-4">
                      <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-200">
                        <FiTrendingUp className="w-5 h-5 md:w-6 md:h-6 text-white" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold text-gray-900 text-lg md:text-xl">Template Analytics</h3>
                        <p className="text-gray-600 text-sm md:text-base">Real-time metrics and performance insights</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 md:gap-3">
                      <span className={`text-xs md:text-sm font-medium px-2 md:px-3 py-1 md:py-1.5 rounded-full ${score >= 80 ? 'bg-teal-100 text-teal-800 border border-teal-200' :
                        score >= 60 ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                          'bg-red-100 text-red-800 border border-red-200'
                        }`}>
                        {score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : 'Needs Work'}
                      </span>
                      {showMetrics ?
                        <FiChevronUp className="w-5 h-5 md:w-6 md:h-6 text-gray-400 transition-transform duration-200" /> :
                        <FiChevronDown className="w-5 h-5 md:w-6 md:h-6 text-gray-400 transition-transform duration-200" />
                      }
                    </div>
                  </button>

                  {showMetrics && (
                    <div className="p-4 md:p-6 border-t border-gray-300/50 bg-gradient-to-br from-gray-50/50 to-white/30">
                      {/* Enhanced Score Display - Responsive */}
                      <div className="flex flex-col lg:flex-row items-center gap-6 md:gap-8 mb-6 md:mb-8 p-6 md:p-8 bg-white rounded-xl md:rounded-2xl border border-gray-300/50 shadow-sm">
                        <CircularScore score={score} color={scoreColor} />
                        <div className="flex-1 text-center lg:text-left mt-4 lg:mt-0">
                          <h4 className="font-bold text-gray-900 text-xl md:text-2xl mb-2 md:mb-3">Email Health Score</h4>
                          <p className={`text-base md:text-lg font-medium mb-3 md:mb-4 ${score >= 80 ? 'text-teal-600' :
                            score >= 60 ? 'text-amber-600' :
                              'text-red-600'
                            }`}>
                            {score >= 80 ? '🎉 Excellent - Your template is ready for sending!' :
                              score >= 60 ? '📝 Good - Minor improvements can boost performance' :
                                '⚠️ Needs Work - Review recommendations below'}
                          </p>
                          <div className="flex flex-wrap justify-center lg:justify-start items-center gap-4 md:gap-6 text-xs md:text-sm text-gray-600">
                            <div className="flex items-center gap-1 md:gap-2">
                              <div className="w-2 h-2 md:w-3 md:h-3 bg-teal-500 rounded-full"></div>
                              <span className="font-medium">80-100: Excellent</span>
                            </div>
                            <div className="flex items-center gap-1 md:gap-2">
                              <div className="w-2 h-2 md:w-3 md:h-3 bg-amber-500 rounded-full"></div>
                              <span className="font-medium">60-79: Good</span>
                            </div>
                            <div className="flex items-center gap-1 md:gap-2">
                              <div className="w-2 h-2 md:w-3 md:h-3 bg-red-500 rounded-full"></div>
                              <span className="font-medium">0-59: Needs Work</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Enhanced Metrics Grid - Improved Responsive Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
                        {[
                          { label: 'Subject', value: displayMetrics.subjectLength, warning: displayMetrics.subjectLength > 50 || displayMetrics.subjectLength < 10, optimal: displayMetrics.subjectLength >= 10 && displayMetrics.subjectLength <= 50, icon: FiTarget, description: 'chars' },
                          { label: 'Words', value: displayMetrics.wordCount, warning: displayMetrics.wordCount < 50 || displayMetrics.wordCount > 500, optimal: displayMetrics.wordCount >= 50 && displayMetrics.wordCount <= 500, icon: FiFileText, description: 'words' },
                          { label: 'Sentences', value: displayMetrics.sentenceCount, optimal: displayMetrics.sentenceCount >= 3, icon: FiFileText, description: 'sentences' },
                          { label: 'Paragraphs', value: displayMetrics.paragraphCount, optimal: displayMetrics.paragraphCount >= 2, icon: FiFileText, description: 'paragraphs' },
                          { label: 'Lines', value: displayMetrics.lineCount, icon: FiFileText, description: 'lines' },
                          { label: 'Read Time', value: displayMetrics.readingTime, icon: FiClock, description: 'minutes' },
                          { label: 'Links', value: displayMetrics.linkCount, warning: displayMetrics.linkCount > 2, optimal: displayMetrics.linkCount <= 2, icon: FiLink, description: 'links' },
                          { label: 'Questions', value: displayMetrics.questionCount, optimal: displayMetrics.questionCount >= 1, icon: FiFileText, description: 'questions' },
                          { label: 'Spam Words', value: displayMetrics.spammyWordCount, warning: displayMetrics.spammyWordCount > 0, optimal: displayMetrics.spammyWordCount === 0, icon: FiShield, description: 'words' },
                          { label: 'Personal Tags', value: displayMetrics.personalizationCount, optimal: displayMetrics.personalizationCount > 0, icon: FiUser, description: 'tags' },
                          { label: 'UPPERCASE', value: displayMetrics.uppercaseCount, warning: displayMetrics.uppercaseCount > 2, optimal: displayMetrics.uppercaseCount <= 2, icon: FiFileText, description: 'instances' },
                          { label: 'Readability', value: Math.round(displayMetrics.readabilityScore), warning: displayMetrics.readabilityScore < 60, optimal: displayMetrics.readabilityScore >= 60, icon: FiFileText, description: 'score' },
                        ].map((metric, index) => {
                          const IconComponent = metric.icon;
                          return (
                            <div key={index} className={`bg-white/80 backdrop-blur-sm border rounded-lg md:rounded-xl p-3 md:p-4 text-center transition-all duration-200 hover:shadow-md group ${metric.warning ? 'border-red-300 bg-red-50/50' :
                              metric.optimal ? 'border-teal-300 bg-teal-50/50' :
                                'border-gray-300/50'
                              }`}>
                              <div className="flex items-center justify-center gap-1 md:gap-2 mb-2 md:mb-3">
                                <IconComponent className={`w-4 h-4 md:w-5 md:h-5 ${metric.warning ? 'text-red-600' :
                                  metric.optimal ? 'text-teal-600' :
                                    'text-gray-600'
                                  }`} />
                                <div className="text-xl md:text-2xl font-bold text-gray-900">{metric.value}</div>
                              </div>
                              <div className="space-y-1">
                                <div className="text-xs md:text-sm font-semibold text-gray-700 uppercase tracking-wide">{metric.label}</div>
                                <div className="text-xs text-gray-500">{metric.description}</div>
                              </div>
                              {metric.warning && (
                                <div className="mt-1 md:mt-2 text-xs text-red-600 bg-red-100 px-1.5 md:px-2 py-0.5 md:py-1 rounded-full font-medium animate-pulse">
                                  Review
                                </div>
                              )}
                              {metric.optimal && !metric.warning && (
                                <div className="mt-1 md:mt-2 text-xs text-teal-600 bg-teal-100 px-1.5 md:px-2 py-0.5 md:py-1 rounded-full font-medium">
                                  Optimal
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Saved Templates - Responsive */}
                {savedTemplates.length > 0 && (
                  <div className="bg-white/60 backdrop-blur-sm rounded-xl md:rounded-2xl border border-gray-300/50 p-4 md:p-6 shadow-sm">
                    <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-3 md:mb-4 flex items-center gap-2">
                      <FiSave className="w-4 h-4 md:w-5 md:h-5 text-teal-500" />
                      Saved Templates
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                      {savedTemplates.map(template => (
                        <div key={template.id} className="bg-white/80 border border-gray-300/50 rounded-lg md:rounded-xl p-3 md:p-4 hover:shadow-md transition-shadow duration-200">
                          <div className="flex items-center justify-between mb-1 md:mb-2">
                            <h4 className="font-semibold text-gray-900 truncate text-sm md:text-base">{template.name}</h4>
                            <button
                              onClick={() => loadTemplate(template)}
                              className="text-teal-600 hover:text-teal-700 transition-colors duration-200"
                            >
                              <FiUpload className="w-3 h-3 md:w-4 md:h-4" />
                            </button>
                          </div>
                          <p className="text-xs md:text-sm text-gray-600 truncate">{template.subject}</p>
                          <p className="text-xs text-gray-500 mt-1 md:mt-2">
                            {new Date(template.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6 md:space-y-8">
                {/* Results Header - Improved Layout & Responsive */}
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 md:gap-6">
  <div className="flex items-start gap-3 md:gap-4 flex-shrink-0">
    <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl md:rounded-2xl flex items-center justify-center shadow-xl">
      <FiBarChart2 className="w-6 h-6 md:w-8 md:h-8 text-white" />
    </div>
    <div className="flex-1 min-w-0">
      <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Template Analysis Results</h2>
      <p className="text-gray-600 text-base md:text-lg mt-1 md:mt-2">Comprehensive insights and actionable recommendations</p>
    </div>
  </div>

                  <div className="flex gap-2 md:gap-3 flex-shrink-0">
                    <button
                      onClick={() => setActiveTab('editor')}
                      className="flex items-center gap-2 px-3 md:px-5 py-2.5 md:py-3 bg-white border border-gray-300 text-gray-700 rounded-lg md:rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium shadow-sm hover:shadow-md hover:border-teal-200 text-sm md:text-base"
                    >
                      <FiEdit2 className="w-4 h-4 md:w-5 md:h-5" />
                      Edit Template
                    </button>
                    <button
                      onClick={handleAnalyze}
                      className="flex items-center gap-2 px-3 md:px-5 py-2.5 md:py-3 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-lg md:rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 font-semibold text-sm md:text-base"
                    >
                      <FiRefreshCw className="w-4 h-4 md:w-5 md:h-5" />
                      Re-analyze
                    </button>
                  </div>
                </div>

               {/* Summary Cards - Analytics Dashboard Design */}
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
  {[
    { 
      severity: 'Critical', 
      count: analysisResults.filter(r => r.severity === 'High').length, 
      percentage: Math.min(100, analysisResults.filter(r => r.severity === 'High').length * 25),
      description: 'Urgent fixes needed', 
      icon: FiAlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    },
    { 
      severity: 'Warning', 
      count: analysisResults.filter(r => r.severity === 'Medium').length, 
      percentage: Math.min(100, analysisResults.filter(r => r.severity === 'Medium').length * 25),
      description: 'Recommended improvements', 
      icon: FiAlertTriangle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
    { 
      severity: 'Suggestion', 
      count: analysisResults.filter(r => r.severity === 'Low').length, 
      percentage: Math.min(100, analysisResults.filter(r => r.severity === 'Low').length * 25),
      description: 'Optional enhancements', 
      icon: FiFileText,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    { 
      severity: 'Passed', 
      count: analysisResults.filter(r => r.severity === 'None').length, 
      percentage: Math.min(100, analysisResults.filter(r => r.severity === 'None').length * 25),
      description: 'All checks passed', 
      icon: FiAward,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
  ].map((summary, index) => (
    <motion.div
      key={summary.severity}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="relative bg-white border border-gray-200 rounded-xl p-4 transition-all duration-300 hover:shadow-md group"
    >
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 to-teal-600 rounded-b-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      
      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 opacity-0 group-hover:opacity-5 transition-opacity duration-300"></div>
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className={`w-10 h-10 ${summary.bgColor} rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
            <summary.icon className={`text-lg ${summary.color}`} />
          </div>
          <span className="text-sm font-medium text-gray-500">{summary.severity}</span>
        </div>

        <div className="flex items-end justify-between mb-2">
          <p className={`text-xl font-bold ${summary.color} antialiased subpixel-antialiased`}>{summary.count}</p>
          <p className="text-lg font-semibold text-teal-600 antialiased">
            {summary.percentage}%
          </p>
        </div>

        <div className="flex items-center">
          <span className="text-sm text-gray-500 truncate antialiased">
            {summary.description}
          </span>
        </div>
      </div>
    </motion.div>
  ))}
</div>

                {/* Enhanced Issues List - Responsive */}
                <div className="space-y-4 md:space-y-6">
                  <h3 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2 md:gap-3">
                    <FiFileText className="w-5 h-5 md:w-6 md:h-6 text-teal-500" />
                    Detailed Analysis
                  </h3>
                  {analysisResults.length === 0 ? (
                    <div className="text-center py-8 md:py-12 bg-white/60 rounded-xl md:rounded-2xl border border-gray-300/50">
                      <FiBarChart2 className="w-12 h-12 md:w-16 md:h-16 text-gray-400 mx-auto mb-3 md:mb-4" />
                      <p className="text-gray-600 text-base md:text-lg">No analysis results yet. Click "Analyze Template" to get started.</p>
                    </div>
                  ) : (
                    analysisResults.map((result) => {
                      const IconComponent = result.icon || FiAlertTriangle;
                      return (
                        <div key={result.id} className={`p-4 md:p-6 rounded-xl md:rounded-2xl border-l-4 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-300 ${result.severity === 'High' ? 'border-red-500 bg-red-50/80' :
                          result.severity === 'Medium' ? 'border-amber-500 bg-amber-50/80' :
                            result.severity === 'Low' ? 'border-teal-500 bg-teal-50/80' :
                              'border-green-500 bg-green-50/80'
                          }`}>
                          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 md:gap-4 mb-3 md:mb-4">
                            <div className="flex items-start gap-3 md:gap-4">
                              <div className={`p-2 md:p-3 rounded-lg md:rounded-xl ${result.severity === 'High' ? 'bg-red-100 text-red-600' :
                                result.severity === 'Medium' ? 'bg-amber-100 text-amber-600' :
                                  result.severity === 'Low' ? 'bg-teal-100 text-teal-600' :
                                    'bg-green-100 text-green-600'
                                }`}>
                                <IconComponent className="w-4 h-4 md:w-6 md:h-6" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 md:gap-3 mb-1 md:mb-2">
                                  <h4 className="font-bold text-gray-900 text-lg md:text-xl break-words">{result.issue}</h4>
                                  <span className={`px-2 md:px-3 py-1 md:py-1.5 rounded-full text-xs md:text-sm font-bold uppercase flex-shrink-0 ${result.severity === 'High' ? 'bg-red-100 text-red-800' :
                                    result.severity === 'Medium' ? 'bg-amber-100 text-amber-800' :
                                      result.severity === 'Low' ? 'bg-teal-100 text-teal-800' :
                                        'bg-green-100 text-green-800'
                                    }`}>
                                    {result.severity} Priority
                                  </span>
                                </div>
                                <span className="inline-block px-2 md:px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs md:text-sm font-medium">
                                  {result.category}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3 md:space-y-4 text-sm md:text-base">
                            <div className="flex flex-col sm:flex-row sm:items-start gap-2 md:gap-3">
                              <span className="font-semibold text-gray-700 min-w-20 md:min-w-24 flex items-center gap-1 md:gap-2 flex-shrink-0 text-sm md:text-base">
                                <FiAlertTriangle className="w-4 h-4 md:w-5 md:h-5" />
                                Found:
                              </span>
                              <span className={`px-3 md:px-4 py-2 md:py-3 rounded-lg md:rounded-xl font-mono text-xs md:text-sm flex-1 break-words ${result.severity === 'High' ? 'bg-red-100 text-red-800 border border-red-200' :
                                result.severity === 'Medium' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                                  result.severity === 'Low' ? 'bg-teal-100 text-teal-800 border border-teal-200' :
                                    'bg-green-100 text-green-800 border border-green-200'
                                }`}>
                                {result.found}
                              </span>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-start gap-2 md:gap-3">
                              <span className="font-semibold text-gray-700 min-w-20 md:min-w-24 flex items-center gap-1 md:gap-2 flex-shrink-0 text-sm md:text-base">
                                <FiCheckCircle className="w-4 h-4 md:w-5 md:h-5" />
                                Recommendation:
                              </span>
                              <span className="text-gray-600 bg-white/60 px-3 md:px-4 py-2 md:py-3 rounded-lg md:rounded-xl border border-gray-300/50 flex-1 leading-relaxed text-sm md:text-base">
                                {result.suggestion}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Enhanced Best Practices - Use API strategies when available */}
                <div className="bg-gradient-to-r from-teal-50/60 to-teal-100/30 rounded-xl md:rounded-2xl p-6 md:p-8 border border-teal-300/50 shadow-sm">
                  <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 md:mb-6 flex items-center gap-2 md:gap-3">
                    <FiSettings className="w-5 h-5 md:w-7 md:h-7 text-teal-500" />
                    Email Best Practices & Warmup Strategies
                  </h3>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6 text-sm md:text-base">
                    {(warmupStrategies.length > 0 ? warmupStrategies : [
                      {
                        title: "Gradual Warmup Process",
                        description: "Start with 5-10 emails daily, gradually increasing volume over 4-8 weeks. Monitor engagement metrics closely and adjust based on performance."
                      },
                      {
                        title: "Authentication Setup",
                        description: "Configure SPF, DKIM, and DMARC records properly. This builds trust with email providers and improves deliverability rates significantly."
                      },
                      {
                        title: "List Hygiene & Engagement",
                        description: "Regularly clean your email list. Remove inactive subscribers, validate email addresses, and monitor open/click rates to maintain list quality."
                      },
                      {
                        title: "Content Optimization",
                        description: "Personalize content, avoid spam triggers, maintain a clean professional tone, and ensure mobile responsiveness for better engagement."
                      }
                    ]).map((strategy, index) => (
                      <div key={index} className="flex items-start gap-3 md:gap-4 p-3 md:p-4 bg-white/60 rounded-lg md:rounded-xl border border-gray-300/30 shadow-sm hover:shadow-md transition-shadow duration-300">
                        <div className="w-8 h-8 md:w-10 md:h-10 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-teal-600 text-xs md:text-sm font-bold">{index + 1}</span>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900 text-base md:text-lg mb-1 md:mb-2">{strategy.title}</h4>
                          <p className="text-gray-600 leading-relaxed text-sm md:text-base">{strategy.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Enhanced Notification - Responsive */}
      {notification && (
        <div className={`fixed bottom-4 md:bottom-8 right-4 md:right-8 left-4 md:left-auto text-white px-4 md:px-8 py-3 md:py-4 rounded-xl md:rounded-2xl shadow-2xl animate-slide-in font-medium ${notification.type === 'error' ? 'bg-gradient-to-r from-red-500 to-red-600' : 'bg-gradient-to-r from-teal-500 to-teal-600'}`}>
          <div className="flex items-center gap-2 md:gap-3">
            {notification.type === 'error' ? <FiAlertTriangle className="w-5 h-5 md:w-6 md:h-6" /> : <FiCheckCircle className="w-5 h-5 md:w-6 md:h-6" />}
            <span className="font-semibold text-sm md:text-lg">{notification.message}</span>
          </div>
        </div>
      )}

      {/* Enhanced Custom Animations */}
      <style jsx global>{`
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
        @keyframes float-medium {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(-3deg); }
        }
        @keyframes float-fast {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(2deg); }
        }
        @keyframes slide-in {
          from {
            transform: translateY(100px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-float-slow { animation: float-slow 8s ease-in-out infinite; }
        .animate-float-medium { animation: float-medium 6s ease-in-out infinite; }
        .animate-float-fast { animation: float-fast 4s ease-in-out infinite; }
        .animate-slide-in { animation: slide-in 0.3s ease-out; }
      `}</style>
    </div>
  );
};

export default TemplateCheckerPage;