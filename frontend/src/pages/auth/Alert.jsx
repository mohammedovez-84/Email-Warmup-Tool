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
  FiChevronRight,
  FiFilter,
  FiSearch,
  FiX,
  FiAlertCircle,
  FiTrendingUp,
  FiTrendingDown,
  FiActivity,
  FiShield,
  FiGlobe,
  FiSend,
  FiUserCheck,
  FiClock
} from 'react-icons/fi';

// Import your real alert service
import { alertService } from '../../services/alertService';

const Alert = () => {
  const navigate = useNavigate();
  const { isAuthenticated, currentUser } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [emailAccounts, setEmailAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({
    totalAlerts: 0,
    unreadAlerts: 0,
    resolvedAlerts: 0
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [markingAsRead, setMarkingAsRead] = useState({});
  const [error, setError] = useState(null);

  // Refs for unsubscribe functions
  const accountsUnsubscribeRef = React.useRef(null);
  const alertsUnsubscribeRef = React.useRef(null);

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (!isAuthenticated || !currentUser) {
          console.log('User not authenticated, redirecting to login');
          navigate('/login');
          return;
        }
        await initializeData();
      } catch (err) {
        console.error('Auth error:', err);
        navigate('/login');
      }
    };

    checkAuth();

    // Cleanup subscriptions on unmount
    return () => {
      if (accountsUnsubscribeRef.current) {
        accountsUnsubscribeRef.current();
      }
      if (alertsUnsubscribeRef.current) {
        alertsUnsubscribeRef.current();
      }
    };
  }, [navigate, isAuthenticated, currentUser]);

  const initializeData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!currentUser?.uid) {
        setIsLoading(false);
        return;
      }

      // Set up real-time subscription for user's email accounts
      accountsUnsubscribeRef.current = alertService.subscribeToAccounts(
        currentUser.uid,
        (accounts) => {
          console.log('Received accounts:', accounts);
          setEmailAccounts(accounts);

          if (accounts.length > 0 && !selectedAccount) {
            setSelectedAccount(accounts[0]);
          }

          setIsLoading(false);
        },
        (error) => {
          console.error('Error in accounts subscription:', error);
          setError('Failed to load email accounts. Please try again.');
          setIsLoading(false);
        }
      );

    } catch (err) {
      console.error('Error initializing data:', err);
      setError('Failed to load monitoring data. Please try again.');
      setIsLoading(false);
    }
  }, [currentUser, selectedAccount]);

  // Set up alerts subscription when selected account changes
  useEffect(() => {
    if (!selectedAccount) {
      setAlerts([]);
      updateStats([]);
      return;
    }

    // Unsubscribe from previous alerts
    if (alertsUnsubscribeRef.current) {
      alertsUnsubscribeRef.current();
    }

    // Subscribe to alerts for the selected account
    alertsUnsubscribeRef.current = alertService.subscribeToAlerts(
      selectedAccount.id,
      (alertsData) => {
        setAlerts(alertsData);
        updateStats(alertsData);

        // Update the account's unread count in local state
        const unreadCount = alertsData.filter(alert => !alert.read).length;
        setEmailAccounts(prev =>
          prev.map(account =>
            account.id === selectedAccount.id
              ? { ...account, unreadCount }
              : account
          )
        );
      },
      (error) => {
        console.error('Error in alerts subscription:', error);
        setError('Failed to load alerts. Please try again.');
      }
    );

    return () => {
      if (alertsUnsubscribeRef.current) {
        alertsUnsubscribeRef.current();
      }
    };
  }, [selectedAccount]);

  const updateStats = useCallback((alertsData) => {
    const totalAlerts = alertsData.length;
    const unreadAlerts = alertsData.filter(alert => !alert.read).length;

    setStats({
      totalAlerts,
      unreadAlerts,
      resolvedAlerts: totalAlerts - unreadAlerts
    });
  }, []);

  const refreshData = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      await initializeData();
    } catch (err) {
      console.error('Error refreshing data:', err);
      setError('Failed to refresh data. Please try again.');
    } finally {
      setRefreshing(false);
    }
  }, [initializeData]);

  const handleAccountSelect = useCallback((account) => {
    setSelectedAccount(account);
    setError(null);
  }, []);

  const markAsRead = useCallback(async (alertId) => {
    try {
      setMarkingAsRead(prev => ({ ...prev, [alertId]: true }));
      setError(null);
      await alertService.markAlertAsRead(alertId);
    } catch (err) {
      console.error('Error marking alert as read:', err);
      setError('Failed to mark alert as read. Please try again.');
    } finally {
      setMarkingAsRead(prev => ({ ...prev, [alertId]: false }));
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!selectedAccount) return;

    try {
      setError(null);
      await alertService.markAllAlertsAsRead(selectedAccount.id);
    } catch (err) {
      console.error('Error marking all alerts as read:', err);
      setError('Failed to mark all alerts as read. Please try again.');
    }
  }, [selectedAccount]);

  // Utility functions (getSeverityColor, getAlertIcon, etc. remain the same)
  const getSeverityColor = useCallback((severity) => {
    switch (severity) {
      case 'critical': return '#DC2626';
      case 'high': return '#EA580C';
      case 'medium': return '#D97706';
      case 'low': return '#059669';
      case 'info': return '#2563EB';
      default: return '#6B7280';
    }
  }, []);

  const getSeverityBgColor = useCallback((severity) => {
    switch (severity) {
      case 'critical': return '#FEF2F2';
      case 'high': return '#FFF7ED';
      case 'medium': return '#FFFBEB';
      case 'low': return '#ECFDF5';
      case 'info': return '#EFF6FF';
      default: return '#F9FAFB';
    }
  }, []);

  const getAlertIcon = useCallback((type) => {
    const iconClass = "w-5 h-5";
    switch (type) {
      case 'domain_health':
      case 'dns_config':
        return <FiGlobe className={iconClass} />;
      case 'warmup_complete':
      case 'warmup_progress':
        return <FiClock className={iconClass} />;
      case 'blacklist_detected':
      case 'blacklist_removed':
        return <FiShield className={iconClass} />;
      case 'bounce_rate':
      case 'delivery_issues':
        return <FiSend className={iconClass} />;
      case 'authentication_failure':
        return <FiUserCheck className={iconClass} />;
      case 'engagement_drop':
        return <FiActivity className={iconClass} />;
      case 'security_breach':
        return <FiAlertTriangle className={iconClass} />;
      case 'quota_warning':
        return <FiAlertCircle className={iconClass} />;
      case 'spam_complaints':
        return <FiAlertCircle className={iconClass} />;
      default:
        return <FiAlertCircle className={iconClass} />;
    }
  }, []);

  const getAlertTypeLabel = useCallback((type) => {
    const typeMap = {
      'domain_health': 'Domain Health',
      'dns_config': 'DNS Configuration',
      'warmup_complete': 'Warmup Complete',
      'warmup_progress': 'Warmup Progress',
      'blacklist_detected': 'Blacklist Detected',
      'blacklist_removed': 'Blacklist Removed',
      'bounce_rate': 'Bounce Rate',
      'spam_complaints': 'Spam Complaints',
      'authentication_failure': 'Authentication',
      'engagement_drop': 'Engagement',
      'security_breach': 'Security',
      'quota_warning': 'Quota'
    };
    return typeMap[type] || type;
  }, []);

  const formatDate = useCallback((dateString) => {
    if (!dateString) return 'Unknown';
    try {
      const date = dateString instanceof Date ? dateString : new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid date';

      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (error) {
      return 'Invalid date';
    }
  }, []);

  // Filter alerts based on search and active filter
  const filteredAlerts = useMemo(() => {
    let filtered = alerts;
    if (searchTerm) {
      filtered = filtered.filter(alert =>
        alert.message?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        alert.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        alert.severity?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        alert.category?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (activeFilter !== 'all') {
      filtered = filtered.filter(alert =>
        activeFilter === 'unread' ? !alert.read : alert.read
      );
    }
    return filtered;
  }, [alerts, searchTerm, activeFilter]);

  // StatisticsCards, FilterTabs, AlertDetails components remain the same...
  const StatisticsCards = () => {
    const statCards = [
      {
        label: "Total Alerts",
        value: stats.totalAlerts,
        icon: FiBell,
        color: "text-indigo-600",
        bgColor: "bg-indigo-50",
        description: "All monitoring alerts"
      },
      {
        label: "Active Issues",
        value: stats.unreadAlerts,
        icon: FiEye,
        color: "text-amber-600",
        bgColor: "bg-amber-50",
        description: "Requires attention"
      },
      {
        label: "Resolved",
        value: stats.resolvedAlerts,
        icon: FiCheckCircle,
        color: "text-emerald-600",
        bgColor: "bg-emerald-50",
        description: "Issues fixed"
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
            className="relative bg-white/80 backdrop-blur-sm rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200/60"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-gray-600 font-medium">{card.label}</p>
                <p className={`text-2xl sm:text-3xl font-bold ${card.color} mt-1 sm:mt-2`}>{card.value}</p>
              </div>
              <div className={`w-10 h-10 sm:w-12 sm:h-12 ${card.bgColor} rounded-xl flex items-center justify-center ml-2`}>
                <card.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${card.color}`} />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-center text-xs sm:text-sm text-gray-500">
                <span className="w-2 h-2 bg-gray-400 rounded-full mr-2"></span>
                {card.description}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    );
  };

  const FilterTabs = () => (
    <div className="flex flex-wrap gap-2 mb-6">
      {[
        { key: 'all', label: 'All Alerts', count: alerts.length },
        { key: 'unread', label: 'Unread', count: alerts.filter(a => !a.read).length },
        { key: 'resolved', label: 'Resolved', count: alerts.filter(a => a.read).length }
      ].map((filter) => (
        <button
          key={filter.key}
          onClick={() => setActiveFilter(filter.key)}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${activeFilter === filter.key
              ? 'bg-teal-600 text-white shadow-md'
              : 'bg-white text-gray-600 border border-gray-300 hover:border-teal-300'
            }`}
        >
          {filter.label}
          <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${activeFilter === filter.key ? 'bg-teal-500' : 'bg-gray-200'
            }`}>
            {filter.count}
          </span>
        </button>
      ))}
    </div>
  );

  const AlertDetails = ({ alert }) => {
    if (!alert.details) return null;
    return (
      <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <h5 className="text-sm font-semibold text-gray-900 mb-2">Details:</h5>
        <div className="space-y-2 text-sm text-gray-600">
          {alert.details.currentScore && (
            <div className="flex justify-between">
              <span>Domain Score:</span>
              <span className="font-medium">{alert.details.currentScore}/100</span>
            </div>
          )}
          {alert.details.issues && (
            <div>
              <span className="font-medium">Issues:</span>
              <ul className="list-disc list-inside mt-1 ml-2">
                {alert.details.issues.map((issue, idx) => (
                  <li key={idx}>{issue}</li>
                ))}
              </ul>
            </div>
          )}
          {alert.details.recommendations && (
            <div>
              <span className="font-medium text-emerald-600">Recommendations:</span>
              <ul className="list-disc list-inside mt-1 ml-2">
                {alert.details.recommendations.map((rec, idx) => (
                  <li key={idx}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="w-16 h-16 border-4 border-teal-200 border-t-teal-500 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-600 text-lg font-medium">Loading your alerts...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <div className="mb-8 mt-10">
        <div className="text-center px-4">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl shadow-xl mb-3">
            <FiBell className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            <span className="bg-gradient-to-r from-teal-600 to-teal-700 bg-clip-text text-transparent">
              Email Monitoring Alerts
            </span>
          </h1>
          <p className="text-gray-600 max-w-3xl mx-auto">
            Real-time monitoring of domain health, warmup progress, blacklisting, and email deliverability
          </p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-4 mb-6">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center">
              <FiAlertCircle className="w-5 h-5 text-red-500 mr-3" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-500">
              <FiX className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="p-4">
        <StatisticsCards />
      </div>

      {/* Main Content */}
      <div className="px-4 pb-8">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Email Accounts Section */}
          <div className="xl:col-span-1">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Email Accounts</h3>
                <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                  {emailAccounts.length} accounts
                </span>
              </div>
              <div className="space-y-3">
                {emailAccounts.map((account) => (
                  <div
                    key={account.id}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${selectedAccount?.id === account.id
                        ? 'border-teal-500 bg-teal-50 shadow-md'
                        : 'border-gray-200 hover:border-teal-300'
                      }`}
                    onClick={() => handleAccountSelect(account)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="font-medium text-gray-900 text-sm">
                            {account.email}
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${account.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                            {account.status}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-600">
                          <span className={account.unreadCount > 0 ? 'text-red-600' : 'text-emerald-600'}>
                            {account.unreadCount} active alerts
                          </span>
                          <span>{account.deliverability}% deliverable</span>
                        </div>
                      </div>
                      <FiChevronRight className={`w-4 h-4 ${selectedAccount?.id === account.id ? 'text-teal-600' : 'text-gray-400'
                        }`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Alert Details Section */}
          <div className="xl:col-span-2">
            {selectedAccount ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                {/* Account Header */}
                <div className="p-4 border-b border-gray-200">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Monitoring Alerts for {selectedAccount.email}
                      </h3>
                      <p className="text-gray-600 text-sm">
                        Last checked: {formatDate(selectedAccount.lastChecked)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-2 sm:mt-0">
                      <button
                        className="bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg text-sm flex items-center gap-2"
                        onClick={refreshData}
                        disabled={refreshing}
                      >
                        <FiRefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                        Refresh
                      </button>
                      {stats.unreadAlerts > 0 && (
                        <button
                          className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
                          onClick={markAllAsRead}
                        >
                          <FiCheckCircle className="w-4 h-4" />
                          Mark all as read
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Search and Filters */}
                <div className="p-4 border-b border-gray-200">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                          type="text"
                          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-teal-500"
                          placeholder="Search alerts..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                          <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
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
                <div className="p-4">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Monitoring Alerts</h4>

                  {filteredAlerts.length === 0 ? (
                    <div className="text-center py-8">
                      <FiBell className="w-12 h-12 text-teal-400 mx-auto mb-4" />
                      <p className="text-gray-900 font-medium mb-2">No alerts found</p>
                      <p className="text-gray-600 text-sm">
                        {searchTerm || activeFilter !== 'all'
                          ? 'Try adjusting your search terms or filters.'
                          : 'All systems operational! No issues detected.'
                        }
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <AnimatePresence>
                        {filteredAlerts.map((alert) => (
                          <motion.div
                            key={alert.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className={`p-4 rounded-lg border transition-all ${alert.read ? 'bg-gray-50 border-gray-200' : 'border-l-4 shadow-sm'
                              }`}
                            style={{
                              borderLeftColor: alert.read ? 'transparent' : getSeverityColor(alert.severity),
                              backgroundColor: alert.read ? '#F9FAFB' : getSeverityBgColor(alert.severity)
                            }}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
                              <div className="flex items-start space-x-3 flex-1">
                                <div
                                  className="w-8 h-8 rounded-lg flex items-center justify-center mt-1"
                                  style={{
                                    color: getSeverityColor(alert.severity),
                                    backgroundColor: `${getSeverityColor(alert.severity)}15`
                                  }}
                                >
                                  {getAlertIcon(alert.type)}
                                </div>
                                <div className="flex-1">
                                  <div className="flex flex-wrap items-center gap-2 mb-2">
                                    <span
                                      className="px-2.5 py-0.5 rounded-full text-xs font-medium"
                                      style={{
                                        backgroundColor: `${getSeverityColor(alert.severity)}15`,
                                        color: getSeverityColor(alert.severity)
                                      }}
                                    >
                                      {alert.severity?.charAt(0).toUpperCase() + alert.severity?.slice(1)}
                                    </span>
                                    {!alert.read && (
                                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                        Unread
                                      </span>
                                    )}
                                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                      {getAlertTypeLabel(alert.type)}
                                    </span>
                                  </div>
                                  <p className="text-gray-900 font-medium mb-2">{alert.message}</p>
                                  <p className="text-gray-500 text-sm">
                                    {formatDate(alert.timestamp)}
                                  </p>
                                  <AlertDetails alert={alert} />
                                </div>
                              </div>
                              {!alert.read && (
                                <button
                                  className="sm:ml-4 bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg text-sm flex items-center gap-2 mt-2 sm:mt-0"
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
                                </button>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                <FiMail className="w-12 h-12 text-teal-400 mx-auto mb-4" />
                <p className="text-gray-900 font-medium mb-2">No email accounts found</p>
                <p className="text-gray-600 text-sm">
                  {emailAccounts.length === 0
                    ? 'Add email accounts to start monitoring.'
                    : 'Select an email account to view alerts.'
                  }
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Alert;