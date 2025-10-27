import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from "../../context/AuthContext";
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiBell,
  FiMail,
  FiCheckCircle,
  FiAlertTriangle,
  FiRefreshCw,
  FiEye,
  FiEyeOff,
  FiChevronRight,
  FiFilter,
  FiSearch,
  FiX,
  FiAlertCircle,
  FiTrendingUp,
  FiTrendingDown,
  FiActivity
} from 'react-icons/fi';

const Alert = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [emailAccounts, setEmailAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [stats, setStats] = useState({
    totalAlerts: 0,
    unreadAlerts: 0,
    resolvedAlerts: 0
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [markingAsRead, setMarkingAsRead] = useState({});

  // Enhanced sample alert data with better categorization
  const sampleAlerts = useMemo(() => [
    {
      id: 1,
      type: 'bounce',
      message: 'High bounce rate detected (12.5%) - Immediate attention required',
      timestamp: '2023-10-20T19:52:00Z',
      read: false,
      severity: 'critical',
      category: 'performance',
      account: 'marketing@pipeline-prospects.com'
    },
    {
      id: 2,
      type: 'spam',
      message: 'Multiple emails marked as spam by recipients',
      timestamp: '2023-10-19T15:15:00Z',
      read: true,
      severity: 'high',
      category: 'reputation',
      account: 'marketing@pipeline-prospects.com'
    },
    {
      id: 3,
      type: 'delivery',
      message: 'Delivery issues detected with outlook.com domains',
      timestamp: '2023-10-18T16:30:00Z',
      read: true,
      severity: 'medium',
      category: 'delivery',
      account: 'sales@pipeline-prospects.com'
    },
    {
      id: 4,
      type: 'engagement',
      message: 'Low open rate detected (15%) - Below industry average',
      timestamp: '2023-10-17T11:20:00Z',
      read: false,
      severity: 'medium',
      category: 'performance',
      account: 'marketing@pipeline-prospects.com'
    },
    {
      id: 5,
      type: 'security',
      message: 'Unusual login activity detected from new location',
      timestamp: '2023-10-16T08:45:00Z',
      read: false,
      severity: 'high',
      category: 'security',
      account: 'salvis@pipeline-prospects.com'
    },
    {
      id: 6,
      type: 'quota',
      message: 'Approaching daily sending limit (85% used)',
      timestamp: '2023-10-15T14:20:00Z',
      read: true,
      severity: 'low',
      category: 'quota',
      account: 'support@pipeline-prospects.com'
    },
    {
      id: 7,
      type: 'performance',
      message: 'Email deliverability rate dropped to 78%',
      timestamp: '2023-10-14T09:30:00Z',
      read: false,
      severity: 'high',
      category: 'performance',
      account: 'marketing@pipeline-prospects.com'
    },
    {
      id: 8,
      type: 'authentication',
      message: 'SPF record configuration issue detected',
      timestamp: '2023-10-13T13:15:00Z',
      read: true,
      severity: 'medium',
      category: 'security',
      account: 'sales@pipeline-prospects.com'
    }
  ], []);

  // Enhanced email accounts with better data
  const sampleAccounts = useMemo(() => [
    {
      id: 1,
      email: 'marketing@pipeline-prospects.com',
      alerts: sampleAlerts.filter(alert => alert.account === 'marketing@pipeline-prospects.com'),
      lastChecked: '2023-10-20T17:00:00Z',
      unreadCount: 3,
      status: 'active',
      warmupStatus: 'active',
      deliverability: 78
    },
    {
      id: 2,
      email: 'salvis@pipeline-prospects.com',
      alerts: sampleAlerts.filter(alert => alert.account === 'salvis@pipeline-prospects.com'),
      lastChecked: '2023-10-19T09:15:00Z',
      unreadCount: 1,
      status: 'active',
      warmupStatus: 'paused',
      deliverability: 92
    },
    {
      id: 3,
      email: 'support@pipeline-prospects.com',
      alerts: sampleAlerts.filter(alert => alert.account === 'support@pipeline-prospects.com'),
      lastChecked: '2023-10-20T10:45:00Z',
      unreadCount: 0,
      status: 'active',
      warmupStatus: 'active',
      deliverability: 95
    },
    {
      id: 4,
      email: 'sales@pipeline-prospects.com',
      alerts: sampleAlerts.filter(alert => alert.account === 'sales@pipeline-prospects.com'),
      lastChecked: '2023-10-20T14:30:00Z',
      unreadCount: 1,
      status: 'paused',
      warmupStatus: 'inactive',
      deliverability: 85
    }
  ], [sampleAlerts]);

  // Check authentication status
  useEffect(() => {
    if (!isAuthenticated()) {
      console.log('User not authenticated, redirecting to login');
      navigate('/login');
      return;
    }

    initializeData();
  }, [navigate, isAuthenticated]);

  const initializeData = useCallback(() => {
    setEmailAccounts(sampleAccounts);
    setSelectedAccount(sampleAccounts[0]);

    const totalAlerts = sampleAlerts.length;
    const unreadAlerts = sampleAlerts.filter(alert => !alert.read).length;

    setStats({
      totalAlerts,
      unreadAlerts,
      resolvedAlerts: totalAlerts - unreadAlerts
    });

    setIsLoading(false);
  }, [sampleAccounts, sampleAlerts]);

  const refreshData = useCallback(async () => {
    setRefreshing(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    initializeData();
    setRefreshing(false);
  }, [initializeData]);

  const markAsRead = useCallback(async (alertId) => {
    if (!selectedAccount) return;

    setMarkingAsRead(prev => ({ ...prev, [alertId]: true }));

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));

    const updatedAlerts = selectedAccount.alerts.map(alert =>
      alert.id === alertId ? { ...alert, read: true } : alert
    );

    const updatedAccount = {
      ...selectedAccount,
      alerts: updatedAlerts,
      unreadCount: updatedAlerts.filter(alert => !alert.read).length
    };

    setEmailAccounts(prev =>
      prev.map(account =>
        account.id === selectedAccount.id ? updatedAccount : account
      )
    );

    setSelectedAccount(updatedAccount);

    // Update stats
    setStats(prev => ({
      ...prev,
      unreadAlerts: prev.unreadAlerts - 1,
      resolvedAlerts: prev.resolvedAlerts + 1
    }));

    setMarkingAsRead(prev => ({ ...prev, [alertId]: false }));
  }, [selectedAccount]);

  const markAllAsRead = useCallback(async () => {
    if (!selectedAccount) return;

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 800));

    const updatedAlerts = selectedAccount.alerts.map(alert => ({
      ...alert,
      read: true
    }));

    const updatedAccount = {
      ...selectedAccount,
      alerts: updatedAlerts,
      unreadCount: 0
    };

    setEmailAccounts(prev =>
      prev.map(account =>
        account.id === selectedAccount.id ? updatedAccount : account
      )
    );

    setSelectedAccount(updatedAccount);

    // Update stats
    const unreadCount = selectedAccount.alerts.filter(a => !a.read).length;
    setStats(prev => ({
      ...prev,
      unreadAlerts: prev.unreadAlerts - unreadCount,
      resolvedAlerts: prev.resolvedAlerts + unreadCount
    }));
  }, [selectedAccount]);

  // Enhanced color system
  const getSeverityColor = useCallback((severity) => {
    switch (severity) {
      case 'critical': return '#DC2626'; // Red-600
      case 'high': return '#EA580C';     // Orange-600
      case 'medium': return '#D97706';   // Amber-600
      case 'low': return '#059669';      // Emerald-600
      case 'info': return '#2563EB';     // Blue-600
      default: return '#6B7280';         // Gray-500
    }
  }, []);

  const getSeverityBgColor = useCallback((severity) => {
    switch (severity) {
      case 'critical': return '#FEF2F2'; // Red-50
      case 'high': return '#FFF7ED';     // Orange-50
      case 'medium': return '#FFFBEB';   // Amber-50
      case 'low': return '#ECFDF5';      // Emerald-50
      case 'info': return '#EFF6FF';     // Blue-50
      default: return '#F9FAFB';         // Gray-50
    }
  }, []);

  const getStatusColor = useCallback((status) => {
    switch (status) {
      case 'active': return '#10B981';   // Green-500
      case 'paused': return '#F59E0B';   // Yellow-500
      case 'inactive': return '#EF4444'; // Red-500
      default: return '#6B7280';         // Gray-500
    }
  }, []);

  const getAlertIcon = useCallback((type) => {
    const iconClass = "w-5 h-5";

    switch (type) {
      case 'bounce':
        return (
          <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-2.625 6c-.54 0-.828.419-.936.634a1.96 1.96 0 00-.189.866c0 .298.059.605.189.866.108.215.395.634.936.634.54 0 .828-.419.936-.634.13-.26.189-.568.189-.866 0-.298-.059-.605-.189-.866-.108-.215-.395-.634-.936-.634zm4.314.634c.108-.215.395-.634.936-.634.54 0 .828.419.936.634.13.26.189.568.189.866 0 .298-.059.605-.189.866-.108.215-.395.634-.936.634-.54 0-.828-.419-.936-.634a1.96 1.96 0 01-.189-.866c0-.298.059-.605.189-.866zm-4.34 7.964a.75.75 0 01-1.061-1.06 5.236 5.236 0 013.73-1.538 5.236 5.236 0 013.695 1.538.75.75 0 11-1.061 1.06 3.736 3.736 0 00-2.639-1.098 3.736 3.736 0 00-2.664 1.098z" clipRule="evenodd" />
          </svg>
        );
      case 'spam':
        return (
          <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" clipRule="evenodd" />
          </svg>
        );
      case 'delivery':
        return (
          <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24">
            <path d="M3.375 4.5C2.339 4.5 1.5 5.34 1.5 6.375V13.5h12V6.375c0-1.036-.84-1.875-1.875-1.875h-8.25zM13.5 15h-12v2.625c0 1.035.84 1.875 1.875 1.875h.375a3 3 0 116 0h3a.75.75 0 00.75-.75V15z" />
            <path d="M8.25 19.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0zM15.75 6.75a.75.75 0 00-.75.75v11.25c0 .087.015.17.042.248a3 3 0 015.958.464c.853-.175 1.522-.935 1.464-1.883a18.659 18.659 0 00-3.732-10.104 1.837 1.837 0 00-1.47-.725H15.75z" />
            <path d="M19.5 19.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
          </svg>
        );
      case 'engagement':
        return (
          <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24">
            <path d="M18.375 2.25c-1.035 0-1.875.84-1.875 1.875v15.75c0 1.035.84 1.875 1.875 1.875h.75c1.035 0 1.875-.84 1.875-1.875V4.125c0-1.036-.84-1.875-1.875-1.875h-.75zM9.75 8.625c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-.75a1.875 1.875 0 01-1.875-1.875V8.625zM3 13.125c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v6.75c0 1.035-.84 1.875-1.875 1.875h-.75A1.875 1.875 0 013 19.875v-6.75z" />
          </svg>
        );
      case 'security':
        return <FiAlertTriangle className={iconClass} />;
      case 'quota':
        return (
          <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" d="M5.625 1.5H9a3.75 3.75 0 013.75 3.75v1.875c0 1.036.84 1.875 1.875 1.875H16.5a3.75 3.75 0 013.75 3.75v7.875c0 1.035-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 01-1.875-1.875V3.375c0-1.036.84-1.875 1.875-1.875zM9.75 17.25a.75.75 0 00-1.5 0v.75a.75.75 0 001.5 0v-.75zm2.25-3a.75.75 0 01.75.75v.75a.75.75 0 01-1.5 0v-.75a.75.75 0 01.75-.75zm3.75-1.5a.75.75 0 00-1.5 0v.75a.75.75 0 001.5 0v-.75z" clipRule="evenodd" />
          </svg>
        );
      case 'performance':
        return <FiActivity className={iconClass} />;
      case 'authentication':
        return <FiAlertCircle className={iconClass} />;
      default:
        return (
          <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
          </svg>
        );
    }
  }, []);

  const formatDate = useCallback((dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }, []);

  // Filter alerts based on search and active filter
  const filteredAlerts = useMemo(() => {
    if (!selectedAccount) return [];

    let alerts = selectedAccount.alerts;

    // Apply search filter
    if (searchTerm) {
      alerts = alerts.filter(alert =>
        alert.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        alert.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        alert.severity.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (activeFilter !== 'all') {
      alerts = alerts.filter(alert =>
        activeFilter === 'unread' ? !alert.read : alert.read
      );
    }

    return alerts;
  }, [selectedAccount, searchTerm, activeFilter]);

  // Enhanced Statistics Cards Component
  const StatisticsCards = () => {
    const statCards = [
      {
        label: "Total Alerts",
        value: stats.totalAlerts,
        icon: FiBell,
        color: "text-indigo-600",
        bgColor: "bg-indigo-50",
        borderColor: "border-indigo-200",
        gradient: "from-indigo-500 to-indigo-600",
        description: "All time alerts count",
        trend: "up"
      },
      {
        label: "Unread Alerts",
        value: stats.unreadAlerts,
        icon: FiEye,
        color: "text-amber-600",
        bgColor: "bg-amber-50",
        borderColor: "border-amber-200",
        gradient: "from-amber-500 to-amber-600",
        description: "Requires your attention",
        trend: "down"
      },
      {
        label: "Resolved Issues",
        value: stats.resolvedAlerts,
        icon: FiCheckCircle,
        color: "text-emerald-600",
        bgColor: "bg-emerald-50",
        borderColor: "border-emerald-200",
        gradient: "from-emerald-500 to-emerald-600",
        description: "Successfully resolved",
        trend: "up"
      }
    ];

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-6">
        {statCards.map((card, index) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="relative bg-white/80 backdrop-blur-sm rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200/60 hover:shadow-md transition-all duration-300 group"
          >
            {/* Background Gradient Effect */}
            {/* <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-teal-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div> */}

            <div className="flex items-center justify-between relative z-10">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-gray-600 font-medium truncate">{card.label}</p>
                <p className={`text-2xl sm:text-3xl font-bold ${card.color} mt-1 sm:mt-2 truncate`}>{card.value}</p>
              </div>
              <div className={`w-10 h-10 sm:w-12 sm:h-12 ${card.bgColor} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 flex-shrink-0 ml-2 relative overflow-hidden`}>
                <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-10`}></div>
                <card.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${card.color} relative z-10`} />
              </div>
            </div>

            <div className="mt-3 sm:mt-4 relative z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center text-xs sm:text-sm text-gray-500">
                  <span className={`w-2 h-2 bg-gradient-to-r ${card.gradient} rounded-full mr-2`}></span>
                  {card.description}
                </div>
                {card.trend && (
                  <div className={`flex items-center text-xs ${card.trend === 'up' ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {card.trend === 'up' ? <FiTrendingUp className="w-3 h-3 mr-1" /> : <FiTrendingDown className="w-3 h-3 mr-1" />}
                    {card.trend === 'up' ? '12%' : '5%'}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Border Effect */}
            {/* <div className="absolute bottom-0 left-0 right-0 h-0.5 sm:h-1 bg-gradient-to-r from-teal-500 to-blue-500 rounded-b-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div> */}
          </motion.div>
        ))}
      </div>
    );
  };

  // Enhanced Filter Tabs Component
  const FilterTabs = () => (
    <div className="flex flex-wrap gap-2 mb-6">
      {[
        { key: 'all', label: 'All Alerts', count: selectedAccount?.alerts.length || 0 },
        { key: 'unread', label: 'Unread', count: selectedAccount?.alerts.filter(a => !a.read).length || 0 },
        { key: 'resolved', label: 'Resolved', count: selectedAccount?.alerts.filter(a => a.read).length || 0 }
      ].map((filter) => (
        <motion.button
          key={filter.key}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setActiveFilter(filter.key)}
          className={`px-3 py-2 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${activeFilter === filter.key
            ? 'bg-gradient-to-r from-teal-600 to-teal-700 text-white shadow-md'
            : 'bg-white text-gray-600 border border-gray-300 hover:border-teal-300 hover:text-teal-700 hover:shadow-sm'
            }`}
        >
          <span className="hidden xs:inline">{filter.label}</span>
          <span className="xs:hidden">
            {filter.key === 'all' ? 'All' : filter.key === 'unread' ? 'Unread' : 'Resolved'}
          </span>
          <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${activeFilter === filter.key ? 'bg-teal-500' : 'bg-gray-200'
            }`}>
            {filter.count}
          </span>
        </motion.button>
      ))}
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="w-16 h-16 border-4 border-teal-200 border-t-teal-500 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-600 text-lg font-medium">Loading your alerts...</p>
        <p className="text-gray-500 text-sm mt-2">Getting everything ready for you</p>
      </div >
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-teal-50 w-full lg:w-[calc(100%)] xl:w-[calc(100%)] relative overflow-hidden font-sans">
      {/* Header Section */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-gray-200/60 px-4 sm:px-6 lg:px-8 py-4 sm:py-6 relative z-10">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900">Alerts & Notifications</h1>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">Monitor your email account performance and issues</p>
          </div>
          <div className="flex items-center space-x-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={refreshData}
              disabled={refreshing}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all duration-200 disabled:opacity-50 text-sm"
            >
              <FiRefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="p-4 sm:p-6 lg:p-8 relative z-10">
        <StatisticsCards />
      </div>

      {/* Main Content */}
      <div className="px-4 sm:px-6 lg:px-8 pb-8 relative z-10">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
          {/* Email Accounts Section */}
          <div className="xl:col-span-1">
            <div className="bg-white/80 backdrop-blur-xl rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-200/60">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Email Accounts</h3>
                <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{emailAccounts.length} accounts</span>
              </div>
              <div className="space-y-3">
                {emailAccounts.map((account, index) => (
                  <motion.div
                    key={account.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`p-3 sm:p-4 rounded-lg sm:rounded-xl border-2 cursor-pointer transition-all duration-300 ${selectedAccount?.id === account.id
                      ? 'border-teal-500 bg-gradient-to-r from-teal-50/80 to-teal-100/50 shadow-md'
                      : 'border-gray-200/60 hover:border-teal-300 hover:shadow-sm bg-white/50'
                      }`}
                    onClick={() => setSelectedAccount(account)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="font-medium text-gray-900 text-sm truncate">
                            {account.email}
                          </div>
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${account.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : account.status === 'paused'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                              }`}
                          >
                            {account.status}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-600">
                          <span className={`font-medium ${account.unreadCount > 0 ? 'text-red-600' : 'text-emerald-600'
                            }`}>
                            {account.unreadCount} unread alert{account.unreadCount !== 1 ? 's' : ''}
                          </span>
                          <span className="text-gray-500">
                            {account.deliverability}% deliverability
                          </span>
                        </div>
                      </div>
                      <div className={`ml-3 transition-transform ${selectedAccount?.id === account.id ? 'text-teal-600' : 'text-gray-400'
                        }`}>
                        <FiChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* Alert Details Section */}
          <div className="xl:col-span-2">
            {selectedAccount && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/80 backdrop-blur-xl rounded-xl sm:rounded-2xl shadow-sm border border-gray-200/60"
              >
                {/* Account Header */}
                <div className="p-4 sm:p-6 border-b border-gray-200/60">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-1 truncate">
                        Alerts for {selectedAccount.email}
                      </h3>
                      <p className="text-gray-600 text-sm">
                        Last checked: {formatDate(selectedAccount.lastChecked)}
                      </p>
                    </div>
                    {selectedAccount.unreadCount > 0 && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="bg-gradient-to-r from-teal-500 to-teal-600 text-white px-4 py-2 rounded-lg sm:rounded-xl text-sm font-medium hover:from-teal-600 hover:to-teal-700 transition-all duration-300 shadow-md hover:shadow-lg flex items-center gap-2"
                        onClick={markAllAsRead}
                      >
                        <FiCheckCircle className="w-4 h-4" />
                        Mark all as read
                      </motion.button>
                    )}
                  </div>
                </div>

                {/* Search and Filters */}
                <div className="p-4 sm:p-6 border-b border-gray-200/60">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                          type="text"
                          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition-all bg-white/50 text-sm"
                          placeholder="Search alerts by message, type, or severity..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                          <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            <FiX className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    <FilterTabs />
                  </div>
                </div>

                {/* Recent Alerts */}
                <div className="p-4 sm:p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Recent Alerts</h4>

                  {filteredAlerts.length === 0 ? (
                    <div className="text-center py-8 sm:py-12">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-r from-teal-50 to-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FiBell className="w-8 h-8 sm:w-10 sm:h-10 text-teal-400" />
                      </div>
                      <p className="text-gray-900 font-medium text-lg mb-2">No alerts found</p>
                      <p className="text-gray-600 text-sm max-w-sm mx-auto">
                        {searchTerm || activeFilter !== 'all'
                          ? 'Try adjusting your search terms or filters.'
                          : 'You\'ll see notifications here when we detect issues with your email delivery or performance metrics.'
                        }
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <AnimatePresence>
                        {filteredAlerts.map((alert, index) => (
                          <motion.div
                            key={alert.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ delay: index * 0.05 }}
                            className={`p-4 rounded-lg sm:rounded-xl border transition-all duration-300 hover:shadow-md ${alert.read
                              ? 'bg-gray-50/50 border-gray-200'
                              : 'border-l-4 shadow-sm'
                              }`}
                            style={{
                              borderLeftColor: alert.read ? 'transparent' : getSeverityColor(alert.severity),
                              backgroundColor: alert.read ? '#F9FAFB80' : getSeverityBgColor(alert.severity)
                            }}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between space-y-4 sm:space-y-0">
                              <div className="flex items-start space-x-3 sm:space-x-4 flex-1">
                                <div
                                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-1"
                                  style={{
                                    color: getSeverityColor(alert.severity),
                                    backgroundColor: `${getSeverityColor(alert.severity)}15`
                                  }}
                                >
                                  {getAlertIcon(alert.type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2 mb-2">
                                    <span
                                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                                      style={{
                                        backgroundColor: `${getSeverityColor(alert.severity)}15`,
                                        color: getSeverityColor(alert.severity)
                                      }}
                                    >
                                      {alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}
                                    </span>
                                    {!alert.read && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                        Unread
                                      </span>
                                    )}
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                      {alert.type}
                                    </span>
                                  </div>
                                  <p className="text-gray-900 font-medium mb-2 text-sm sm:text-base">{alert.message}</p>
                                  <p className="text-gray-500 text-xs sm:text-sm">
                                    {formatDate(alert.timestamp)}
                                  </p>
                                </div>
                              </div>
                              {!alert.read && (
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  className="sm:ml-4 bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-teal-50 hover:border-teal-300 transition-colors flex-shrink-0 self-start disabled:opacity-50 flex items-center gap-2"
                                  onClick={() => markAsRead(alert.id)}
                                  disabled={markingAsRead[alert.id]}
                                >
                                  {markingAsRead[alert.id] ? (
                                    <>
                                      <div className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                                      Marking...
                                    </>
                                  ) : (
                                    <>
                                      <FiCheckCircle className="w-4 h-4" />
                                      Mark as read
                                    </>
                                  )}
                                </motion.button>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Alert;
