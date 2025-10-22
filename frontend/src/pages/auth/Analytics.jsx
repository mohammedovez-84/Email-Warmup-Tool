import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { FiPieChart, FiBarChart2, FiInfo, FiExternalLink, FiRefreshCw, FiDownload, FiMail, FiInbox, FiFilter, FiAlertTriangle, FiCheck, FiX } from 'react-icons/fi';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';

// Health Distribution Item Component
const HealthDistributionItem = ({ item, index }) => (
  <div key={item.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-white transition-colors duration-200">
    <div className="flex items-center space-x-3">
      <div 
        className="w-4 h-4 rounded-full" 
        style={{ backgroundColor: item.color }}
      />
      <span className="font-medium text-gray-700 text-sm">{item.name}</span>
    </div>
    <div className="flex items-center space-x-2">
      <span className="text-sm font-semibold text-gray-900">{item.value}%</span>
      <div className="w-16 bg-gray-200 rounded-full h-2">
        <div 
          className="h-2 rounded-full transition-all duration-500"
          style={{ 
            width: `${item.value}%`,
            backgroundColor: item.color
          }}
        />
      </div>
    </div>
  </div>
);

// Beautiful Pie Chart Component - Updated layout with pie chart on left
const EmailHealthPieChart = () => {
  const pieData = [
    { name: 'Excellent', value: 35, color: '#059669' },
    { name: 'Good', value: 25, color: '#2563EB' },
    { name: 'Fair', value: 20, color: '#D97706' },
    { name: 'Needs Improvement', value: 15, color: '#DC2626' },
    { name: 'Critical', value: 5, color: '#7F1D1D' }
  ];

  const COLORS = ['#059669', '#2563EB', '#D97706', '#DC2626', '#7F1D1D'];

  const renderCustomizedLabel = ({
    cx, cy, midAngle, innerRadius, outerRadius, percent, index
  }) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        className="text-xs font-semibold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
      {/* Left Pie Chart */}
      <div className="flex-1">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomizedLabel}
                outerRadius={120}
                fill="#8884d8"
                dataKey="value"
                startAngle={90}
                endAngle={-270}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value, name) => [`${value}%`, name]}
                contentStyle={{ 
                  borderRadius: '8px', 
                  border: '1px solid #E5E7EB',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  fontFamily: 'inherit'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Right Health Distribution - All 4 items */}
      <div className="flex-1 space-y-4">
        {pieData.slice(0, 4).map((item, index) => (
          <HealthDistributionItem key={item.name} item={item} index={index} />
        ))}
      </div>
    </div>
  );
};

// Updated Stats Card Component
const StatsCard = ({ title, value, percentage, trend }) => {
  const isPositive = trend?.toLowerCase().includes('increase') || 
                    trend?.toLowerCase().includes('improved') || 
                    trend?.toLowerCase().includes('better');
  
  const isNegative = trend?.toLowerCase().includes('decrease') || 
                    trend?.toLowerCase().includes('decreased') || 
                    trend?.toLowerCase().includes('worse');

  const getBorderColor = () => {
    if (percentage >= 90) return 'border-l-green-300 border-t-green-300 border-r-green-50 border-b-green-50';
    if (percentage >= 70) return 'border-l-blue-300 border-t-blue-300 border-r-blue-50 border-b-blue-50';
    if (percentage >= 50) return 'border-l-amber-300 border-t-amber-300 border-r-amber-50 border-b-amber-50';
    return 'border-l-red-300 border-t-red-300 border-r-red-50 border-b-red-50';
  };

  return (
    <div className={`bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-all duration-300 border-2 ${getBorderColor()} hover:scale-105 transform transition-transform`}>
      <div className="flex flex-col h-full">
        <h3 className="text-sm font-normal text-gray-500 mb-1 tracking-wide">{title}</h3>
        <div className="flex items-center justify-between flex-grow">
          <div>
            <div className="text-xl font-semibold text-gray-900 mb-1">{value}</div>
            <div className={`text-xs font-medium ${
              percentage >= 90 ? 'text-green-600' : 
              percentage >= 70 ? 'text-blue-600' : 
              percentage >= 50 ? 'text-amber-600' : 'text-red-600'
            }`}>
              {percentage}%
            </div>
          </div>
        </div>
        {trend && (
          <div className={`mt-1 text-xs flex items-center font-normal ${
            isPositive ? 'text-green-600' : 
            isNegative ? 'text-red-600' : 'text-gray-500'
          }`}>
            {isPositive && <span className="mr-1">▲</span>}
            {isNegative && <span className="mr-1">▼</span>}
            {trend}
          </div>
        )}
      </div>
    </div>
  );
};

// Main Analytics Dashboard Component
const AnalyticsDashboard = () => {
  const [emailStats, setEmailStats] = useState({
    sent: 1876,
    delivered: 1782,
    inbox: 1675,
    spam: 107,
    deliverability: 94
  });

  const [accountHealth, setAccountHealth] = useState({
    score: 82,
    status: 'Good',
    issues: ['High bounce rate', 'Low engagement']
  });

  const [campaignPerformance, setCampaignPerformance] = useState([
    { name: 'Monday', sent: 400, inbox: 380, spam: 20, deliverability: 95 },
    { name: 'Tuesday', sent: 450, inbox: 405, spam: 45, deliverability: 90 },
    { name: 'Wednesday', sent: 500, inbox: 450, spam: 50, deliverability: 90 },
    { name: 'Thursday', sent: 550, inbox: 495, spam: 55, deliverability: 90 },
    { name: 'Friday', sent: 600, inbox: 540, spam: 60, deliverability: 90 }
  ]);

  const [currentTime, setCurrentTime] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [isExporting, setIsExporting] = useState(false);

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

  const BAR_COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

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

  const handleRefreshData = () => {
    const newEmailStats = {
      sent: Math.floor(1000 + Math.random() * 500),
      delivered: Math.floor(900 + Math.random() * 400),
      inbox: Math.floor(800 + Math.random() * 300),
      spam: Math.floor(10 + Math.random() * 50),
      deliverability: Math.floor(85 + Math.random() * 15)
    };

    setEmailStats(newEmailStats);
    
    setAccountScores({
      1: { 
        score: Math.floor(70 + Math.random() * 30), 
        reputation: Math.random() > 0.3 ? 'good' : 'excellent' 
      }
    });

    setSelectedAccount(prev => ({
      ...prev,
      lastActive: new Date().toISOString()
    }));
  };

  const handleExportReport = async () => {
    setIsExporting(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const exportData = {
      emailStats,
      campaignPerformance,
      accountData: selectedAccount,
      accountScore: accountScores[1],
      timestamp: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `email-analytics-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    alert('Report exported successfully!');
    setIsExporting(false);
  };

  const deliveryRate = ((emailStats.delivered / emailStats.sent) * 100).toFixed(1);
  const inboxRate = ((emailStats.inbox / emailStats.delivered) * 100).toFixed(1);
  const spamRate = ((emailStats.spam / emailStats.delivered) * 100).toFixed(1);

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans antialiased">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Email Warmup Analytics</h1>
        </div>
        <div className="flex gap-3">
          <select className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-normal text-sm">
            <option>Last 7 days</option>
            <option>Last 30 days</option>
            <option>Last 90 days</option>
          </select>
          <button 
            className={`flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-800 to-teal-600 text-white rounded-lg font-medium shadow-md hover:shadow-lg hover:from-teal-500 to-teal-300 transition-all duration-200 text-sm ${
              isExporting ? 'opacity-75 cursor-not-allowed' : ''
            }`}
            onClick={handleExportReport}
            disabled={isExporting}
          >
            <FiDownload size={16} className={isExporting ? 'animate-spin' : ''} />
            {isExporting ? 'Exporting...' : 'Export Report'}
          </button>
        </div>
      </div>

      {/* Content */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Email Warmup Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Sent"
              value={emailStats.sent}
              percentage={100}
              trend="Total emails sent"
            />
            
            <StatsCard
              title="Delivered"
              value={emailStats.delivered}
              percentage={deliveryRate}
              trend="Increase compared to last week"
            />
            
            <StatsCard
              title="Landed in Inbox"
              value={emailStats.inbox}
              percentage={inboxRate}
              trend="Increase compared to last week"
            />
            
            <StatsCard
              title="Landed in Spam"
              value={emailStats.spam}
              percentage={spamRate}
              trend="Decreased compared to last week"
            />
          </div>

          {/* Email Health Pie Chart Section - Updated without summary stats */}
          <div className="bg-white rounded-xl shadow-sm p-7 border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Email Health Overview</h2>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <FiInfo size={16} />
                <span>Distribution of email performance across all metrics</span>
              </div>
            </div>
            
            <EmailHealthPieChart />
            {/* Summary Stats component removed from here */}
          </div>

          {/* Campaign Performance - Enhanced Design */}
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100 hover:shadow-xl transition-all duration-300">
            {/* Header with enhanced styling */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8">
              <div className="mb-4 lg:mb-0">
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                  Campaign Performance
                </h2>
                <p className="text-gray-600 mt-2 text-sm font-medium">Weekly email deliverability metrics and trends</p>
              </div>
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2 bg-blue-50 px-3 py-2 rounded-lg border border-blue-100">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-sm font-medium text-blue-700">Real-time Data</span>
                </div>
                
              </div>
            </div>

            {/* Enhanced Chart Container */}
            <div className="h-80 relative">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={campaignPerformance}
                  margin={{ top: 20, right: 30, left: 20, bottom: 25 }}
                >
                  {/* Enhanced Cartesian Grid */}
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    vertical={false} 
                    stroke="#f0f0f0"
                    strokeWidth={0.5}
                  />
                  
                  {/* Enhanced XAxis */}
                  <XAxis 
                    dataKey="name" 
                    tick={{ 
                      fontSize: 13, 
                      fill: '#6B7280',
                      fontWeight: 500,
                      fontFamily: 'inherit'
                    }}
                    axisLine={{ stroke: '#E5E7EB', strokeWidth: 1 }}
                    tickLine={{ stroke: '#E5E7EB' }}
                    tickMargin={10}
                  />
                  
                  {/* Enhanced YAxis */}
                  <YAxis 
                    tick={{ 
                      fontSize: 13, 
                      fill: '#6B7280',
                      fontWeight: 500,
                      fontFamily: 'inherit'
                    }}
                    axisLine={{ stroke: '#E5E7EB', strokeWidth: 1 }}
                    tickLine={{ stroke: '#E5E7EB' }}
                    tickMargin={10}
                    tickFormatter={(value) => value.toLocaleString()}
                  />
                  
                  {/* Enhanced Tooltip */}
                  <Tooltip 
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #E5E7EB',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                      background: 'rgba(255, 255, 255, 0.95)',
                      backdropFilter: 'blur(8px)',
                      fontFamily: 'inherit',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                    cursor={{ fill: 'rgba(243, 244, 246, 0.5)' }}
                    formatter={(value, name) => [
                      <span key="value" className="font-semibold text-gray-900">{value.toLocaleString()}</span>, 
                      name
                    ]}
                    labelFormatter={(label) => (
                      <span className="font-semibold text-gray-900">{label}</span>
                    )}
                  />
                  
                  {/* Enhanced Legend */}
                  <Legend 
                    verticalAlign="top"
                    height={36}
                    iconSize={12}
                    iconType="circle"
                    wrapperStyle={{
                      paddingBottom: '20px',
                      fontFamily: 'inherit',
                      fontSize: '13px',
                      fontWeight: '600'
                    }}
                    formatter={(value) => (
                      <span className="text-gray-700 text-sm font-medium">{value}</span>
                    )}
                  />
                  
                  {/* Enhanced Bars with gradients and animations */}
                  <Bar 
                    dataKey="inbox" 
                    name="Landed in Inbox"
                    radius={[6, 6, 0, 0]}
                    fill="url(#inboxGradient)"
                    animationBegin={0}
                    animationDuration={1500}
                    animationEasing="ease-out"
                  >
                    {campaignPerformance.map((entry, index) => (
                      <Cell 
                        key={`inbox-${index}`}
                        fill="url(#inboxGradient)"
                        opacity={0.9}
                      />
                    ))}
                  </Bar>
                  
                  <Bar 
                    dataKey="spam" 
                    name="Landed in Spam"
                    radius={[6, 6, 0, 0]}
                    fill="url(#spamGradient)"
                    animationBegin={400}
                    animationDuration={1500}
                    animationEasing="ease-out"
                  >
                    {campaignPerformance.map((entry, index) => (
                      <Cell 
                        key={`spam-${index}`}
                        fill="url(#spamGradient)"
                        opacity={0.9}
                      />
                    ))}
                  </Bar>

                  {/* SVG Gradients for beautiful bar colors */}
                  <defs>
                    <linearGradient id="inboxGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#059669" stopOpacity={0.9} />
                    </linearGradient>
                    <linearGradient id="spamGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#EF4444" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#DC2626" stopOpacity={0.9} />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Enhanced Performance Summary */}
            <div className="mt-8 pt-6 border-t border-gray-100">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100">
                  <div className="text-2xl font-bold text-gray-900 mb-1">
                    {campaignPerformance.reduce((sum, day) => sum + day.inbox, 0).toLocaleString()}
                  </div>
                  <div className="text-sm font-semibold text-green-700 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                    Total Inbox
                  </div>
                </div>
                
                <div className="text-center p-4 bg-gradient-to-br from-red-50 to-rose-50 rounded-xl border border-red-100">
                  <div className="text-2xl font-bold text-gray-900 mb-1">
                    {campaignPerformance.reduce((sum, day) => sum + day.spam, 0).toLocaleString()}
                  </div>
                  <div className="text-sm font-semibold text-red-700 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-red-500 mr-2"></div>
                    Total Spam
                  </div>
                </div>
                
                <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border border-blue-100">
                  <div className="text-2xl font-bold text-gray-900 mb-1">
                    {Math.round(
                      (campaignPerformance.reduce((sum, day) => sum + day.inbox, 0) / 
                       campaignPerformance.reduce((sum, day) => sum + day.sent, 0)) * 100
                    )}%
                  </div>
                  <div className="text-sm font-semibold text-blue-700 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mr-2"></div>
                    Avg. Inbox Rate
                  </div>
                </div>
              </div>
            </div>

            {/* Trend Indicator */}
            <div className="mt-6 flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2 text-gray-600">
                <FiInfo size={16} />
                <span>Compared to previous week</span>
              </div>
              <div className="flex items-center space-x-1 text-green-600 font-semibold">
                <span>▲ 12.5%</span>
                <span>Improvement</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Styles for consistent typography and smoothness */}
      <style jsx global>{`
        * {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }
        
        body {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        
        .transition-smooth {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .font-sans {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }
      `}</style>
    </div>
  );
};

export default AnalyticsDashboard;