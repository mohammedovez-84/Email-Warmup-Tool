import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { FiPieChart, FiBarChart2, FiInfo, FiExternalLink, FiSettings, FiRefreshCw } from 'react-icons/fi';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';

// Spam Analytics Component
const SpamAnalytics = ({ selectedAccount }) => {
  // Sample data for spam analysis
  const spamTriggersData = [
    { name: 'Suspicious Links', value: 15 },
    { name: 'Spammy Words', value: 8 },
    { name: 'Image-Only', value: 5 },
    { name: 'Other', value: 2 },
  ];

  const reputationFactors = [
    {
      subject: 'Authentication',
      A: 100,
      B: 90,
      fullMark: 100,
    },
    {
      subject: 'Content',
      A: 85,
      B: 75,
      fullMark: 100,
    },
    {
      subject: 'Engagement',
      A: 92,
      B: 78,
      fullMark: 100,
    },
    {
      subject: 'Infrastructure',
      A: 95,
      B: 80,
      fullMark: 100,
    },
    {
      subject: 'List Quality',
      A: 88,
      B: 72,
      fullMark: 100,
    },
  ];

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A4DE6C', '#D0ED57'];

  return (
    <div className="spam-analysis">
      <div className="spam-triggers">
        <h3><FiPieChart size={18} style={{ marginRight: '8px' }} /> Spam Triggers Analysis</h3>
        <div className="spam-chart-container">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={spamTriggersData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              >
                {spamTriggersData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="reputation-factors">
        <h3><FiBarChart2 size={18} style={{ marginRight: '8px' }} /> Reputation Factors</h3>
        <div className="radar-chart-container">
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={reputationFactors}>
              <PolarGrid />
              <PolarAngleAxis dataKey="subject" />
              <PolarRadiusAxis angle={30} domain={[0, 100]} />
              <Radar
                name="Your Score"
                dataKey="A"
                stroke="#0d9488"
                fill="#0d9488"
                fillOpacity={0.6}
              />
              <Radar
                name="Industry Average"
                dataKey="B"
                stroke="#64748B"
                fill="#64748B"
                fillOpacity={0.3}
              />
              <Legend />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="spam-tips">
        <h3>Improvement Recommendations</h3>
        <ul>
          <li>
            <FiInfo className="tip-icon" />
            <strong>Content Optimization:</strong> Reduce use of spam trigger words like "free", "guarantee", etc.
            <a href="#" className="learn-more">Learn more <FiExternalLink size={12} /></a>
          </li>
          <li>
            <FiInfo className="tip-icon" />
            <strong>Formatting:</strong> Maintain a healthy text-to-image ratio (at least 60:40).
          </li>
          <li>
            <FiInfo className="tip-icon" />
            <strong>Authentication:</strong> Implement DMARC for {selectedAccount?.domain || 'your domain'}.
            {selectedAccount?.authentication?.includes('DMARC') &&
              <span className="implemented"> (Implemented)</span>}
          </li>
          <li>
            <FiInfo className="tip-icon" />
            <strong>List Hygiene:</strong> Clean your email list regularly to remove inactive addresses.
            <a href="#" className="learn-more">Run cleanup now <FiExternalLink size={12} /></a>
          </li>
          <li>
            <FiInfo className="tip-icon" />
            <strong>Engagement:</strong> Segment your list to send more targeted content.
          </li>
        </ul>
      </div>
    </div>
  );
};

// Score Gauge Component
const ScoreGauge = ({ value, max = 100 }) => {
  const percentage = (value / max) * 100;
  let color = '#10B981'; // green
  if (percentage < 70) color = '#F59E0B'; // yellow
  if (percentage < 50) color = '#EF4444'; // red

  return (
    <div style={{ width: 120, height: 120 }}>
      <CircularProgressbar
        value={percentage}
        text={`${value}`}
        styles={buildStyles({
          pathColor: color,
          textColor: '#0F172A',
          trailColor: '#E2E8F0',
          textSize: '32px',
        })}
      />
    </div>
  );
};

// Account Analytics Component
const AccountAnalytics = ({ selectedAccount, accountScores, getDeliverabilityData, engagementData }) => {
  return (
    <div className="account-details-section">
      {selectedAccount && (
        <>
          <div className="account-header">
            <h2>{selectedAccount.name}</h2>
            <div className="account-actions">
              <button className="action-btn">
                <FiSettings /> Settings
              </button>
              <button className="action-btn primary">
                <FiRefreshCw /> Refresh Data
              </button>
            </div>
          </div>

          <div className="account-stats-grid">
            <div className="stat-card">
              <h4>Reputation Score</h4>
              <div className="stat-value-large">
                <ScoreGauge value={accountScores[selectedAccount.id]?.score || 0} />
              </div>
              <div className="stat-description">
                {accountScores[selectedAccount.id]?.reputation === 'excellent' ?
                  'Excellent sender reputation' :
                  accountScores[selectedAccount.id]?.reputation === 'good' ?
                    'Good sender reputation' :
                    'Needs improvement'}
              </div>
            </div>

            <div className="stat-card">
              <h4>Authentication</h4>
              <div className="auth-badges">
                {selectedAccount.authentication.map((auth, index) => (
                  <span key={index} className="auth-badge">{auth}</span>
                ))}
                {selectedAccount.authentication.length < 3 && (
                  <span className="auth-badge missing">+{3 - selectedAccount.authentication.length} more needed</span>
                )}
              </div>
              <div className="stat-description">
                {selectedAccount.authentication.length === 3 ?
                  'Full authentication configured' :
                  'Configure DMARC for better deliverability'}
              </div>
            </div>

            <div className="stat-card">
              <h4>Recent Activity</h4>
              <div className="stat-value">
                {new Date(selectedAccount.lastActive).toLocaleString()}
              </div>
              <div className="stat-description">
                Last email sent {Math.floor((new Date() - new Date(selectedAccount.lastActive)) / (1000 * 60 * 60))} hours ago
              </div>
            </div>

            <div className="stat-card">
              <h4>Issues Detected</h4>
              <div className="stat-value">
                {selectedAccount.issues.length || 'None'}
              </div>
              <div className="stat-description">
                {selectedAccount.issues.length ?
                  selectedAccount.issues.join(', ') :
                  'No critical issues found'}
              </div>
            </div>
          </div>

          <div className="account-charts">
            <div className="account-chart-card">
              <h4>Daily Volume</h4>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={getDeliverabilityData(selectedAccount.id)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="inbox"
                      stroke="#10B981"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="account-chart-card">
              <h4>Engagement Trend</h4>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={engagementData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="opens"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="clicks"
                      stroke="#10B981"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Main Analytics Dashboard Component
const AnalyticsDashboard = () => {
  // Mock data for demonstration
  const [emailStats, setEmailStats] = useState({
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    replied: 0,
    bounced: 0
  });

  const [campaignPerformance, setCampaignPerformance] = useState([]);
  const [engagementData, setEngagementData] = useState([]);
  const [deviceData, setDeviceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  // Sample account data
  const [selectedAccount, setSelectedAccount] = useState({
    id: 1,
    name: 'Marketing Account',
    domain: 'example.com',
    authentication: ['SPF', 'DKIM'],
    lastActive: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    issues: ['High bounce rate', 'Low engagement']
  });

  const [accountScores, setAccountScores] = useState({
    1: { score: 82, reputation: 'good' }
  });

  // Colors for charts
  const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
  const BAR_COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  // Update current time
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  // Simulate data loading
  useEffect(() => {
    const timer = setTimeout(() => {
      // Mock email statistics
      setEmailStats({
        sent: 1254,
        delivered: 1189,
        opened: 876,
        clicked: 432,
        replied: 198,
        bounced: 65
      });

      // Mock campaign performance data
      setCampaignPerformance([
        { name: 'Q1 Newsletter', sent: 400, opened: 320, clicked: 180, replied: 45 },
        { name: 'Product Launch', sent: 600, opened: 480, clicked: 290, replied: 98 },
        { name: 'Holiday Promo', sent: 800, opened: 650, clicked: 420, replied: 156 },
        { name: 'Webinar Invite', sent: 300, opened: 240, clicked: 150, replied: 62 },
        { name: 'Customer Survey', sent: 200, opened: 180, clicked: 120, replied: 75 }
      ]);

      // Mock engagement data over time
      setEngagementData([
        { day: 'Mon', opened: 120, clicked: 60 },
        { day: 'Tue', opened: 152, clicked: 78 },
        { day: 'Wed', opened: 182, clicked: 95 },
        { day: 'Thu', opened: 210, clicked: 112 },
        { day: 'Fri', opened: 190, clicked: 98 },
        { day: 'Sat', opened: 90, clicked: 45 },
        { day: 'Sun', opened: 70, clicked: 32 }
      ]);

      // Mock device data
      setDeviceData([
        { name: 'Desktop', value: 45 },
        { name: 'Mobile', value: 40 },
        { name: 'Tablet', value: 10 },
        { name: 'Other', value: 5 }
      ]);

      setLoading(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  // Mock function for deliverability data
  const getDeliverabilityData = (accountId) => {
    return [
      { name: 'Mon', inbox: 120, spam: 5 },
      { name: 'Tue', inbox: 152, spam: 7 },
      { name: 'Wed', inbox: 182, spam: 8 },
      { name: 'Thu', inbox: 210, spam: 10 },
      { name: 'Fri', inbox: 190, spam: 6 },
      { name: 'Sat', inbox: 90, spam: 3 },
      { name: 'Sun', inbox: 70, spam: 2 }
    ];
  };

  // Calculate rates
  const deliveryRate = ((emailStats.delivered / emailStats.sent) * 100).toFixed(1);
  const openRate = ((emailStats.opened / emailStats.delivered) * 100).toFixed(1);
  const clickRate = ((emailStats.clicked / emailStats.opened) * 100).toFixed(1);
  const replyRate = ((emailStats.replied / emailStats.clicked) * 100).toFixed(1);
  const bounceRate = ((emailStats.bounced / emailStats.sent) * 100).toFixed(1);

  if (loading) {
    return (
      <div className="analytics-loading">
        <div className="loading-spinner"></div>
        <p>Loading analytics data...</p>
      </div>
    );
  }

  return (
    <div className="analytics-dashboard">
      {/* Header with title and info */}
      <div className="dashboard-header">
        <div className="header-left">
          <h1>Email Analytics Dashboard</h1>
          <div className="last-updated">
            <span>Last updated: {currentTime}</span>
          </div>
        </div>
        <div className="header-right">
          <div className="header-actions">
            <select className="time-filter">
              <option>Last 7 days</option>
              <option>Last 30 days</option>
              <option>Last 90 days</option>
            </select>
            <button className="export-btn">Export Report</button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="nav-tabs">
        <div className="tabs-container">
          <button
            className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={`tab ${activeTab === 'spam' ? 'active' : ''}`}
            onClick={() => setActiveTab('spam')}
          >
            Spam Analysis
          </button>
          <button
            className={`tab ${activeTab === 'account' ? 'active' : ''}`}
            onClick={() => setActiveTab('account')}
          >
            Account Details
          </button>
          <div className="tab-spacer"></div>
          <button className="filter-btn">
            <i className="fas fa-filter"></i>
            Filters
          </button>
        </div>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'overview' && (
        <>
          {/* Summary Cards */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon delivered">
                <i className="fas fa-paper-plane"></i>
              </div>
              <div className="stat-info">
                <h3>Delivered</h3>
                <div className="stat-number">{emailStats.delivered}</div>
                <div className="stat-rate">{deliveryRate}%</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon opened">
                <i className="fas fa-envelope-open"></i>
              </div>
              <div className="stat-info">
                <h3>Opened</h3>
                <div className="stat-number">{emailStats.opened}</div>
                <div className="stat-rate">{openRate}%</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon clicked">
                <i className="fas fa-mouse-pointer"></i>
              </div>
              <div className="stat-info">
                <h3>Clicked</h3>
                <div className="stat-number">{emailStats.clicked}</div>
                <div className="stat-rate">{clickRate}%</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon replied">
                <i className="fas fa-reply"></i>
              </div>
              <div className="stat-info">
                <h3>Replied</h3>
                <div className="stat-number">{emailStats.replied}</div>
                <div className="stat-rate">{replyRate}%</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon bounced">
                <i className="fas fa-exclamation-circle"></i>
              </div>
              <div className="stat-info">
                <h3>Bounced</h3>
                <div className="stat-number">{emailStats.bounced}</div>
                <div className="stat-rate">{bounceRate}%</div>
              </div>
            </div>
          </div>

          {/* Campaign Performance Bar Chart */}
          <div className="chart-container">
            <div className="chart-header">
              <h2>Campaign Performance</h2>
            </div>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart
                data={campaignPerformance}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="sent" fill={BAR_COLORS[0]} name="Emails Sent" radius={[4, 4, 0, 0]} />
                <Bar dataKey="opened" fill={BAR_COLORS[1]} name="Opened" radius={[4, 4, 0, 0]} />
                <Bar dataKey="clicked" fill={BAR_COLORS[2]} name="Clicked" radius={[4, 4, 0, 0]} />
                <Bar dataKey="replied" fill={BAR_COLORS[3]} name="Replied" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="charts-row">
            {/* Engagement Over Time Line Chart */}
            <div className="chart-container half-width">
              <div className="chart-header">
                <h2>Engagement Over Time</h2>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart
                  data={engagementData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="opened" stroke={COLORS[0]} fill={`url(#colorOpened)`} strokeWidth={2} name="Opened" />
                  <Area type="monotone" dataKey="clicked" stroke={COLORS[2]} fill={`url(#colorClicked)`} strokeWidth={2} name="Clicked" />
                  <defs>
                    <linearGradient id="colorOpened" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS[0]} stopOpacity={0.8} />
                      <stop offset="95%" stopColor={COLORS[0]} stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="colorClicked" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS[2]} stopOpacity={0.8} />
                      <stop offset="95%" stopColor={COLORS[2]} stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Device Distribution Pie Chart */}
            <div className="chart-container half-width">
              <div className="chart-header">
                <h2>Device Distribution</h2>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={deviceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {deviceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {activeTab === 'spam' && (
        <div className="tab-content">
          <SpamAnalytics selectedAccount={selectedAccount} />
        </div>
      )}

      {activeTab === 'account' && (
        <div className="tab-content">
          <AccountAnalytics
            selectedAccount={selectedAccount}
            accountScores={accountScores}
            getDeliverabilityData={getDeliverabilityData}
            engagementData={engagementData}
          />
        </div>
      )}

      {/* Footer */}
      <div className="dashboard-footer">
        <span>© Email Analytics Dashboard</span>
      </div>

      {/* Inject Font Awesome for icons */}
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css" />
    </div>
  );
};

// CSS Styles
const styles = `
.analytics-dashboard {
  padding: 20px 30px;
  font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background-color: #f8fafc;
  min-height: 100vh;
  margin-left: 240px;
  width: calc(100% - 240px);
}

/* Header Styles */
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.header-left h1 {
  color: #1e293b;
  font-weight: 700;
  font-size: 24px;
  margin: 0 0 8px 0;
}

.last-updated {
  font-size: 14px;
  color: #64748b;
}

.header-right {
  display: flex;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.time-filter {
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  background: white;
  color: #64748b;
  font-size: 14px;
  cursor: pointer;
}

.export-btn {
  padding: 8px 16px;
  background: #4F46E5;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.3s ease;
}

.export-btn:hover {
  background: #4338CA;
}

/* Navigation Tabs */
.nav-tabs {
  margin-bottom: 24px;
  border-bottom: 1px solid #e2e8f0;
}

.tabs-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tab {
  padding: 12px 20px;
  background: none;
  border: none;
  color: #64748b;
  font-weight: 500;
  cursor: pointer;
  position: relative;
  transition: color 0.3s ease;
}

.tab:hover {
  color: #4F46E5;
}

.tab.active {
  color: #4F46E5;
}

.tab.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background: #4F46E5;
}

.tab-spacer {
  flex: 1;
}

.filter-btn {
  padding: 8px 16px;
  background: white;
  color: #64748b;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.3s ease;
}

.filter-btn:hover {
  background: #f1f5f9;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 15px rgba(0, 0, 0, 0.1);
}

.stat-icon {
  width: 50px;
  height: 50px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 15px;
  font-size: 20px;
  color: white;
}

.stat-icon.delivered {
  background: linear-gradient(135deg, #4F46E5 0%, #7C73E6 100%);
}

.stat-icon.opened {
  background: linear-gradient(135deg, #10B981 0%, #34D399 100%);
}

.stat-icon.clicked {
  background: linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%);
}

.stat-icon.replied {
  background: linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%);
}

.stat-icon.bounced {
  background: linear-gradient(135deg, #EF4444 0%, #F87171 100%);
}

.stat-info h3 {
  margin: 0 0 5px 0;
  color: #64748b;
  font-size: 14px;
  font-weight: 500;
}

.stat-number {
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 2px;
}

.stat-rate {
  font-size: 14px;
  color: #10b981;
  font-weight: 600;
}

.stat-icon.bounced ~ .stat-info .stat-rate {
  color: #EF4444;
}

/* Chart Containers */
.chart-container {
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.chart-header {
  margin-bottom: 20px;
}

.chart-header h2 {
  margin: 0;
  color: #334155;
  font-size: 18px;
  font-weight: 600;
}

.charts-row {
  display: flex;
  gap: 24px;
}

.half-width {
  flex: 1;
}

/* Footer */
.dashboard-footer {
  margin-top: 40px;
  padding: 20px 0;
  text-align: center;
  color: #64748b;
  font-size: 14px;
  border-top: 1px solid #e2e8f0;
}

/* Loading State */
.analytics-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 60vh;
}

.loading-spinner {
  border: 4px solid #f3f3f3;
  border-top: 4px solid #4F46E5;
  border-radius: 50%;
  width: 50px;
  height: 50px;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Spam Analysis Styles */
.spam-analysis {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.spam-triggers, .reputation-factors {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.spam-triggers h3, .reputation-factors h3 {
  display: flex;
  align-items: center;
  margin: 0 0 20px 0;
  color: #334155;
  font-size: 18px;
  font-weight: 600;
}

.spam-tips {
  grid-column: 1 / -1;
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.spam-tips h3 {
  margin: 0 0 16px 0;
  color: #334155;
  font-size: 18px;
  font-weight: 600;
}

.spam-tips ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.spam-tips li {
  padding: 12px 0;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: flex-start;
}

.spam-tips li:last-child {
  border-bottom: none;
}

.tip-icon {
  margin-right: 12px;
  color: #4F46E5;
  flex-shrink: 0;
  margin-top: 2px;
}

.learn-more {
  margin-left: 8px;
  color: #4F46E5;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.implemented {
  margin-left: 8px;
  color: #10B981;
  font-weight: 500;
}

/* Account Details Styles */
.account-details-section {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.account-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.account-header h2 {
  margin: 0;
  color: #1e293b;
  font-size: 24px;
  font-weight: 700;
}

.account-actions {
  display: flex;
  gap: 12px;
}

.action-btn {
  padding: 8px 16px;
  background: white;
  color: #64748b;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.3s ease;
}

.action-btn:hover {
  background: #f1f5f9;
}

.action-btn.primary {
  background: #4F46E5;
  color: white;
  border: none;
}

.action-btn.primary:hover {
  background: #4338CA;
}

.account-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.account-stats-grid .stat-card {
  flex-direction: column;
  text-align: center;
  padding: 20px;
}

.stat-value-large {
  margin: 16px 0;
  display: flex;
  justify-content: center;
}

.auth-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  margin: 16px 0;
}

.auth-badge {
  padding: 4px 12px;
  background: #10B981;
  color: white;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.auth-badge.missing {
  background: #F59E0B;
}

.stat-description {
  font-size: 14px;
  color: #64748b;
  margin-top: 8px;
}

.account-charts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.account-chart-card {
  background: #f8fafc;
  border-radius: 12px;
  padding: 20px;
}

.account-chart-card h4 {
  margin: 0 0 16px 0;
  color: #334155;
  font-size: 16px;
  font-weight: 600;
}

/* Responsive Design */
@media (max-width: 1024px) {
  .charts-row,
  .spam-analysis,
  .account-charts {
    grid-template-columns: 1fr;
  }
  
  .half-width {
    flex: none;
    width: 100%;
  }
}

@media (max-width: 768px) {
  .analytics-dashboard {
    padding: 16px;
    margin-left: 0;
    width: 100%;
  }
  
  .dashboard-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
  
  .header-actions {
    width: 100%;
    justify-content: space-between;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .tabs-container {
    overflow-x: auto;
    padding-bottom: 8px;
  }
  
  .time-filter, .export-btn {
    width: 48%;
  }
  
  .account-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
  
  .account-actions {
    width: 100%;
    justify-content: space-between;
  }
}

@media (max-width: 480px) {
  .stat-card {
    flex-direction: column;
    text-align: center;
  }
  
  .stat-icon {
    margin-right: 0;
    margin-bottom: 15px;
  }
  
  .header-actions {
    flex-direction: column;
  }
  
  .time-filter, .export-btn {
    width: 100%;
  }
  
  .filter-btn {
    width: 100%;
    justify-content: center;
  }
  
  .account-actions {
    flex-direction: column;
  }
    
  
  .action-btn {
    width: 100%;
    justify-content: center;
  }
}
`;

// Inject styles
const styleSheet = document.createElement('style');
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);

export default AnalyticsDashboard;