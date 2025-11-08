import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { FiDownload, FiMail, FiInbox, FiAlertTriangle, FiCheck, FiX, FiEye, FiBarChart2, FiChevronDown, FiRefreshCw, FiTrendingUp, FiTrendingDown, FiMinus } from 'react-icons/fi';
import { motion } from 'framer-motion';

// Environment variables
const API_BASE_URL = 'http://localhost:5000';

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Analytics Dashboard Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiAlertTriangle className="text-red-600 text-2xl" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
            <p className="text-gray-600 mb-4">
              We encountered an error while loading the analytics dashboard.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium"
            >
              Reload Dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Helper functions
const getMonthNames = (count = 3) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentMonth = new Date().getMonth();
  const monthNames = [];
  
  for (let i = count - 1; i >= 0; i--) {
    const monthIndex = (currentMonth - i + 12) % 12;
    monthNames.push(months[monthIndex]);
  }
  
  return monthNames;
};

const getWeekLabels = (count = 4) => {
  const weekLabels = [];
  for (let i = count - 1; i >= 0; i--) {
    const weekNumber = Math.floor((new Date().getDate() + i * 7) / 7);
    weekLabels.push(`Week ${weekNumber}`);
  }
  return weekLabels.reverse();
};

// API Service - Using your existing endpoint
const createApiService = () => {
  const fetchWithRetry = async (url, options = {}, retries = 2, delay = 1000) => {
    try {
      console.log(`API Call: ${url}`);
      
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`API Response from ${url}:`, data);
      
      if (!data.success) {
        throw new Error(data.message || 'API request failed');
      }

      return data;
    } catch (error) {
      console.error(`API call failed to ${url}:`, error);
      if (retries > 0) {
        console.warn(`Retrying... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchWithRetry(url, options, retries - 1, delay * 2);
      }
      throw error;
    }
  };

  return {
    // Using your existing single-user analytics endpoint
    getDashboardData: async (email, timeRange = '7d') => {
      try {
        const data = await fetchWithRetry(
          `${API_BASE_URL}/api/analytics/dashboard?email=${encodeURIComponent(email)}&range=${timeRange}`
        );

        const apiData = data.data;
        
        if (!apiData || typeof apiData !== 'object') {
          throw new Error('Invalid data format received from API');
        }

        // Transform your existing API response to match what the component expects
        return {
          // Stats Cards Data - using data from your API response
          totalSent: apiData.sent?.total || 0,
          delivered: apiData.sent?.delivered?.count || 0,
          bounced: apiData.bounceMetrics?.total || 0,
          inbox: apiData.sent?.inbox?.count || 0,
          
          // Trend Data - using the trend data from your API
          sentTrend: apiData.sent?.trend || { type: 'no change', value: 0, text: 'no change compared to last week' },
          deliveredTrend: apiData.sent?.delivered?.trend || { type: 'no change', value: 0, text: 'no change compared to last week' },
          inboxTrend: apiData.sent?.inbox?.trend || { type: 'no change', value: 0, text: 'no change compared to last week' },
          bouncedTrend: { type: 'no change', value: 0, text: 'no change compared to last week' },
          
          // Pie Chart Data
          emailHealth: apiData.emailHealth || [],
          
          // Bar Chart Data
          dailyPerformance: apiData.dailyPerformance || [],
          
          // Additional Data
          engagement: apiData.engagement || {},
          user: apiData.user || {}
        };

      } catch (error) {
        console.error('Dashboard data API error:', error);
        throw new Error(`Failed to load analytics data: ${error.message}`);
      }
    }
  };
};

// Fallback health data
const getFallbackHealthData = () => [
  { name: 'Excellent', value: 25, color: '#059669' },
  { name: 'Good', value: 35, color: '#2563EB' },
  { name: 'Fair', value: 25, color: '#D97706' },
  { name: 'Needs Improvement', value: 15, color: '#DC2626' }
];

// Performance timeline generator
const generatePerformanceTimeline = (dailyPerformance, timeRange) => {
  if (!dailyPerformance || !Array.isArray(dailyPerformance)) {
    return getFallbackTimeline(timeRange);
  }

  const timeline = dailyPerformance.map(day => ({
    name: day.day,
    sent: (day.inbox || 0) + (day.spam || 0),
    inbox: day.inbox || 0,
    spam: day.spam || 0,
    deliverability: day.inbox > 0 ? Math.round((day.inbox / ((day.inbox || 0) + (day.spam || 0))) * 100) : 0
  }));

  return timeline;
};

// Fallback timeline
const getFallbackTimeline = (timeRange) => {
  const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 4 : 3;
  const isWeekly = timeRange === '30d';
  const isMonthly = timeRange === '90d';
  
  const timeline = [];
  let labels = [];

  if (isMonthly) {
    labels = getMonthNames(3);
  } else if (isWeekly) {
    labels = getWeekLabels(4);
  } else {
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    labels = dayNames.slice(0, 7);
  }

  for (let i = 0; i < days; i++) {
    timeline.push({
      name: labels[i] || `Day ${i + 1}`,
      sent: 0,
      inbox: 0,
      spam: 0,
      deliverability: 0
    });
  }
  
  return timeline;
};

const analyticsApi = createApiService();

// Ultra Stable Pie Chart Component (keep your existing)
const UltraStablePieChart = React.memo(({ data }) => {
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
});

// Analytics Statistics Cards Component with BIGGER Trend Indicators
// Analytics Statistics Cards Component with BIGGER Trend Indicators and BIGGER CONTENT
// Analytics Statistics Cards Component with BIGGER Trend Indicators and BIGGER CONTENT but REDUCED HEIGHT
const AnalyticsStatisticsCards = React.memo(({ statsData }) => {
  const getTrendIcon = (type) => {
    switch (type) {
      case 'increase':
        return <FiTrendingUp className="text-green-500 w-4 h-4 sm:w-6 sm:h-6" />;
      case 'decrease':
        return <FiTrendingDown className="text-red-500 w-4 h-4 sm:w-6 sm:h-6" />;
      case 'no change':
        return <FiMinus className="text-gray-500 w-4 h-4 sm:w-6 sm:h-6" />;
      default:
        return <FiMinus className="text-gray-500 w-4 h-4 sm:w-6 sm:h-6" />;
    }
  };

  const getTrendColor = (type) => {
    switch (type) {
      case 'increase':
        return 'text-green-600';
      case 'decrease':
        return 'text-red-600';
      case 'no change':
        return 'text-gray-600';
      default:
        return 'text-gray-600';
    }
  };

  const statCards = [
    {
      label: "Sent",
      value: statsData.totalSent || 0,
      trend: statsData.sentTrend || { type: 'no change', value: 0, text: 'no change compared to last week' },
      icon: FiMail,
      color: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      label: "Delivered",
      value: statsData.delivered || 0,
      trend: statsData.deliveredTrend || { type: 'no change', value: 0, text: 'no change compared to last week' },
      icon: FiCheck,
      color: "text-green-600",
      bgColor: "bg-green-50"
    },
    {
      label: "Landed in Inbox",
      value: statsData.inbox || 0,
      trend: statsData.inboxTrend || { type: 'no change', value: 0, text: 'no change compared to last week' },
      icon: FiInbox,
      color: "text-purple-600",
      bgColor: "bg-purple-50"
    },
    {
      label: "Bounced",
      value: statsData.bounced || 0,
      trend: statsData.bouncedTrend || { type: 'no change', value: 0, text: 'no change compared to last week' },
      icon: FiX,
      color: "text-orange-600",
      bgColor: "bg-orange-50"
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
      {statCards.map((card, index) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="relative bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-200 hover:shadow-md transition-all duration-300 group"
        >
          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 opacity-0 group-hover:opacity-5 transition-opacity duration-300"></div>

          <div className="flex items-center justify-between relative z-10">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm text-gray-600 font-medium truncate">{card.label}</p>
              <p className={`text-lg sm:text-2xl font-bold ${card.color} mt-1 truncate`}>
                {card.value.toLocaleString()}
              </p>
              
              {/* TREND INDICATOR - Now placed below the value like Dashboard */}
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center gap-1">
                  {getTrendIcon(card.trend.type)}
                  <span className={`text-xs sm:text-sm font-semibold ${getTrendColor(card.trend.type)}`}>
                    {card.trend.type === 'increase' ? '+' : ''}{card.trend.value}
                  </span>
                </div>
                <span className="text-xs text-gray-500 truncate">
                  {card.trend.text}
                </span>
              </div>
            </div>
            
            <div
              className={`w-8 h-8 sm:w-12 sm:h-12 ${card.bgColor} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 flex-shrink-0 ml-2`}
            >
              <card.icon className={`w-4 h-4 sm:w-6 sm:h-6 ${card.color}`} />
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-0.5 sm:h-1 bg-gradient-to-r from-teal-500 to-teal-600 rounded-b-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        </motion.div>
      ))}
    </div>
  );
});

// Loading Component
const LoadingState = ({ message = "Loading analytics data..." }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <div className="w-16 h-16 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-gray-600">{message}</p>
    </div>
  </div>
);

// Empty State Component
const EmptyState = ({ onRetry, error }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center max-w-md p-6">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <FiAlertTriangle className="text-red-600 text-2xl" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Unable to Load Analytics</h2>
      <p className="text-gray-600 mb-6">{error}</p>
      <div className="space-y-3">
        <button 
          onClick={onRetry}
          className="w-full px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium"
        >
          Try Again
        </button>
      </div>
    </div>
  </div>
);

// Main Analytics Dashboard Component
const AnalyticsDashboard = () => {
  const [statsData, setStatsData] = useState({
    totalSent: 0,
    delivered: 0,
    bounced: 0,
    inbox: 0,
    sentTrend: { type: 'no change', value: 0, text: 'no change compared to last week' },
    deliveredTrend: { type: 'no change', value: 0, text: 'no change compared to last week' },
    inboxTrend: { type: 'no change', value: 0, text: 'no change compared to last week' },
    bouncedTrend: { type: 'no change', value: 0, text: 'no change compared to last week' }
  });
  
  const [healthDistribution, setHealthDistribution] = useState(getFallbackHealthData());
  const [performanceTimeline, setPerformanceTimeline] = useState([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState('7d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load analytics data - using your existing API
  const loadAnalyticsData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Using your existing single-user API with hardcoded email for now
      const apiResponse = await analyticsApi.getDashboardData('sathya01.dcm@gmail.com', selectedTimeRange);
      
      // Set stats data with trends from your API
      setStatsData({
        totalSent: apiResponse.totalSent || 0,
        delivered: apiResponse.delivered || 0,
        bounced: apiResponse.bounced || 0,
        inbox: apiResponse.inbox || 0,
        sentTrend: apiResponse.sentTrend || { type: 'no change', value: 0, text: 'no change compared to last week' },
        deliveredTrend: apiResponse.deliveredTrend || { type: 'no change', value: 0, text: 'no change compared to last week' },
        inboxTrend: apiResponse.inboxTrend || { type: 'no change', value: 0, text: 'no change compared to last week' },
        bouncedTrend: apiResponse.bouncedTrend || { type: 'no change', value: 0, text: 'no change compared to last week' }
      });
      
      // Set pie chart data
      const healthData = apiResponse.emailHealth ? apiResponse.emailHealth.map(item => ({
        name: item.level || 'Unknown',
        value: Math.min(100, Math.max(0, item.percentage || 0)),
        color: {
          'Excellent': '#059669',
          'Good': '#2563EB',
          'Fair': '#D97706',
          'Needs Improvement': '#DC2626'
        }[item.level] || '#6B7280'
      })) : getFallbackHealthData();
      
      setHealthDistribution(healthData);
      
      // Set bar chart data
      const timeline = generatePerformanceTimeline(apiResponse.dailyPerformance, selectedTimeRange);
      setPerformanceTimeline(timeline);
      
    } catch (error) {
      console.error('Failed to load analytics data:', error);
      setError(error.message);
      setHealthDistribution(getFallbackHealthData());
      setPerformanceTimeline(getFallbackTimeline(selectedTimeRange));
    } finally {
      setLoading(false);
    }
  }, [selectedTimeRange]);

  useEffect(() => {
    loadAnalyticsData();
  }, [loadAnalyticsData]);

  const handleTimeRangeChange = (newTimeRange) => {
    setSelectedTimeRange(newTimeRange);
  };

  const handleRetry = useCallback(() => {
    setError(null);
    loadAnalyticsData();
  }, [loadAnalyticsData]);

  if (loading) {
    return <LoadingState message="Loading analytics data..." />;
  }

  if (error) {
    return <EmptyState onRetry={handleRetry} error={error} />;
  }

  return (
    <div className="min-h-screen text-gray-900 flex justify-center items-start p-4 sm:p-6 font-['Inter',_'Roboto',_-apple-system,_BlinkMacSystemFont,_'Segoe_UI',_sans-serif]">
      <style jsx>{`
        .recharts-wrapper:focus,
        .recharts-surface:focus,
        .recharts-legend-wrapper:focus {
          outline: none !important;
        }
        .recharts-sector:focus {
          outline: none !important;
        }
        .recharts-bar-rectangle:focus {
          outline: none !important;
        }
      `}</style>
      
      <div className="w-full">
        <div className="space-y-6 sm:space-y-8 pt-5">
          <AnalyticsStatisticsCards statsData={statsData} />

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
              <UltraStablePieChart data={healthDistribution} />
            </div>
          </div>

          <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-200 overflow-hidden w-full">
            <div className="border-b border-gray-200 bg-gradient-to-r from-teal-50 to-teal-100 px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-700 flex items-center gap-2 sm:gap-3">
                  <FiBarChart2 className="text-teal-600 text-lg sm:text-xl" />
                  {selectedTimeRange === '7d' && 'Daily Warmup Performance'}
                  {selectedTimeRange === '30d' && 'Weekly Warmup Performance'}
                  {selectedTimeRange === '90d' && 'Monthly Warmup Performance'}
                </h2>
                <div className="flex justify-end">
                  <select 
                    value={selectedTimeRange}
                    onChange={(e) => handleTimeRangeChange(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition-all text-sm"
                  >
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="p-4 sm:p-6 lg:p-8">
              <div className="h-64 sm:h-72 lg:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={performanceTimeline}
                    margin={{ top: 20, right: 10, left: 10, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" strokeWidth={0.5} />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 12, fill: '#6B7280', fontWeight: 500 }}
                      axisLine={{ stroke: '#E5E7EB', strokeWidth: 1 }}
                      tickLine={{ stroke: '#E5E7EB' }}
                      tickMargin={10}
                    />
                    <YAxis 
                      tick={{ fontSize: 12, fill: '#6B7280', fontWeight: 500 }}
                      axisLine={{ stroke: '#E5E7EB', strokeWidth: 1 }}
                      tickLine={{ stroke: '#E5E7EB' }}
                      tickMargin={10}
                      tickFormatter={(value) => value.toLocaleString()}
                      domain={[0, 'dataMax + 2']}
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
                      barSize={36}
                    />

                    <Bar 
                      dataKey="spam" 
                      name="Landed in Spam"
                      radius={[4, 4, 0, 0]}  
                      fill="url(#spamGradient)"
                      animationBegin={150} 
                      animationDuration={400} 
                      animationEasing="ease-out"
                      barSize={36}
                    />

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

// Wrap with Error Boundary
const AnalyticsDashboardWithErrorBoundary = () => (
  <ErrorBoundary>
    <AnalyticsDashboard />
  </ErrorBoundary>
);

export default AnalyticsDashboardWithErrorBoundary;