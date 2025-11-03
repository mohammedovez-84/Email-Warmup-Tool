import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { FiDownload, FiMail, FiInbox, FiAlertTriangle, FiCheck } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { FiBarChart2 } from 'react-icons/fi';

// API Service
const analyticsApi = {
  getDashboardData: async (accountId, timeRange = '7d') => {
    // TODO: Replace with actual API call
    // const response = await fetch(`/api/analytics/dashboard?account_id=${accountId}&time_range=${timeRange}`);
    // return response.json();
    
    // Mock data - remove when API is ready
    return new Promise(resolve => setTimeout(() => resolve({
      stats: {
        sent: 1876,
        delivered: 1782,
        inbox: 1675,
        spam: 107,
        deliverability: 94
      },
      health_distribution: [
        { name: 'Excellent', value: 40, color: '#059669' },
        { name: 'Good', value: 30, color: '#2563EB' },
        { name: 'Fair', value: 20, color: '#D97706' },
        { name: 'Needs Improvement', value: 10, color: '#DC2626' }
      ],
      performance_timeline: [
        { name: 'Monday', sent: 400, inbox: 380, spam: 20, deliverability: 95 },
        { name: 'Tuesday', sent: 450, inbox: 405, spam: 45, deliverability: 90 },
        { name: 'Wednesday', sent: 500, inbox: 450, spam: 50, deliverability: 90 },
        { name: 'Thursday', sent: 550, inbox: 495, spam: 55, deliverability: 90 },
        { name: 'Friday', sent: 600, inbox: 540, spam: 60, deliverability: 90 },
        { name: 'Saturday', sent: 350, inbox: 315, spam: 35, deliverability: 90 },
        { name: 'Sunday', sent: 300, inbox: 270, spam: 30, deliverability: 90 }
      ]
    }), 500));
  }
};

// Ultra Stable Pie Chart Component
const UltraStablePieChart = ({ data }) => {
  const COLORS = ['#059669', '#2563EB', '#D97706', '#DC2626'];

  const renderCustomizedLabel = ({
    cx, cy, midAngle, innerRadius, outerRadius, percent, index
  }) => {
    if (percent < 0.05) return null;
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="rgba(255, 255, 255, 0.85)"
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        className="text-xs font-medium"
        fontSize={11}
        style={{
          textShadow: '0px 1px 2px rgba(0, 0, 0, 0.3)',
          fontWeight: 500
        }}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row items-center justify-between gap-6 lg:gap-8">
      <div className="w-full lg:flex-1">
        <div className="h-64 sm:h-72 lg:h-80 xl:h-96">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomizedLabel}
                outerRadius="75%"
                innerRadius="40%"
                fill="#8884d8"
                dataKey="value"
                isAnimationActive={true}
                animationBegin={100}
                animationDuration={800}
                animationEasing="ease-out"
                paddingAngle={1}
              >
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[index % COLORS.length]} 
                    stroke="#ffffff"
                    strokeWidth={1.5}
                  />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value, name) => [`${value}%`, name]}
                contentStyle={{ 
                  borderRadius: '8px', 
                  border: '1px solid #E5E7EB',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  fontFamily: 'inherit',
                  backgroundColor: 'white'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="w-full lg:flex-1 space-y-3 lg:space-y-4">
        {data.map((item, index) => (
          <div key={item.name} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:shadow-sm transition-all duration-200">
            <div className="flex items-center gap-3">
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.color }}
              ></div>
              <span className="text-sm font-medium text-gray-700">{item.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-gray-600 tracking-tight">
                {item.value}%
              </span>
              <div className="w-12 bg-gray-200 rounded-full h-2">
                <div 
                  className="h-2 rounded-full transition-all duration-500"
                  style={{ 
                    width: `${item.value}%`,
                    backgroundColor: item.color
                  }}
                ></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Analytics Statistics Cards Component
const AnalyticsStatisticsCards = ({ emailStats, deliveryRate, inboxRate, spamRate }) => {
  const statCards = [
    {
      label: "Sent",
      value: emailStats.sent,
      percentage: 100,
      trend: "Total emails sent",
      icon: FiMail,
      color: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      label: "Delivered",
      value: emailStats.delivered,
      percentage: deliveryRate,
      trend: "Increase compared to last week",
      icon: FiCheck,
      color: "text-green-600",
      bgColor: "bg-green-50"
    },
    {
      label: "Landed in Inbox",
      value: emailStats.inbox,
      percentage: inboxRate,
      trend: "Increase compared to last week",
      icon: FiInbox,
      color: "text-purple-600",
      bgColor: "bg-purple-50"
    },
    {
      label: "Landed in Spam",
      value: emailStats.spam,
      percentage: spamRate,
      trend: "Decreased compared to last week",
      icon: FiAlertTriangle,
      color: "text-orange-600",
      bgColor: "bg-orange-50"
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {statCards.map((card, index) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="relative bg-white border border-gray-200 rounded-xl p-4 transition-all duration-300 hover:shadow-md group"
        >
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 to-teal-600 rounded-b-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          
          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 opacity-0 group-hover:opacity-5 transition-opacity duration-300"></div>
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 ${card.bgColor} rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                <card.icon className={`text-lg ${card.color}`} />
              </div>
              <span className="text-sm font-medium text-gray-500">{card.label}</span>
            </div>

            <div className="flex items-end justify-between mb-2">
              <p className={`text-xl font-bold ${card.color} antialiased subpixel-antialiased`}>{card.value}</p>
              <p className="text-lg font-semibold text-teal-600 antialiased">
                {card.percentage}%
              </p>
            </div>

            <div className="flex items-center">
              <span className="text-sm text-gray-500 truncate antialiased">
                {card.trend}
              </span>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

// Main Analytics Dashboard Component
const AnalyticsDashboard = () => {
  const [dashboardData, setDashboardData] = useState({
    stats: {
      sent: 0,
      delivered: 0,
      inbox: 0,
      spam: 0,
      deliverability: 0
    },
    health_distribution: [],
    performance_timeline: []
  });
  
  const [isExporting, setIsExporting] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState('7d');

  // Load dashboard data
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const data = await analyticsApi.getDashboardData(1, selectedTimeRange);
        setDashboardData(data);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      }
    };

    loadDashboardData();
  }, [selectedTimeRange]);

const handleExportReport = async () => {
  setIsExporting(true);
  try {
    // Safe data extraction
    const safeStats = stats || {};
    const safeHealthDistribution = health_distribution || [];
    const safePerformanceTimeline = performance_timeline || [];
    
    // Safe calculations
    const safeDeliveryRate = safeStats.sent > 0 ? 
      ((safeStats.delivered / safeStats.sent) * 100).toFixed(1) : 0;
    const safeInboxRate = safeStats.delivered > 0 ? 
      ((safeStats.inbox / safeStats.delivered) * 100).toFixed(1) : 0;
    const safeSpamRate = safeStats.delivered > 0 ? 
      ((safeStats.spam / safeStats.delivered) * 100).toFixed(1) : 0;

    // Create a simple professional HTML report
    const reportHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Email Analytics Report - ${new Date().toLocaleDateString()}</title>
          <style>
              * {
                  margin: 0;
                  padding: 0;
                  box-sizing: border-box;
              }
              
              body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                  background: #f8fafc;
                  color: #334155;
                  line-height: 1.5;
                  padding: 20px;
              }
              
              .report-container {
                  max-width: 900px;
                  margin: 0 auto;
                  background: white;
                  border-radius: 8px;
                  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                  overflow: hidden;
              }
              
              .report-header {
                  background: #0d9488;
                  color: white;
                  padding: 20px;
                  text-align: center;
              }
              
              .report-title {
                  font-size: 1.5em;
                  font-weight: 600;
                  margin-bottom: 6px;
              }
              
              .report-subtitle {
                  font-size: 1em;
                  opacity: 0.9;
              }
              
              .report-meta {
                  background: #f0fdfa;
                  padding: 20px 30px;
                  border-bottom: 1px solid #e2e8f0;
                  font-size: 0.9em;
                  display: flex;
                  justify-content: space-between;
              }
              
              .stats-grid {
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                  gap: 16px;
                  padding: 30px;
              }
              
              .stat-card {
                  background: white;
                  padding: 20px;
                  border-radius: 6px;
                  text-align: center;
                  border: 1px solid #e2e8f0;
              }
              
              .stat-value {
                  font-size: 1.8em;
                  font-weight: 700;
                  color: #0d9488;
                  margin-bottom: 4px;
              }
              
              .stat-label {
                  font-size: 0.85em;
                  color: #64748b;
                  font-weight: 500;
              }
              
              .stat-percentage {
                  font-size: 0.8em;
                  color: #0d9488;
                  font-weight: 500;
                  margin-top: 6px;
              }
              
              .section {
                  padding: 30px;
                  border-bottom: 1px solid #e2e8f0;
              }
              
              .section:last-child {
                  border-bottom: none;
              }
              
              .section-title {
                  font-size: 1.2em;
                  font-weight: 600;
                  color: #0f766e;
                  margin-bottom: 20px;
                  padding-bottom: 8px;
                  border-bottom: 2px solid #0d9488;
              }
              
              .health-distribution {
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                  gap: 12px;
              }
              
              .health-item {
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  padding: 12px 16px;
                  background: white;
                  border-radius: 6px;
                  border: 1px solid #e2e8f0;
              }
              
              .health-info {
                  display: flex;
                  align-items: center;
                  gap: 10px;
              }
              
              .health-color {
                  width: 12px;
                  height: 12px;
                  border-radius: 50%;
              }
              
              .health-name {
                  font-weight: 500;
                  color: #374151;
              }
              
              .health-value {
                  font-weight: 600;
                  color: #0d9488;
              }
              
              .performance-table {
                  width: 100%;
                  border-collapse: collapse;
                  background: white;
                  border-radius: 6px;
                  overflow: hidden;
                  border: 1px solid #e2e8f0;
              }
              
              .performance-table th {
                  background: #f0fdfa;
                  color: #0f766e;
                  padding: 12px 16px;
                  text-align: left;
                  font-weight: 600;
                  font-size: 0.85em;
                  border-bottom: 1px solid #e2e8f0;
              }
              
              .performance-table td {
                  padding: 12px 16px;
                  border-bottom: 1px solid #f1f5f9;
                  font-size: 0.9em;
              }
              
              .performance-table tr:last-child td {
                  border-bottom: none;
              }
              
              .positive {
                  color: #0d9488;
                  font-weight: 500;
              }
              
              .summary-box {
                  background: #f0fdfa;
                  padding: 20px;
                  border-radius: 6px;
                  border-left: 4px solid #0d9488;
              }
              
              .summary-title {
                  font-weight: 600;
                  color: #0f766e;
                  margin-bottom: 8px;
              }
              
              .report-footer {
                  background: #134e4a;
                  color: white;
                  padding: 20px 30px;
                  text-align: center;
              }
              
              .footer-text {
                  opacity: 0.8;
                  font-size: 0.85em;
              }
              
              @media (max-width: 768px) {
                  body {
                      padding: 10px;
                  }
                  
                  .report-meta {
                      flex-direction: column;
                      gap: 8px;
                  }
                  
                  .stats-grid {
                      grid-template-columns: 1fr;
                      padding: 20px;
                  }
                  
                  .section {
                      padding: 20px;
                  }
              }
          </style>
      </head>
      <body>
          <div class="report-container">
              <!-- Header -->
              <div class="report-header">
                  <h1 class="report-title">Email Analytics Report</h1>
                  <p class="report-subtitle">Performance Summary</p>
              </div>
              
              <!-- Meta Information -->
              <div class="report-meta">
                  <div>Generated: ${new Date().toLocaleDateString()}</div>
                  <div>Period: ${selectedTimeRange === '7d' ? 'Last 7 Days' : selectedTimeRange === '30d' ? 'Last 30 Days' : 'Last 90 Days'}</div>
                  <div>ID: ${Math.random().toString(36).substr(2, 9).toUpperCase()}</div>
              </div>
              
              <!-- Statistics Grid -->
              <div class="stats-grid">
                  <div class="stat-card">
                      <div class="stat-value">${(safeStats.sent || 0).toLocaleString()}</div>
                      <div class="stat-label">Emails Sent</div>
                  </div>
                  <div class="stat-card">
                      <div class="stat-value">${(safeStats.delivered || 0).toLocaleString()}</div>
                      <div class="stat-label">Delivered</div>
                      <div class="stat-percentage">${safeDeliveryRate}% success rate</div>
                  </div>
                  <div class="stat-card">
                      <div class="stat-value">${(safeStats.inbox || 0).toLocaleString()}</div>
                      <div class="stat-label">Inbox Placement</div>
                      <div class="stat-percentage">${safeInboxRate}% of delivered</div>
                  </div>
                  <div class="stat-card">
                      <div class="stat-value">${(safeStats.spam || 0).toLocaleString()}</div>
                      <div class="stat-label">Spam Placement</div>
                      <div class="stat-percentage">${safeSpamRate}% of delivered</div>
                  </div>
              </div>
              
              <!-- Email Health Overview -->
              <div class="section">
                  <h2 class="section-title">Email Health Distribution</h2>
                  <div class="health-distribution">
                      ${safeHealthDistribution.map(item => `
                          <div class="health-item">
                              <div class="health-info">
                                  <div class="health-color" style="background-color: ${item?.color || '#cccccc'}"></div>
                                  <span class="health-name">${item?.name || 'Unknown'}</span>
                              </div>
                              <div class="health-value">${item?.value || 0}%</div>
                          </div>
                      `).join('')}
                  </div>
              </div>
              
              <!-- Performance Timeline -->
              <div class="section">
                  <h2 class="section-title">Performance Timeline</h2>
                  <table class="performance-table">
                      <thead>
                          <tr>
                              <th>Date</th>
                              <th>Sent</th>
                              <th>Inbox</th>
                              <th>Spam</th>
                              <th>Rate</th>
                          </tr>
                      </thead>
                      <tbody>
                          ${safePerformanceTimeline.map(day => `
                              <tr>
                                  <td>${day?.name || 'Unknown'}</td>
                                  <td>${(day?.sent || 0).toLocaleString()}</td>
                                  <td>${(day?.inbox || 0).toLocaleString()}</td>
                                  <td>${(day?.spam || 0).toLocaleString()}</td>
                                  <td class="positive">${day?.deliverability || 0}%</td>
                              </tr>
                          `).join('')}
                      </tbody>
                  </table>
              </div>
              
              <!-- Summary -->
              <div class="section">
                  <h2 class="section-title">Summary</h2>
                  <div class="summary-box">
                      <div class="summary-title">Overall Performance</div>
                      <p>Your email warmup is showing good results with a ${safeDeliveryRate}% delivery rate and ${safeInboxRate}% inbox placement rate. Continue following the current warmup strategy for optimal performance.</p>
                  </div>
              </div>
              
              <!-- Footer -->
              <div class="report-footer">
                  <p class="footer-text">
                      Generated by Email Analytics System • ${new Date().getFullYear()}
                  </p>
              </div>
          </div>
      </body>
      </html>
    `;

    // Create and download the HTML file
    const blob = new Blob([reportHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `email-report-${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log('📄 Report exported successfully!');
    
  } catch (error) {
    console.error('Export failed:', error);
    alert('Failed to export report. Please try again.');
  } finally {
    setIsExporting(false);
  }
};

  const { stats, health_distribution, performance_timeline } = dashboardData;

  const deliveryRate = stats.sent > 0 ? ((stats.delivered / stats.sent) * 100).toFixed(1) : 0;
  const inboxRate = stats.delivered > 0 ? ((stats.inbox / stats.delivered) * 100).toFixed(1) : 0;
  const spamRate = stats.delivered > 0 ? ((stats.spam / stats.delivered) * 100).toFixed(1) : 0;

  return (
    <div className="min-h-screen text-gray-900 flex justify-center items-start p-4 sm:p-6 font-['Inter',_'Roboto',_-apple-system,_BlinkMacSystemFont,_'Segoe_UI',_sans-serif]">
      <div className="w-full">
        <div className="space-y-6 sm:space-y-8 pt-5">
          {/* Stats Cards */}
          <AnalyticsStatisticsCards 
            emailStats={stats}
            deliveryRate={deliveryRate}
            inboxRate={inboxRate}
            spamRate={spamRate}
          />

          {/* Email Health Overview */}
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-200 border-t-8 border-t-teal-500 overflow-hidden w-full">
            <div className="bg-white px-4 sm:px-5 py-3 sm:py-4">
              <h2 className="text-xl md:text-2xl font-bold text-center flex items-center justify-center gap-2 sm:gap-3 pt-5">
                <div className="inline-flex items-center justify-center w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg md:rounded-xl shadow-sm">
                  <FiBarChart2 className="text-white w-4 h-4 md:w-5 md:h-5" />
                </div>
                <span className="bg-gradient-to-r from-teal-600 to-teal-700 bg-clip-text text-transparent inline-block">
                  Email Health Overview
                </span>
              </h2>
            </div>
            <div className="p-3 sm:p-4 lg:p-5">
              <UltraStablePieChart data={health_distribution} />
            </div>
          </div>

          {/* Warmup Performance Chart */}
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-200 overflow-hidden w-full">
            <div className="border-b border-gray-200 bg-gradient-to-r from-teal-50 to-teal-100 px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-700 flex items-center gap-2 sm:gap-3">
                  <i className="fas fa-trending-up text-teal-600 text-lg sm:text-xl"></i>
                  {selectedTimeRange === '7d' && 'Daily Warmup Performance'}
                  {selectedTimeRange === '30d' && 'Weekly Warmup Performance'}
                  {selectedTimeRange === '90d' && 'Monthly Warmup Performance'}
                </h2>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <select 
                    value={selectedTimeRange}
                    onChange={(e) => setSelectedTimeRange(e.target.value)}
                    className="px-3 sm:px-4 py-2 border border-gray-300 rounded-lg sm:rounded-xl bg-white text-gray-700 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition-all text-xs sm:text-sm"
                  >
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                  </select>
                  <button 
                    className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2 border-none rounded-lg sm:rounded-xl font-semibold transition-all duration-300 bg-gradient-to-r from-teal-600 to-teal-700 text-white shadow-md hover:from-teal-700 hover:to-teal-800 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer text-xs sm:text-sm ${
                      isExporting ? 'opacity-70 cursor-not-allowed' : ''
                    }`}
                    onClick={handleExportReport}
                    disabled={isExporting}
                  >
                    <FiDownload className={isExporting ? 'animate-spin' : ''} />
                    {isExporting ? 'Exporting...' : 'Export Report'}
                  </button>
                </div>
              </div>
            </div>
            
            <div className="p-4 sm:p-6 lg:p-8">
              <div className="h-64 sm:h-72 lg:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={performance_timeline}
                    margin={{ 
                      top: 20, 
                      right: 10, 
                      left: 10, 
                      bottom: 25 
                    }}
                  >
                    <CartesianGrid 
                      strokeDasharray="3 3" 
                      vertical={false} 
                      stroke="#f0f0f0"
                      strokeWidth={0.5}
                    />
                    
                    <XAxis 
                      dataKey="name" 
                      tick={{ 
                        fontSize: 12,
                        fill: '#6B7280',
                        fontWeight: 500,
                      }}
                      axisLine={{ stroke: '#E5E7EB', strokeWidth: 1 }}
                      tickLine={{ stroke: '#E5E7EB' }}
                      tickMargin={10}
                    />
                    
                    <YAxis 
                      tick={{ 
                        fontSize: 12,
                        fill: '#6B7280',
                        fontWeight: 500,
                      }}
                      axisLine={{ stroke: '#E5E7EB', strokeWidth: 1 }}
                      tickLine={{ stroke: '#E5E7EB' }}
                      tickMargin={10}
                      tickFormatter={(value) => value.toLocaleString()}
                    />
                    
                    <Tooltip 
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #E5E7EB',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                        background: 'white',
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
                    
                    <Legend 
                      verticalAlign="top"
                      height={36}
                      iconSize={12}
                      iconType="circle"
                      wrapperStyle={{
                        paddingBottom: '20px',
                        fontSize: '13px',
                        fontWeight: '600'
                      }}
                      formatter={(value) => (
                        <span className="text-gray-700 text-sm font-medium">{value}</span>
                      )}
                    />
                    
                    <Bar 
                      dataKey="inbox" 
                      name="Landed in Inbox"
                      radius={[4, 4, 0, 0]}  
                      fill="url(#inboxGradient)"
                      animationBegin={0}
                      animationDuration={400} 
                      animationEasing="ease-out"
                      barSize={28}
                    >
                      {performance_timeline.map((entry, index) => (  
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
                      radius={[4, 4, 0, 0]}  
                      fill="url(#spamGradient)"
                      animationBegin={150} 
                      animationDuration={400} 
                      animationEasing="ease-out"
                      barSize={28}
                    >
                      {performance_timeline.map((entry, index) => (  
                        <Cell 
                          key={`spam-${index}`} 
                          fill="url(#spamGradient)"
                          opacity={0.9}
                        />
                      ))}
                    </Bar>

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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;