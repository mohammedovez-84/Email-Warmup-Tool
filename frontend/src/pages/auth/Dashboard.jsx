import React, { useState, useEffect } from 'react';
import {
    FiSearch, FiSettings, FiPlus, FiChevronRight,
    FiX, FiTrash2, FiLink, FiBarChart2, FiPower, FiArrowLeft, FiSave
} from 'react-icons/fi';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

// Components
import GoogleConnect from './GoogleConnect';
import MicrosoftConnect from './MicrosoftConnect';
import SMTPConnect from './SMTPConnect';
import WarmupSettings from "./WarmupSettings";

const API_BASE_URL = 'http://localhost:5000';

const Dashboard = ({ isSidebarCollapsed }) => {
    const navigate = useNavigate();
    const [state, setState] = useState({
        warmupEmails: [],
        loading: true,
        searchTerm: '',
        showProviderModal: false,
        selectedProvider: null,
        refreshingStats: true,
        selectedEmail: null,
        showSettingsPanel: false,
        togglingEmails: {},
        stats: null,
        accountDetails: null,
        emailStats: {}
    });

    // Warmup Settings state
    const [showWarmupSettings, setShowWarmupSettings] = useState(false);
    const [warmupSettingsEmail, setWarmupSettingsEmail] = useState(null);

    // Helper function to update state
    const updateState = (updates) => {
        setState(prev => ({ ...prev, ...updates }));
    };

    // Format email account data consistently
    const formatEmailAccount = (account) => ({
        ...account,
        id: account._id || account.email,
        name: account.name || account.sender_name || 'Unknown',
        address: account.email,
        status: account.status || 'unknown',
        deliverability: account.deliverability || 0,
        sentToday: account.sentToday || 0,
        receivedToday: account.receivedToday || 0,
        sentTotal: account.sentTotal || 0,
        receivedTotal: account.receivedTotal || 0,
        inboxRate: account.inboxRate || 0,
        spamRate: account.spamRate || 0,
        replyRate: account.replyRate || 0,
        lastActive: account.lastActive || 'Never',
        createdAt: account.createdAt || new Date().toISOString(),
        warmupSettings: account.warmupSettings || {
            startEmailsPerDay: 3,
            increaseByPerDay: 3,
            maxEmailsPerDay: 25,
            replyRate: 0,
            senderName: account.name || '',
            customFolderName: ''
        }
    });

    // Handle unauthorized access
    const handleUnauthorized = () => {
        localStorage.removeItem('token');
        navigate('/login');
        toast.info('Session expired. Please login again.');
    };

    // Fetch emails with proper error handling
    const fetchWarmupEmails = async () => {
        try {
            updateState({ loading: true });
            const token = localStorage.getItem('token');
            if (!token) return;

            const response = await axios.get(`${API_BASE_URL}/api/accounts/data`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const { googleUsers = [], smtpAccounts = [] } = response.data;
            const allEmails = [
                ...googleUsers.map(user => formatEmailAccount(user)),
                ...smtpAccounts.map(account => formatEmailAccount(account))
            ].filter(acc => acc.email);

            // Update email stats for each account
            const emailStats = {};
            allEmails.forEach(email => {
                emailStats[email.address] = {
                    sent: 0,
                    received: 0,
                    inbox: 0,
                    spam: 0,
                    replied: 0
                };
            });

            updateState({
                warmupEmails: allEmails,
                emailStats
            });
        } catch (error) {
            console.error('Error fetching emails:', error);
            if (error.response?.status === 401) {
                handleUnauthorized();
            } else {
                toast.error('Failed to load email accounts');
            }
        } finally {
            updateState({ loading: false });
        }
    };

    const fetchAccountDetails = async (emailId) => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE_URL}/api/accounts/${emailId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return formatEmailAccount(response.data);
        } catch (error) {
            console.error('Error fetching account details:', error);
            return null;
        }
    };

    // Fetch stats from backend
    const fetchStats = async () => {
        try {
            updateState({ refreshingStats: true });
            const token = localStorage.getItem("token");
            const userId = localStorage.getItem("userId");

            if (!userId) {
                console.error("No userId found in localStorage");
                updateState({ refreshingStats: false });
                return;
            }

            const res = await axios.get(`${API_BASE_URL}/api/metrics/user/${userId}/summary`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            const stats = res.data.data || {};

            // Normalize into UI-friendly format
            const emailStats = {};
            for (const email of state.warmupEmails) {
                const senderStats = stats[email.address?.toLowerCase()] || {
                    totalSent: 0,
                    deliveredInbox: 0,
                    repliesReceived: 0,
                    landedSpam: 0,
                    bounced: 0,
                    movedToInbox: 0,
                    deliverabilityScore: 100,
                };

                emailStats[email.address] = {
                    sent: senderStats.totalSent,
                    received: senderStats.deliveredInbox + senderStats.landedSpam,
                    replied: senderStats.repliesReceived,
                    inbox: senderStats.deliveredInbox,
                    spam: senderStats.landedSpam,
                    movedToInbox: senderStats.movedToInbox,
                    deliverability: senderStats.deliverabilityScore, // 👈 renamed for UI
                };
            }

            updateState({
                stats,
                emailStats,
                refreshingStats: false,
            });
        } catch (err) {
            console.error("Error fetching stats:", err);
            updateState({ refreshingStats: false });
        }
    };

    // Get stats for a specific email (from normalized emailStats)
    const getEmailStats = (email) => {
        return state.emailStats?.[email] || {
            sent: 0,
            received: 0,
            replied: 0,
            inbox: 0,
            spam: 0,
            movedToInbox: 0,
            deliverability: 100,
        };
    };



    // Enhanced toggle function with proper status handling
    const handleToggle = async (emailAddress, currentWarmupStatus) => {
        const newStatus = currentWarmupStatus === 'active' ? 'paused' : 'active';

        if (newStatus === 'paused') {
            const confirm = window.confirm('Are you sure you want to pause warmup for this email?');
            if (!confirm) return;
        }

        try {
            updateState(prev => ({
                ...prev,
                togglingEmails: { ...prev.togglingEmails, [emailAddress]: true },
                warmupEmails: prev.warmupEmails.map(email =>
                    email.address === emailAddress ? { ...email, warmupStatus: newStatus } : email
                ),
                accountDetails: prev.accountDetails?.address === emailAddress
                    ? { ...prev.accountDetails, warmupStatus: newStatus }
                    : prev.accountDetails
            }));

            const token = localStorage.getItem('token');
            if (!token) {
                handleUnauthorized();
                return;
            }

            await axios.put(
                `${API_BASE_URL}/api/warmup/emails/${emailAddress}/status`,
                { status: newStatus },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            toast.success(`Warmup ${newStatus === 'active' ? 'started' : 'paused'} successfully`);
            await fetchStats();
        } catch (error) {
            console.error('Toggle failed:', error);

            updateState(prev => ({
                ...prev,
                warmupEmails: prev.warmupEmails.map(email =>
                    email.address === emailAddress ? { ...email, warmupStatus: currentWarmupStatus } : email
                ),
                accountDetails: prev.accountDetails?.address === emailAddress
                    ? { ...prev.accountDetails, warmupStatus: currentWarmupStatus }
                    : prev.accountDetails
            }));

            if (error.response?.status === 401) {
                handleUnauthorized();
            } else {
                toast.error(
                    `Failed to ${newStatus === 'active' ? 'start' : 'pause'} warmup: ${error.response?.data?.message || error.message}`
                );
            }
        } finally {
            updateState(prev => ({
                ...prev,
                togglingEmails: { ...prev.togglingEmails, [emailAddress]: false }
            }));
        }
    };

    // Settings panel handlers
    const handleSettingsClick = (email) => {
        updateState({
            selectedEmail: email,
            showSettingsPanel: true
        });
    };

    const closeSettingsPanel = () => {
        updateState({
            selectedEmail: null,
            showSettingsPanel: false
        });
    };

    // Delete email directly
    const handleDeleteEmail = async (emailId) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                handleUnauthorized();
                return;
            }

            await axios.delete(
                `${API_BASE_URL}/api/accounts/data/${encodeURIComponent(emailId)}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            toast.success('Email deleted successfully');
            fetchWarmupEmails();
            closeSettingsPanel();
        } catch (error) {
            console.error('Error deleting email:', error);
            if (error.response?.status === 401) {
                handleUnauthorized();
            } else {
                toast.error('Failed to delete email');
            }
        }
    };

    // Handle account click to show details
    const handleAccountClick = async (email) => {
        const details = await fetchAccountDetails(email.id);
        if (details) {
            updateState({
                viewMode: 'detail',
                accountDetails: details
            });
        }
    };

    // Save warmup settings
    const saveWarmupSettings = async (settings) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                handleUnauthorized();
                return;
            }

            await axios.put(
                `${API_BASE_URL}/api/warmup/emails/${warmupSettingsEmail.address}/settings`,
                settings,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            toast.success('Warmup settings saved successfully');
            fetchWarmupEmails();
        } catch (error) {
            console.error('Error saving warmup settings:', error);
            toast.error('Failed to save warmup settings');
        }
    };

    // Initialize component
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            fetchWarmupEmails();
            fetchStats();
        } else {
            updateState({ loading: false });
        }

        const interval = setInterval(fetchStats, 15000); // auto-refresh stats every 15 seconds
        return () => clearInterval(interval);
    }, []);


    // Filter emails based on search term
    const filteredEmails = state.warmupEmails.filter(email =>
        (email.address?.toLowerCase() || '').includes(state.searchTerm.toLowerCase()) ||
        (email.name?.toLowerCase() || '').includes(state.searchTerm.toLowerCase()) ||
        (email.id?.toString().toLowerCase() || '').includes(state.searchTerm.toLowerCase())
    );

    // Get initials for avatar
    const getInitials = (name) => {
        if (!name || typeof name !== 'string') return '?';
        const words = name.trim().split(' ');
        return words.length > 1
            ? words[0].charAt(0).toUpperCase() + words[1].charAt(0).toUpperCase()
            : words[0].charAt(0).toUpperCase();
    };

    // Provider configuration
    const providers = [
        {
            id: 'google',
            name: "Google",
            description: "Gmail & Google Workspace",
            icon: "G",
            component: <GoogleConnect onSuccess={fetchWarmupEmails} onClose={() => updateState({ selectedProvider: null })} />
        },
        {
            id: 'microsoft',
            name: "Microsoft",
            description: "Exchange, O365, Outlook & Hotmail",
            icon: "M",
            component: <MicrosoftConnect onSuccess={fetchWarmupEmails} onClose={() => updateState({ selectedProvider: null })} />
        },
        {
            id: 'smtp',
            name: "SMTP/IMAP",
            description: "Any other Email Service provider account",
            icon: "S",
            component: <SMTPConnect onSuccess={fetchWarmupEmails} onClose={() => updateState({ selectedProvider: null })} />
        }
    ];

    const handleProviderSelect = (provider) => {
        updateState({
            selectedProvider: provider,
            showProviderModal: false
        });
    };

    // Warmup Settings Component
    const WarmupSettings = ({ email, onClose, onSave }) => {
        const [settings, setSettings] = useState({
            startEmailsPerDay: email?.warmupSettings?.startEmailsPerDay || 3,
            increaseByPerDay: email?.warmupSettings?.increaseByPerDay || 3,
            maxEmailsPerDay: email?.warmupSettings?.maxEmailsPerDay || 25,
            replyRate: email?.warmupSettings?.replyRate || 0,
            senderName: email?.warmupSettings?.senderName || email?.name || '',
            customFolderName: email?.warmupSettings?.customFolderName || ''
        });

        const handleChange = (e) => {
            const { name, value } = e.target;
            setSettings(prev => ({
                ...prev,
                [name]: value
            }));
        };

        const handleSave = () => {
            onSave(settings);
            onClose();
        };

        return (
            <div className="warmup-settings-container" style={{ display: email ? 'block' : 'none' }}>
                <style jsx>{`
                    .warmup-settings-container {
                        position: fixed;
                        top: 0;
                        right: 0;
                        bottom: 0;
                        width: 85%;
                        max-width: 400px;
                        background: white;
                        box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);
                        z-index: 1000;
                        overflow-y: auto;
                        padding: 24px;
                    }

                    .settings-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 24px;
                        padding-bottom: 16px;
                        border-bottom: 1px solid #e2e8f0;
                    }

                    .settings-title {
                        font-size: 20px;
                        font-weight: 600;
                        color: #1e293b;
                    }

                    .close-btn {
                        background: none;
                        border: none;
                        cursor: pointer;
                        color: #64748b;
                        font-size: 20px;
                    }

                    .settings-form {
                        display: flex;
                        flex-direction: column;
                        gap: 20px;
                    }

                    .form-group {
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                    }

                    .form-label {
                        font-size: 14px;
                        font-weight: 500;
                        color: #334155;
                    }

                    .form-input {
                        padding: 10px 12px;
                        border: 1px solid #e2e8f0;
                        border-radius: 6px;
                        font-size: 14px;
                        transition: all 0.2s;
                    }

                    .form-input:focus {
                        outline: none;
                        border-color: #6366f1;
                        box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
                    }

                    .recommended {
                        font-size: 12px;
                        color: #64748b;
                        margin-top: -4px;
                    }

                    .checkbox-group {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        margin-top: 8px;
                    }

                    .checkbox-input {
                        width: 16px;
                        height: 16px;
                    }

                    .checkbox-label {
                        font-size: 14px;
                        color: #334155;
                    }

                    .form-actions {
                        display: flex;
                        justify-content: space-between;
                        margin-top: 32px;
                        padding-top: 16px;
                        border-top: 1px solid #e2e8f0;
                    }

                    .btn {
                        padding: 10px 16px;
                        border-radius: 6px;
                        font-size: 14px;
                        font-weight: 500;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        transition: all 0.2s;
                    }

                    .btn-discard {
                        background: #f8fafc;
                        border: 1px solid #e2e8f0;
                        color: #64748b;
                    }

                    .btn-discard:hover {
                        background: #f1f5f9;
                    }

                    .btn-save {
                        background: #0d9488;
                        border: 1px solid #0d9488;
                        color: white;
                    }

                    .btn-save:hover {
                        background: #0f766e;
                    }

                    .error-message {
                        color: #dc2626;
                        font-size: 12px;
                        margin-top: 4px;
                    }
                `}</style>

                <div className="settings-header">
                    <h2 className="settings-title">Warm-up Settings</h2>
                    <button className="close-btn" onClick={onClose}>
                        <FiX />
                    </button>
                </div>

                <div className="settings-form">
                    <div className="form-group">
                        <label className="form-label">Start with emails/day (Recommended 3)</label>
                        <input
                            type="number"
                            name="startEmailsPerDay"
                            className="form-input"
                            value={settings.startEmailsPerDay}
                            onChange={handleChange}
                            min="1"
                        />
                        {settings.startEmailsPerDay < 1 && (
                            <p className="error-message">The value could not be less than 1 or in fraction.</p>
                        )}
                    </div>

                    <div className="form-group">
                        <label className="form-label">Increase by emails every day (Recommended 3)</label>
                        <input
                            type="number"
                            name="increaseByPerDay"
                            className="form-input"
                            value={settings.increaseByPerDay}
                            onChange={handleChange}
                            min="1"
                        />
                        {settings.increaseByPerDay < 1 && (
                            <p className="error-message">The value could not be less than 1 or in fraction.</p>
                        )}
                    </div>

                    <div className="form-group">
                        <label className="form-label">Maximum emails to be sent per day (Recommended 25)</label>
                        <input
                            type="number"
                            name="maxEmailsPerDay"
                            className="form-input"
                            value={settings.maxEmailsPerDay}
                            onChange={handleChange}
                            min="1"
                        />
                        {settings.maxEmailsPerDay < 1 && (
                            <p className="error-message">The value could not be less than 1 or in fraction.</p>
                        )}
                    </div>

                    <div className="form-group">
                        <label className="form-label">Reply rate</label>
                        <input
                            type="number"
                            name="replyRate"
                            className="form-input"
                            value={settings.replyRate}
                            onChange={handleChange}
                            min="0"
                            max="100"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Sender name</label>
                        <input
                            type="text"
                            name="senderName"
                            className="form-input"
                            value={settings.senderName}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="checkbox-group">
                        <input
                            type="checkbox"
                            id="customFolder"
                            className="checkbox-input"
                            checked={!!settings.customFolderName}
                            onChange={(e) => setSettings(prev => ({
                                ...prev,
                                customFolderName: e.target.checked ? 'Custom Folder' : ''
                            }))}
                        />
                        <label htmlFor="customFolder" className="checkbox-label">
                            + Add custom name for warmup folder
                        </label>
                    </div>

                    {settings.customFolderName && (
                        <div className="form-group">
                            <input
                                type="text"
                                name="customFolderName"
                                className="form-input"
                                value={settings.customFolderName}
                                onChange={handleChange}
                                placeholder="Enter folder name"
                            />
                        </div>
                    )}
                </div>

                <div className="form-actions">
                    <button className="btn btn-discard" onClick={onClose}>
                        <FiTrash2 /> Discard
                    </button>
                    <button
                        className="btn btn-save"
                        onClick={handleSave}
                        disabled={
                            settings.startEmailsPerDay < 1 ||
                            settings.increaseByPerDay < 1 ||
                            settings.maxEmailsPerDay < 1
                        }
                    >
                        <FiSave /> Save
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className={`dashboard ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            <style jsx>{`
                .dashboard {
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                    margin-left: 250px;
                    margin-right: 40px;
                    padding: 2rem;
                    color: #333;
                    min-height: 180vh;
                    display: flex;
                    flex-direction: column;
                    background-color: #f8fafc;
                    transition: margin-left 0.3s ease;
                    position: relative;
                    width: calc(100% - 280px);
                }

                .dashboard.sidebar-collapsed {
                margin-left: 380px; // Increased from 340px
                margin-right: 30px; // Added right margin
                width: calc(100% - 380px); // Adjusted calculation (380px left + 30px right)
                }

                .dashboard-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.5rem;
                    gap: 1rem;
                    flex-wrap: wrap;
                }

                .search-container {
                    position: relative;
                    flex-grow: 1;
                    max-width: 200px;
                }

                .search-input {
                    width: 100%;
                    padding: 0.75rem 1rem 0.75rem 2.5rem;
                    border: 1px solid #e2e8f0;
                    border-radius: 0.5rem;
                    font-size: 0.875rem;
                    background-color: white;
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
                    transition: all 0.2s ease;
                }

                .search-input:focus {
                    outline: none;
                    border-color: #6366f1;
                    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
                }

                .search-icon {
                    position: absolute;
                    left: 1rem;
                    top: 50%;
                    transform: translateY(-50%);
                    color: #94a3b8;
                    pointer-events: none;
                }

                .action-buttons {
                    display: flex;
                    gap: 0.75rem;
                    align-items: center;
                }

                .btn {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0.75rem 1.25rem;
                    border-radius: 0.5rem;
                    font-size: 0.875rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    gap: 0.5rem;
                    border: none;
                }

                .btn-primary {
                    background: linear-gradient(135deg, #0d9488 0%, #075985 100%);
                    color: white;
                }

                .btn-primary:hover {
                    opacity: 0.9;
                }

                .btn-outline {
                    background: white;
                    border: 1px solid #e2e8f0;
                    color: #64748b;
                }

                .btn-outline:hover {
                    background-color: #f8fafc;
                }

                .btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .emails-table {
                    background-color: white;
                    border-radius: 0.75rem;
                    overflow: hidden;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                    margin-bottom: 2rem;
                    flex-grow: 1;
                    width: 100%;
                    max-width: 2400px; // Add this to limit maximum width
                    margin-left: auto; // Center the table
                    margin-right: auto; // Center the table
                }

                .table-header {
                    display: grid;
                    grid-template-columns: 2fr 1fr 1fr 1fr 1.1fr 0.5fr; 
                    background: linear-gradient(135deg, #0d9488 0%, #075985 100%);
                    padding: 1rem 1.5rem;
                    border-bottom: 1px solid #e2e8f0;
                    font-weight: 600;
                    color: #000000ff;
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .header-cell {
                    padding: 0 0.5rem;
                    text-align: left;
                }

                .table-row {
                    display: grid;
                    grid-template-columns: 2fr 1fr 1fr 1fr 1fr 0.5fr;
                    padding: 1rem 1.5rem;
                    border-bottom: 1px solid #f1f5f9;
                    align-items: center;
                    transition: background-color 0.2s ease;
                }

                .table-row:last-child {
                    border-bottom: none;
                }

                .table-row:hover {
                    background-color: #f8fafc;
                }

                .table-cell {
                    padding: 0 0.5rem;
                }

                .email-cell {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    cursor: pointer;
                }

                .avatar {
                    width: 2.5rem;
                    height: 2.5rem;
                    border-radius: 50%;
                    background-color: #6366f1;
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 500;
                    flex-shrink: 0;
                }

                .email-info {
                    display: flex;
                    flex-direction: column;
                }

                .email-name {
                    font-weight: 500;
                    color: #1e293b;
                    margin-bottom: 0.25rem;
                }

                .email-address {
                    font-size: 0.75rem;
                    color: #64748b;
                }

                .status-badge {
                    display: inline-flex;
                    align-items: center;
                    padding: 0.25rem 0.75rem;
                    border-radius: 9999px;
                    font-size: 0.75rem;
                    font-weight: 500;
                    text-transform: capitalize;
                    transition: all 0.2s ease;
                }

                .status-active {
                    background-color: #dcfce7;
                    color: #166534;
                }

                .status-paused {
                    background-color: #fee2e2;
                    color: #991b1b;
                }

                .status-inactive {
                    background-color: #fee2e2;
                    color: #991b1b;
                }

                .status-unknown {
                    background-color: #e2e8f0;
                    color: #475569;
                }

                .mode-cell {
                    color: #475569;
                }

                .count-cell {
                    font-weight: 500;
                    color: #1e293b;
                }

                .deliverability-container {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .deliverability-bar {
                    flex-grow: 1;
                    height: 1.5rem;
                    background-color: #f1f5f9;
                    border-radius: 9999px;
                    overflow: hidden;
                }

                .deliverability-fill {
                    height: 100%;
                    background-color: #6366f1;
                    border-radius: 9999px;
                    transition: width 0.3s ease;
                    position: relative;
                }

                .deliverability-value {
                    position: absolute;
                    left: 50%;
                    top: 50%;
                    transform: translate(-50%, -50%);
                    font-size: 0.6875rem;
                    font-weight: 600;
                    color: white;
                }

                .actions-cell {
                    display: flex;
                    justify-content: flex-end;
                    gap: 0.5rem;
                }

                .toggle-switch {
                    position: relative;
                    display: inline-block;
                    width: 40px;
                    height: 24px;
                }

                .toggle-input {
                    opacity: 0;
                    width: 0;
                    height: 0;
                }

                .toggle-slider {
                    position: absolute;
                    cursor: pointer;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: #cbd5e1;
                    transition: .4s;
                    border-radius: 34px;
                }

                .toggle-slider:before {
                    position: absolute;
                    content: "";
                    height: 16px;
                    width: 16px;
                    left: 4px;
                    bottom: 4px;
                    background-color: white;
                    transition: .4s;
                    border-radius: 50%;
                }

                .toggle-input:checked + .toggle-slider {
                    background-color: #4f46e5;
                }

                .toggle-input:checked + .toggle-slider:before {
                    transform: translateX(20px);
                }

                .toggle-spinner {
                    display: inline-block;
                    width: 12px;
                    height: 12px;
                    border: 2px solid rgba(255,255,255,0.3);
                    border-radius: 50%;
                    border-top-color: #fff;
                    animation: spin 1s ease-in-out infinite;
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                }

                @keyframes spin {
                    to { transform: translate(-50%, -50%) rotate(360deg); }
                }

                .toggle-input:disabled + .toggle-slider {
                    opacity: 0.7;
                    cursor: not-allowed;
                }

                .action-btn {
                    background: none;
                    border: none;
                    color: #94a3b8;
                    cursor: pointer;
                    padding: 0.25rem;
                    border-radius: 0.25rem;
                    transition: all 0.2s ease;
                }

                .action-btn:hover {
                    color: #6366f1;
                    background-color: #f1f5f9;
                }

                .action-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .loading-state, .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 3rem;
                    grid-column: 1 / -1;
                    color: #64748b;
                    min-height: 200px;
                }

                .spinner {
                    width: 2rem;
                    height: 2rem;
                    border: 3px solid #e2e8f0;
                    border-top-color: #6366f1;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin-bottom: 1rem;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: rgba(0, 0, 0, 0.5);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 50;
                }

                .provider-modal {
                    background-color: white;
                    border-radius: 0.75rem;
                    width: 100%;
                    max-width: 32rem;
                    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
                    overflow: hidden;
                }

                .modal-header {
                    padding: 1.5rem;
                    border-bottom: 1px solid #0e08c0ff;
                }

                .modal-title {
                    font-size: 1.25rem;
                    font-weight: 600;
                    color: #1e293b;
                    margin: 0;
                }

                .provider-list {
                    padding: 0.5rem;
                }

                .provider-item {
                    display: flex;
                    align-items: center;
                    padding: 1rem;
                    border-radius: 0.5rem;
                    cursor: pointer;
                    transition: background-color 0.2s ease;
                    margin-bottom: 0.25rem;
                }

                .provider-item:hover {
                    background-color: #f8fafc;
                }

                .provider-icon {
                    width: 2.5rem;
                    height: 2.5rem;
                    border-radius: 50%;
                    background-color: #6366f1;
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                    margin-right: 1rem;
                    flex-shrink: 0;
                }

                .provider-details {
                    flex-grow: 1;
                }

                .provider-name {
                    font-weight: 500;
                    color: #1e293b;
                    margin-bottom: 0.25rem;
                }

                .provider-description {
                    font-size: 0.875rem;
                    color: #64748b;
                }

                .provider-arrow {
                    color: #cbd5e1;
                }

                .modal-footer {
                    padding: 1.5rem;
                    border-top: 1px solid #e2e8f0;
                    display: flex;
                    justify-content: flex-end;
                }

                .btn-cancel {
                    background-color: white;
                    color: #64748b;
                    border: 1px solid #e2e8f0;
                    padding: 0.5rem 1rem;
                    border-radius: 0.5rem;
                    font-size: 0.875rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .btn-cancel:hover {
                    background-color: #f8fafc;
                }

                .settings-panel {
                    position: fixed;
                    top: 64px;
                    right: 20px;
                    width: 240px;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    z-index: 100;
                    transform: translateX(${state.showSettingsPanel ? '0' : '100%'});
                    transition: transform 0.3s ease;
                    padding: 16px;
                    overflow: hidden;
                    border: 1px solid #e2e8f0;
                }

                .settings-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 12px;
                    padding-bottom: 12px;
                    border-bottom: 1px solid #f1f5f9;
                }

                .settings-title {
                    font-size: 14px;
                    font-weight: 600;
                    color: #1e293b;
                }

                .settings-close {
                    background: none;
                    border: none;
                    color: #64748b;
                    cursor: pointer;
                    font-size: 16px;
                    padding: 4px;
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .settings-close:hover {
                    background-color: #f1f5f9;
                }

                .deliverability-display {
                    text-align: center;
                    margin-bottom: 16px;
                    padding: 12px;
                    background-color: #f8fafc;
                    border-radius: 6px;
                }

                .deliverability-percentage {
                    font-size: 24px;
                    font-weight: 700;
                    color: #f1f5f9;
                    margin-bottom: 4px;
                }

                .deliverability-label {
                    font-size: 10px;
                    font-weight: 600;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .settings-menu {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .settings-item {
                    display: flex;
                    align-items: center;
                    padding: 10px 12px;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    font-size: 13px;
                }

                .settings-item:hover {
                    background-color: #f8fafc;
                }

                .settings-icon {
                    margin-right: 10px;
                    color: #64748b;
                    font-size: 14px;
                }

                .settings-label {
                    flex-grow: 1;
                    font-weight: 500;
                    color: #334155;
                }

                .delete-item {
                    color: #ef4444;
                    margin-top: 8px;
                    border-top: 1px solid #f1f5f9;
                    padding-top: 12px;
                }

                .delete-item:hover {
                    background-color: #fee2e2;
                }

                .stats-section {
                    background-color: white;
                    border-radius: 0.75rem;
                    padding: 1.5rem;
                    margin-bottom: 2rem;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                }

                .stats-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }

                .stats-title {
                    font-size: 1.25rem;
                    font-weight: 600;
                    color: #1e293b;
                }

                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 1rem;
                }

                .stat-card {
                    background-color: #f8fafc;
                    border-radius: 0.5rem;
                    padding: 1rem;
                    text-align: center;
                }

                .stat-value {
                    font-size: 1.5rem;
                    font-weight: 600;
                    color: #1e293b;
                    margin-bottom: 0.25rem;
                }

                .stat-label {
                    font-size: 0.875rem;
                    color: #64748b;
                }

                .account-stats {
                    margin-top: 1.5rem;
                }

                .account-stats-title {
                    font-size: 1rem;
                    font-weight: 500;
                    color: #1e293b;
                    margin-bottom: 1rem;
                }

                .account-stats-list {
                    display: grid;
                    gap: 0.75rem;
                }

                .account-stat-item {
                    display: flex;
                    justify-content: space-between;
                    padding: 0.5rem 0;
                    border-bottom: 1px solid #f1f5f9;
                }

                .account-stat-email {
                    font-weight: 500;
                    color: #1e293b;
                }

                .account-stat-values {
                    display: flex;
                    gap: 1rem;
                }

                .account-stat-value {
                    min-width: 40px;
                    text-align: right;
                }

                /* Account Detail View */
                .account-detail-view {
                    background-color: white;
                    border-radius: 0.75rem;
                    padding: 2rem;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                }

                .account-detail-header {
                    display: flex;
                    align-items: center;
                    margin-bottom: 2rem;
                }

                .back-button {
                    background: none;
                    border: none;
                    cursor: pointer;
                    margin-right: 1rem;
                    color: #64748b;
                }

                .account-detail-title {
                    font-size: 1.5rem;
                    font-weight: 600;
                    color: #1e293b;
                }

                .account-detail-content {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 2rem;
                }

                .account-info-section {
                    margin-bottom: 2rem;
                }

                .account-info-title {
                    font-size: 1rem;
                    font-weight: 600;
                    color: #1e293b;
                    margin-bottom: 1rem;
                    padding-bottom: 0.5rem;
                    border-bottom: 1px solid #f1f5f9;
                }

                .account-info-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                }

                .account-info-item {
                    margin-bottom: 1rem;
                }

                .account-info-label {
                    font-size: 0.875rem;
                    color: #64748b;
                    margin-bottom: 0.25rem;
                }

                .account-info-value {
                    font-weight: 500;
                    color: #1e293b;
                }

                .account-stats-section {
                    background-color: #f8fafc;
                    border-radius: 0.5rem;
                    padding: 1.5rem;
                }

                .account-stats-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 1rem;
                }

                .account-stat-card {
                    background-color: white;
                    border-radius: 0.5rem;
                    padding: 1rem;
                    text-align: center;
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
                }

                .account-stat-value {
                    font-size: 1.25rem;
                    font-weight: 600;
                    color: #1e293b;
                    margin-bottom: 0.25rem;
                }

                .account-stat-label {
                    font-size: 0.875rem;
                    color: #000000ff;
                }

                .deliverability-chart {
                    height: 200px;
                    background-color: #f8fafc;
                    border-radius: 0.5rem;
                    margin-top: 1.5rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #64748b;
                }

                @media (max-width: 768px) {
                    .dashboard {
                        margin-left: 0;
                        margin-right: 0;
                        padding: 1rem;
                        width: 100%;
                    }

                    .dashboard.sidebar-collapsed {
                        margin-left: 0;
                        margin-right: 0;
                        width: 100%;
                    }
                        .emails-table {
                         max-width: 100%; // Full width on mobile
                    }

                    .search-container {
                        max-width: 100%;
                    }

                    .table-header, .table-row {
                        grid-template-columns: 1.5fr 1fr 1fr 1fr 0.5fr;
                    }

                    .header-cell:nth-child(3),
                    .table-cell:nth-child(3) {
                        display: none;
                    }

                    .header-cell:nth-child(4),
                    .table-cell:nth-child(4) {
                        display: none;
                    }

                    .settings-panel {
                        width: 100%;
                    }

                    .stats-grid {
                        grid-template-columns: repeat(2, 1fr);
                    }

                    .account-detail-content {
                        grid-template-columns: 1fr;
                    }
                }

                @media (max-width: 640px) {
                    .table-header, .table-row {
                        grid-template-columns: 1fr 1fr 0.5fr;
                    }

                    .header-cell:nth-child(5),
                    .table-cell:nth-child(5) {
                        display: none;
                    }

                    .stats-grid {
                        grid-template-columns: 1fr;
                    }

                    .account-info-grid {
                        grid-template-columns: 1fr;
                    }
                    .refreshing-indicator {
                     font-size: 0.8rem;
                    color: #64748b;
                     margin-left: 0.5rem;
                    font-style: italic;
                     }
                    .account-stats-grid {
                        grid-template-columns: repeat(2, 1fr);
                    }
                }
            `}</style>

            <div className="dashboard-header">
                <div className="search-container">
                    <FiSearch className="search-icon" />
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Search emails"
                        value={state.searchTerm}
                        onChange={(e) => updateState({ searchTerm: e.target.value })}
                    />
                </div>
                <div className="action-buttons">
                    <button
                        className="btn btn-primary"
                        onClick={() => updateState({ showProviderModal: true })}
                        disabled={state.loading}
                    >
                        <FiPlus /> Add Account
                    </button>
                </div>
            </div>

            {state.viewMode === 'detail' && state.accountDetails ? (
                <div className="account-detail-view">
                    <div className="account-detail-header">
                        <button className="back-button" onClick={() => updateState({ viewMode: 'list' })}>
                            <FiArrowLeft size={24} />
                        </button>
                        <h2 className="account-detail-title">{state.accountDetails.name}</h2>
                    </div>

                    <div className="account-detail-content">
                        <div>
                            <div className="account-info-section">
                                <h3 className="account-info-title">Account Information</h3>
                                <div className="account-info-grid">
                                    <div className="account-info-item">
                                        <div className="account-info-label">Email Address</div>
                                        <div className="account-info-value">{state.accountDetails.address}</div>
                                    </div>
                                    <div className="account-info-item">
                                        <div className="account-info-label">Status</div>
                                        <div className="account-info-value">
                                            <span className={`status-badge ${state.accountDetails.status === 'active' ? 'status-active' :
                                                state.accountDetails.status === 'paused' || state.accountDetails.status === 'inactive' ? 'status-paused' : 'status-unknown'}`}>
                                                {state.accountDetails.status.charAt(0).toUpperCase() + state.accountDetails.status.slice(1)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="account-info-item">
                                        <div className="account-info-label">Created</div>
                                        <div className="account-info-value">
                                            {new Date(state.accountDetails.createdAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <div className="account-info-item">
                                        <div className="account-info-label">Last Active</div>
                                        <div className="account-info-value">{state.accountDetails.lastActive}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="account-info-section">
                                <h3 className="account-info-title">Connection</h3>
                                <div className="account-info-grid">
                                    <div className="account-info-item">
                                        <div className="account-info-label">Provider</div>
                                        <div className="account-info-value">
                                            {state.accountDetails.address.includes('gmail.com') ? 'Google' :
                                                state.accountDetails.address.includes('outlook.com') ? 'Microsoft' : 'SMTP'}
                                        </div>
                                    </div>
                                    <div className="account-info-item">
                                        <div className="account-info-label">Status</div>
                                        <div className="account-info-value">
                                            <span className="status-badge status-active">Connected</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <div className="account-stats-section">
                                <h3 className="account-info-title">Performance Stats</h3>
                                <div className="account-stats-grid">
                                    <div className="account-stat-card">
                                        <div className="account-stat-value">{state.accountDetails.sentTotal}</div>
                                        <div className="account-stat-label">Total Sent</div>
                                    </div>
                                    <div className="account-stat-card">
                                        <div className="account-stat-value">{state.accountDetails.receivedTotal}</div>
                                        <div className="account-stat-label">Total Received</div>
                                    </div>
                                    <div className="account-stat-card">
                                        <div className="account-stat-value">{state.accountDetails.deliverability}%</div>
                                        <div className="account-stat-label">Deliverability</div>
                                    </div>
                                    <div className="account-stat-card">
                                        <div className="account-stat-value">{state.accountDetails.inboxRate}%</div>
                                        <div className="account-stat-label">Inbox Rate</div>
                                    </div>
                                    <div className="account-stat-card">
                                        <div className="account-stat-value">{state.accountDetails.spamRate}%</div>
                                        <div className="account-stat-label">Spam Rate</div>
                                    </div>
                                    <div className="account-stat-card">
                                        <div className="account-stat-value">{state.accountDetails.replyRate}%</div>
                                        <div className="account-stat-label">Reply Rate</div>
                                    </div>
                                </div>

                                <div className="deliverability-chart">
                                    Deliverability Chart (Last 30 Days)
                                </div>
                            </div>

                            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => handleSettingsClick(state.accountDetails)}
                                >
                                    <FiSettings /> Account Settings
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    <div className="emails-table">
                        <div className="table-header">
                            <div className="header-cell">Email Account</div>
                            <div className="header-cell">Status</div>
                            <div className="header-cell">Sent</div>
                            <div className="header-cell">Received</div>
                            <div className="header-cell">Deliverability</div>
                            <div className="header-cell">Toggle</div>
                        </div>

                        {state.loading ? (
                            <div className="loading-state">
                                <div className="spinner"></div>
                                <p>Loading email accounts...</p>
                            </div>
                        ) : filteredEmails.length > 0 ? (
                            filteredEmails.map((email) => {
                                const stats = getEmailStats(email.address);
                                return (
                                    <div className="table-row" key={email.id}>
                                        <div className="table-cell email-cell" onClick={() => handleAccountClick(email)}>
                                            <div className="avatar">{getInitials(email.name)}</div>
                                            <div className="email-info">
                                                <div className="email-name">{email.name}</div>
                                                <div className="email-address">{email.address}</div>
                                            </div>
                                        </div>
                                        <div className="table-cell">
                                            <span className={`status-badge ${email.warmupStatus === 'active' ? 'status-active' :
                                                email.warmupStatus === 'paused' || email.warmupStatus === 'inactive' ? 'status-paused' : 'status-unknown'}`}>
                                                {email.warmupStatus?.charAt(0).toUpperCase() + email.warmupStatus?.slice(1)}
                                            </span>
                                        </div>
                                        <div className="table-cell count-cell">
                                            {Number(stats.sent || 0).toLocaleString()}
                                        </div>
                                        <div className="table-cell count-cell">
                                            {Number(stats.replied || 0).toLocaleString()}
                                        </div>
                                        <div className="table-cell">
                                            <div className="deliverability-container">
                                                <div className="deliverability-bar">
                                                    <div
                                                        className="deliverability-fill"
                                                        style={{ width: `${stats.deliverability}%` }}
                                                    >
                                                        <span className="deliverability-value">
                                                            {stats.deliverability}%
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="table-cell actions-cell">
                                            <label className="toggle-switch">
                                                <input
                                                    type="checkbox"
                                                    checked={email.warmupStatus === 'active'}
                                                    onChange={() => handleToggle(email.address, email.warmupStatus)}
                                                    className="toggle-input"
                                                    disabled={state.togglingEmails[email.address]}
                                                />
                                                <span className="toggle-slider">
                                                    {state.togglingEmails[email.address] && (
                                                        <span className="toggle-spinner"></span>
                                                    )}
                                                </span>
                                            </label>
                                            <button
                                                className="action-btn"
                                                title="Settings"
                                                onClick={() => handleSettingsClick(email)}
                                                disabled={state.togglingEmails[email.id]}
                                            >
                                                <FiSettings />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="empty-state">
                                <p>No email accounts found</p>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => updateState({ showProviderModal: true })}
                                >
                                    <FiPlus /> Add Your First Account
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Settings Panel */}
            <div className="settings-panel">
                {state.selectedEmail && (
                    <>
                        <div className="settings-header">
                            <h3 className="settings-title">Settings</h3>
                            <button className="settings-close" onClick={closeSettingsPanel}>
                                <FiX />
                            </button>
                        </div>

                        <div className="settings-menu">
                            <div className="settings-item" onClick={() => console.log('Disconnect Email')}>
                                <FiPower className="settings-icon" />
                                <span className="settings-label">Disconnect Email</span>
                            </div>
                            <div className="settings-item" onClick={() => {
                                setWarmupSettingsEmail(state.selectedEmail);
                                setShowWarmupSettings(true);
                                closeSettingsPanel();
                            }}>
                                <FiSettings className="settings-icon" />
                                <span className="settings-label">Warmup Settings</span>
                            </div>
                            <div className="settings-item" onClick={() => console.log('View Connection Settings')}>
                                <FiLink className="settings-icon" />
                                <span className="settings-label">View Connection Settings</span>
                            </div>
                            <div className="settings-item" onClick={() => console.log('Warmup Report')}>
                                <FiBarChart2 className="settings-icon" />
                                <span className="settings-label">Warmup Report</span>
                            </div>
                            <div
                                className="settings-item delete-item"
                                onClick={() => handleDeleteEmail(state.selectedEmail.id)}
                            >
                                <FiTrash2 className="settings-icon" />
                                <span className="settings-label">Delete Email</span>
                            </div>
                            <div
                                className="settings-item delete-item"
                                onClick={() => handleDeleteEmail(state.selectedEmail.id)}
                            >
                                <FiTrash2 className="settings-icon" />
                                <span className="settings-label">Delete All</span>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Warmup Settings Panel */}
            {showWarmupSettings && (
                <WarmupSettings
                    email={warmupSettingsEmail}
                    onClose={() => setShowWarmupSettings(false)}
                    onSave={saveWarmupSettings}
                />
            )}

            {/* Provider Selection Modal */}
            {state.showProviderModal && (
                <div className="modal-overlay">
                    <div className="provider-modal">
                        <div className="modal-header">
                            <h3 className="modal-title">Connect Email Account</h3>
                        </div>
                        <div className="provider-list">
                            {providers.map((provider) => (
                                <div
                                    key={provider.id}
                                    className="provider-item"
                                    onClick={() => handleProviderSelect(provider)}
                                >
                                    <div className="provider-icon">{provider.icon}</div>
                                    <div className="provider-details">
                                        <div className="provider-name">{provider.name}</div>
                                        <div className="provider-description">{provider.description}</div>
                                    </div>
                                    <FiChevronRight className="provider-arrow" />
                                </div>
                            ))}
                        </div>
                        <div className="modal-footer">
                            <button
                                className="btn btn-cancel"
                                onClick={() => updateState({ showProviderModal: false })}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Selected Provider Component */}
            {state.selectedProvider && state.selectedProvider.component}
        </div>
    );
};

export default Dashboard;