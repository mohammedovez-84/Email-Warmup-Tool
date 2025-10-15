import React, { useState, useRef, useEffect } from 'react';
import { FiAlertTriangle, FiCheckCircle, FiCopy, FiEdit2, FiSend, FiChevronDown, FiChevronUp, FiEye, FiEyeOff, FiBold, FiItalic, FiUnderline, FiLink, FiCode, FiList, FiAlignLeft } from 'react-icons/fi';

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
  const scoreColor = score >= 80 ? '#38a169' : score >= 60 ? '#dd6b20' : '#e53e3e';

  return (
    <div className="template-checker-container">
      {/* <div className="header">
      </div> */}

      <div className="content-area">
        {activeTab === 'editor' ? (
          <div className="editor-section">
            <div className="editor-header">
              <h3>Email Template</h3>
              <div className="editor-actions">
                <div className="formatting-options">
                  <select
                    className="font-select"
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                  >
                    {fonts.map(font => (
                      <option key={font} value={font}>{font}</option>
                    ))}
                  </select>
                  <select
                    className="size-select"
                    value={fontSize}
                    onChange={(e) => setFontSize(e.target.value)}
                  >
                    <option value="12px">12px</option>
                    <option value="14px">14px</option>
                    <option value="16px">16px</option>
                    <option value="18px">18px</option>
                    <option value="20px">20px</option>
                  </select>
                  <button
                    className={`format-button bold ${isBold ? 'active' : ''}`}
                    onClick={() => applyFormatting('bold')}
                    title="Bold"
                  >
                    <FiBold />
                  </button>
                  <button
                    className={`format-button italic ${isItalic ? 'active' : ''}`}
                    onClick={() => applyFormatting('italic')}
                    title="Italic"
                  >
                    <FiItalic />
                  </button>
                  <button
                    className={`format-button underline ${isUnderline ? 'active' : ''}`}
                    onClick={() => applyFormatting('underline')}
                    title="Underline"
                  >
                    <FiUnderline />
                  </button>
                </div>
                <div className="action-buttons">
                  <button className="action-button" onClick={handleCopyToClipboard}>
                    <FiCopy /> Copy
                  </button>
                  <button className="action-button analyze-button" onClick={handleAnalyze}>
                    <FiSend /> Analyze
                  </button>
                </div>
              </div>
            </div>

            <div className="subject-field">
              <label>Subject:</label>
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Enter email subject"
              />
              <div className="subject-metrics">
                <span>Length: {emailSubject.length} chars</span>
                {emailSubject.length > 50 && (
                  <span className="warning">(Recommended max: 50 chars)</span>
                )}
              </div>
            </div>

            <textarea
              ref={textareaRef}
              className="email-editor"
              value={emailContent}
              onChange={(e) => setEmailContent(e.target.value)}
              placeholder="Paste your email template here..."
              style={{
                fontFamily,
                fontSize,
                fontWeight: isBold ? 'bold' : 'normal',
                fontStyle: isItalic ? 'italic' : 'normal',
                textDecoration: isUnderline ? 'underline' : 'none'
              }}
            />

            <div className="metrics-section">
              <div className="metrics-header" onClick={toggleMetrics}>
                <h4>Template Metrics</h4>
                <span className="metrics-toggle-icon">
                  {showMetrics ? <FiChevronUp /> : <FiChevronDown />}
                </span>
              </div>
              {showMetrics && (
                <div className="metrics-panel">
                  <div className="score-display">
                    <div className="score-circle">
                      <svg viewBox="0 0 36 36" className="circular-chart">
                        <path className="circle-bg"
                          d="M18 2.0845
                            a 15.9155 15.9155 0 0 1 0 31.831
                            a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path className="circle"
                          stroke={scoreColor}
                          strokeDasharray={`${score}, 100`}
                          d="M18 2.0845
                            a 15.9155 15.9155 0 0 1 0 31.831
                            a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <text x="18" y="20.35" className="percentage">{score}</text>
                      </svg>
                    </div>
                    <div className="score-text">
                      <h5>Email Health Score</h5>
                      <p>{score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : 'Needs Improvement'}</p>
                    </div>
                  </div>
                  <div className="metrics-grid">
                    <div className="metric-card">
                      <div className="metric-value">{metrics.subjectLength}</div>
                      <div className="metric-label">Subject Length</div>
                      {metrics.subjectLength > 50 && <div className="metric-warning">Too long</div>}
                    </div>
                    <div className="metric-card">
                      <div className="metric-value">{metrics.wordCount}</div>
                      <div className="metric-label">Word Count</div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-value">{metrics.sentenceCount}</div>
                      <div className="metric-label">Sentences</div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-value">{metrics.avgWordsPerSentence.toFixed(1)}</div>
                      <div className="metric-label">Avg. Words/Sentence</div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-value">{metrics.readingTime}</div>
                      <div className="metric-label">Reading Time</div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-value">{metrics.linkCount}</div>
                      <div className="metric-label">Links</div>
                      {metrics.linkCount > 3 && <div className="metric-warning">Too many</div>}
                    </div>
                    <div className="metric-card">
                      <div className="metric-value">{metrics.questionCount}</div>
                      <div className="metric-label">Questions</div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-value">{metrics.spammyWordCount}</div>
                      <div className="metric-label">Spam Words</div>
                      {metrics.spammyWordCount > 0 && <div className="metric-warning">Found</div>}
                    </div>
                    <div className="metric-card">
                      <div className="metric-value">{metrics.personalizationCount}</div>
                      <div className="metric-label">Personalizations</div>
                      {metrics.personalizationCount > 0 && <div className="metric-warning">Tags found</div>}
                    </div>
                    <div className="metric-card">
                      <div className="metric-value">{metrics.uppercaseCount}</div>
                      <div className="metric-label">Uppercase Words</div>
                      {metrics.uppercaseCount > 3 && <div className="metric-warning">Too many</div>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="results-section">
            <div className="results-header">
              <h2>Analysis Results</h2>
              <button className="action-button" onClick={() => setActiveTab('editor')}>
                <FiEdit2 /> Edit Template
              </button>
            </div>

            <div className="results-summary">
              <div className="summary-card high">
                <div className="summary-count">
                  {analysisResults.filter(r => r.severity === 'High').length}
                </div>
                <div className="summary-label">High severity issues</div>
              </div>
              <div className="summary-card medium">
                <div className="summary-count">
                  {analysisResults.filter(r => r.severity === 'Medium').length}
                </div>
                <div className="summary-label">Medium severity issues</div>
              </div>
              <div className="summary-card low">
                <div className="summary-count">
                  {analysisResults.filter(r => r.severity === 'Low').length}
                </div>
                <div className="summary-label">Low severity issues</div>
              </div>
              <div className="summary-card none">
                <div className="summary-count">
                  {analysisResults.filter(r => r.severity === 'None').length}
                </div>
                <div className="summary-label">No issues</div>
              </div>
            </div>

            <div className="issues-list">
              {analysisResults.map((result) => (
                <div key={result.id} className={`issue-card ${result.severity.toLowerCase()}`}>
                  <div className="issue-header">
                    <div className="issue-title">
                      {result.severity === 'High' ? (
                        <FiAlertTriangle className="icon high" />
                      ) : result.severity === 'None' ? (
                        <FiCheckCircle className="icon none" />
                      ) : (
                        <FiAlertTriangle className="icon medium" />
                      )}
                      <span>{result.issue}</span>
                    </div>
                    <div className={`severity-badge ${result.severity.toLowerCase()}`}>
                      {result.severity}
                    </div>
                  </div>
                  <div className="issue-details">
                    <div className="detail-row">
                      <span>Found:</span>
                      <span className="found-text">{result.found}</span>
                    </div>
                    <div className="detail-row">
                      <span>Suggestion:</span>
                      <span>{result.suggestion}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="recommendations">
              <h3>General Recommendations</h3>
              <ul>
                <li>Warm up your domain by gradually increasing email volume over 4-8 weeks</li>
                <li>Ensure your DNS records (SPF, DKIM, DMARC) are properly configured</li>
                <li>Maintain a clean email list and remove inactive subscribers</li>
                <li>Keep a good balance between text and images (at least 60% text)</li>
                <li>Avoid using too many sales-oriented words that might trigger spam filters</li>
                <li>Keep your subject line under 50 characters for better open rates</li>
                <li>Limit the number of links in your email to 3 or fewer</li>
                <li>Use a professional email signature with your contact information</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {notification && (
        <div className="notification">
          {notification}
        </div>
      )}

      <style jsx>{`
        .template-checker-container {
          padding: 40px;
          max-width: 100%;
          margin: 0 auto;
          background-color: #f8fafc;
          min-height: 100vh;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          width: calc(100% - 240px);
          margin-left: 240px;
        }

        .header {
          background: white;
          color: black;
          padding: 2.5rem 2rem;
          margin-bottom: 2rem;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          border-bottom: 1px solid #e2e8f0;
        }

        .header-content {
          max-width: 1200px;
          margin: 0 auto;
          text-align: center;
        }

        .header h2 {
          font-size: 2.8rem;
          font-weight: 800;
          margin-bottom: 0.5rem;
          letter-spacing: -0.5px;
          color: #0B1E3F;
        }

        .subtitle {
          font-size: 1.2rem;
          margin: 0;
          font-weight: 400;
          color: #4a5568;
        }

        .content-area {
          background-color: #FFFFFF;
          border-radius: 16px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
          overflow: hidden;
          margin: 0 2rem 3rem;
          border: 1px solid #e2e8f0;
        }

        .editor-section h3,
        .results-section h2 {
          font-size: 1.6rem;
          color: #0F172A;
          margin-bottom: 1.5rem;
          padding-bottom: 0.75rem;
          border-bottom: 2px solid #f1f5f9;
          font-weight: 700;
        }

        .editor-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 2rem 2rem 0;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .editor-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .formatting-options {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .font-select,
        .size-select {
          padding: 0.6rem;
          border: 1px solid #d1d9e6;
          border-radius: 10px;
          background: white;
          font-size: 0.9rem;
          min-width: 110px;
          transition: all 0.2s ease;
          cursor: pointer;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
          font-weight: 500;
        }

        .font-select:hover,
        .size-select:hover {
          border-color: #0B1E3F;
          box-shadow: 0 0 0 3px rgba(11, 30, 63, 0.1);
        }

        .format-button {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #d1d9e6;
          border-radius: 10px;
          background: white;
          cursor: pointer;
          color: #4a5568;
          transition: all 0.2s ease;
          font-size: 1rem;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
        }

        .format-button:hover {
          background-color: #f7f9fc;
          border-color: #0B1E3F;
          color: #0B1E3F;
          transform: translateY(-2px);
        }

        .format-button.active {
          background: linear-gradient(to right, #0B1E3F 0%, #008080 100%);
          color: white;
          border-color: #0B1E3F;
          box-shadow: 0 4px 8px rgba(11, 30, 63, 0.2);
        }

        .metrics-toggle {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #d1d9e6;
          border-radius: 10px;
          background: white;
          cursor: pointer;
          color: #4a5568;
          transition: all 0.2s ease;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
        }

        .metrics-toggle:hover {
          background-color: #f7f9fc;
          border-color: #0B1E3F;
          color: #0B1E3F;
          transform: translateY(-2px);
        }

        .action-buttons {
          display: flex;
          gap: 1rem;
        }

        .action-button {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: #f7f9fc;
          border: 1px solid #d1d9e6;
          color: #4a5568;
          padding: 0.7rem 1.2rem;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 0.95rem;
          font-weight: 500;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
        }

        .action-button:hover {
          background: #eef2f7;
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }

        .analyze-button {
          background: linear-gradient(to right, #0B1E3F 0%, #008080 100%);
          color: white;
          border: none;
          box-shadow: 0 4px 10px rgba(11, 30, 63, 0.3);
        }

        .analyze-button:hover {
          background: linear-gradient(to right, #0a172e 0%, #006666 100%);
          transform: translateY(-2px);
          box-shadow: 0 6px 12px rgba(11, 30, 63, 0.4);
        }

        .subject-field {
          padding: 0 2rem;
          margin-bottom: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .subject-field label {
          font-weight: 600;
          color: #2d3748;
          font-size: 1rem;
        }

        .subject-field input {
          padding: 0.9rem 1.2rem;
          border: 1px solid #d1d9e6;
          border-radius: 10px;
          font-size: 1rem;
          width: 100%;
          transition: all 0.2s ease;
          background-color: #f7f9fc;
          font-weight: 500;
        }

        .subject-field input:focus {
          outline: none;
          border-color: #0B1E3F;
          box-shadow: 0 0 0 3px rgba(11, 30, 63, 0.1);
          background-color: white;
        }

        .subject-metrics {
          font-size: 0.9rem;
          color: #718096;
          display: flex;
          gap: 0.5rem;
          align-items: center;
          margin-top: 0.5rem;
        }

        .subject-metrics .warning {
          color: #ed8936;
          font-weight: 500;
          background-color: #fffaf0;
          padding: 0.2rem 0.5rem;
          border-radius: 5px;
        }

        .email-editor {
          width: calc(100% - 4rem);
          min-height: 320px;
          padding: 1.5rem;
          border: 1px solid #d1d9e6;
          border-radius: 12px;
          font-family: inherit;
          font-size: 1rem;
          line-height: 1.7;
          resize: vertical;
          margin: 0 2rem 2rem;
          transition: all 0.2s ease;
          background-color: #f7f9fc;
        }

        .email-editor:focus {
          outline: none;
          border-color: #0B1E3F;
          box-shadow: 0 0 0 3px rgba(11, 30, 63, 0.1);
          background-color: white;
        }

        .metrics-section {
          margin: 0 2rem 2rem;
          border: 1px solid #d1d9e6;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
        }

        .metrics-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.2rem 1.5rem;
          background: linear-gradient(to right, #f7f9fc 0%, #edf2f7 100%);
          cursor: pointer;
          transition: all 0.2s ease;
          border-bottom: 1px solid #e2e8f0;
        }

        .metrics-header:hover {
          background: linear-gradient(to right, #edf2f7 0%, #e2e8f0 100%);
        }

        .metrics-header h4 {
          margin: 0;
          font-size: 1.2rem;
          color: #2d3748;
          font-weight: 600;
        }

        .metrics-toggle-icon {
          color: #718096;
          transition: all 0.2s ease;
          font-size: 1.2rem;
        }

        .metrics-panel {
          background-color: white;
          padding: 1.5rem;
        }

        .score-display {
          display: flex;
          align-items: center;
          margin-bottom: 2rem;
          padding: 1rem;
          background: #f7fafc;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
        }

        .score-circle {
          width: 80px;
          height: 80px;
          margin-right: 1.5rem;
        }

        .circular-chart {
          display: block;
          max-width: 100%;
          max-height: 100%;
        }

        .circle-bg {
          fill: none;
          stroke: #eee;
          stroke-width: 3.8;
        }

        .circle {
          fill: none;
          stroke-width: 2.8;
          stroke-linecap: round;
          transition: all 0.5s ease;
          transform: rotate(-90deg);
          transform-origin: 50% 50%;
        }

        .percentage {
          fill: #4a5568;
          font-size: 0.5em;
          font-weight: 700;
          text-anchor: middle;
        }

        .score-text h5 {
          margin: 0 0 0.5rem 0;
          font-size: 1.1rem;
          color: #2d3748;
        }

        .score-text p {
          margin: 0;
          font-weight: 600;
          color: #4a5568;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 1.2rem;
        }

        .metric-card {
          background: linear-gradient(135deg, #ffffff 0%, #f7f9fc 100%);
          border-radius: 12px;
          padding: 1.5rem;
          text-align: center;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
          border: 1px solid #e2e8f0;
          transition: all 0.2s ease;
          position: relative;
        }

        .metric-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 15px rgba(0, 0, 0, 0.1);
          border-color: #cbd5e0;
        }

        .metric-value {
          font-size: 2rem;
          font-weight: 800;
          color: #0B1E3F;
          margin-bottom: 0.5rem;
        }

        .metric-label {
          font-size: 0.9rem;
          color: #718096;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 0.5rem;
        }

        .metric-warning {
          font-size: 0.75rem;
          color: #e53e3e;
          background: #fed7d7;
          padding: 0.2rem 0.5rem;
          border-radius: 9999px;
          display: inline-block;
          font-weight: 600;
        }

        .results-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 2rem 2rem 0;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .results-summary {
          display: flex;
          gap: 1.5rem;
          margin: 2rem;
          flex-wrap: wrap;
        }

        .summary-card {
          flex: 1;
          padding: 2rem;
          border-radius: 16px;
          text-align: center;
          transition: all 0.2s ease;
          box-shadow: 0 6px 15px rgba(0, 0, 0, 0.08);
          min-width: 220px;
        }

        .summary-card.high {
          background: linear-gradient(135deg, #fff5f5 0%, #fed7d7 100%);
          border-left: 5px solid #e53e3e;
        }

        .summary-card.medium {
          background: linear-gradient(135deg, #fffbeb 0%, #feebc8 100%);
          border-left: 5px solid #dd6b20;
        }

        .summary-card.low {
          background: linear-gradient(135deg, #f0fff4 0%, #c6f6d5 100%);
          border-left: 5px solid #38a169;
        }

        .summary-card.none {
          background: linear-gradient(135deg, #ebf8ff 0%, #bee3f8 100%);
          border-left: 5px solid #3182ce;
        }

        .summary-count {
          font-size: 2.5rem;
          font-weight: 800;
          margin-bottom: 0.5rem;
        }

        .summary-card.high .summary-count {
          color: #e53e3e;
        }

        .summary-card.medium .summary-count {
          color: #dd6b20;
        }

        .summary-card.low .summary-count {
          color: #38a169;
        }

        .summary-card.none .summary-count {
          color: #3182ce;
        }

        .summary-label {
          color: #4a5568;
          font-size: 1rem;
          font-weight: 600;
        }

        .issues-list {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          margin: 2rem;
        }

        .issue-card {
          padding: 2rem;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          transition: all 0.2s ease;
          background-color: white;
          box-shadow: 0 6px 15px rgba(0, 0, 0, 0.05);
        }

        .issue-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
        }

        .issue-card.high {
          border-left: 5px solid #e53e3e;
        }

        .issue-card.medium {
          border-left: 5px solid #dd6b20;
        }

        .issue-card.low {
          border-left: 5px solid #38a169;
        }

        .issue-card.none {
          border-left: 5px solid #3182ce;
        }

        .issue-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.2rem;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .issue-title {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-weight: 700;
          font-size: 1.2rem;
        }

        .icon {
          font-size: 1.4rem;
        }

        .icon.high {
          color: #e53e3e;
        }

        .icon.medium {
          color: #dd6b20;
        }

        .icon.none {
          color: #3182ce;
        }

        .severity-badge {
          padding: 0.5rem 1rem;
          border-radius: 9999px;
          font-size: 0.9rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .severity-badge.high {
          background-color: #fed7d7;
          color: #c53030;
        }

        .severity-badge.medium {
          background-color: #feebc8;
          color: #c05621;
        }

        .severity-badge.low {
          background-color: #c6f6d5;
          color: #2f855a;
        }

        .severity-badge.none {
          background-color: #bee3f8;
          color: #2b6cb0;
        }

        .issue-details {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
        }

        .detail-row {
          display: flex;
          gap: 1rem;
        }

        .detail-row span:first-child {
          font-weight: 700;
          color: #2d3748;
          min-width: 100px;
        }

        .detail-row span:last-child {
          color: #4a5568;
          font-size: 1rem;
        }

        .found-text {
          background-color: rgba(229, 62, 62, 0.1);
          padding: 0.4rem 0.7rem;
          border-radius: 6px;
          color: #c53030;
          font-family: 'Fira Code', monospace;
          font-size: 0.9rem;
          font-weight: 500;
        }

        .recommendations {
          background: linear-gradient(135deg, #f7f9fc 0%, #edf2f7 100%);
          border-radius: 16px;
          padding: 2rem;
          border: 1px solid #e2e8f0;
          margin: 2rem;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
        }

        .recommendations h3 {
          margin-top: 0;
          margin-bottom: 1.5rem;
          font-size: 1.4rem;
          color: #2d3748;
          font-weight: 700;
        }

        .recommendations ul {
          padding-left: 1.5rem;
          margin: 0;
        }

        .recommendations li {
          margin-bottom: 0.8rem;
          color: #4a5568;
          line-height: 1.7;
          font-size: 1rem;
        }

        .notification {
          position: fixed;
          bottom: 25px;
          right: 25px;
          background: linear-gradient(to right, #0B1E3F 0%, #008080 100%);
          color: white;
          padding: 1rem 1.8rem;
          border-radius: 10px;
          box-shadow: 0 12px 20px rgba(0, 0, 0, 0.25);
          z-index: 1000;
          animation: slideIn 0.3s ease-out;
          font-weight: 600;
          font-size: 1rem;
        }

        @keyframes slideIn {
          from {
            transform: translateY(100px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @media (max-width: 1024px) {
          .content-area {
            margin: 0 1.5rem 2rem;
          }
          
          .editor-header, .results-header {
            padding: 1.5rem 1.5rem 0;
          }
          
          .subject-field, .email-editor, .metrics-section, 
          .results-summary, .issues-list, .recommendations {
            margin-left: 1.5rem;
            margin-right: 1.5rem;
          }
          
          .email-editor {
            width: calc(100% - 3rem);
          }
        }

        @media (max-width: 768px) {
          .template-checker-container {
            padding: 0;
          }
          
          .header {
            padding: 2rem 1.5rem;
          }
          
          .header h2 {
            font-size: 2.2rem;
          }
          
          .subtitle {
            font-size: 1.1rem;
          }
          
          .content-area {
            margin: 0 1rem 2rem;
          }
          
          .editor-actions {
            flex-direction: column;
          }
          
          .formatting-options {
            width: 100%;
            justify-content: space-between;
          }
          
          .action-buttons {
            width: 100%;
          }
          
          .action-button {
            flex: 1;
            justify-content: center;
          }

          .metrics-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          
          .results-summary {
            flex-direction: column;
          }

          .score-display {
            flex-direction: column;
            text-align: center;
          }

          .score-circle {
            margin-right: 0;
            margin-bottom: 1rem;
          }
        }

        @media (max-width: 576px) {
          .header h2 {
            font-size: 1.8rem;
          }
          
          .editor-section h3, .results-section h2 {
            font-size: 1.4rem;
          }
          
          .formatting-options {
            gap: 0.5rem;
          }
          
          .font-select, .size-select {
            min-width: 90px;
          }
          
          .metrics-grid {
            grid-template-columns: 1fr;
          }
          
          .detail-row {
            flex-direction: column;
            gap: 0.5rem;
          }
          
          .detail-row span:first-child {
            min-width: auto;
          }
        }
      `}</style>
    </div>
  );
};

export default TemplateCheckerPage;