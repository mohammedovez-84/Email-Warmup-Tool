import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { FiPieChart, FiBarChart2, FiInfo, FiExternalLink, FiRefreshCw } from 'react-icons/fi';
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Spam Triggers */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="flex items-center text-lg font-semibold text-gray-800 mb-5">
          <FiPieChart size={18} className="mr-2" />
          Spam Triggers Analysis
        </h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
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

      {/* Reputation Factors */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="flex items-center text-lg font-semibold text-gray-800 mb-5">
          <FiBarChart2 size={18} className="mr-2" />
          Reputation Factors
        </h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
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

      {/* Improvement Recommendations */}
      <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Improvement Recommendations</h3>
        <ul className="space-y-3">
          <li className="flex items-start pb-3 border-b border-gray-100">
            <FiInfo className="text-blue-600 mt-1 mr-3 flex-shrink-0" />
            <div className="flex-1">
              <strong>Content Optimization:</strong> Reduce use of spam trigger words like "free", "guarantee", etc.
              <a href="#" className="text-blue-600 text-sm ml-2 inline-flex items-center">
                Learn more <FiExternalLink size={12} className="ml-1" />
              </a>
            </div>
          </li>
          <li className="flex items-start pb-3 border-b border-gray-100">
            <FiInfo className="text-blue-600 mt-1 mr-3 flex-shrink-0" />
            <div className="flex-1">
              <strong>Formatting:</strong> Maintain a healthy text-to-image ratio (at least 60:40).
            </div>
          </li>
          <li className="flex items-start pb-3 border-b border-gray-100">
            <FiInfo className="text-blue-600 mt-1 mr-3 flex-shrink-0" />
            <div className="flex-1">
              <strong>Authentication:</strong> Implement DMARC for {selectedAccount?.domain || 'your domain'}.
              {selectedAccount?.authentication?.includes('DMARC') && (
                <span className="text-green-600 font-medium ml-2">(Implemented)</span>
              )}
            </div>
          </li>
          <li className="flex items-start pb-3 border-b border-gray-100">
            <FiInfo className="text-blue-600 mt-1 mr-3 flex-shrink-0" />
            <div className="flex-1">
              <strong>List Hygiene:</strong> Clean your email list regularly to remove inactive addresses.
              <a href="#" className="text-blue-600 text-sm ml-2 inline-flex items-center">
                Run cleanup now <FiExternalLink size={12} className="ml-1" />
              </a>
            </div>
          </li>
          <li className="flex items-start">
            <FiInfo className="text-blue-600 mt-1 mr-3 flex-shrink-0" />
            <div className="flex-1">
              <strong>Engagement:</strong> Segment your list to send more targeted content.
            </div>
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
const AccountAnalytics = ({ selectedAccount, accountScores, getDeliverabilityData }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      {selectedAccount && (
        <>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h2 className="text-2xl font-bold text-gray-900">{selectedAccount.name}</h2>
            <div className="flex gap-3">
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
                <FiRefreshCw size={16} />
                Refresh Data
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Reputation Score */}
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <h4 className="text-sm font-medium text-gray-600 mb-3">Reputation Score</h4>
              <div className="flex justify-center mb-3">
                <ScoreGauge value={accountScores[selectedAccount.id]?.score || 0} />
              </div>
              <div className="text-sm text-gray-600">
                {accountScores[selectedAccount.id]?.reputation === 'excellent'
                  ? 'Excellent sender reputation'
                  : accountScores[selectedAccount.id]?.reputation === 'good'
                  ? 'Good sender reputation'
                  : 'Needs improvement'}
              </div>
            </div>

            {/* Authentication */}
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <h4 className="text-sm font-medium text-gray-600 mb-3">Authentication</h4>
              <div className="flex flex-wrap justify-center gap-2 mb-3">
                {selectedAccount.authentication.map((auth, index) => (
                  <span key={index} className="px-3 py-1 bg-green-500 text-white text-xs font-medium rounded-full">
                    {auth}
                  </span>
                ))}
                {selectedAccount.authentication.length < 3 && (
                  <span className="px-3 py-1 bg-yellow-500 text-white text-xs font-medium rounded-full">
                    +{3 - selectedAccount.authentication.length} more needed
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-600">
                {selectedAccount.authentication.length === 3
                  ? 'Full authentication configured'
                  : 'Configure DMARC for better deliverability'}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <h4 className="text-sm font-medium text-gray-600 mb-3">Recent Activity</h4>
              <div className="text-xl font-bold text-gray-900 mb-2">
                {new Date(selectedAccount.lastActive).toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">
                Last email sent {Math.floor((new Date() - new Date(selectedAccount.lastActive)) / (1000 * 60 * 60))} hours ago
              </div>
            </div>

            {/* Issues Detected */}
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <h4 className="text-sm font-medium text-gray-600 mb-3">Issues Detected</h4>
              <div className="text-xl font-bold text-gray-900 mb-2">
                {selectedAccount.issues.length || 'None'}
              </div>
              <div className="text-sm text-gray-600">
                {selectedAccount.issues.length
                  ? selectedAccount.issues.join(', ')
                  : 'No critical issues found'}
              </div>
            </div>
          </div>

          {/* Daily Volume - Now Full Width */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-lg font-semibold text-gray-800 mb-4">Daily Volume</h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-gray-600">Loading analytics data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Analytics Dashboard</h1>
          <div className="text-sm text-gray-600 mt-1">
            Last updated: {currentTime}
          </div>
        </div>
        <div className="flex gap-3">
          <select className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            <option>Last 7 days</option>
            <option>Last 30 days</option>
            <option>Last 90 days</option>
          </select>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
            Export Report
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex items-center gap-2">
          <button
            className={`px-6 py-3 font-medium text-sm relative ${
              activeTab === 'overview'
                ? 'text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
            {activeTab === 'overview' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
            )}
          </button>
          <button
            className={`px-6 py-3 font-medium text-sm relative ${
              activeTab === 'spam'
                ? 'text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => setActiveTab('spam')}
          >
            Spam Analysis
            {activeTab === 'spam' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
            )}
          </button>
          <button
            className={`px-6 py-3 font-medium text-sm relative ${
              activeTab === 'account'
                ? 'text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => setActiveTab('account')}
          >
            Account Details
            {activeTab === 'account' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
            )}
          </button>
          <div className="flex-1"></div>
        </div>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Delivered */}
            <div className="bg-white rounded-xl shadow-sm p-4 flex items-center hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center mr-4">
                <i className="fas fa-paper-plane text-white text-lg"></i>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-600">Delivered</h3>
                <div className="text-2xl font-bold text-gray-900">{emailStats.delivered}</div>
                <div className="text-sm font-semibold text-green-600">{deliveryRate}%</div>
              </div>
            </div>

            {/* Opened */}
            <div className="bg-white rounded-xl shadow-sm p-4 flex items-center hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center mr-4">
                <i className="fas fa-envelope-open text-white text-lg"></i>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-600">Opened</h3>
                <div className="text-2xl font-bold text-gray-900">{emailStats.opened}</div>
                <div className="text-sm font-semibold text-green-600">{openRate}%</div>
              </div>
            </div>

            {/* Clicked */}
            <div className="bg-white rounded-xl shadow-sm p-4 flex items-center hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg flex items-center justify-center mr-4">
                <i className="fas fa-mouse-pointer text-white text-lg"></i>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-600">Clicked</h3>
                <div className="text-2xl font-bold text-gray-900">{emailStats.clicked}</div>
                <div className="text-sm font-semibold text-green-600">{clickRate}%</div>
              </div>
            </div>

            {/* Replied */}
            <div className="bg-white rounded-xl shadow-sm p-4 flex items-center hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center mr-4">
                <i className="fas fa-reply text-white text-lg"></i>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-600">Replied</h3>
                <div className="text-2xl font-bold text-gray-900">{emailStats.replied}</div>
                <div className="text-sm font-semibold text-green-600">{replyRate}%</div>
              </div>
            </div>

            {/* Bounced */}
            <div className="bg-white rounded-xl shadow-sm p-4 flex items-center hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center mr-4">
                <i className="fas fa-exclamation-circle text-white text-lg"></i>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-600">Bounced</h3>
                <div className="text-2xl font-bold text-gray-900">{emailStats.bounced}</div>
                <div className="text-sm font-semibold text-red-600">{bounceRate}%</div>
              </div>
            </div>
          </div>

          {/* Campaign Performance */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">Campaign Performance</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
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
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Engagement Over Time */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-6">Engagement Over Time</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
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
            </div>

            {/* Device Distribution */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-6">Device Distribution</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
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
          </div>
        </div>
      )}

      {activeTab === 'spam' && (
        <SpamAnalytics selectedAccount={selectedAccount} />
      )}

      {activeTab === 'account' && (
        <AccountAnalytics
          selectedAccount={selectedAccount}
          accountScores={accountScores}
          getDeliverabilityData={getDeliverabilityData}
        />
      )}

      {/* Footer */}
      <div className="mt-8 pt-6 border-t border-gray-200 text-center text-gray-600 text-sm">
        © Email Analytics Dashboard
      </div>

      {/* Inject Font Awesome for icons */}
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css" />
    </div>
  );
};

export default AnalyticsDashboard;