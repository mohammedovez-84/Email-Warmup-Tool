import React, { useState, useRef, useEffect } from 'react';
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiCopy,
  FiEdit2,
  FiSend,
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
  FiUser
} from 'react-icons/fi';

const TemplateCheckerPage = () => {
  const [emailSubject, setEmailSubject] = useState('Problem with emails going to SPAM');
  const [emailContent, setEmailContent] = useState(`Hi [Recipient_Name],

I ran into a problem with my email.
I sent emails to my clients to announce the launch of a new promotion in our company, but most of the recipients received my emails in the SPAM folder.

Perhaps this is due to the fact that my domain is very young and has not participated in mailing lists before?
Could you tell me how I can warm up my domain and mailbox?

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
  const textareaRef = useRef(null);

  // Calculate metrics based on email content
  const calculateMetrics = () => {
    const words = emailContent.split(/\s+/).filter(word => word.length > 0);
    const sentences = emailContent.split(/[.!?]+/).filter(s => s.length > 0);
    const paragraphs = emailContent.split(/\n\s*\n/).filter(p => p.trim().length > 0);

    return {
      subjectLength: emailSubject.length,
      contentLength: emailContent.length,
      wordCount: words.length,
      sentenceCount: sentences.length,
      paragraphCount: paragraphs.length,
      avgWordsPerSentence: words.length / Math.max(sentences.length, 1),
      readingTime: Math.ceil(words.length / 200) + ' min',
      linkCount: (emailContent.match(/https?:\/\/[^\s]+/g) || []).length,
      questionCount: (emailContent.match(/\?/g) || []).length,
      spammyWordCount: (emailContent.match(/\b(promotion|free|discount|offer|win|prize|buy now|limited time|act fast|click here|money back|guarantee|no cost|no obligation|risk-free|special promotion)\b/gi) || []).length,
      personalizationCount: (emailContent.match(/\[[^\]]+\]/g) || []).length,
      uppercaseCount: (emailContent.match(/[A-Z]{3,}/g) || []).length
    };
  };

  const [metrics, setMetrics] = useState(calculateMetrics());

  // Update metrics when content changes
  useEffect(() => {
    setMetrics(calculateMetrics());
  }, [emailSubject, emailContent]);

  const fonts = [
    'Inter', 'Arial', 'Helvetica', 'Georgia', 'Times New Roman',
    'Verdana', 'Tahoma', 'Segoe UI', 'Roboto', 'SF Pro Display'
  ];

  const handleAnalyze = () => {
    const newResults = [];
    const spamWords = emailContent.match(/\b(promotion|free|discount|offer|win|prize|buy now|limited time|act fast|click here|money back|guarantee|no cost|no obligation|risk-free|special promotion)\b/gi) || [];
    const personalizationTags = emailContent.match(/\[[^\]]+\]/g) || [];
    const uppercaseWords = emailContent.match(/[A-Z]{3,}/g) || [];
    const linkCount = metrics.linkCount;

    // Spam words check
    if (spamWords.length > 0) {
      newResults.push({
        id: 1,
        issue: 'Spam Trigger Words Detected',
        severity: 'High',
        found: spamWords.join(', '),
        suggestion: `Replace spammy words with professional alternatives. Consider: ${spamWords.map(w => `"${w}"`).join(', ')}`,
        icon: FiShield
      });
    }

    // Personalization tags check
    if (personalizationTags.length > 0) {
      newResults.push({
        id: 2,
        issue: 'Personalization Tags Not Filled',
        severity: 'Medium',
        found: personalizationTags.join(', '),
        suggestion: 'Replace all personalization tags with actual recipient data before sending',
        icon: FiUser
      });
    }

    // Uppercase words check
    if (uppercaseWords.length > 3) {
      newResults.push({
        id: 3,
        issue: 'Excessive Uppercase Text',
        severity: 'Medium',
        found: `${uppercaseWords.length} uppercase words/phrases`,
        suggestion: 'Reduce uppercase usage. Excessive capitalization triggers spam filters',
        icon: FiFileText
      });
    }

    // Link count check
    if (linkCount > 3) {
      newResults.push({
        id: 4,
        issue: 'Too Many Links',
        severity: 'Medium',
        found: `${linkCount} links detected`,
        suggestion: 'Limit to 2-3 relevant links. Multiple links can affect deliverability',
        icon: FiLink
      });
    }

    // Subject length check
    if (emailSubject.length > 50) {
      newResults.push({
        id: 5,
        issue: 'Subject Line Too Long',
        severity: 'Medium',
        found: `${emailSubject.length} characters (recommended max: 50)`,
        suggestion: 'Shorten subject line to 50 characters for better open rates',
        icon: FiBarChart2
      });
    }

    // Signature check
    if (!emailContent.includes('Best regards') && !emailContent.includes('Sincerely') && !emailContent.includes('Thank you')) {
      newResults.push({
        id: 6,
        issue: 'Professional Closing Missing',
        severity: 'Low',
        found: 'No professional closing detected',
        suggestion: 'Add a professional closing like "Best regards" or "Sincerely"',
        icon: FiFileText
      });
    }

    // Add a positive result if no issues found
    if (newResults.length === 0) {
      newResults.push({
        id: 7,
        issue: 'Template Quality Excellent',
        severity: 'None',
        found: 'All checks passed successfully',
        suggestion: 'Your email template follows best practices for optimal deliverability',
        icon: FiCheckCircle
      });
    }

    setAnalysisResults(newResults);
    setActiveTab('results');
  };

  const handleCopyToClipboard = () => {
    if (textareaRef.current) {
      textareaRef.current.select();
      document.execCommand('copy');
      showNotification('Email template copied to clipboard!');
    }
  };

  const showNotification = (message) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
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

    switch (type) {
      case 'bold':
        if (selectedText) {
          newText = emailContent.substring(0, start) +
            `**${selectedText}**` +
            emailContent.substring(end);
          setIsBold(!isBold);
        }
        break;
      case 'italic':
        if (selectedText) {
          newText = emailContent.substring(0, start) +
            `*${selectedText}*` +
            emailContent.substring(end);
          setIsItalic(!isItalic);
        }
        break;
      case 'underline':
        if (selectedText) {
          newText = emailContent.substring(0, start) +
            `_${selectedText}_` +
            emailContent.substring(end);
          setIsUnderline(!isUnderline);
        }
        break;
      default:
        break;
    }

    setEmailContent(newText);

    // Restore cursor position
    setTimeout(() => {
      textarea.selectionStart = start;
      textarea.selectionEnd = end;
      textarea.focus();
    }, 0);
  };

  // Get score based on metrics
  const getScore = () => {
    let score = 100;

    // Deduct points for issues
    if (metrics.spammyWordCount > 0) score -= metrics.spammyWordCount * 5;
    if (metrics.personalizationCount > 0) score -= metrics.personalizationCount * 2;
    if (metrics.uppercaseCount > 3) score -= (metrics.uppercaseCount - 3) * 3;
    if (metrics.linkCount > 3) score -= (metrics.linkCount - 3) * 4;
    if (emailSubject.length > 50) score -= 5;
    if (metrics.wordCount < 50) score -= 10; // Too short
    if (metrics.wordCount > 500) score -= 5; // Too long

    return Math.max(0, Math.min(100, score));
  };

  const score = getScore();
  const scoreColor = score >= 80 ? '#0D9488' : score >= 60 ? '#D97706' : '#DC2626';

  const CircularScore = ({ score, color }) => {
    const radius = 30;
    const circumference = 2 * Math.PI * radius;
    const strokeDasharray = `${(score / 100) * circumference} ${circumference}`;

    return (
      <div className="relative w-16 h-16">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="32"
            cy="32"
            r={radius}
            stroke="#E5E7EB"
            strokeWidth="4"
            fill="none"
          />
          <circle
            cx="32"
            cy="32"
            r={radius}
            stroke={color}
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={strokeDasharray}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-gray-800">{score}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-teal-100/30 to-teal-50/30 p-6 font-sans">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-20 left-10 w-64 h-64 bg-teal-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float-slow"></div>
        <div className="absolute top-40 right-10 w-80 h-80 bg-teal-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float-medium"></div>
        <div className="absolute bottom-20 left-1/3 w-72 h-72 bg-teal-400 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-float-slow"></div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 bg-gradient-to-r from-teal-600 to-teal-700 bg-clip-text text-transparent">
            Email Template Analyzer
          </h1>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Optimize your email templates for better deliverability and engagement
          </p>
        </div>

        {/* Main Content Card */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 overflow-hidden">
          {/* Navigation Tabs */}
          <div className="flex border-b border-gray-200/60 bg-white/50 backdrop-blur-sm">
            <button
              onClick={() => setActiveTab('editor')}
              className={`flex items-center gap-2 px-6 py-4 font-semibold transition-all duration-300 ${activeTab === 'editor'
                ? 'text-teal-600 border-b-2 border-teal-600 bg-gradient-to-r from-teal-50/50 to-teal-50/30'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50/50'
                }`}
            >
              <FiFileText className="w-4 h-4" />
              Template Editor
            </button>
            <button
              onClick={() => setActiveTab('results')}
              className={`flex items-center gap-2 px-6 py-4 font-semibold transition-all duration-300 ${activeTab === 'results'
                ? 'text-teal-600 border-b-2 border-teal-600 bg-gradient-to-r from-teal-50/50 to-teal-50/30'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50/50'
                }`}
            >
              <FiBarChart2 className="w-4 h-4" />
              Analysis Results
              {analysisResults.length > 0 && (
                <span className="bg-teal-100 text-teal-800 text-xs px-2 py-1 rounded-full font-bold">
                  {analysisResults.length}
                </span>
              )}
            </button>
          </div>

          {/* Content Area */}
          <div className="p-6">
            {activeTab === 'editor' ? (
              <div className="space-y-6">
                {/* Header with Actions */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Compose Your Email</h2>
                    <p className="text-gray-600 text-sm">Create and optimize your email template</p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    {/* Formatting Toolbar */}
                    <div className="flex items-center gap-1 bg-white/80 backdrop-blur-sm border border-gray-300/50 rounded-xl p-1">
                      <select
                        value={fontFamily}
                        onChange={(e) => setFontFamily(e.target.value)}
                        className="px-3 py-2 border-0 bg-transparent text-sm focus:outline-none focus:ring-0"
                      >
                        {fonts.map(font => (
                          <option key={font} value={font}>{font}</option>
                        ))}
                      </select>

                      <select
                        value={fontSize}
                        onChange={(e) => setFontSize(e.target.value)}
                        className="px-3 py-2 border-0 bg-transparent text-sm focus:outline-none focus:ring-0 border-l border-gray-300/50"
                      >
                        <option value="12px">12px</option>
                        <option value="14px">14px</option>
                        <option value="16px">16px</option>
                        <option value="18px">18px</option>
                      </select>

                      <div className="flex gap-1 border-l border-gray-300/50 pl-1">
                        <button
                          onClick={() => applyFormatting('bold')}
                          className={`p-2 rounded-lg transition-all duration-200 ${isBold
                            ? 'bg-teal-600 text-white shadow-md'
                            : 'text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                          <FiBold className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => applyFormatting('italic')}
                          className={`p-2 rounded-lg transition-all duration-200 ${isItalic
                            ? 'bg-teal-600 text-white shadow-md'
                            : 'text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                          <FiItalic className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => applyFormatting('underline')}
                          className={`p-2 rounded-lg transition-all duration-200 ${isUnderline
                            ? 'bg-teal-600 text-white shadow-md'
                            : 'text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                          <FiUnderline className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={handleCopyToClipboard}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium shadow-sm hover:shadow-md"
                      >
                        <FiCopy className="w-4 h-4" />
                        Copy
                      </button>
                      <button
                        onClick={handleAnalyze}
                        className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 font-semibold"
                      >
                        <FiSend className="w-4 h-4" />
                        Analyze Template
                      </button>
                    </div>
                  </div>
                </div>

                {/* Subject Field */}
                <div className="bg-white/50 backdrop-blur-sm rounded-xl border border-gray-300/50 p-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email Subject
                  </label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="w-full px-4 py-3 bg-white/80 border border-gray-300/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-200 text-lg font-medium"
                    placeholder="Enter your email subject line..."
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm text-gray-500">
                      {emailSubject.length} characters
                    </span>
                    {emailSubject.length > 50 && (
                      <span className="text-amber-600 text-sm font-medium bg-amber-50 px-2 py-1 rounded-lg">
                        Recommended: 50 characters max
                      </span>
                    )}
                  </div>
                </div>

                {/* Email Editor */}
                <div className="bg-white/50 backdrop-blur-sm rounded-xl border border-gray-300/50 overflow-hidden">
                  <label className="block text-sm font-semibold text-gray-700 p-4 border-b border-gray-300/50">
                    Email Content
                  </label>
                  <textarea
                    ref={textareaRef}
                    value={emailContent}
                    onChange={(e) => setEmailContent(e.target.value)}
                    className="w-full h-64 px-4 py-4 bg-white/80 border-0 focus:outline-none focus:ring-0 resize-vertical text-gray-700 leading-relaxed"
                    style={{
                      fontFamily,
                      fontSize,
                      fontWeight: isBold ? 'bold' : 'normal',
                      fontStyle: isItalic ? 'italic' : 'normal',
                      textDecoration: isUnderline ? 'underline' : 'none'
                    }}
                    placeholder="Write your email content here... Use **bold**, *italic*, or _underline_ formatting."
                  />
                </div>

                {/* Metrics Section */}
                <div className="bg-white/50 backdrop-blur-sm rounded-xl border border-gray-300/50 overflow-hidden">
                  <button
                    onClick={toggleMetrics}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50/50 transition-all duration-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg flex items-center justify-center">
                        <FiBarChart2 className="w-4 h-4 text-white" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold text-gray-900">Template Analytics</h3>
                        <p className="text-sm text-gray-600">Real-time metrics and insights</p>
                      </div>
                    </div>
                    {showMetrics ? <FiChevronUp className="w-5 h-5 text-gray-400" /> : <FiChevronDown className="w-5 h-5 text-gray-400" />}
                  </button>

                  {showMetrics && (
                    <div className="p-4 border-t border-gray-300/50">
                      {/* Score Display */}
                      <div className="flex items-center gap-4 mb-6 p-4 bg-gradient-to-r from-teal-50 to-teal-100/30 rounded-xl border border-teal-300/30">
                        <CircularScore score={score} color={scoreColor} />
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 mb-1">Email Health Score</h4>
                          <p className={`text-sm font-medium ${score >= 80 ? 'text-teal-600' :
                            score >= 60 ? 'text-amber-600' :
                              'text-red-600'
                            }`}>
                            {score >= 80 ? 'Excellent - Ready to send' :
                              score >= 60 ? 'Good - Minor improvements needed' :
                                'Needs work - Review recommendations'}
                          </p>
                        </div>
                      </div>

                      {/* Metrics Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {[
                          { label: 'Subject Length', value: metrics.subjectLength, warning: metrics.subjectLength > 50, icon: FiFileText },
                          { label: 'Word Count', value: metrics.wordCount, optimal: metrics.wordCount >= 50 && metrics.wordCount <= 500, icon: FiFileText },
                          { label: 'Sentences', value: metrics.sentenceCount, icon: FiFileText },
                          { label: 'Paragraphs', value: metrics.paragraphCount, icon: FiFileText },
                          { label: 'Reading Time', value: metrics.readingTime, icon: FiClock },
                          { label: 'Links', value: metrics.linkCount, warning: metrics.linkCount > 3, icon: FiLink },
                          { label: 'Questions', value: metrics.questionCount, icon: FiFileText },
                          { label: 'Spam Words', value: metrics.spammyWordCount, warning: metrics.spammyWordCount > 0, icon: FiShield },
                          { label: 'Personalization', value: metrics.personalizationCount, warning: metrics.personalizationCount > 0, icon: FiUser },
                          { label: 'UPPERCASE', value: metrics.uppercaseCount, warning: metrics.uppercaseCount > 3, icon: FiFileText },
                        ].map((metric, index) => {
                          const IconComponent = metric.icon;
                          return (
                            <div key={index} className={`bg-white/80 backdrop-blur-sm border rounded-xl p-3 text-center transition-all duration-200 hover:shadow-md ${metric.warning ? 'border-red-300 bg-red-50/50' :
                              metric.optimal ? 'border-teal-300 bg-teal-50/50' :
                                'border-gray-300/50'
                              }`}>
                              <div className="flex items-center justify-center gap-2 mb-2">
                                <IconComponent className={`w-4 h-4 ${metric.warning ? 'text-red-600' :
                                  metric.optimal ? 'text-teal-600' :
                                    'text-gray-600'
                                  }`} />
                                <div className="text-lg font-bold text-gray-900">{metric.value}</div>
                              </div>
                              <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{metric.label}</div>
                              {metric.warning && (
                                <div className="mt-1 text-xs text-red-600 bg-red-100 px-2 py-1 rounded-full font-medium">
                                  Review
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Results Header */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Template Analysis Results</h2>
                    <p className="text-gray-600 text-sm">Detailed insights and recommendations</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('editor')}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium shadow-sm hover:shadow-md"
                  >
                    <FiEdit2 className="w-4 h-4" />
                    Edit Template
                  </button>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { severity: 'Critical', count: analysisResults.filter(r => r.severity === 'High').length, color: 'red', description: 'Urgent fixes needed' },
                    { severity: 'Warning', count: analysisResults.filter(r => r.severity === 'Medium').length, color: 'amber', description: 'Recommended improvements' },
                    { severity: 'Suggestion', count: analysisResults.filter(r => r.severity === 'Low').length, color: 'teal', description: 'Optional enhancements' },
                    { severity: 'Passed', count: analysisResults.filter(r => r.severity === 'None').length, color: 'green', description: 'All checks passed' },
                  ].map((summary, index) => (
                    <div key={index} className={`p-4 rounded-xl border-l-4 backdrop-blur-sm ${summary.color === 'red' ? 'bg-red-50/80 border-red-500' :
                      summary.color === 'amber' ? 'bg-amber-50/80 border-amber-500' :
                        summary.color === 'teal' ? 'bg-teal-50/80 border-teal-500' :
                          'bg-green-50/80 border-green-500'
                      }`}>
                      <div className={`text-2xl font-bold mb-1 ${summary.color === 'red' ? 'text-red-600' :
                        summary.color === 'amber' ? 'text-amber-600' :
                          summary.color === 'teal' ? 'text-teal-600' :
                            'text-green-600'
                        }`}>
                        {summary.count}
                      </div>
                      <div className="text-sm font-semibold text-gray-900">
                        {summary.severity}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {summary.description}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Issues List */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Detailed Analysis</h3>
                  {analysisResults.map((result) => {
                    const IconComponent = result.icon || FiAlertTriangle;
                    return (
                      <div key={result.id} className={`p-4 rounded-xl border-l-4 backdrop-blur-sm ${result.severity === 'High' ? 'border-red-500 bg-red-50/80' :
                        result.severity === 'Medium' ? 'border-amber-500 bg-amber-50/80' :
                          result.severity === 'Low' ? 'border-teal-500 bg-teal-50/80' :
                            'border-green-500 bg-green-50/80'
                        }`}>
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 mb-3">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${result.severity === 'High' ? 'bg-red-100 text-red-600' :
                              result.severity === 'Medium' ? 'bg-amber-100 text-amber-600' :
                                result.severity === 'Low' ? 'bg-teal-100 text-teal-600' :
                                  'bg-green-100 text-green-600'
                              }`}>
                              <IconComponent className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-900 mb-1">{result.issue}</h4>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${result.severity === 'High' ? 'bg-red-100 text-red-800' :
                                  result.severity === 'Medium' ? 'bg-amber-100 text-amber-800' :
                                    result.severity === 'Low' ? 'bg-teal-100 text-teal-800' :
                                      'bg-green-100 text-green-800'
                                  }`}>
                                  {result.severity}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2 text-sm">
                          <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                            <span className="font-semibold text-gray-700 min-w-20">Found:</span>
                            <span className={`px-3 py-2 rounded-lg font-mono text-sm ${result.severity === 'High' ? 'bg-red-100 text-red-800' :
                              result.severity === 'Medium' ? 'bg-amber-100 text-amber-800' :
                                result.severity === 'Low' ? 'bg-teal-100 text-teal-800' :
                                  'bg-green-100 text-green-800'
                              }`}>
                              {result.found}
                            </span>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                            <span className="font-semibold text-gray-700 min-w-20">Recommendation:</span>
                            <span className="text-gray-600 bg-white/50 px-3 py-2 rounded-lg border border-gray-300/30">
                              {result.suggestion}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Best Practices */}
                <div className="bg-gradient-to-r from-teal-50/50 to-teal-100/30 rounded-xl p-6 border border-teal-300/50">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <FiSettings className="w-5 h-5 text-teal-600" />
                    Email Best Practices
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-3">
                      <div className="flex items-start gap-3 p-3 bg-white/50 rounded-lg border border-gray-300/30">
                        <div className="w-6 h-6 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-teal-600 text-xs font-bold">1</span>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-1">Warm Up Gradually</h4>
                          <p className="text-gray-600">Start with 5-10 emails daily, gradually increasing volume over 4-8 weeks</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 bg-white/50 rounded-lg border border-gray-300/30">
                        <div className="w-6 h-6 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-teal-600 text-xs font-bold">2</span>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-1">Authentication Setup</h4>
                          <p className="text-gray-600">Configure SPF, DKIM, and DMARC records for domain authentication</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3 p-3 bg-white/50 rounded-lg border border-gray-300/30">
                        <div className="w-6 h-6 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-teal-600 text-xs font-bold">3</span>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-1">List Hygiene</h4>
                          <p className="text-gray-600">Regularly clean your email list and remove inactive subscribers</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 bg-white/50 rounded-lg border border-gray-300/30">
                        <div className="w-6 h-6 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-teal-600 text-xs font-bold">4</span>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-1">Engagement Focus</h4>
                          <p className="text-gray-600">Monitor open rates and engagement metrics to maintain sender reputation</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 bg-gradient-to-r from-teal-500 to-teal-600 text-white px-6 py-3 rounded-xl shadow-2xl animate-slide-in font-medium">
          <div className="flex items-center gap-2">
            <FiCheckCircle className="w-4 h-4" />
            {notification}
          </div>
        </div>
      )}

      {/* Custom Animations */}
      <style jsx global>{`
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
        @keyframes float-medium {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(-3deg); }
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
        .animate-slide-in { animation: slide-in 0.3s ease-out; }
      `}</style>
    </div>
  );
};

export default TemplateCheckerPage;