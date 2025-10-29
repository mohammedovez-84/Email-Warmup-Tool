import React, { useState, useEffect,} from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell,} from 'recharts';
import { FiDownload, FiMail, FiInbox, FiAlertTriangle, FiCheck,} from 'react-icons/fi';
import { motion } from 'framer-motion';
import 'react-circular-progressbar/dist/styles.css';

// API PLACEHOLDER - Add your API calls here later
const API = {
  // TODO: Replace with actual API calls
  fetchEmailStats: async () => {
    // return await fetch('/api/email-stats').then(res => res.json());
    return {
      sent: 1876,
      delivered: 1782,
      inbox: 1675,
      spam: 107,
      deliverability: 94
    };
  },

  fetchAccountHealth: async () => {
    // return await fetch('/api/account-health').then(res => res.json());
    return {
      score: 82,
      status: 'Good',
      issues: ['High bounce rate', 'Low engagement']
    };
  },
  
  fetchWarmupPerformance: async () => {
    // return await fetch('/api/warmup-performance').then(res => res.json());
    return [
      { name: 'Monday', sent: 400, inbox: 380, spam: 20, deliverability: 95 },
      { name: 'Tuesday', sent: 450, inbox: 405, spam: 45, deliverability: 90 },
      { name: 'Wednesday', sent: 500, inbox: 450, spam: 50, deliverability: 90 },
      { name: 'Thursday', sent: 550, inbox: 495, spam: 55, deliverability: 90 },
      { name: 'Friday', sent: 600, inbox: 540, spam: 60, deliverability: 90 },
      { name: 'Saturday', sent: 350, inbox: 315, spam: 35, deliverability: 90 },
      { name: 'Sunday', sent: 300, inbox: 270, spam: 30, deliverability: 90 }
    ];
  },

  exportReport: async (data) => {
    // TODO: Replace with actual export API call
    // return await fetch('/api/export-report', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(data)
    // });
    return new Promise(resolve => setTimeout(resolve, 2000));
  }
};

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

// Ultra Stable Pie Chart with Smooth Initial Animation
const UltraStablePieChart = () => {
  const [animationCompleted, setAnimationCompleted] = useState(false);
  
  const pieData = [
    { name: 'Excellent', value: 40, color: '#059669' },
    { name: 'Good', value: 30, color: '#2563EB' },
    { name: 'Fair', value: 20, color: '#D97706' },
    { name: 'Needs Improvement', value: 10, color: '#DC2626' }
  ];

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
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        className="text-xs font-semibold"
        fontSize={12}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  // Set animation as completed after the initial animation finishes
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimationCompleted(true);
    }, 1000); // Match this with animationDuration

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col lg:flex-row items-center justify-between gap-6 lg:gap-8">
      <div className="w-full lg:flex-1">
        <div className="h-64 sm:h-72 lg:h-80 xl:h-96">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomizedLabel}
                outerRadius="75%"
                innerRadius="40%"
                fill="#8884d8"
                dataKey="value"
                isAnimationActive={true} // Keep animation active for initial load
                animationBegin={100}
                animationDuration={800} // Smooth closing line animation
                animationEasing="ease-out"
                paddingAngle={1}
              >
                {pieData.map((entry, index) => (
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
        {pieData.map((item, index) => (
          <HealthDistributionItem key={item.name} item={item} index={index} />
        ))}
      </div>
    </div>
  );
};

// Analytics Statistics Cards - Made Responsive
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
          className="relative bg-white border border-gray-200 rounded-xl p-4 sm:p-6 flex items-center gap-3 sm:gap-4 transition-all duration-300 hover:shadow-md group"
        >
          {/* Green gradient line at the bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 to-teal-600 rounded-b-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          
          {/* Very subtle green tint overlay (5% opacity) */}
          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 opacity-0 group-hover:opacity-5 transition-opacity duration-300"></div>
          
          {/* Icon with scaling effect */}
          <div className={`w-12 h-12 sm:w-14 sm:h-14 ${card.bgColor} rounded-xl flex items-center justify-center text-xl sm:text-2xl group-hover:scale-110 transition-transform duration-300 relative z-10`}>
            <card.icon className={card.color} />
          </div>
          
          {/* Content */}
          <div className="relative z-10">
            <h4 className="text-sm text-gray-600 font-medium mb-1">{card.label}</h4>
            <p className="text-teal-600 text-lg sm:text-xl font-bold">{card.value}</p>
            <p className="text-sm font-medium text-teal-600">
              {card.percentage}%
            </p>
          </div>
        </motion.div>
      ))}
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

  const [warmupPerformance, setWarmupPerformance] = useState([
    { name: 'Monday', sent: 400, inbox: 380, spam: 20, deliverability: 95 },
    { name: 'Tuesday', sent: 450, inbox: 405, spam: 45, deliverability: 90 },
    { name: 'Wednesday', sent: 500, inbox: 450, spam: 50, deliverability: 90 },
    { name: 'Thursday', sent: 550, inbox: 495, spam: 55, deliverability: 90 },
    { name: 'Friday', sent: 600, inbox: 540, spam: 60, deliverability: 90 },
      { name: 'Saturday', sent: 350, inbox: 315, spam: 35, deliverability: 90 },
  { name: 'Sunday', sent: 300, inbox: 270, spam: 30, deliverability: 90 }
  ]);

  const [currentTime, setCurrentTime] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [isExporting, setIsExporting] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState('7');

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

  // API PLACEHOLDER - Load data from API
  useEffect(() => {
    // TODO: Uncomment and implement API calls when backend is ready
    /*
    const loadData = async () => {
      try {
        const [stats, health, performance] = await Promise.all([
          API.fetchEmailStats(),
          API.fetchAccountHealth(),
          API.fetchWarmupPerformance()
        ]);
       
        setEmailStats(stats);
        setAccountHealth(health);
        setWarmupPerformance(performance);
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    };
   
    loadData();
    */
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

const generateTimeRangeData = (range) => {
  if (range === '7') {
    return [
      { name: 'Mon', sent: 400, inbox: 380, spam: 20, deliverability: 95 },
      { name: 'Tue', sent: 450, inbox: 405, spam: 45, deliverability: 90 },
      { name: 'Wed', sent: 500, inbox: 450, spam: 50, deliverability: 90 },
      { name: 'Thu', sent: 550, inbox: 495, spam: 55, deliverability: 90 },
      { name: 'Fri', sent: 600, inbox: 540, spam: 60, deliverability: 90 },
      { name: 'Sat', sent: 350, inbox: 315, spam: 35, deliverability: 90 },
      { name: 'Sun', sent: 300, inbox: 270, spam: 30, deliverability: 90 }
    ];
  } else if (range === '30') {
    return [
      { name: 'Week 1', sent: 2800, inbox: 2520, spam: 280, deliverability: 90 },
      { name: 'Week 2', sent: 3150, inbox: 2835, spam: 315, deliverability: 90 },
      { name: 'Week 3', sent: 3500, inbox: 3150, spam: 350, deliverability: 90 },
      { name: 'Week 4', sent: 3850, inbox: 3465, spam: 385, deliverability: 90 }
    ];
  } else if (range === '90') {
    return [
      { name: 'Month 1', sent: 11200, inbox: 10080, spam: 1120, deliverability: 90 },
      { name: 'Month 2', sent: 12600, inbox: 11340, spam: 1260, deliverability: 90 },
      { name: 'Month 3', sent: 14000, inbox: 12600, spam: 1400, deliverability: 90 }
    ];
  } else {
    return [
      { name: 'Mon', sent: 400, inbox: 380, spam: 20, deliverability: 95 },
      { name: 'Tue', sent: 450, inbox: 405, spam: 45, deliverability: 90 },
      { name: 'Wed', sent: 500, inbox: 450, spam: 50, deliverability: 90 },
      { name: 'Thu', sent: 550, inbox: 495, spam: 55, deliverability: 90 },
      { name: 'Fri', sent: 600, inbox: 540, spam: 60, deliverability: 90 },
      { name: 'Sat', sent: 350, inbox: 315, spam: 35, deliverability: 90 },
      { name: 'Sun', sent: 300, inbox: 270, spam: 30, deliverability: 90 }
    ];
  }
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

    // API PLACEHOLDER - Export via API
    try {
      /*
      await API.exportReport({
        emailStats,
        warmupPerformance,
        accountData: selectedAccount,
        accountScore: accountScores[1],
        timestamp: new Date().toISOString()
      });
      */

      // Temporary mock export (remove when API is ready)
      await new Promise(resolve => setTimeout(resolve, 2000));

      const exportData = {
        emailStats,
        warmupPerformance,
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
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export report. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const deliveryRate = ((emailStats.delivered / emailStats.sent) * 100).toFixed(1);
  const inboxRate = ((emailStats.inbox / emailStats.delivered) * 100).toFixed(1);
  const spamRate = ((emailStats.spam / emailStats.delivered) * 100).toFixed(1);

  return (
    <div className="min-h-screen text-gray-900 flex justify-center items-start p-4 sm:p-6 font-['Inter',_'Roboto',_-apple-system,_BlinkMacSystemFont,_'Segoe_UI',_sans-serif]">
      {/* Changed: Removed max-w-7xl mx-auto */}
      <div className="w-full">
        {/* Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6 sm:space-y-8">
            {/* Email Warmup Stats Cards - Now at the top */}
            <AnalyticsStatisticsCards 
              emailStats={emailStats}
              deliveryRate={deliveryRate}
              inboxRate={inboxRate}
              spamRate={spamRate}
            />

            
            {/* Changed: Added w-full */}
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-200 overflow-hidden w-full">
              <div className="border-b border-gray-200 bg-gradient-to-r from-teal-50 to-teal-100 px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-700 flex items-center gap-2 sm:gap-3">
                  <i className="fas fa-chart-pie text-teal-600 text-lg sm:text-xl"></i>
                  Email Health Overview
                </h2>
              </div>
              <div className="p-4 sm:p-6 lg:p-8">
                <UltraStablePieChart />
              </div>
            </div>

            
            {/* Changed: Added w-full */}
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-200 overflow-hidden w-full">
              <div className="border-b border-gray-200 bg-gradient-to-r from-teal-50 to-teal-100 px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-700 flex items-center gap-2 sm:gap-3">
  <i className="fas fa-trending-up text-teal-600 text-lg sm:text-xl"></i>
  {selectedTimeRange === '7' && 'Daily Warmup Performance'}
  {selectedTimeRange === '30' && 'Weekly Warmup Performance'}
  {selectedTimeRange === '90' && 'Monthly Warmup Performance'}
</h2>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <select 
  value={selectedTimeRange}
  onChange={(e) => setSelectedTimeRange(e.target.value)}
  className="px-3 sm:px-4 py-2 border border-gray-300 rounded-lg sm:rounded-xl bg-white text-gray-700 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition-all text-xs sm:text-sm"
>
  <option value="7">Last 7 days</option>
  <option value="30">Last 30 days</option>
  <option value="90">Last 90 days</option>
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
  data={generateTimeRangeData(selectedTimeRange)}
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
  minPointSize={2}
>
  {generateTimeRangeData(selectedTimeRange).map((entry, index) => (  
    <Cell 
      key={`inbox-${selectedTimeRange}-${index}`} 
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
  minPointSize={2} 
> {/* ADD THIS CLOSING ANGLE BRACKET */}
  {generateTimeRangeData(selectedTimeRange).map((entry, index) => (  
    <Cell 
      key={`spam-${selectedTimeRange}-${index}`} 
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
        )}
      </div>
    </div>
  );
};

export default AnalyticsDashboard;