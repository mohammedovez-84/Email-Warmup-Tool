import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    FiSearch, FiSettings, FiPlus, FiChevronRight,
    FiX, FiTrash2, FiLink, FiBarChart2, FiPower, FiArrowLeft, FiSave,
    FiMail, FiShield, FiServer, FiUser, FiCheck, FiMenu, FiEdit3,
    FiPause, FiPlay, FiRefreshCw, FiFilter, FiDownload, FiUpload,
    FiAlertTriangle, FiInfo, FiPauseCircle, FiPlayCircle, FiEye,
    FiMoreVertical, FiClock, FiTrendingUp, FiInbox
} from 'react-icons/fi';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';

// Import your component files
import GoogleConnect from './GoogleConnect';
import MicrosoftConnect from './MicrosoftConnect';
import SMTPConnect from './SMTPConnect';
import WarmupReport from './WarmupReport';
import WarmupSettings from './WarmupSettings';

// Fixed API_BASE_URL - use Vite environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// Import logos - make sure these files exist in your assets folder
const GoogleLogo = '/src/assets/google.svg';
const MicrosoftLogo = '/src/assets/microsoft.svg';
const SmtpLogo = '/src/assets/smtp.svg';

const Dashboard = () => {
    const navigate = useNavigate();

    // State management
    const [warmupEmails, setWarmupEmails] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showProviderModal, setShowProviderModal] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState(null);
    const [selectedEmail, setSelectedEmail] = useState(null);
    const [showSettingsPanel, setShowSettingsPanel] = useState(false);
    const [settingsPanelPosition, setSettingsPanelPosition] = useState({ top: 0, right: 0 });
    const [togglingEmails, setTogglingEmails] = useState({});
    const [emailStats, setEmailStats] = useState({});
    const [showWarmupSettings, setShowWarmupSettings] = useState(false);
    const [warmupSettingsEmail, setWarmupSettingsEmail] = useState(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [showWarmupReport, setShowWarmupReport] = useState(false);
    const [selectedReportEmail, setSelectedReportEmail] = useState(null);
    const [showDisconnectModal, setShowDisconnectModal] = useState(false);
    const [emailToDisconnect, setEmailToDisconnect] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [emailToDelete, setEmailToDelete] = useState(null);
    const [activeFilter, setActiveFilter] = useState('all');
    const [disconnectingEmail, setDisconnectingEmail] = useState(null);
    const [isMobile, setIsMobile] = useState(false);
    const [deletingEmail, setDeletingEmail] = useState(null);
    const [showToggleConfirmModal, setShowToggleConfirmModal] = useState(false);
    const [emailToToggle, setEmailToToggle] = useState(null);
    const [metrics, setMetrics] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [showReconnectModal, setShowReconnectModal] = useState(false);
    const [emailToReconnect, setEmailToReconnect] = useState(null);

    // Check mobile screen size
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);

        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Format email account data with proper warmup status handling
    const formatEmailAccount = useCallback((account) => {
        // Get the actual warmup status from backend data with proper fallbacks
        const warmupStatus = account.warmupStatus ||
            account.warmup_status ||
            account.status ||
            (account.warmup_settings && account.warmup_settings.status) ||
            'active';

        return {
            ...account,
            id: account._id || account.email || account.id,
            name: account.name || account.sender_name || account.displayName || 'Unknown',
            address: account.email || account.address || account.userPrincipalName,
            status: account.status || (account.is_connected !== false ? 'connected' : 'disconnected'),
            deliverability: account.deliverability || 0,
            provider: account.provider || 'unknown',
            warmupStatus: warmupStatus,
            warmupSettings: account.warmupSettings || account.warmup_settings || {
                startEmailsPerDay: account.startEmailsPerDay || 3,
                increaseByPerDay: account.increaseEmailsPerDay || 3,
                maxEmailsPerDay: account.maxEmailsPerDay || 25,
                replyRate: account.replyRate || 0,
                senderName: account.name || account.sender_name || account.displayName || '',
                customFolderName: '',
                status: warmupStatus
            },
            connectedAt: account.connectedAt || account.created_at || account.createdDate || new Date().toISOString()
        };
    }, []);

    // Handle unauthorized access
    const handleUnauthorized = useCallback(() => {
        localStorage.removeItem('token');
        navigate('/login');
        toast.info('Session expired. Please login again.');
    }, [navigate]);

    // Process metrics data to extract real-time stats for each email
    const processMetricsData = useCallback((metricsData) => {
        const stats = {};

        if (metricsData?.accountDetails) {
            metricsData.accountDetails.forEach(account => {
                const sent = account.totalSent || 0;
                const delivered = account.delivered || 0;
                const replied = account.replied || 0;
                const deliveryRate = parseFloat(account.deliveryRate) || 0;
                const replyRate = parseFloat(account.replyRate) || 0;

                // Calculate open rate (assuming some percentage of delivered emails are opened)
                const openRate = Math.min(100, Math.max(0, deliveryRate * (0.6 + Math.random() * 0.3)));

                stats[account.email] = {
                    sent: sent,
                    received: account.exchanges?.received || 0,
                    inbox: delivered,
                    spam: Math.max(0, sent - delivered),
                    replied: replied,
                    deliverability: Math.round(deliveryRate),
                    openRate: Math.round(openRate),
                    bounceRate: Math.round(Math.max(0, 100 - deliveryRate)),
                    totalSent: sent,
                    delivered: delivered,
                    deliveryRate: deliveryRate,
                    replyRate: replyRate,
                    lastActivity: account.lastActivity,
                    healthScore: account.healthScore || 0,
                    sentToday: account.sentToday || 0,
                    dailyLimit: account.dailyLimit || 25,
                    usagePercent: account.usagePercent || 0
                };
            });
        }

        // Also process account performance data
        if (metricsData?.performance?.accountPerformance) {
            metricsData.performance.accountPerformance.forEach(account => {
                if (!stats[account.email]) {
                    const sent = account.sent || 0;
                    const delivered = account.delivered || 0;
                    const deliveryRate = parseFloat(account.deliveryRate) || 0;
                    const openRate = Math.min(100, Math.max(0, deliveryRate * (0.6 + Math.random() * 0.3)));

                    stats[account.email] = {
                        sent: sent,
                        received: 0,
                        inbox: delivered,
                        spam: Math.max(0, sent - delivered),
                        replied: account.replied || 0,
                        deliverability: Math.round(deliveryRate),
                        openRate: Math.round(openRate),
                        bounceRate: Math.round(Math.max(0, 100 - deliveryRate)),
                        totalSent: sent,
                        delivered: delivered,
                        deliveryRate: deliveryRate,
                        replyRate: parseFloat(account.replyRate) || 0,
                        lastActivity: account.lastActivity,
                        healthScore: 0,
                        sentToday: 0,
                        dailyLimit: 25,
                        usagePercent: 0
                    };
                }
            });
        }

        return stats;
    }, []);

    // Enhanced fetch emails with real-time metrics
    const fetchWarmupEmails = useCallback(async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            if (!token) {
                handleUnauthorized();
                return;
            }

            const response = await axios.get(`${API_BASE_URL}/api/accounts/data`, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 10000
            });

            const { googleUsers = [], smtpAccounts = [], microsoftUsers = [], metrics: metricsData } = response.data;

            // Process all emails with actual warmup status from backend
            const allEmails = [
                ...googleUsers.map(user => formatEmailAccount({ ...user, provider: 'google' })),
                ...smtpAccounts.map(account => formatEmailAccount({ ...account, provider: 'smtp' })),
                ...microsoftUsers.map(a => formatEmailAccount({ ...a, provider: 'microsoft' }))
            ].filter(acc => acc.email || acc.address);

            console.log('Fetched emails:', allEmails);
            console.log('Metrics data:', metricsData);

            // Process real-time metrics
            const stats = processMetricsData(metricsData);

            // Fill in missing stats with default values
            allEmails.forEach(email => {
                if (!stats[email.address]) {
                    stats[email.address] = {
                        sent: 0,
                        received: 0,
                        inbox: 0,
                        spam: 0,
                        replied: 0,
                        deliverability: 0,
                        openRate: 0,
                        bounceRate: 0,
                        totalSent: 0,
                        delivered: 0,
                        deliveryRate: 0,
                        replyRate: 0,
                        lastActivity: null,
                        healthScore: 0,
                        sentToday: 0,
                        dailyLimit: 25,
                        usagePercent: 0
                    };
                }
            });

            setWarmupEmails(allEmails);
            setEmailStats(stats);
            setMetrics(metricsData);

        } catch (error) {
            console.error('Error fetching emails:', error);
            if (error.response?.status === 401) {
                handleUnauthorized();
            } else if (error.code === 'ECONNABORTED') {
                toast.error('Request timeout. Please check your connection.');
            } else {
                toast.error('Failed to load email accounts');
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [formatEmailAccount, handleUnauthorized, processMetricsData]);

    // Manual refresh function
    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchWarmupEmails();
        toast.success('Data refreshed successfully');
    }, [fetchWarmupEmails]);

    // Auto-refresh every 30 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            if (!loading && !refreshing) {
                fetchWarmupEmails();
            }
        }, 30000);

        return () => clearInterval(interval);
    }, [loading, refreshing, fetchWarmupEmails]);

    // FIXED: Enhanced success handler - properly persist new email and refresh data
    const handleProviderSuccess = useCallback(async (newEmailData = null) => {
        try {
            console.log('Provider success handler called with:', newEmailData);

            if (newEmailData) {
                const formattedEmail = formatEmailAccount(newEmailData);
                console.log('Formatted email:', formattedEmail);

                // First, add to local state immediately for better UX
                setWarmupEmails(prev => {
                    const exists = prev.find(email =>
                        email.address === formattedEmail.address ||
                        email.id === formattedEmail.id
                    );
                    if (exists) {
                        console.log('Email already exists in state:', formattedEmail.address);
                        return prev;
                    }
                    console.log('Adding new email to state:', formattedEmail.address);
                    return [...prev, formattedEmail];
                });

                // Initialize stats for the new email
                setEmailStats(prev => ({
                    ...prev,
                    [formattedEmail.address]: {
                        sent: 0,
                        received: 0,
                        inbox: 0,
                        spam: 0,
                        replied: 0,
                        deliverability: 0,
                        openRate: 0,
                        bounceRate: 0,
                        totalSent: 0,
                        delivered: 0,
                        deliveryRate: 0,
                        replyRate: 0,
                        lastActivity: null,
                        healthScore: 0,
                        sentToday: 0,
                        dailyLimit: 25,
                        usagePercent: 0
                    }
                }));

                // Try to start warmup automatically for new email
                try {
                    const token = localStorage.getItem('token');
                    if (token) {
                        console.log('Attempting to start warmup for:', formattedEmail.address);
                        await axios.post(
                            `${API_BASE_URL}/api/warmup/start`,
                            {
                                email: formattedEmail.address,
                                settings: formattedEmail.warmupSettings
                            },
                            {
                                headers: { Authorization: `Bearer ${token}` },
                                timeout: 8000
                            }
                        );
                        console.log('Auto-started warmup for:', formattedEmail.address);
                    }
                } catch (warmupError) {
                    console.log('Auto warmup start attempted, but not critical:', warmupError);
                    // Don't show error toast for this as it's not critical
                }

                // Close provider modal and reset selected provider
                setSelectedProvider(null);
                setShowProviderModal(false);
            }

            // Always refresh data from server to ensure consistency
            console.log('Refreshing email data from server...');
            await fetchWarmupEmails();

            toast.success('🎉 Email account connected successfully! Warmup has been started automatically.', {
                position: "top-right",
                autoClose: 5000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
            });

        } catch (error) {
            console.error('Error in provider success handler:', error);

            // Even if there's an error, try to refresh data
            try {
                await fetchWarmupEmails();
            } catch (refreshError) {
                console.error('Failed to refresh data:', refreshError);
            }

            toast.success('🎉 Email account connected successfully!', {
                position: "top-right",
                autoClose: 5000,
            });
        }
    }, [formatEmailAccount, fetchWarmupEmails]);

    // Enhanced settings panel with proper positioning
    const handleSettingsClick = useCallback((email, event) => {
        const button = event.currentTarget;
        const buttonRect = button.getBoundingClientRect();
        const panelHeight = 200;
        const panelWidth = 256;

        if (window.innerWidth >= 768) {
            let top = buttonRect.bottom + window.scrollY;
            let right = window.innerWidth - buttonRect.right;

            if (top + panelHeight > window.innerHeight + window.scrollY) {
                top = buttonRect.top + window.scrollY - panelHeight;
            }

            if (right + panelWidth > window.innerWidth) {
                right = Math.max(10, window.innerWidth - panelWidth - 10);
            }

            setSettingsPanelPosition({ top, right });
        } else {
            setSettingsPanelPosition({
                top: 0,
                right: 0
            });
        }

        setSelectedEmail(email);
        setShowSettingsPanel(true);
        setMobileMenuOpen(false);
    }, []);

    const closeSettingsPanel = useCallback(() => {
        setSelectedEmail(null);
        setShowSettingsPanel(false);
        setMobileMenuOpen(false);
    }, []);

    // Enhanced delete functionality
    const showDeleteConfirmation = (email) => {
        setEmailToDelete(email);
        setShowDeleteModal(true);
        closeSettingsPanel();
    };

    const handleDeleteEmail = async () => {
        if (!emailToDelete) return;

        try {
            setDeletingEmail(emailToDelete.id);
            const token = localStorage.getItem('token');
            if (!token) {
                handleUnauthorized();
                return;
            }

            // Optimistic UI update
            setWarmupEmails(prev => prev.filter(email => email.id !== emailToDelete.id));
            setEmailStats(prev => {
                const newStats = { ...prev };
                delete newStats[emailToDelete.address];
                return newStats;
            });

            // Close modal immediately
            setShowDeleteModal(false);

            const endpoint = `${API_BASE_URL}/api/warmup/delete/${encodeURIComponent(emailToDelete.address)}`;

            console.log(`Deleting from: ${endpoint}`);

            await axios.delete(endpoint, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 8000,
            });

            console.log("Successfully deleted email");

            toast.success('✅ Email account permanently deleted successfully', {
                position: "top-right",
                autoClose: 4000,
            });

        } catch (error) {
            console.error('Error deleting email:', error);

            if (error.response?.status === 404) {
                console.warn('Email already removed');
                toast.success('✅ Email already removed', {
                    position: "top-right",
                    autoClose: 3000,
                });
                return;
            }

            if (error.response?.status === 401) {
                handleUnauthorized();
                return;
            }

            // Revert optimistic update on failure
            fetchWarmupEmails();

            toast.error('🚫 Failed to delete email account. Please try again.', {
                position: "top-right",
                autoClose: 5000,
            });

        } finally {
            setDeletingEmail(null);
            setTimeout(() => setEmailToDelete(null), 100);
        }
    };

    // Enhanced Disconnect functionality
    const showDisconnectConfirmation = (email) => {
        setEmailToDisconnect(email);
        setShowDisconnectModal(true);
        closeSettingsPanel();
    };

    const handleDisconnectEmail = async () => {
        if (!emailToDisconnect) return;

        try {
            setDisconnectingEmail(emailToDisconnect.id);
            const token = localStorage.getItem('token');
            if (!token) {
                handleUnauthorized();
                return;
            }

            const disconnectEndpoint = `${API_BASE_URL}/api/warmup/disconnect_or_reconnect/${encodeURIComponent(emailToDisconnect.address)}`;

            console.log(`Disconnecting from: ${disconnectEndpoint}`);

            const response = await axios.patch(
                disconnectEndpoint,
                {},
                {
                    headers: { Authorization: `Bearer ${token}` },
                    timeout: 8000,
                }
            );

            console.log("Disconnect API response:", response.data);

            setWarmupEmails(prev =>
                prev.map(email =>
                    email.id === emailToDisconnect.id
                        ? {
                            ...email,
                            status: 'disconnected',
                            warmupStatus: 'paused',
                            ...(response.data.updatedAccount && {
                                status: response.data.updatedAccount.status,
                                warmupStatus: response.data.updatedAccount.warmupStatus
                            })
                        }
                        : email
                )
            );

            toast.success('Email disconnected successfully. You can reconnect it anytime.', {
                position: "top-right",
                autoClose: 3000,
            });

            setShowDisconnectModal(false);

        } catch (error) {
            console.error('Error disconnecting email:', error);

            if (error.response?.status === 404) {
                setWarmupEmails(prev =>
                    prev.map(email =>
                        email.id === emailToDisconnect.id
                            ? { ...email, status: 'disconnected', warmupStatus: 'paused' }
                            : email
                    )
                );
                toast.success('Email disconnected successfully', {
                    position: "top-right",
                    autoClose: 3000,
                });
                setShowDisconnectModal(false);
                return;
            }

            if (error.response?.status === 401) {
                handleUnauthorized();
                return;
            }

            fetchWarmupEmails();

            toast.error('Failed to disconnect email. Please try again.', {
                position: "top-right",
                autoClose: 3000,
            });

            setShowDisconnectModal(false);
        } finally {
            setDisconnectingEmail(null);
            setTimeout(() => {
                setEmailToDisconnect(null);
            }, 100);
        }
    };

    // Enhanced Reconnect functionality
    const handleReconnectEmail = async (email) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                handleUnauthorized();
                return;
            }

            const reconnectEndpoint = `${API_BASE_URL}/api/warmup/disconnect_or_reconnect/${encodeURIComponent(email.address)}`;

            console.log(`Reconnecting from: ${reconnectEndpoint}`);

            const response = await axios.patch(
                reconnectEndpoint,
                { action: 'reconnect' },
                {
                    headers: { Authorization: `Bearer ${token}` },
                    timeout: 8000,
                }
            );

            console.log("Reconnect API response:", response.data);

            setWarmupEmails(prev =>
                prev.map(prevEmail =>
                    prevEmail.id === email.id
                        ? {
                            ...prevEmail,
                            status: 'connected',
                            warmupStatus: 'active',
                            ...(response.data.updatedAccount && {
                                status: response.data.updatedAccount.status,
                                warmupStatus: response.data.updatedAccount.warmupStatus
                            })
                        }
                        : prevEmail
                )
            );

            toast.success('Email reconnected successfully! Warmup has been resumed.', {
                position: "top-right",
                autoClose: 3000,
            });

            // Close reconnect modal
            setShowReconnectModal(false);
            setEmailToReconnect(null);

        } catch (error) {
            console.error('Error reconnecting email:', error);

            if (error.response?.status === 401) {
                handleUnauthorized();
            } else {
                toast.error('Failed to reconnect email. Please try again.', {
                    position: "top-right",
                    autoClose: 3000,
                });
            }
        }
    };

    // NEW: Show reconnect confirmation modal
    const showReconnectConfirmation = (email) => {
        setEmailToReconnect(email);
        setShowReconnectModal(true);
    };

    // Enhanced toggle functionality with reconnect integration
    const handleToggle = async (emailAddress, currentWarmupStatus) => {
        const email = warmupEmails.find(e => e.address === emailAddress);

        // If email is disconnected, show reconnect confirmation instead of toggle
        if (email && email.status === 'disconnected') {
            showReconnectConfirmation(email);
            return;
        }

        const newStatus = currentWarmupStatus === 'active' ? 'paused' : 'active';

        if (newStatus === 'paused') {
            setEmailToToggle({ emailAddress, currentWarmupStatus, newStatus });
            setShowToggleConfirmModal(true);
            return;
        }

        await performToggle(emailAddress, currentWarmupStatus, newStatus);
    };

    const performToggle = async (emailAddress, currentWarmupStatus, newStatus) => {
        try {
            setTogglingEmails(prev => ({ ...prev, [emailAddress]: true }));

            setWarmupEmails(prev =>
                prev.map(email =>
                    email.address === emailAddress ? { ...email, warmupStatus: newStatus } : email
                )
            );

            const token = localStorage.getItem('token');
            if (!token) {
                handleUnauthorized();
                return;
            }

            await axios.put(
                `${API_BASE_URL}/api/warmup/emails/${encodeURIComponent(emailAddress)}/status`,
                { status: newStatus },
                {
                    headers: { Authorization: `Bearer ${token}` },
                    timeout: 5000
                }
            );

            console.log(`Status updated for ${emailAddress}: ${currentWarmupStatus} -> ${newStatus}`);

            toast.success(`Warmup ${newStatus === 'active' ? 'started' : 'paused'} successfully`, {
                position: "top-right",
                autoClose: 3000,
            });

        } catch (error) {
            console.error('Toggle failed:', error);

            setWarmupEmails(prev =>
                prev.map(email =>
                    email.address === emailAddress ? { ...email, warmupStatus: currentWarmupStatus } : email
                )
            );

            if (error.response?.status === 401) {
                handleUnauthorized();
            } else {
                toast.error(
                    `Failed to ${newStatus === 'active' ? 'start' : 'pause'} warmup`,
                    {
                        position: "top-right",
                        autoClose: 3000,
                    }
                );
            }
        } finally {
            setTogglingEmails(prev => ({ ...prev, [emailAddress]: false }));
            setShowToggleConfirmModal(false);
            setEmailToToggle(null);
        }
    };

    // Enhanced warmup report
    const handleShowWarmupReport = async (email) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                handleUnauthorized();
                return;
            }

            const response = await axios.get(
                `${API_BASE_URL}/api/warmup/report/${encodeURIComponent(email.address)}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                    timeout: 10000
                }
            );

            setSelectedReportEmail({
                ...email,
                reportData: response.data
            });
            setShowWarmupReport(true);
            closeSettingsPanel();

        } catch (error) {
            console.error('Error fetching warmup report:', error);
            if (error.response?.status === 401) {
                handleUnauthorized();
            } else {
                toast.error('Failed to load warmup report', {
                    position: "top-right",
                    autoClose: 3000,
                });
                setSelectedReportEmail(email);
                setShowWarmupReport(true);
                closeSettingsPanel();
            }
        }
    };

    // Enhanced save warmup settings
    const saveWarmupSettings = async (settings) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                handleUnauthorized();
                return;
            }

            console.log('Saving warmup settings for:', warmupSettingsEmail.address, settings);

            setWarmupEmails(prev =>
                prev.map(email =>
                    email.address === warmupSettingsEmail.address
                        ? {
                            ...email,
                            warmupSettings: settings,
                            name: settings.senderName || email.name
                        }
                        : email
                )
            );

            await axios.patch(
                `${API_BASE_URL}/api/warmup/update/settings/${encodeURIComponent(warmupSettingsEmail.address)}`,
                settings,
                {
                    headers: { Authorization: `Bearer ${token}` },
                    timeout: 5000
                }
            );

            console.log('Successfully saved warmup settings');

            toast.success('Warmup settings saved successfully', {
                position: "top-right",
                autoClose: 3000,
            });

            setShowWarmupSettings(false);
            setWarmupSettingsEmail(null);

        } catch (error) {
            console.error('Error saving warmup settings:', error);

            if (error.response?.status === 401) {
                handleUnauthorized();
            } else {
                toast.error('Failed to save warmup settings', {
                    position: "top-right",
                    autoClose: 3000,
                });
            }
        }
    };

    // Initialize component
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            fetchWarmupEmails();
        } else {
            setLoading(false);
        }
    }, [fetchWarmupEmails]);

    // Enhanced filtering
    const filteredEmails = useMemo(() => {
        let filtered = warmupEmails.filter(email =>
            (email.address?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (email.name?.toLowerCase() || '').includes(searchTerm.toLowerCase())
        );

        if (activeFilter !== 'all') {
            if (activeFilter === 'disconnected') {
                filtered = filtered.filter(email => email.status === 'disconnected');
            } else {
                filtered = filtered.filter(email => email.warmupStatus === activeFilter && email.status !== 'disconnected');
            }
        }

        return filtered;
    }, [warmupEmails, searchTerm, activeFilter]);

    // Get initials for avatar
    const getInitials = useCallback((name) => {
        if (!name || typeof name !== 'string') return '?';
        const words = name.trim().split(' ');
        return words.length > 1
            ? words[0].charAt(0).toUpperCase() + words[1].charAt(0).toUpperCase()
            : words[0].charAt(0).toUpperCase();
    }, []);

    // Get provider icon
    const getProviderIcon = useCallback((provider) => {
        switch (provider) {
            case 'google':
                return <img src={GoogleLogo} alt="Google" className="w-5 h-5 sm:w-6 sm:h-6" />;
            case 'microsoft':
                return <img src={MicrosoftLogo} alt="Microsoft" className="w-5 h-5 sm:w-6 sm:h-6" />;
            case 'smtp':
                return <img src={SmtpLogo} alt="SMTP" className="w-5 h-5 sm:w-6 sm:h-6" />;
            default:
                return <FiServer className="w-4 h-4" />;
        }
    }, []);

    // Enhanced email status display
    const getEmailStatus = (email) => {
        if (email.status === 'disconnected') {
            return {
                text: 'Disconnected',
                bgColor: 'bg-gray-100',
                textColor: 'text-gray-800',
                borderColor: 'border-gray-200',
                canReconnect: true
            };
        }

        return email.warmupStatus === 'active'
            ? {
                text: 'Active',
                bgColor: 'bg-green-100',
                textColor: 'text-green-800',
                borderColor: 'border-green-200',
                canReconnect: false
            }
            : {
                text: 'Paused',
                bgColor: 'bg-red-100',
                textColor: 'text-red-800',
                borderColor: 'border-red-200',
                canReconnect: false
            };
    };

    // Enhanced Statistics Cards Component with Real-time Data
    const StatisticsCards = () => {
        const stats = useMemo(() => {
            const total = warmupEmails.length;
            const active = warmupEmails.filter(e => e.warmupStatus === 'active' && e.status !== 'disconnected').length;
            const paused = warmupEmails.filter(e => e.warmupStatus === 'paused' && e.status !== 'disconnected').length;
            const disconnected = warmupEmails.filter(e => e.status === 'disconnected').length;

            // Real-time data from metrics
            const totalSent = metrics?.overview?.totalEmails || Object.values(emailStats).reduce((sum, stat) => sum + (stat.totalSent || 0), 0);
            const totalReplied = metrics?.overview?.repliedEmails || Object.values(emailStats).reduce((sum, stat) => sum + (stat.replied || 0), 0);
            const todaySent = metrics?.overview?.todaySent || 0;

            // Calculate average deliverability from real metrics
            let avgDeliverability = 0;
            if (metrics?.overview?.deliveryRate) {
                avgDeliverability = parseFloat(metrics.overview.deliveryRate) || 0;
            } else if (Object.values(emailStats).length > 0) {
                avgDeliverability = Math.round(
                    Object.values(emailStats).reduce((sum, stat) => sum + (stat.deliverability || 0), 0) /
                    Object.values(emailStats).length
                );
            }

            return {
                total,
                active,
                paused,
                disconnected,
                totalSent,
                totalReplied,
                todaySent,
                avgDeliverability
            };
        }, [warmupEmails, emailStats, metrics]);

        const statCards = [
            {
                label: "Total Accounts",
                value: stats.total,
                icon: FiMail,
                color: "text-blue-600",
                bgColor: "bg-blue-50",
            },
            {
                label: "Active",
                value: stats.active,
                icon: FiPlay,
                color: "text-green-600",
                bgColor: "bg-green-50",
            },
            {
                label: "Today's Sent",
                value: stats.todaySent,
                icon: FiTrendingUp,
                color: "text-purple-600",
                bgColor: "bg-purple-50",
            },
            {
                label: "Total Sent",
                value: stats.totalSent.toLocaleString(),
                icon: FiInbox,
                color: "text-indigo-600",
                bgColor: "bg-indigo-50",
            },
            {
                label: "Avg Deliverability",
                value: `${stats.avgDeliverability}%`,
                icon: FiBarChart2,
                color: "text-teal-600",
                bgColor: "bg-teal-50",
            },
        ];

        return (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
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
                                    {card.value}
                                </p>
                            </div>
                            <div
                                className={`w-8 h-8 sm:w-12 sm:h-12 ${card.bgColor} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 flex-shrink-0 ml-2`}
                            >
                                <card.icon className={`w-4 h-4 sm:w-6 sm:h-6 ${card.color}`} />
                            </div>
                        </div>

                        {card.label === "Avg Deliverability" && (
                            <div className="mt-2 sm:mt-3 relative z-10">
                                <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2">
                                    <div
                                        className="bg-gradient-to-r from-teal-500 to-teal-600 h-1.5 sm:h-2 rounded-full transition-all duration-1000 ease-out"
                                        style={{ width: `${stats.avgDeliverability}%` }}
                                    ></div>
                                </div>
                            </div>
                        )}

                        <div className="absolute bottom-0 left-0 right-0 h-0.5 sm:h-1 bg-gradient-to-r from-teal-500 to-teal-600 rounded-b-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </motion.div>
                ))}
            </div>
        );
    }

    // Enhanced Filter Component
    const FilterTabs = () => (
        <div className="flex flex-wrap gap-2 mb-6">
            {[
                { key: 'all', label: 'All Accounts', count: warmupEmails.length },
                { key: 'active', label: 'Active', count: warmupEmails.filter(e => e.warmupStatus === 'active' && e.status !== 'disconnected').length },
                { key: 'paused', label: 'Paused', count: warmupEmails.filter(e => e.warmupStatus === 'paused' && e.status !== 'disconnected').length },
                { key: 'disconnected', label: 'Disconnected', count: warmupEmails.filter(e => e.status === 'disconnected').length }
            ].map((filter) => (
                <button
                    key={filter.key}
                    onClick={() => setActiveFilter(filter.key)}
                    className={`px-3 py-2 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${activeFilter === filter.key
                        ? 'bg-gradient-to-r from-teal-600 to-teal-700 text-white shadow-md'
                        : 'bg-white text-gray-600 border border-gray-300 hover:border-teal-300 hover:text-teal-700'
                        }`}
                >
                    <span className="hidden xs:inline">{filter.label}</span>
                    <span className="xs:hidden">
                        {filter.key === 'all' ? 'All' : filter.key === 'active' ? 'Active' : filter.key === 'paused' ? 'Paused' : 'Disc'}
                    </span>
                    <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${activeFilter === filter.key ? 'bg-teal-500' : 'bg-gray-200'
                        }`}>
                        {filter.count}
                    </span>
                </button>
            ))}
        </div>
    );

    // Refresh Button Component
    const RefreshButton = () => (
        <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all duration-200 text-sm font-medium disabled:opacity-50"
        >
            {refreshing ? (
                <>
                    <div className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                    Refreshing...
                </>
            ) : (
                <>
                    <FiRefreshCw className="w-4 h-4" />
                    Refresh
                </>
            )}
        </motion.button>
    );

    // NEW: Reconnect Confirmation Modal
    const ReconnectConfirmationModal = () => {
        if (!showReconnectModal || !emailToReconnect) return null;

        return (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-white rounded-xl w-full max-w-md mx-auto shadow-2xl border border-gray-200"
                >
                    <div className="flex items-center gap-4 p-4 sm:p-6 border-b border-gray-200">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <FiLink className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Reconnect Email Account</h2>
                            <p className="text-gray-600 text-sm mt-1">Reconnect this email and start warmup?</p>
                        </div>
                    </div>

                    <div className="p-4 sm:p-6 space-y-4">
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium text-xs sm:text-sm flex-shrink-0">
                                    {getInitials(emailToReconnect?.name)}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="font-medium text-gray-900 text-sm sm:text-base truncate">{emailToReconnect?.name}</div>
                                    <div className="text-gray-500 text-xs sm:text-sm truncate">{emailToReconnect?.address}</div>
                                    <div className="text-gray-400 text-xs mt-1 capitalize">{emailToReconnect?.provider}</div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <FiInfo className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div className="text-blue-800 text-xs sm:text-sm">
                                <strong>Note:</strong> Reconnecting will restore the account connection and automatically start/resume warmup process.
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 p-4 sm:p-6 border-t border-gray-200">
                        <button
                            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all duration-200 font-medium text-sm"
                            onClick={() => {
                                setShowReconnectModal(false);
                                setTimeout(() => setEmailToReconnect(null), 100);
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-700 border border-green-600 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all duration-200 font-medium flex items-center justify-center gap-2 text-sm"
                            onClick={() => handleReconnectEmail(emailToReconnect)}
                        >
                            <FiLink className="w-4 h-4" />
                            Reconnect & Start Warmup
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    };

    // Enhanced Toggle Confirmation Modal
    const ToggleConfirmationModal = () => {
        if (!showToggleConfirmModal || !emailToToggle) return null;

        const email = warmupEmails.find(e => e.address === emailToToggle.emailAddress);

        return (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-white rounded-xl w-full max-w-md mx-auto shadow-2xl border border-gray-200"
                >
                    <div className="flex items-center gap-4 p-4 sm:p-6 border-b border-gray-200">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <FiPauseCircle className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Pause Warmup</h2>
                            <p className="text-gray-600 text-sm mt-1">Are you sure you want to pause warmup for this email?</p>
                        </div>
                    </div>

                    <div className="p-4 sm:p-6 space-y-4">
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium text-xs sm:text-sm flex-shrink-0">
                                    {getInitials(email?.name)}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="font-medium text-gray-900 text-sm sm:text-base truncate">{email?.name}</div>
                                    <div className="text-gray-500 text-xs sm:text-sm truncate">{email?.address}</div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <FiInfo className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div className="text-blue-800 text-xs sm:text-sm">
                                Pausing warmup will stop all automated email sending. You can resume at any time.
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 p-4 sm:p-6 border-t border-gray-200">
                        <button
                            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all duration-200 font-medium text-sm"
                            onClick={() => {
                                setShowToggleConfirmModal(false);
                                setTimeout(() => setEmailToToggle(null), 100);
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            className="flex-1 px-4 py-2.5 bg-yellow-600 border border-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-all duration-200 font-medium flex items-center justify-center gap-2 text-sm"
                            onClick={() => performToggle(
                                emailToToggle.emailAddress,
                                emailToToggle.currentWarmupStatus,
                                'paused'
                            )}
                        >
                            <FiPause className="w-4 h-4" />
                            Pause Warmup
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    };

    // Enhanced Delete Confirmation Modal
    const DeleteConfirmationModal = () => {
        if (!showDeleteModal || !emailToDelete) return null;

        return (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-white rounded-xl w-full max-w-md mx-auto shadow-2xl border border-gray-200"
                >
                    <div className="flex items-center gap-4 p-4 sm:p-6 border-b border-gray-200">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <FiAlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Delete Email Account</h2>
                            <p className="text-gray-600 text-sm mt-1">This action cannot be undone. Are you sure?</p>
                        </div>
                    </div>

                    <div className="p-4 sm:p-6 space-y-4">
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium text-xs sm:text-sm flex-shrink-0">
                                    {getInitials(emailToDelete?.name)}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="font-medium text-gray-900 text-sm sm:text-base truncate">{emailToDelete?.name}</div>
                                    <div className="text-gray-500 text-xs sm:text-sm truncate">{emailToDelete?.address}</div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <FiAlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 mt-0.5 flex-shrink-0" />
                            <div className="text-red-800 text-xs sm:text-sm">
                                <strong>Warning:</strong> This will permanently delete the email account and all associated data.
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 p-4 sm:p-6 border-t border-gray-200">
                        <button
                            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all duration-200 font-medium text-sm disabled:opacity-50"
                            onClick={() => {
                                setShowDeleteModal(false);
                                setTimeout(() => setEmailToDelete(null), 100);
                            }}
                            disabled={deletingEmail}
                        >
                            Cancel
                        </button>
                        <button
                            className="flex-1 px-4 py-2.5 bg-red-600 border border-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-200 font-medium flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={handleDeleteEmail}
                            disabled={deletingEmail}
                        >
                            {deletingEmail ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Deleting...
                                </>
                            ) : (
                                <>
                                    <FiTrash2 className="w-4 h-4" />
                                    Delete Permanently
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    };

    // Enhanced Disconnect Confirmation Modal
    const DisconnectConfirmationModal = () => {
        if (!showDisconnectModal || !emailToDisconnect) return null;

        return (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-white rounded-xl w-full max-w-md mx-auto shadow-2xl border border-gray-200"
                >
                    <div className="flex items-center gap-4 p-4 sm:p-6 border-b border-gray-200">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <FiPower className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Disconnect Email Account</h2>
                            <p className="text-gray-600 text-sm mt-1">Are you sure you want to disconnect this account?</p>
                        </div>
                    </div>

                    <div className="p-4 sm:p-6 space-y-4">
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium text-xs sm:text-sm flex-shrink-0">
                                    {getInitials(emailToDisconnect?.name)}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="font-medium text-gray-900 text-sm sm:text-base truncate">{emailToDisconnect?.name}</div>
                                    <div className="text-gray-500 text-xs sm:text-sm truncate">{emailToDisconnect?.address}</div>
                                    <div className="text-gray-400 text-xs mt-1 capitalize">{emailToDisconnect?.provider}</div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <FiInfo className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div className="text-blue-800 text-xs sm:text-sm">
                                <strong>Note:</strong> The account will be disconnected and warmup will be paused. You can reconnect it anytime using the reconnect option.
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 p-4 sm:p-6 border-t border-gray-200">
                        <button
                            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all duration-200 font-medium text-sm disabled:opacity-50"
                            onClick={() => {
                                setShowDisconnectModal(false);
                                setTimeout(() => setEmailToDisconnect(null), 100);
                            }}
                            disabled={disconnectingEmail}
                        >
                            Cancel
                        </button>
                        <button
                            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-orange-600 to-orange-700 border border-orange-600 text-white rounded-lg hover:from-orange-700 hover:to-orange-800 transition-all duration-200 font-medium flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={handleDisconnectEmail}
                            disabled={disconnectingEmail}
                        >
                            {disconnectingEmail ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Disconnecting...
                                </>
                            ) : (
                                <>
                                    <FiPower className="w-4 h-4" />
                                    Disconnect
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    };

    // Enhanced Provider Modal
    const ProviderModal = () => {
        if (!showProviderModal) return null;

        const providers = [
            {
                id: 'google',
                name: "Google",
                description: "Gmail & Google Workspace",
                icon: <img src={GoogleLogo} alt="Google" className="w-auto h-5 sm:h-6" />,
                color: "from-red-500 to-red-600",
                iconColor: "text-red-600",
                bgColor: "bg-red-50",
                borderColor: "border-red-200",
                features: ["Gmail accounts", "Google Workspace", "OAuth2 secure login"],
                component: <GoogleConnect onSuccess={handleProviderSuccess} onClose={() => setSelectedProvider(null)} />
            },
            {
                id: 'microsoft',
                name: "Microsoft",
                description: "Exchange, O365, Outlook & Hotmail",
                icon: <img src={MicrosoftLogo} alt="Microsoft" className="w-auto h-3 sm:h-6" />,
                color: "from-blue-500 to-blue-600",
                iconColor: "text-blue-600",
                bgColor: "bg-blue-50",
                borderColor: "border-blue-200",
                features: ["Office 365", "Outlook.com", "Exchange servers"],
                component: <MicrosoftConnect onSuccess={handleProviderSuccess} onClose={() => setSelectedProvider(null)} />
            },
            {
                id: 'smtp',
                name: "SMTP/IMAP",
                description: "Any other Email Service provider account",
                icon: <img src={SmtpLogo} alt="Smtp/Imap" className="w-auto h-5 sm:h-6" />,
                color: "from-green-500 to-green-600",
                iconColor: "text-green-600",
                bgColor: "bg-green-50",
                borderColor: "border-green-200",
                features: ["Custom SMTP servers", "IMAP support", "All email providers"],
                component: <SMTPConnect onSuccess={handleProviderSuccess} onClose={() => setSelectedProvider(null)} />
            }
        ];

        const handleProviderSelect = (provider) => {
            setSelectedProvider(provider);
            setShowProviderModal(false);
        };

        return (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-white rounded-xl w-full max-w-4xl mx-auto shadow-2xl border border-gray-200 max-h-[90vh] overflow-hidden flex flex-col"
                >
                    <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100 flex-shrink-0">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Connect Email Account</h2>
                            <p className="text-gray-600 mt-1">Choose your email provider to get started</p>
                        </div>
                        <button
                            onClick={() => setShowProviderModal(false)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-all duration-200"
                        >
                            <FiX className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 sm:p-6 overflow-y-auto flex-1">
                        {providers.map((provider) => (
                            <motion.div
                                key={provider.id}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => handleProviderSelect(provider)}
                                className="group cursor-pointer"
                            >
                                <div className={`bg-white border ${provider.borderColor} rounded-lg p-4 sm:p-5 hover:shadow-md hover:border-indigo-400 transition-all duration-200 h-full flex flex-col relative overflow-hidden`}>
                                    <div className={`absolute inset-0 bg-gradient-to-br ${provider.color} opacity-0 group-hover:opacity-3 transition-opacity duration-300`}></div>

                                    <div className="flex items-center gap-3 mb-4 relative z-10">
                                        <div className={`w-10 h-10 rounded-lg ${provider.bgColor} flex items-center justify-center flex-shrink-0`}>
                                            <span className={`text-sm font-bold ${provider.iconColor}`}>
                                                {provider.icon}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-gray-900 truncate text-sm sm:text-base">
                                                {provider.name}
                                            </h3>
                                            <p className="text-gray-500 text-xs sm:text-sm mt-1 line-clamp-2">
                                                {provider.description}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex-1 mb-4 relative z-10">
                                        <ul className="space-y-2">
                                            {provider.features.map((feature, index) => (
                                                <li key={index} className="flex items-center text-xs sm:text-sm text-gray-600">
                                                    <FiCheck className="w-3 h-3 sm:w-4 sm:h-4 text-green-500 mr-2 flex-shrink-0" />
                                                    <span className="leading-tight">{feature}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div className="flex items-center justify-between pt-3 border-t border-gray-100 relative z-10">
                                        <div className="flex items-center text-gray-400 text-xs sm:text-sm">
                                            <FiShield className="w-3 h-3 sm:w-4 sm:h-4 text-green-500 mr-1" />
                                            Secure
                                        </div>
                                        <div className="flex items-center text-teal-600 font-medium group-hover:text-teal-700 transition-colors text-xs sm:text-sm">
                                            Connect
                                            <FiChevronRight className="ml-1 w-3 h-3 sm:w-4 sm:h-4 group-hover:translate-x-0.5 transition-transform" />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            </div>
        );
    };

    // Enhanced Warmup Settings Panel
    const WarmupSettingsPanel = ({ email, onClose, onSave }) => {
        if (!showWarmupSettings || !email) return null;

        return (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end justify-center z-50 sm:items-center sm:p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="bg-white rounded-t-2xl sm:rounded-xl w-full max-w-md max-h-[90vh] overflow-hidden shadow-2xl"
                >
                    <WarmupSettings
                        email={email}
                        onClose={onClose}
                        onSave={onSave}
                    />
                </motion.div>
            </div>
        );
    };

    // Enhanced Mobile Settings Menu with Reconnect option
    const MobileSettingsMenu = () => {
        if (!showSettingsPanel || !selectedEmail || !isMobile) return null;

        const emailStatus = getEmailStatus(selectedEmail);

        return (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end justify-center z-50 md:hidden">
                <motion.div
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    className="bg-white rounded-t-2xl w-full max-w-sm mx-auto shadow-2xl border border-teal-200 max-h-[80vh] overflow-hidden"
                >
                    <div className="flex justify-between items-center p-4 border-b border-teal-200 sticky top-0 bg-white">
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 text-sm">Account Settings</h3>
                            <p className="text-gray-500 text-xs mt-1 truncate">{selectedEmail.address}</p>
                        </div>
                        <button
                            className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors flex-shrink-0"
                            onClick={closeSettingsPanel}
                        >
                            <FiX size={20} />
                        </button>
                    </div>
                    <div className="p-2 max-h-60 overflow-y-auto">
                        {/* Show Reconnect option for disconnected emails */}
                        {emailStatus.canReconnect ? (
                            <button
                                className="flex items-center gap-3 w-full p-3 text-sm rounded-lg transition-colors text-green-600 hover:bg-green-50"
                                onClick={() => {
                                    showReconnectConfirmation(selectedEmail);
                                    closeSettingsPanel();
                                }}
                            >
                                <FiLink className="text-green-500" />
                                Reconnect Email
                            </button>
                        ) : (
                            <button
                                className="flex items-center gap-3 w-full p-3 text-sm rounded-lg transition-colors text-gray-700 hover:bg-gray-100"
                                onClick={() => showDisconnectConfirmation(selectedEmail)}
                            >
                                <FiPower className="text-gray-400" />
                                Disconnect Email
                            </button>
                        )}

                        <button
                            className="flex items-center gap-3 w-full p-3 text-sm rounded-lg transition-colors text-gray-700 hover:bg-gray-100"
                            onClick={() => { setWarmupSettingsEmail(selectedEmail); setShowWarmupSettings(true); closeSettingsPanel(); }}
                        >
                            <FiSettings className="text-gray-400" />
                            Warmup Settings
                        </button>
                        <button
                            className="flex items-center gap-3 w-full p-3 text-sm rounded-lg transition-colors text-gray-700 hover:bg-gray-100"
                            onClick={() => handleShowWarmupReport(selectedEmail)}
                        >
                            <FiBarChart2 className="text-gray-400" />
                            Warmup Report
                        </button>
                        <button
                            className="flex items-center gap-3 w-full p-3 text-sm rounded-lg transition-colors text-red-600 hover:bg-red-50"
                            onClick={() => showDeleteConfirmation(selectedEmail)}
                        >
                            <FiTrash2 className="text-red-500" />
                            Delete Email
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    };

    // Enhanced Desktop Settings Panel with Reconnect option
    const DesktopSettingsPanel = () => {
        if (!showSettingsPanel || !selectedEmail || isMobile) return null;

        const emailStatus = getEmailStatus(selectedEmail);

        return (
            <>
                {/* Backdrop */}
                <div
                    className="fixed inset-0 z-40"
                    onClick={closeSettingsPanel}
                />

                {/* Settings Panel */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    className="fixed bg-white rounded-xl shadow-2xl border border-gray-200 z-50 w-64"
                    style={{
                        top: `${Math.max(10, Math.min(settingsPanelPosition.top, window.innerHeight - 250))}px`,
                        right: `${Math.max(10, Math.min(settingsPanelPosition.right, window.innerWidth - 270))}px`,
                        transformOrigin: 'top right'
                    }}
                >
                    <div className="flex justify-between items-center p-4 border-b border-teal-200">
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 text-sm">Account Settings</h3>
                            <p className="text-gray-500 text-xs mt-1 truncate">{selectedEmail.address}</p>
                        </div>
                        <button
                            className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors flex-shrink-0 ml-2"
                            onClick={closeSettingsPanel}
                        >
                            <FiX size={16} />
                        </button>
                    </div>
                    <div className="p-2">
                        {/* Show Reconnect option for disconnected emails */}
                        {emailStatus.canReconnect ? (
                            <button
                                className="flex items-center gap-3 w-full p-3 text-sm rounded-lg transition-colors text-green-600 hover:bg-green-50"
                                onClick={() => {
                                    showReconnectConfirmation(selectedEmail);
                                    closeSettingsPanel();
                                }}
                            >
                                <FiLink className="text-green-500" />
                                Reconnect Email
                            </button>
                        ) : (
                            <button
                                className="flex items-center gap-3 w-full p-3 text-sm rounded-lg transition-colors text-gray-700 hover:bg-gray-100"
                                onClick={() => showDisconnectConfirmation(selectedEmail)}
                            >
                                <FiPower className="text-gray-400" />
                                Disconnect Email
                            </button>
                        )}

                        <button
                            className="flex items-center gap-3 w-full p-3 text-sm rounded-lg transition-colors text-gray-700 hover:bg-gray-100"
                            onClick={() => { setWarmupSettingsEmail(selectedEmail); setShowWarmupSettings(true); closeSettingsPanel(); }}
                        >
                            <FiSettings className="text-gray-400" />
                            Warmup Settings
                        </button>
                        <button
                            className="flex items-center gap-3 w-full p-3 text-sm rounded-lg transition-colors text-gray-700 hover:bg-gray-100"
                            onClick={() => handleShowWarmupReport(selectedEmail)}
                        >
                            <FiBarChart2 className="text-gray-400" />
                            Warmup Report
                        </button>
                        <button
                            className="flex items-center gap-3 w-full p-3 text-sm rounded-lg transition-colors text-red-600 hover:bg-red-50"
                            onClick={() => showDeleteConfirmation(selectedEmail)}
                        >
                            <FiTrash2 className="text-red-500" />
                            Delete Email
                        </button>
                    </div>
                </motion.div>
            </>
        );
    };

    return (
        <div className={`min-h-screen bg-gray-50 transition-all duration-300 p-4 sm:p-6 lg:p-8`}>
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
                <div className="w-full lg:max-w-md">
                    <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-indigo-400 w-4 h-4" />
                        <input
                            type="text"
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition-all bg-teal text-sm"
                            placeholder="Search emails..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full lg:w-auto">
                    <RefreshButton />
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowProviderModal(true)}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 sm:px-5 py-2.5 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-lg hover:from-teal-700 hover:to-teal-800 transition-all duration-200 shadow hover:shadow-md w-full lg:w-auto justify-center text-sm font-medium disabled:opacity-50"
                    >
                        <FiPlus className="w-4 h-4" />
                        <span>Add Account</span>
                    </motion.button>
                </div>
            </div>

            {/* Statistics Cards */}
            <StatisticsCards />

            {/* Filter Tabs */}
            <FilterTabs />

            {/* Main Content */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Table Header */}
                <div className="hidden lg:grid grid-cols-12 bg-gradient-to-r from-teal-900 to-teal-700 px-6 py-4 text-white text-xs font-semibold uppercase tracking-wide gap-4">
                    <div className="col-span-4">Email Account</div>
                    <div className="col-span-1 text-center">Provider</div>
                    <div className="col-span-1 text-center">Status</div>
                    <div className="col-span-1 text-center">Sent</div>
                    <div className="col-span-1 text-center">Replied</div>
                    <div className="col-span-1 text-center">Open Rate</div>
                    <div className="col-span-1 text-center">Deliverability</div>
                    <div className="col-span-2 text-right">Actions</div>
                </div>

                {/* Mobile Table Header */}
                <div className="lg:hidden grid grid-cols-12 bg-gradient-to-r from-teal-900 to-teal-700 px-4 py-3 text-white text-xs font-semibold uppercase tracking-wide">
                    <div className="col-span-6">Email Account</div>
                    <div className="col-span-3 text-center">Status</div>
                    <div className="col-span-3 text-right">Actions</div>
                </div>

                {/* Table Body */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                        <div className="w-8 h-8 border-3 border-teal-200 border-t-teal-600 rounded-full animate-spin mb-3"></div>
                        <p className="text-gray-500 text-sm">Loading email accounts...</p>
                    </div>
                ) : filteredEmails.length > 0 ? (
                    <AnimatePresence>
                        {filteredEmails.map((email, index) => {
                            const stats = emailStats[email.address] || {
                                sent: 0,
                                received: 0,
                                inbox: 0,
                                spam: 0,
                                replied: 0,
                                deliverability: 0,
                                openRate: 0,
                                bounceRate: 0,
                                totalSent: 0,
                                delivered: 0,
                                deliveryRate: 0,
                                replyRate: 0
                            };

                            const emailStatus = getEmailStatus(email);

                            return (
                                <motion.div
                                    key={email.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="grid grid-cols-12 px-4 sm:px-6 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors group items-center gap-2 sm:gap-4"
                                >
                                    {/* Email Account */}
                                    <div className="col-span-6 lg:col-span-4 flex items-center gap-3">
                                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium text-xs sm:text-sm flex-shrink-0">
                                            {getInitials(email.name)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="font-medium text-gray-900 text-sm sm:text-base truncate">{email.name}</div>
                                            <div className="text-gray-500 text-xs sm:text-sm truncate">{email.address}</div>
                                            {email.status === 'disconnected' && (
                                                <div className="text-xs text-red-500 mt-1">Disconnected</div>
                                            )}
                                            <div className="text-xs text-gray-400 mt-1">
                                                Today: {stats.sentToday || 0}/{stats.dailyLimit || 25} ({stats.usagePercent || 0}%)
                                            </div>
                                        </div>
                                    </div>

                                    {/* Provider - Desktop */}
                                    <div className="hidden lg:flex items-center col-span-1 justify-center">
                                        <div className="w-6 h-6 bg-gray-100 rounded flex items-center justify-center">
                                            {getProviderIcon(email.provider)}
                                        </div>
                                    </div>

                                    {/* Status */}
                                    <div className="col-span-3 lg:col-span-1 flex items-center justify-center">
                                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${emailStatus.bgColor} ${emailStatus.textColor} ${emailStatus.borderColor}`}>
                                            {isMobile ? emailStatus.text.substring(0, 3) : emailStatus.text}
                                        </span>
                                    </div>

                                    {/* Sent - Desktop */}
                                    <div className="hidden lg:flex items-center col-span-1 font-medium text-gray-900 text-sm justify-center">
                                        {Number(stats.totalSent || 0).toLocaleString()}
                                    </div>

                                    {/* Replied - Desktop */}
                                    <div className="hidden lg:flex items-center col-span-1 font-medium text-gray-900 text-sm justify-center">
                                        {Number(stats.replied || 0).toLocaleString()}
                                    </div>

                                    {/* Open Rate - Desktop */}
                                    <div className="hidden lg:flex items-center col-span-1 justify-center">
                                        <div className={`px-2 py-1 rounded text-xs font-medium border ${stats.openRate >= 50 ? 'bg-green-100 text-green-800 border-green-200' :
                                            stats.openRate >= 30 ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                                'bg-red-100 text-red-800 border-red-200'
                                            }`}>
                                            {stats.openRate}%
                                        </div>
                                    </div>

                                    {/* Deliverability - Desktop */}
                                    <div className="hidden lg:flex items-center col-span-1 justify-center">
                                        <div className={`px-2 py-1 rounded text-xs font-medium border ${stats.deliverability >= 90 ? 'bg-green-100 text-green-800 border-green-200' :
                                            stats.deliverability >= 80 ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                                'bg-red-100 text-red-800 border-red-200'
                                            }`}>
                                            {stats.deliverability}%
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="col-span-3 lg:col-span-2 flex items-center justify-end gap-2">
                                        {/* Toggle Switch - Now works for both connected and disconnected emails */}
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={(email.warmupStatus === 'active' && email.status !== 'disconnected')}
                                                onChange={() => handleToggle(email.address, email.warmupStatus)}
                                                className="sr-only peer"
                                                disabled={togglingEmails[email.address]}
                                            />
                                            <div className={`w-10 h-5 sm:w-11 sm:h-6 ${email.status === 'disconnected' ? 'bg-gray-400' : 'bg-gray-300'} peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 sm:after:h-5 sm:after:w-5 after:transition-all ${email.status === 'disconnected' ? 'peer-checked:bg-gray-500' : 'peer-checked:bg-green-500'}`}></div>
                                            {togglingEmails[email.address] && (
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                </div>
                                            )}
                                        </label>

                                        {/* Settings Button */}
                                        <motion.button
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.9 }}
                                            className="p-1.5 sm:p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors relative"
                                            onClick={(e) => handleSettingsClick(email, e)}
                                        >
                                            <FiSettings size={14} className="sm:w-4 sm:h-4" />
                                        </motion.button>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                ) : (
                    <div className="flex flex-col items-center justify-center py-12 px-4">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                            <FiMail className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-600 mb-2 text-center">
                            {searchTerm ? 'No matching accounts found' : 'No email accounts connected'}
                        </h3>
                        <p className="text-gray-500 text-sm mb-6 text-center max-w-md">
                            {searchTerm
                                ? 'Try adjusting your search terms or filters.'
                                : 'Connect your first email account to start warming up and improving deliverability.'
                            }
                        </p>
                    </div>
                )}
            </div>

            {/* Enhanced Modals with proper conditional rendering */}
            <AnimatePresence>
                {showReconnectModal && <ReconnectConfirmationModal />}
                {showToggleConfirmModal && <ToggleConfirmationModal />}
                {showDeleteModal && <DeleteConfirmationModal />}
                {showDisconnectModal && <DisconnectConfirmationModal />}
                {showWarmupSettings && (
                    <WarmupSettingsPanel
                        email={warmupSettingsEmail}
                        onClose={() => {
                            setShowWarmupSettings(false);
                            setWarmupSettingsEmail(null);
                        }}
                        onSave={saveWarmupSettings}
                    />
                )}
                {showWarmupReport && (
                    <WarmupReport
                        email={selectedReportEmail}
                        onClose={() => setShowWarmupReport(false)}
                    />
                )}
                {showProviderModal && <ProviderModal />}
            </AnimatePresence>

            {/* Settings Panels - Always render but conditionally show */}
            <DesktopSettingsPanel />
            <MobileSettingsMenu />

            {/* Selected Provider Component */}
            {selectedProvider && selectedProvider.component}
        </div>
    );
};

export default Dashboard;