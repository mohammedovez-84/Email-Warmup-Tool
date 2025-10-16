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
        emailStats: {},
        viewMode: 'list'
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
                    deliverability: senderStats.deliverabilityScore,
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

    // Get stats for a specific email
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

        const interval = setInterval(fetchStats, 15000);
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
    const WarmupSettingsPanel = ({ email, onClose, onSave }) => {
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
            <div className={`fixed top-0 right-0 bottom-0 w-85 max-w-[400px] bg-white shadow-lg z-[1000] overflow-y-auto p-6 transition-all ${email ? "block" : "hidden"}`}>
                {/* Header */}
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200">
                    <h2 className="text-[20px] font-semibold text-slate-800">Warm-up Settings</h2>
                    <button
                        className="text-slate-500 text-xl hover:text-slate-700 transition-colors"
                        onClick={onClose}
                    >
                        <FiX />
                    </button>
                </div>

                {/* Settings Form */}
                <div className="flex flex-col gap-5">
                    {/* Start Emails Per Day */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-slate-700">
                            Start with emails/day (Recommended 3)
                        </label>
                        <input
                            type="number"
                            name="startEmailsPerDay"
                            className="px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                            value={settings.startEmailsPerDay}
                            onChange={handleChange}
                            min="1"
                        />
                        {settings.startEmailsPerDay < 1 && (
                            <p className="text-red-600 text-xs mt-1">
                                The value could not be less than 1 or in fraction.
                            </p>
                        )}
                    </div>

                    {/* Increase By Emails Per Day */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-slate-700">
                            Increase by emails every day (Recommended 3)
                        </label>
                        <input
                            type="number"
                            name="increaseByPerDay"
                            className="px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                            value={settings.increaseByPerDay}
                            onChange={handleChange}
                            min="1"
                        />
                        {settings.increaseByPerDay < 1 && (
                            <p className="text-red-600 text-xs mt-1">
                                The value could not be less than 1 or in fraction.
                            </p>
                        )}
                    </div>

                    {/* Max Emails Per Day */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-slate-700">
                            Maximum emails to be sent per day (Recommended 25)
                        </label>
                        <input
                            type="number"
                            name="maxEmailsPerDay"
                            className="px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                            value={settings.maxEmailsPerDay}
                            onChange={handleChange}
                            min="1"
                        />
                        {settings.maxEmailsPerDay < 1 && (
                            <p className="text-red-600 text-xs mt-1">
                                The value could not be less than 1 or in fraction.
                            </p>
                        )}
                    </div>

                    {/* Reply Rate */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-slate-700">Reply rate</label>
                        <input
                            type="number"
                            name="replyRate"
                            className="px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                            value={settings.replyRate}
                            onChange={handleChange}
                            min="0"
                            max="100"
                        />
                    </div>

                    {/* Sender Name */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-slate-700">Sender name</label>
                        <input
                            type="text"
                            name="senderName"
                            className="px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                            value={settings.senderName}
                            onChange={handleChange}
                        />
                    </div>

                    {/* Checkbox */}
                    <div className="flex items-center gap-2 mt-2">
                        <input
                            type="checkbox"
                            id="customFolder"
                            className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded"
                            checked={!!settings.customFolderName}
                            onChange={(e) =>
                                setSettings((prev) => ({
                                    ...prev,
                                    customFolderName: e.target.checked ? "Custom Folder" : "",
                                }))
                            }
                        />
                        <label htmlFor="customFolder" className="text-sm text-slate-700">
                            + Add custom name for warmup folder
                        </label>
                    </div>

                    {/* Custom Folder Name Input */}
                    {settings.customFolderName && (
                        <div className="flex flex-col gap-2">
                            <input
                                type="text"
                                name="customFolderName"
                                className="px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                                value={settings.customFolderName}
                                onChange={handleChange}
                                placeholder="Enter folder name"
                            />
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex justify-between mt-8 pt-4 border-t border-slate-200">
                    <button
                        className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 transition-all"
                        onClick={onClose}
                    >
                        <FiTrash2 /> Discard
                    </button>
                    <button
                        className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium border border-teal-600 bg-teal-600 text-white hover:bg-teal-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
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
        <div className={`min-h-screen bg-slate-50 font-inter transition-all duration-300 ${isSidebarCollapsed ? 'ml-[380px] mr-[30px] w-[calc(100%-380px)]' : 'ml-[250px] mr-[40px]'
            }`}>
            {/* Main Content */}
            <div className="p-8">
                {/* Header */}
                <div className="flex justify-between items-center mb-6 gap-4 flex-wrap">
                    <div className="relative flex-grow max-w-[200px]">
                        <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg text-sm bg-white shadow-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                            placeholder="Search emails"
                            value={state.searchTerm}
                            onChange={(e) => updateState({ searchTerm: e.target.value })}
                        />
                    </div>
                    <div className="flex gap-3 items-center">
                        <button
                            className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-teal-600 to-cyan-800 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-all disabled:opacity-60"
                            onClick={() => updateState({ showProviderModal: true })}
                            disabled={state.loading}
                        >
                            <FiPlus size={16} /> Add Account
                        </button>
                    </div>
                </div>

                {/* Account Detail View */}
                {state.viewMode === 'detail' && state.accountDetails ? (
                    <div className="bg-white rounded-xl shadow-sm p-8">
                        <div className="flex items-center mb-8">
                            <button
                                className="mr-4 text-slate-500 hover:text-slate-700 transition-colors"
                                onClick={() => updateState({ viewMode: 'list' })}
                            >
                                <FiArrowLeft size={24} />
                            </button>
                            <h2 className="text-2xl font-semibold text-slate-800">{state.accountDetails.name}</h2>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Left Column - Account Info */}
                            <div>
                                <div className="mb-8">
                                    <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b border-slate-200">Account Information</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <div className="text-sm text-slate-500 mb-1">Email Address</div>
                                            <div className="font-medium text-slate-800">{state.accountDetails.address}</div>
                                        </div>
                                        <div>
                                            <div className="text-sm text-slate-500 mb-1">Status</div>
                                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${state.accountDetails.status === 'active'
                                                    ? 'bg-green-100 text-green-800'
                                                    : state.accountDetails.status === 'paused' || state.accountDetails.status === 'inactive'
                                                        ? 'bg-red-100 text-red-800'
                                                        : 'bg-slate-100 text-slate-800'
                                                }`}>
                                                {state.accountDetails.status.charAt(0).toUpperCase() + state.accountDetails.status.slice(1)}
                                            </span>
                                        </div>
                                        <div>
                                            <div className="text-sm text-slate-500 mb-1">Created</div>
                                            <div className="font-medium text-slate-800">
                                                {new Date(state.accountDetails.createdAt).toLocaleDateString()}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-sm text-slate-500 mb-1">Last Active</div>
                                            <div className="font-medium text-slate-800">{state.accountDetails.lastActive}</div>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b border-slate-200">Connection</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <div className="text-sm text-slate-500 mb-1">Provider</div>
                                            <div className="font-medium text-slate-800">
                                                {state.accountDetails.address.includes('gmail.com') ? 'Google' :
                                                    state.accountDetails.address.includes('outlook.com') ? 'Microsoft' : 'SMTP'}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-sm text-slate-500 mb-1">Status</div>
                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                Connected
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column - Performance Stats */}
                            <div>
                                <div className="bg-slate-50 rounded-lg p-6">
                                    <h3 className="text-lg font-semibold text-slate-800 mb-4">Performance Stats</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                                        <div className="bg-white rounded-lg p-4 text-center shadow-sm">
                                            <div className="text-xl font-semibold text-slate-800 mb-1">{state.accountDetails.sentTotal}</div>
                                            <div className="text-sm text-slate-600">Total Sent</div>
                                        </div>
                                        <div className="bg-white rounded-lg p-4 text-center shadow-sm">
                                            <div className="text-xl font-semibold text-slate-800 mb-1">{state.accountDetails.receivedTotal}</div>
                                            <div className="text-sm text-slate-600">Total Received</div>
                                        </div>
                                        <div className="bg-white rounded-lg p-4 text-center shadow-sm">
                                            <div className="text-xl font-semibold text-slate-800 mb-1">{state.accountDetails.deliverability}%</div>
                                            <div className="text-sm text-slate-600">Deliverability</div>
                                        </div>
                                        <div className="bg-white rounded-lg p-4 text-center shadow-sm">
                                            <div className="text-xl font-semibold text-slate-800 mb-1">{state.accountDetails.inboxRate}%</div>
                                            <div className="text-sm text-slate-600">Inbox Rate</div>
                                        </div>
                                        <div className="bg-white rounded-lg p-4 text-center shadow-sm">
                                            <div className="text-xl font-semibold text-slate-800 mb-1">{state.accountDetails.spamRate}%</div>
                                            <div className="text-sm text-slate-600">Spam Rate</div>
                                        </div>
                                        <div className="bg-white rounded-lg p-4 text-center shadow-sm">
                                            <div className="text-xl font-semibold text-slate-800 mb-1">{state.accountDetails.replyRate}%</div>
                                            <div className="text-sm text-slate-600">Reply Rate</div>
                                        </div>
                                    </div>

                                    <div className="h-48 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500">
                                        Deliverability Chart (Last 30 Days)
                                    </div>

                                    <div className="mt-6 flex justify-end">
                                        <button
                                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                                            onClick={() => handleSettingsClick(state.accountDetails)}
                                        >
                                            <FiSettings /> Account Settings
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Email Accounts Table */
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden max-w-[2400px] mx-auto">
                        {/* Table Header */}
                        <div className="grid grid-cols-[2fr,1fr,1fr,1fr,1.1fr,0.5fr] bg-gradient-to-r from-teal-600 to-cyan-800 px-6 py-4 border-b border-slate-200">
                            <div className="text-xs font-semibold text-white uppercase tracking-wider">Email Account</div>
                            <div className="text-xs font-semibold text-white uppercase tracking-wider">Status</div>
                            <div className="text-xs font-semibold text-white uppercase tracking-wider">Sent</div>
                            <div className="text-xs font-semibold text-white uppercase tracking-wider">Received</div>
                            <div className="text-xs font-semibold text-white uppercase tracking-wider">Deliverability</div>
                            <div className="text-xs font-semibold text-white uppercase tracking-wider text-right">Toggle</div>
                        </div>

                        {/* Table Body */}
                        {state.loading ? (
                            <div className="flex flex-col items-center justify-center py-12 col-span-full text-slate-500">
                                <div className="w-8 h-8 border-3 border-slate-200 border-t-indigo-600 rounded-full animate-spin mb-3"></div>
                                <p>Loading email accounts...</p>
                            </div>
                        ) : filteredEmails.length > 0 ? (
                            filteredEmails.map((email) => {
                                const stats = getEmailStats(email.address);
                                return (
                                    <div key={email.id} className="grid grid-cols-[2fr,1fr,1fr,1fr,1fr,0.5fr] px-6 py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors items-center">
                                        {/* Email Account */}
                                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleAccountClick(email)}>
                                            <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-medium flex-shrink-0">
                                                {getInitials(email.name)}
                                            </div>
                                            <div>
                                                <div className="font-medium text-slate-800 mb-1">{email.name}</div>
                                                <div className="text-sm text-slate-500">{email.address}</div>
                                            </div>
                                        </div>

                                        {/* Status */}
                                        <div>
                                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${email.warmupStatus === 'active'
                                                    ? 'bg-green-100 text-green-800'
                                                    : email.warmupStatus === 'paused' || email.warmupStatus === 'inactive'
                                                        ? 'bg-red-100 text-red-800'
                                                        : 'bg-slate-100 text-slate-800'
                                                }`}>
                                                {email.warmupStatus?.charAt(0).toUpperCase() + email.warmupStatus?.slice(1)}
                                            </span>
                                        </div>

                                        {/* Sent */}
                                        <div className="font-medium text-slate-800">
                                            {Number(stats.sent || 0).toLocaleString()}
                                        </div>

                                        {/* Received */}
                                        <div className="font-medium text-slate-800">
                                            {Number(stats.replied || 0).toLocaleString()}
                                        </div>

                                        {/* Deliverability */}
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <div className="flex-grow h-6 bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-indigo-600 rounded-full relative transition-all duration-300"
                                                        style={{ width: `${stats.deliverability}%` }}
                                                    >
                                                        <span className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xs font-semibold text-white">
                                                            {stats.deliverability}%
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Toggle & Actions */}
                                        <div className="flex justify-end items-center gap-2">
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={email.warmupStatus === 'active'}
                                                    onChange={() => handleToggle(email.address, email.warmupStatus)}
                                                    className="sr-only peer"
                                                    disabled={state.togglingEmails[email.address]}
                                                />
                                                <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-4 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 relative">
                                                    {state.togglingEmails[email.address] && (
                                                        <div className="absolute inset-0 flex items-center justify-center">
                                                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                        </div>
                                                    )}
                                                </div>
                                            </label>
                                            <button
                                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                                                title="Settings"
                                                onClick={() => handleSettingsClick(email)}
                                                disabled={state.togglingEmails[email.id]}
                                            >
                                                <FiSettings size={16} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 col-span-full text-slate-500">
                                <p className="mb-4">No email accounts found</p>
                                <button
                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                                    onClick={() => updateState({ showProviderModal: true })}
                                >
                                    <FiPlus /> Add Your First Account
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Settings Panel */}
            <div className={`fixed top-16 right-5 w-60 bg-white rounded-lg shadow-lg z-50 transform transition-transform ${state.showSettingsPanel ? 'translate-x-0' : 'translate-x-full'
                } border border-slate-200`}>
                {state.selectedEmail && (
                    <>
                        <div className="flex justify-between items-center p-4 border-b border-slate-200">
                            <h3 className="text-sm font-semibold text-slate-800">Settings</h3>
                            <button
                                className="p-1 text-slate-500 hover:text-slate-700 rounded transition-colors"
                                onClick={closeSettingsPanel}
                            >
                                <FiX size={16} />
                            </button>
                        </div>

                        <div className="p-2">
                            <div className="flex flex-col gap-1">
                                <button className="flex items-center gap-3 p-3 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition-colors w-full text-left">
                                    <FiPower className="text-slate-500" size={14} />
                                    <span>Disconnect Email</span>
                                </button>
                                <button
                                    className="flex items-center gap-3 p-3 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition-colors w-full text-left"
                                    onClick={() => {
                                        setWarmupSettingsEmail(state.selectedEmail);
                                        setShowWarmupSettings(true);
                                        closeSettingsPanel();
                                    }}
                                >
                                    <FiSettings className="text-slate-500" size={14} />
                                    <span>Warmup Settings</span>
                                </button>
                                <button className="flex items-center gap-3 p-3 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition-colors w-full text-left">
                                    <FiLink className="text-slate-500" size={14} />
                                    <span>View Connection Settings</span>
                                </button>
                                <button className="flex items-center gap-3 p-3 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition-colors w-full text-left">
                                    <FiBarChart2 className="text-slate-500" size={14} />
                                    <span>Warmup Report</span>
                                </button>
                                <div className="border-t border-slate-200 mt-2 pt-2">
                                    <button
                                        className="flex items-center gap-3 p-3 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors w-full text-left"
                                        onClick={() => handleDeleteEmail(state.selectedEmail.id)}
                                    >
                                        <FiTrash2 className="text-red-500" size={14} />
                                        <span>Delete Email</span>
                                    </button>
                                    <button className="flex items-center gap-3 p-3 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors w-full text-left">
                                        <FiTrash2 className="text-red-500" size={14} />
                                        <span>Delete All</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Warmup Settings Panel */}
            {showWarmupSettings && (
                <WarmupSettingsPanel
                    email={warmupSettingsEmail}
                    onClose={() => setShowWarmupSettings(false)}
                    onSave={saveWarmupSettings}
                />
            )}

            {/* Provider Selection Modal */}
            {state.showProviderModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
                        <div className="p-6 border-b border-slate-200">
                            <h3 className="text-xl font-semibold text-slate-800">Connect Email Account</h3>
                        </div>
                        <div className="p-2">
                            {providers.map((provider) => (
                                <div
                                    key={provider.id}
                                    className="flex items-center p-4 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors mb-1"
                                    onClick={() => handleProviderSelect(provider)}
                                >
                                    <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold mr-4 flex-shrink-0">
                                        {provider.icon}
                                    </div>
                                    <div className="flex-grow">
                                        <div className="font-medium text-slate-800 mb-1">{provider.name}</div>
                                        <div className="text-sm text-slate-500">{provider.description}</div>
                                    </div>
                                    <FiChevronRight className="text-slate-400" />
                                </div>
                            ))}
                        </div>
                        <div className="p-6 border-t border-slate-200 flex justify-end">
                            <button
                                className="px-4 py-2 text-slate-600 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
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