import React, { useState, useRef, useEffect } from 'react';
import { FiAlertTriangle, FiCheckCircle, FiCopy, FiEdit2, FiSend, FiChevronDown, FiChevronUp, FiBold, FiItalic, FiUnderline } from 'react-icons/fi';

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
  const [fontFamily, setFontFamily] = useState('Tahoma');
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

    return {
      subjectLength: emailSubject.length,
      contentLength: emailContent.length,
      wordCount: words.length,
      sentenceCount: sentences.length,
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
    'Tahoma', 'Arial', 'Verdana', 'Helvetica', 'Times New Roman',
    'Courier New', 'Georgia', 'Palatino', 'Garamond', 'Comic Sans MS'
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
        issue: 'Spam trigger words detected',
        severity: 'High',
        found: spamWords.join(', '),
        suggestion: `Consider using alternative phrasing for: ${spamWords.map(w => `"${w}"`).join(', ')}`
      });
    }

    // Personalization tags check
    if (personalizationTags.length > 0) {
      newResults.push({
        id: 2,
        issue: 'Personalization tags not filled',
        severity: 'Medium',
        found: personalizationTags.join(', '),
        suggestion: 'Ensure all personalization tags are replaced with actual values before sending'
      });
    }

    // Uppercase words check
    if (uppercaseWords.length > 3) {
      newResults.push({
        id: 3,
        issue: 'Excessive uppercase text',
        severity: 'Medium',
        found: `${uppercaseWords.length} uppercase words/phrases`,
        suggestion: 'Avoid excessive uppercase text as it may trigger spam filters'
      });
    }

    // Link count check
    if (linkCount > 3) {
      newResults.push({
        id: 4,
        issue: 'Too many links',
        severity: 'Medium',
        found: `${linkCount} links detected`,
        suggestion: 'Consider reducing the number of links to improve deliverability'
      });
    }

    // Subject length check
    if (emailSubject.length > 50) {
      newResults.push({
        id: 5,
        issue: 'Subject line too long',
        severity: 'Medium',
        found: `${emailSubject.length} characters (recommended max: 50)`,
        suggestion: 'Shorten your subject line to improve open rates'
      });
    }

    // Signature check
    if (!emailContent.includes('Best regards') && !emailContent.includes('Sincerely') && !emailContent.includes('Thank you')) {
      newResults.push({
        id: 6,
        issue: 'Professional closing missing',
        severity: 'Low',
        found: 'No professional closing detected',
        suggestion: 'Add a professional closing like "Best regards" or "Sincerely"'
      });
    }

    // Add a positive result if no issues found
    if (newResults.length === 0) {
      newResults.push({
        id: 7,
        issue: 'No major issues detected',
        severity: 'None',
        found: 'Your email template looks good',
        suggestion: 'Continue following email best practices for optimal deliverability'
      });
    }

    setAnalysisResults(newResults);
    setActiveTab('results');
  };

  const handleCopyToClipboard = () => {
    if (textareaRef.current) {
      textareaRef.current.select();
      document.execCommand('copy');
      showNotification('Copied to clipboard!');
    }
  };

  const showNotification = (message) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 2000);
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
            `<strong>${selectedText}</strong>` +
            emailContent.substring(end);
          setIsBold(!isBold);
        }
        break;
      case 'italic':
        if (selectedText) {
          newText = emailContent.substring(0, start) +
            `<em>${selectedText}</em>` +
            emailContent.substring(end);
          setIsItalic(!isItalic);
        }
        break;
      case 'underline':
        if (selectedText) {
          newText = emailContent.substring(0, start) +
            `<u>${selectedText}</u>` +
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

    return Math.max(0, Math.min(100, score));
  };

  const score = getScore();
  const scoreColor = score >= 80 ? '#10B981' : score >= 60 ? '#F59E0B' : '#EF4444';

  const CircularScore = ({ score, color }) => {
    const radius = 24;
    const circumference = 2 * Math.PI * radius;
    const strokeDasharray = `${(score / 100) * circumference} ${circumference}`;

    return (
      <div className="relative w-14 h-14">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="28"
            cy="28"
            r={radius}
            stroke="#E5E7EB"
            strokeWidth="4"
            fill="none"
          />
          <circle
            cx="28"
            cy="28"
            r={radius}
            stroke={color}
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={strokeDasharray}
            className="transition-all duration-500 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-gray-800">{score}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full bg-gray-50 p-4 font-sans">
      {/* Main Content */}
      <div className="h-full">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
          {/* Editor/Results Tabs */}
          {activeTab === 'editor' ? (
            <div className="flex-1 overflow-auto p-4">
              {/* Header */}
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-4 space-y-2 lg:space-y-0">
                <h2 className="text-lg font-bold text-gray-900">Email Template Editor</h2>

                <div className="flex flex-col sm:flex-row gap-2">
                  {/* Formatting Options */}
                  <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-lg">
                    <select
                      value={fontFamily}
                      onChange={(e) => setFontFamily(e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-transparent"
                    >
                      {fonts.map(font => (
                        <option key={font} value={font}>{font}</option>
                      ))}
                    </select>

                    <select
                      value={fontSize}
                      onChange={(e) => setFontSize(e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-transparent"
                    >
                      <option value="12px">12px</option>
                      <option value="14px">14px</option>
                      <option value="16px">16px</option>
                      <option value="18px">18px</option>
                    </select>

                    <div className="flex gap-1">
                      <button
                        onClick={() => applyFormatting('bold')}
                        className={`p-1 rounded transition-all duration-200 ${isBold
                          ? 'bg-teal-600 text-white shadow'
                          : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
                          }`}
                      >
                        <FiBold className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => applyFormatting('italic')}
                        className={`p-1 rounded transition-all duration-200 ${isItalic
                          ? 'bg-teal-600 text-white shadow'
                          : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
                          }`}
                      >
                        <FiItalic className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => applyFormatting('underline')}
                        className={`p-1 rounded transition-all duration-200 ${isUnderline
                          ? 'bg-blue-600 text-white shadow'
                          : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
                          }`}
                      >
                        <FiUnderline className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={handleCopyToClipboard}
                      className="flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded border border-gray-300 hover:bg-gray-200 transition-colors duration-200 text-sm font-medium"
                    >
                      <FiCopy className="w-3 h-3" />
                      Copy
                    </button>
                    <button
                      onClick={handleAnalyze}
                      className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-teal-800 to-teal-500 text-white rounded shadow hover:shadow-md transform hover:-translate-y-0.5 transition-all duration-200 text-sm font-medium"
                    >
                      <FiSend className="w-3 h-3" />
                      Analyze
                    </button>
                  </div>
                </div>
              </div>

              {/* Subject Field */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Subject Line
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm"
                  placeholder="Enter your email subject..."
                />
                <div className="flex items-center gap-1 mt-1 text-xs text-gray-600">
                  <span>Length: {emailSubject.length} chars</span>
                  {emailSubject.length > 50 && (
                    <span className="text-amber-600 font-medium bg-amber-50 px-1 py-0.5 rounded">
                      Max: 50 chars
                    </span>
                  )}
                </div>
              </div>

              {/* Email Editor */}
              <div className="mb-4 flex-1">
                <textarea
                  ref={textareaRef}
                  value={emailContent}
                  onChange={(e) => setEmailContent(e.target.value)}
                  className="w-full h-48 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent resize-vertical transition-all duration-200 text-sm"
                  style={{
                    fontFamily,
                    fontSize,
                    fontWeight: isBold ? 'bold' : 'normal',
                    fontStyle: isItalic ? 'italic' : 'normal',
                    textDecoration: isUnderline ? 'underline' : 'none'
                  }}
                  placeholder="Write your email content here..."
                />
              </div>

              {/* Metrics Section */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={toggleMetrics}
                  className="w-full flex items-center justify-between p-2 bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 transition-all duration-200 text-sm"
                >
                  <h3 className="font-semibold text-gray-900">Template Metrics</h3>
                  {showMetrics ? <FiChevronUp className="w-4 h-4 text-gray-600" /> : <FiChevronDown className="w-4 h-4 text-gray-600" />}
                </button>

                {showMetrics && (
                  <div className="p-3 bg-white">
                    {/* Score Display */}
                    <div className="flex items-center gap-3 mb-4 p-2 bg-gray-50 rounded-lg border border-gray-200">
                      <CircularScore score={score} color={scoreColor} />
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900">Email Health Score</h4>
                        <p className={`text-xs font-medium ${score >= 80 ? 'text-green-600' :
                          score >= 60 ? 'text-amber-600' :
                            'text-red-600'
                          }`}>
                          {score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : 'Needs Improvement'}
                        </p>
                      </div>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                      {[
                        { label: 'Subject', value: metrics.subjectLength, warning: metrics.subjectLength > 50 },
                        { label: 'Words', value: metrics.wordCount },
                        { label: 'Sentences', value: metrics.sentenceCount },
                        { label: 'Avg/Sentence', value: metrics.avgWordsPerSentence.toFixed(1) },
                        { label: 'Read Time', value: metrics.readingTime },
                        { label: 'Links', value: metrics.linkCount, warning: metrics.linkCount > 3 },
                        { label: 'Questions', value: metrics.questionCount },
                        { label: 'Spam Words', value: metrics.spammyWordCount, warning: metrics.spammyWordCount > 0 },
                        { label: 'Personalize', value: metrics.personalizationCount, warning: metrics.personalizationCount > 0 },
                        { label: 'UPPERCASE', value: metrics.uppercaseCount, warning: metrics.uppercaseCount > 3 },
                      ].map((metric, index) => (
                        <div key={index} className="bg-white border border-gray-200 rounded-lg p-2 text-center hover:shadow-sm transition-shadow duration-200">
                          <div className="text-lg font-bold text-gray-900">{metric.value}</div>
                          <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">{metric.label}</div>
                          {metric.warning && (
                            <div className="text-xs text-red-600 bg-red-50 px-1 py-0.5 rounded-full font-medium">
                              {metric.label.includes('Spam') ? '!' :
                                metric.label.includes('Personalize') ? '!' :
                                  metric.label.includes('UPPERCASE') ? '!' :
                                    metric.label.includes('Links') ? '!' : '!'}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto p-4">
              {/* Results Header */}
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 mb-2 lg:mb-0">Analysis Results</h2>
                <button
                  onClick={() => setActiveTab('editor')}
                  className="flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded border border-gray-300 hover:bg-gray-200 transition-colors duration-200 text-sm font-medium"
                >
                  <FiEdit2 className="w-3 h-3" />
                  Edit Template
                </button>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                {[
                  { severity: 'High', count: analysisResults.filter(r => r.severity === 'High').length, color: 'red' },
                  { severity: 'Medium', count: analysisResults.filter(r => r.severity === 'Medium').length, color: 'amber' },
                  { severity: 'Low', count: analysisResults.filter(r => r.severity === 'Low').length, color: 'green' },
                  { severity: 'None', count: analysisResults.filter(r => r.severity === 'None').length, color: 'blue' },
                ].map((summary, index) => (
                  <div key={index} className={`p-3 rounded-lg border-l-3 ${summary.color === 'red' ? 'bg-red-50 border-red-500' :
                    summary.color === 'amber' ? 'bg-amber-50 border-amber-500' :
                      summary.color === 'green' ? 'bg-green-50 border-green-500' :
                        'bg-blue-50 border-blue-500'
                    }`}>
                    <div className={`text-xl font-bold mb-1 ${summary.color === 'red' ? 'text-red-600' :
                      summary.color === 'amber' ? 'text-amber-600' :
                        summary.color === 'green' ? 'text-green-600' :
                          'text-blue-600'
                      }`}>
                      {summary.count}
                    </div>
                    <div className="text-xs text-gray-700 font-semibold">
                      {summary.severity}
                    </div>
                  </div>
                ))}
              </div>

              {/* Issues List */}
              <div className="space-y-3 mb-4">
                {analysisResults.map((result) => (
                  <div key={result.id} className={`p-3 rounded-lg border-l-3 ${result.severity === 'High' ? 'border-red-500 bg-red-50' :
                    result.severity === 'Medium' ? 'border-amber-500 bg-amber-50' :
                      result.severity === 'Low' ? 'border-green-500 bg-green-50' :
                        'border-blue-500 bg-blue-50'
                    }`}>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2">
                      <div className="flex items-center gap-2 mb-1 sm:mb-0">
                        {result.severity === 'High' ? (
                          <FiAlertTriangle className="w-4 h-4 text-red-600" />
                        ) : result.severity === 'None' ? (
                          <FiCheckCircle className="w-4 h-4 text-blue-600" />
                        ) : (
                          <FiAlertTriangle className="w-4 h-4 text-amber-600" />
                        )}
                        <span className="text-sm font-semibold text-gray-900">{result.issue}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${result.severity === 'High' ? 'bg-red-100 text-red-800' :
                        result.severity === 'Medium' ? 'bg-amber-100 text-amber-800' :
                          result.severity === 'Low' ? 'bg-green-100 text-green-800' :
                            'bg-blue-100 text-blue-800'
                        }`}>
                        {result.severity}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex flex-col sm:flex-row sm:items-start gap-1">
                        <span className="font-semibold text-gray-700 min-w-12">Found:</span>
                        <span className="bg-red-100 text-red-800 px-2 py-1 rounded font-mono">
                          {result.found}
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-start gap-1">
                        <span className="font-semibold text-gray-700 min-w-12">Fix:</span>
                        <span className="text-gray-600">{result.suggestion}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Recommendations */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-3 border border-gray-200">
                <h3 className="text-sm font-bold text-gray-900 mb-2">Recommendations</h3>
                <ul className="space-y-1 text-xs text-gray-700">
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1 flex-shrink-0" />
                    <span>Warm up domain gradually over 4-8 weeks</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1 flex-shrink-0" />
                    <span>Configure SPF, DKIM, DMARC records</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1 flex-shrink-0" />
                    <span>Clean email list regularly</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1 flex-shrink-0" />
                    <span>Keep subject under 50 characters</span>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className="fixed bottom-4 right-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg shadow-lg animate-slide-in text-sm">
          {notification}
        </div>
      )}

      {/* Custom Animation */}
      <style jsx global>{`
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
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default TemplateCheckerPage;