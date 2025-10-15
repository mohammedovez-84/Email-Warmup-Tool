import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from "../../context/AuthContext";

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

  // Sample alert data
  const sampleAlerts = [
    { id: 1, type: 'bounce', message: 'High bounce rate detected (12.5%)', timestamp: '2023-05-20T14:22:00Z', read: false, severity: 'high' },
    { id: 2, type: 'spam', message: 'Marked as spam by multiple recipients', timestamp: '2023-05-19T09:45:00Z', read: true, severity: 'medium' },
    { id: 3, type: 'delivery', message: 'Delivery issues to outlook.com domains', timestamp: '2023-05-18T16:30:00Z', read: true, severity: 'low' },
    { id: 4, type: 'reply', message: 'Positive reply received from john@example.com', timestamp: '2023-05-17T11:20:00Z', read: false, severity: 'info' },
    { id: 5, type: 'engagement', message: 'Low open rate detected (15%)', timestamp: '2023-05-16T14:15:00Z', read: false, severity: 'medium' }
  ];

  // Sample email accounts
  const sampleAccounts = [
    {
      id: 1,
      email: 'marketing@pipeline-prospects.com',
      alerts: sampleAlerts,
      lastChecked: '2023-05-20T14:30:00Z'
    },
    {
      id: 2,
      email: 'sales@pipeline-prospects.com',
      alerts: [],
      lastChecked: '2023-05-19T09:15:00Z'
    },
    {
      id: 3,
      email: 'support@pipeline-prospects.com',
      alerts: [],
      lastChecked: '2023-05-20T10:45:00Z'
    }
  ];

  // Check authentication status
  useEffect(() => {
    if (!isAuthenticated()) {
      console.log('User not authenticated, redirecting to login');
      navigate('/login');
      return;
    }

    // Initialize with sample data
    setEmailAccounts(sampleAccounts);
    setSelectedAccount(sampleAccounts[0]);

    // Calculate stats
    const totalAlerts = sampleAlerts.length;
    const unreadAlerts = sampleAlerts.filter(alert => !alert.read).length;

    setStats({
      totalAlerts,
      unreadAlerts,
      resolvedAlerts: totalAlerts - unreadAlerts
    });

    setIsLoading(false);
  }, [navigate, isAuthenticated]);

  const markAsRead = (alertId) => {
    if (!selectedAccount) return;

    const updatedAlerts = selectedAccount.alerts.map(alert =>
      alert.id === alertId ? { ...alert, read: true } : alert
    );

    setEmailAccounts(prev =>
      prev.map(account =>
        account.id === selectedAccount.id ? { ...account, alerts: updatedAlerts } : account
      )
    );

    setSelectedAccount({ ...selectedAccount, alerts: updatedAlerts });

    // Update stats
    setStats(prev => ({
      ...prev,
      unreadAlerts: prev.unreadAlerts - 1,
      resolvedAlerts: prev.resolvedAlerts + 1
    }));
  };

  const markAllAsRead = () => {
    if (!selectedAccount) return;

    const updatedAlerts = selectedAccount.alerts.map(alert => ({
      ...alert,
      read: true
    }));

    setEmailAccounts(prev =>
      prev.map(account =>
        account.id === selectedAccount.id ? { ...account, alerts: updatedAlerts } : account
      )
    );

    setSelectedAccount({ ...selectedAccount, alerts: updatedAlerts });

    // Update stats
    const unreadCount = selectedAccount.alerts.filter(a => !a.read).length;
    setStats(prev => ({
      ...prev,
      unreadAlerts: prev.unreadAlerts - unreadCount,
      resolvedAlerts: prev.resolvedAlerts + unreadCount
    }));
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return '#e53e3e';
      case 'medium': return '#ed8936';
      case 'low': return '#38b2ac';
      case 'info': return '#4299e1';
      default: return '#a0aec0';
    }
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading your alerts...</p>
      </div>
    );
  }

  return (
    <div className="alert-container">
      {/* Animated Background Elements */}
      <div className="background-animation">
        <div className="floating-text">EndBounce</div>
        <div className="floating-text">EndBounce</div>
        <div className="floating-text">EndBounce</div>
        <div className="floating-text">EndBounce</div>
        <div className="floating-text">EndBounce</div>
        <div className="floating-text">EndBounce</div>
      </div>

      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(79, 70, 229, 0.1)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#4f46e5">
              <path d="M3.375 3C2.339 3 1.5 3.84 1.5 4.875v.75c0 1.036.84 1.875 1.875 1.875h17.25c1.035 0 1.875-.84 1.875-1.875v-.75C22.5 3.839 21.66 3 20.625 3H3.375z" />
              <path fillRule="evenodd" d="M3.087 9l.54 9.176A3 3 0 006.62 21h10.757a3 3 0 002.995-2.824L20.913 9H3.087zm6.163 3.75A.75.75 0 0110 12h4a.75.75 0 010 1.5h-4a.75.75 0 01-.75-.75z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="stat-info">
            <h3>{stats.totalAlerts}</h3>
            <p>Total Alerts</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.1)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#f59e0b">
              <path fillRule="evenodd" d="M5.25 9a6.75 6.75 0 0113.5 0v.75c0 2.123.8 4.057 2.118 5.52a.75.75 0 01-.297 1.206c-1.544.57-3.16.99-4.831 1.243a3.75 3.75 0 11-7.48 0 24.585 24.585 0 01-4.831-1.244.75.75 0 01-.298-1.205A8.217 8.217 0 005.25 9.75V9zm4.502 8.9a2.25 2.25 0 104.496 0 25.057 25.057 0 01-4.496 0z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="stat-info">
            <h3>{stats.unreadAlerts}</h3>
            <p>Unread Alerts</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#10b981">
              <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="stat-info">
            <h3>{stats.resolvedAlerts}</h3>
            <p>Resolved Issues</p>
          </div>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="accounts-section">
          <h3>Email Accounts</h3>
          <div className="account-cards">
            {emailAccounts.map(account => (
              <div
                key={account.id}
                className={`account-card ${selectedAccount?.id === account.id ? 'selected' : ''}`}
                onClick={() => setSelectedAccount(account)}
              >
                <div className="account-info">
                  <div className="account-email">{account.email}</div>
                  <div className="account-details">
                    <div className="alert-count">
                      {account.alerts.filter(a => !a.read).length} unread alerts
                    </div>
                  </div>
                </div>
                <div className="account-action">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </div>

        {selectedAccount && (
          <div className="alert-details">
            <div className="account-header">
              <div className="account-title">
                <h3>Alerts for {selectedAccount.email}</h3>
                <div className="last-checked">
                  Last checked: {new Date(selectedAccount.lastChecked).toLocaleString()}
                </div>
              </div>
            </div>

            <div className="alerts-section">
              <div className="section-header">
                <h4>Recent Alerts</h4>
                {selectedAccount.alerts.filter(a => !a.read).length > 0 && (
                  <button className="mark-all-read-btn" onClick={markAllAsRead}>
                    Mark all as read
                  </button>
                )}
              </div>
              <div className="alerts-list">
                {selectedAccount.alerts.length === 0 ? (
                  <div className="no-alerts">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                    </svg>
                    <p>No alerts found for this account.</p>
                    <span>You'll see notifications here when we detect issues with your email delivery.</span>
                  </div>
                ) : (
                  selectedAccount.alerts.map(alert => (
                    <div key={alert.id} className={`alert-item ${alert.read ? 'read' : 'unread'}`}>
                      <div className="alert-icon" style={{ color: getSeverityColor(alert.severity) }}>
                        {alert.type === 'bounce' && (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                            <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-2.625 6c-.54 0-.828.419-.936.634a1.96 1.96 0 00-.189.866c0 .298.059.605.189.866.108.215.395.634.936.634.54 0 .828-.419.936-.634.13-.26.189-.568.189-.866 0-.298-.059-.605-.189-.866-.108-.215-.395-.634-.936-.634zm4.314.634c.108-.215.395-.634.936-.634.54 0 .828.419.936.634.13.26.189.568.189.866 0 .298-.059.605-.189.866-.108.215-.395.634-.936.634-.54 0-.828-.419-.936-.634a1.96 1.96 0 01-.189-.866c0-.298.059-.605.189-.866zm-4.34 7.964a.75.75 0 01-1.061-1.06 5.236 5.236 0 013.73-1.538 5.236 5.236 0 013.695 1.538.75.75 0 11-1.061 1.06 3.736 3.736 0 00-2.639-1.098 3.736 3.736 0 00-2.664 1.098z" clipRule="evenodd" />
                          </svg>
                        )}
                        {alert.type === 'spam' && (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                            <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" clipRule="evenodd" />
                          </svg>
                        )}
                        {alert.type === 'delivery' && (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M3.375 4.5C2.339 4.5 1.5 5.34 1.5 6.375V13.5h12V6.375c0-1.036-.84-1.875-1.875-1.875h-8.25zM13.5 15h-12v2.625c0 1.035.84 1.875 1.875 1.875h.375a3 3 0 116 0h3a.75.75 0 00.75-.75V15z" />
                            <path d="M8.25 19.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0zM15.75 6.75a.75.75 0 00-.75.75v11.25c0 .087.015.17.042.248a3 3 0 015.958.464c.853-.175 1.522-.935 1.464-1.883a18.659 18.659 0 00-3.732-10.104 1.837 1.837 0 00-1.47-.725H15.75z" />
                            <path d="M19.5 19.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
                          </svg>
                        )}
                        {alert.type === 'reply' && (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                            <path fillRule="evenodd" d="M4.804 21.644A6.707 6.707 0 006 21.75a6.721 6.721 0 003.583-1.029c.774.182 1.584.279 2.417.279 5.322 0 9.75-3.97 9.75-9 0-5.03-4.428-9-9.75-9s-9.75 3.97-9.75 9c0 2.409 1.025 4.587 2.674 6.192.232.226.277.428.254.543a3.73 3.73 0 01-.814 1.686.75.75 0 00.44 1.223zM8.25 10.875a1.125 1.125 0 100 2.25 1.125 1.125 0 000-2.25zM10.875 12a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0zm4.875-1.125a1.125 1.125 0 100 2.25 1.125 1.125 0 000-2.25z" clipRule="evenodd" />
                          </svg>
                        )}
                        {alert.type === 'engagement' && (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18.375 2.25c-1.035 0-1.875.84-1.875 1.875v15.75c0 1.035.84 1.875 1.875 1.875h.75c1.035 0 1.875-.84 1.875-1.875V4.125c0-1.036-.84-1.875-1.875-1.875h-.75zM9.75 8.625c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-.75a1.875 1.875 0 01-1.875-1.875V8.625zM3 13.125c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v6.75c0 1.035-.84 1.875-1.875 1.875h-.75A1.875 1.875 0 013 19.875v-6.75z" />
                          </svg>
                        )}
                      </div>
                      <div className="alert-content">
                        <div className="alert-message">{alert.message}</div>
                        <div className="alert-time">
                          {new Date(alert.timestamp).toLocaleString()}
                        </div>
                      </div>
                      {!alert.read && (
                        <button
                          className="mark-read-btn"
                          onClick={() => markAsRead(alert.id)}
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        
        .alert-container {
          padding: 0;
          font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
          color: #1a1d23;
          min-height: 100vh;
          margin-left: 240px;
          width: calc(100% - 240px);
          background: white;
          position: relative;
          overflow: hidden;
        }
        
        /* Animated Background */
        .background-animation {
          position: fixed;
          top: 0;
          left: 240px;
          right: 0;
          bottom: 0;
          z-index: 0;
          overflow: hidden;
          pointer-events: none;
        }
        
        .floating-text {
          position: absolute;
          font-family: 'Arial', sans-serif;
          font-weight: 900;
          font-size: 20px;
          color: rgba(11, 30, 63, 0.03);
          animation: float 25s infinite linear;
          user-select: none;
          white-space: nowrap;
        }
        
        .floating-text:nth-child(1) {
          top: 10%;
          left: 5%;
          animation-duration: 30s;
          animation-delay: 0s;
        }
        
        .floating-text:nth-child(2) {
          top: 30%;
          left: 15%;
          animation-duration: 35s;
          animation-delay: 5s;
        }
        
        .floating-text:nth-child(3) {
          top: 50%;
          left: 25%;
          animation-duration: 40s;
          animation-delay: 10s;
        }
        
        .floating-text:nth-child(4) {
          top: 70%;
          left: 35%;
          animation-duration: 45s;
          animation-delay: 15s;
        }
        
        .floating-text:nth-child(5) {
          top: 20%;
          left: 75%;
          animation-duration: 50s;
          animation-delay: 20s;
        }
        
        .floating-text:nth-child(6) {
          top: 60%;
          left: 85%;
          animation-duration: 55s;
          animation-delay: 25s;
        }
        
        @keyframes float {
          0% {
            transform: translateX(100%) rotate(0deg);
          }
          100% {
            transform: translateX(-100%) rotate(360deg);
          }
        }
        
        .dashboard-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          padding: 24px 32px 0;
          position: relative;
          z-index: 1;
        }
        
        .stat-card {
          background: white;
          border-radius: 12px;
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.04);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          border: 1px solid #e2e8f0;
        }
        
        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 15px rgba(0,0,0,0.07);
        }
        
        .stat-icon {
          width: 56px;
          height: 56px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .stat-icon svg {
          width: 24px;
          height: 24px;
        }
        
        .stat-info h3 {
          margin: 0 0 4px;
          font-size: 24px;
          font-weight: 700;
        }
        
        .stat-info p {
          margin: 0;
          color: #64748b;
          font-size: 14px;
        }
        
        .dashboard-content {
          padding: 24px 32px 32px;
          position: relative;
          z-index: 1;
        }
        
        .accounts-section {
          margin-bottom: 24px;
        }
        
        .accounts-section h3 {
          margin: 0 0 16px;
          color: #2c3e50;
          font-weight: 600;
          font-size: 18px;
        }
        
        .loading-container {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          height: 60vh;
          font-size: 16px;
          color: #666;
        }
        
        .loading-spinner {
          width: 48px;
          height: 48px;
          border: 4px solid #e4e9f2;
          border-top: 4px solid #4a6cf7;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 16px;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .account-cards {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
        }
        
        .account-card {
          background: white;
          border-radius: 12px;
          padding: 20px;
          width: 320px;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 6px rgba(0,0,0,0.04);
          display: flex;
          justify-content: space-between;
          align-items: center;
          border: 1px solid #e2e8f0;
          position: relative;
          z-index: 1;
        }
        
        .account-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 15px rgba(0,0,0,0.07);
        }
        
        .account-card.selected {
          border-color: #4a6cf7;
          background-color: #f0f5ff;
        }
        
        .account-info {
          flex: 1;
        }
        
        .account-email {
          font-weight: 600;
          margin-bottom: 12px;
          color: #2d3748;
        }
        
        .account-details {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        
        .alert-count {
          font-size: 14px;
          color: #e53e3e;
          font-weight: 500;
        }
        
        .account-action svg {
          width: 20px;
          height: 20px;
          color: #a0aec0;
        }
        
        .alert-details {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.04);
          border: 1px solid #e2e8f0;
          position: relative;
          z-index: 1;
        }
        
        .account-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .account-title h3 {
          margin: 0 0 8px 0;
          color: #2d3748;
        }
        
        .last-checked {
          font-size: 14px;
          color: #718096;
        }
        
        .alerts-section {
          margin-bottom: 32px;
        }
        
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        
        .section-header h4 {
          margin: 0;
          color: #2d3748;
          font-size: 18px;
          font-weight: 600;
        }
        
        .mark-all-read-btn {
          background: none;
          border: none;
          color: #4a6cf7;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          padding: 6px 12px;
          border-radius: 4px;
        }
        
        .mark-all-read-btn:hover {
          background-color: #f0f5ff;
        }
        
        .alerts-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .no-alerts {
          padding: 40px 20px;
          text-align: center;
          color: #a0aec0;
          background-color: #f8fafc;
          border-radius: 8px;
          border: 1px dashed #cbd5e0;
        }
        
        .no-alerts svg {
          width: 48px;
          height: 48px;
          margin-bottom: 16px;
          opacity: 0.5;
        }
        
        .no-alerts p {
          margin: 0 0 8px 0;
          font-size: 16px;
          font-weight: 500;
        }
        
        .no-alerts span {
          font-size: 14px;
        }
        
        .alert-item {
          display: flex;
          align-items: center;
          padding: 16px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          gap: 16px;
          transition: all 0.2s ease;
        }
        
        .alert-item.unread {
          background-color: #f0f9ff;
          border-color: #bee3f8;
        }
        
        .alert-item:hover {
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        
        .alert-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 8px;
          flex-shrink: 0;
        }
        
        .alert-icon svg {
          width: 20px;
          height: 20px;
        }
        
        .alert-item.unread .alert-icon {
          background-color: #ebf8ff;
        }
        
        .alert-content {
          flex: 1;
        }
        
        .alert-message {
          margin-bottom: 4px;
          font-weight: 500;
          color: #2d3748;
        }
        
        .alert-time {
          font-size: 12px;
          color: #718096;
        }
        
        .mark-read-btn {
          background-color: #4a6cf7;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: background-color 0.2s;
          flex-shrink: 0;
        }
        
        .mark-read-btn:hover {
          background-color: #3b5bdb;
        }
      `}</style>
    </div>
  );
};

export default Alert;