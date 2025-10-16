import React, { useState, useEffect } from 'react';
import {
    FiSearch, FiSettings, FiPlus, FiChevronRight,
    FiX, FiTrash2, FiLink, FiBarChart2, FiPower, FiArrowLeft, FiSave,
    FiMail, FiShield, FiServer, FiUser, FiCheck
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

    // State management
    const [warmupEmails, setWarmupEmails] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showProviderModal, setShowProviderModal] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState(null);
    const [selectedEmail, setSelectedEmail] = useState(null);
    const [showSettingsPanel, setShowSettingsPanel] = useState(false);
    const [togglingEmails, setTogglingEmails] = useState({});
    const [emailStats, setEmailStats] = useState({});
    const [showWarmupSettings, setShowWarmupSettings] = useState(false);
    const [warmupSettingsEmail, setWarmupSettingsEmail] = useState(null);

    // Format email account data
    const formatEmailAccount = (account) => ({
        ...account,
        id: account._id || account.email,
        name: account.name || account.sender_name || 'Unknown',
        address: account.email,
        status: account.status || 'unknown',
        deliverability: account.deliverability || 0,
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

    // Fetch emails
    const fetchWarmupEmails = async () => {
        try {
            setLoading(true);
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

            // Initialize email stats
            const stats = {};
            allEmails.forEach(email => {
                stats[email.address] = {
                    sent: 0,
                    received: 0,
                    inbox: 0,
                    spam: 0,
                    replied: 0,
                    deliverability: email.deliverability || 100
                };
            });

            setWarmupEmails(allEmails);
            setEmailStats(stats);
        } catch (error) {
            console.error('Error fetching emails:', error);
            if (error.response?.status === 401) {
                handleUnauthorized();
            } else {
                toast.error('Failed to load email accounts');
            }
        } finally {
            setLoading(false);
        }
    };

    // Toggle email warmup status
    const handleToggle = async (emailAddress, currentWarmupStatus) => {
        const newStatus = currentWarmupStatus === 'active' ? 'paused' : 'active';

        if (newStatus === 'paused') {
            const confirm = window.confirm('Are you sure you want to pause warmup for this email?');
            if (!confirm) return;
        }

        try {
            setTogglingEmails(prev => ({ ...prev, [emailAddress]: true }));

            // Optimistically update UI
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
                `${API_BASE_URL}/api/warmup/emails/${emailAddress}/status`,
                { status: newStatus },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            toast.success(`Warmup ${newStatus === 'active' ? 'started' : 'paused'} successfully`);
        } catch (error) {
            console.error('Toggle failed:', error);

            // Revert optimistic update
            setWarmupEmails(prev =>
                prev.map(email =>
                    email.address === emailAddress ? { ...email, warmupStatus: currentWarmupStatus } : email
                )
            );

            if (error.response?.status === 401) {
                handleUnauthorized();
            } else {
                toast.error(
                    `Failed to ${newStatus === 'active' ? 'start' : 'pause'} warmup: ${error.response?.data?.message || error.message}`
                );
            }
        } finally {
            setTogglingEmails(prev => ({ ...prev, [emailAddress]: false }));
        }
    };

    // Settings panel handlers
    const handleSettingsClick = (email) => {
        setSelectedEmail(email);
        setShowSettingsPanel(true);
    };

    const closeSettingsPanel = () => {
        setSelectedEmail(null);
        setShowSettingsPanel(false);
    };

    // Delete email
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
        } else {
            setLoading(false);
        }
    }, []);

    // Filter emails based on search term
    const filteredEmails = warmupEmails.filter(email =>
        (email.address?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (email.name?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );

    // Get initials for avatar
    const getInitials = (name) => {
        if (!name || typeof name !== 'string') return '?';
        const words = name.trim().split(' ');
        return words.length > 1
            ? words[0].charAt(0).toUpperCase() + words[1].charAt(0).toUpperCase()
            : words[0].charAt(0).toUpperCase();
    };

    // Provider configuration with enhanced data
    const providers = [
        {
            id: 'google',
            name: "Google",
            description: "Gmail & Google Workspace",
            icon: "G",
            color: "from-red-500 to-red-600",
            iconColor: "text-red-600",
            bgColor: "bg-red-50",
            borderColor: "border-red-200",
            features: ["Gmail accounts", "Google Workspace", "OAuth2 secure login"],
            component: <GoogleConnect onSuccess={fetchWarmupEmails} onClose={() => setSelectedProvider(null)} />
        },
        {
            id: 'microsoft',
            name: "Microsoft",
            description: "Exchange, O365, Outlook & Hotmail",
            icon: "M",
            color: "from-blue-500 to-blue-600",
            iconColor: "text-blue-600",
            bgColor: "bg-blue-50",
            borderColor: "border-blue-200",
            features: ["Office 365", "Outlook.com", "Exchange servers"],
            component: <MicrosoftConnect onSuccess={fetchWarmupEmails} onClose={() => setSelectedProvider(null)} />
        },
        {
            id: 'smtp',
            name: "SMTP/IMAP",
            description: "Any other Email Service provider account",
            icon: "S",
            color: "from-green-500 to-green-600",
            iconColor: "text-green-600",
            bgColor: "bg-green-50",
            borderColor: "border-green-200",
            features: ["Custom SMTP servers", "IMAP support", "All email providers"],
            component: <SMTPConnect onSuccess={fetchWarmupEmails} onClose={() => setSelectedProvider(null)} />
        }
    ];

    const handleProviderSelect = (provider) => {
        setSelectedProvider(provider);
        setShowProviderModal(false);
    };

    // Enhanced Provider Modal Component - Compact and Perfect
    const ProviderModal = () => (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-2xl mx-auto shadow-2xl border border-gray-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Connect Email Account</h2>
                        <p className="text-gray-600 mt-1 text-sm">Choose your email provider to get started</p>
                    </div>
                    <button
                        onClick={() => setShowProviderModal(false)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-all duration-200"
                    >
                        <FiX className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Provider Cards - Compact Layout */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6">
                    {providers.map((provider) => (
                        <div
                            key={provider.id}
                            onClick={() => handleProviderSelect(provider)}
                            className="group cursor-pointer"
                        >
                            <div className={`bg-white border ${provider.borderColor} rounded-lg p-5 hover:shadow-md hover:border-indigo-400 transition-all duration-200 h-full flex flex-col relative overflow-hidden`}>
                                {/* Background Gradient Effect */}
                                <div className={`absolute inset-0 bg-gradient-to-br ${provider.color} opacity-0 group-hover:opacity-3 transition-opacity duration-300`}></div>

                                {/* Icon and Header */}
                                <div className="flex items-center gap-3 mb-4 relative z-10">
                                    <div className={`w-10 h-10 rounded-lg ${provider.bgColor} flex items-center justify-center`}>
                                        <span className={`text-sm font-bold ${provider.iconColor}`}>
                                            {provider.icon}
                                        </span>
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900 text-base">
                                            {provider.name}
                                        </h3>
                                        <p className="text-gray-500 text-xs mt-1">
                                            {provider.description}
                                        </p>
                                    </div>
                                </div>

                                {/* Features */}
                                <div className="flex-1 mb-4 relative z-10">
                                    <ul className="space-y-2">
                                        {provider.features.map((feature, index) => (
                                            <li key={index} className="flex items-center text-xs text-gray-600">
                                                <FiCheck className="w-3 h-3 text-green-500 mr-2 flex-shrink-0" />
                                                <span className="leading-tight">{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Footer */}
                                <div className="flex items-center justify-between pt-3 border-t border-gray-100 relative z-10">
                                    <div className="flex items-center text-gray-400 text-xs">
                                        <FiShield className="w-3 h-3 text-green-500 mr-1" />
                                        Secure
                                    </div>
                                    <div className="flex items-center text-indigo-600 text-sm font-medium group-hover:text-indigo-700 transition-colors">
                                        Connect
                                        <FiChevronRight className="ml-1 w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Security Note */}
                <div className="bg-gray-50 rounded-b-xl p-4 border-t border-gray-200">
                    <div className="flex items-center justify-center text-center">
                        <FiShield className="w-4 h-4 text-green-500 mr-2" />
                        <span className="text-xs text-gray-600">
                            All connections are encrypted and secure. We never store your password.
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );

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
            <div className="fixed top-0 right-0 bottom-0 w-[85%] max-w-[400px] bg-white shadow-lg z-50 overflow-y-auto p-6">
                {/* Header */}
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-800">Warm-up Settings</h2>
                    <button
                        className="text-gray-500 text-xl hover:text-gray-700"
                        onClick={onClose}
                    >
                        <FiX />
                    </button>
                </div>

                {/* Settings Form */}
                <div className="flex flex-col gap-5">
                    {/* Start Emails Per Day */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-gray-700">
                            Start with emails/day (Recommended 3)
                        </label>
                        <input
                            type="number"
                            name="startEmailsPerDay"
                            className="px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
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
                        <label className="text-sm font-medium text-gray-700">
                            Increase by emails every day (Recommended 3)
                        </label>
                        <input
                            type="number"
                            name="increaseByPerDay"
                            className="px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
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
                        <label className="text-sm font-medium text-gray-700">
                            Maximum emails to be sent per day (Recommended 25)
                        </label>
                        <input
                            type="number"
                            name="maxEmailsPerDay"
                            className="px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
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
                        <label className="text-sm font-medium text-gray-700">Reply rate</label>
                        <input
                            type="number"
                            name="replyRate"
                            className="px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                            value={settings.replyRate}
                            onChange={handleChange}
                            min="0"
                            max="100"
                        />
                    </div>

                    {/* Sender Name */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-gray-700">Sender name</label>
                        <input
                            type="text"
                            name="senderName"
                            className="px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                            value={settings.senderName}
                            onChange={handleChange}
                        />
                    </div>

                    {/* Checkbox */}
                    <div className="flex items-center gap-2 mt-2">
                        <input
                            type="checkbox"
                            id="customFolder"
                            className="w-4 h-4"
                            checked={!!settings.customFolderName}
                            onChange={(e) =>
                                setSettings((prev) => ({
                                    ...prev,
                                    customFolderName: e.target.checked ? "Custom Folder" : "",
                                }))
                            }
                        />
                        <label htmlFor="customFolder" className="text-sm text-gray-700">
                            + Add custom name for warmup folder
                        </label>
                    </div>

                    {/* Custom Folder Name Input */}
                    {settings.customFolderName && (
                        <div className="flex flex-col gap-2">
                            <input
                                type="text"
                                name="customFolderName"
                                className="px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                                value={settings.customFolderName}
                                onChange={handleChange}
                                placeholder="Enter folder name"
                            />
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex justify-between mt-8 pt-4 border-t border-gray-200">
                    <button
                        className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 transition-all"
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
        <div className={`min-h-screen  transition-all duration-300 p-6`}>

            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
                <div className="w-full lg:max-w-md">
                    <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-white"
                            placeholder="Search emails..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <button
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-lg hover:from-teal-600 hover:to-teal-700 transition-all duration-200 shadow hover:shadow-md w-full lg:w-auto justify-center"
                    onClick={() => setShowProviderModal(true)}
                    disabled={loading}
                >
                    <FiPlus className="w-4 h-4" />
                    <span className="font-medium">Add Account</span>
                </button>
            </div>

            {/* Main Content - Fixed Table Layout */}
            <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                {/* Table Header */}
                <div className="grid grid-cols-3 md:grid-cols-6 bg-gradient-to-r from-teal-900 to-teal-500 px-4 md:px-6 py-3 text-white text-xs font-semibold uppercase tracking-wide">
                    <div className="col-span-2 md:col-span-1">Email Account</div>
                    <div className="hidden md:block">Status</div>
                    <div>Sent</div>
                    <div>Received</div>
                    <div className="text-right">Actions</div>
                </div>

                {/* Table Body */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                        <div className="w-8 h-8 border-3 border-teal-200 border-t-teal-600 rounded-full animate-spin mb-3"></div>
                        <p className="text-gray-500">Loading email accounts...</p>
                    </div>
                ) : filteredEmails.length > 0 ? (
                    filteredEmails.map((email) => {
                        const stats = emailStats[email.address] || {
                            sent: 0,
                            received: 0,
                            replied: 0,
                            deliverability: email.deliverability || 100
                        };

                        return (
                            <div key={email.id} className="grid grid-cols-3 md:grid-cols-6 px-4 md:px-6 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors group">
                                {/* Email Account */}
                                <div className="col-span-2 md:col-span-1 flex items-center gap-3">
                                    <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium text-sm">
                                        {getInitials(email.name)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="font-medium text-gray-900 text-sm truncate">{email.name}</div>
                                        <div className="text-xs text-gray-500 truncate">{email.address}</div>
                                    </div>
                                </div>

                                {/* Status - Hidden on mobile */}
                                <div className="hidden md:flex items-center">
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${email.warmupStatus === 'active'
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-red-100 text-red-800'
                                        }`}>
                                        {email.warmupStatus?.charAt(0).toUpperCase() + email.warmupStatus?.slice(1) || 'Unknown'}
                                    </span>
                                </div>

                                {/* Sent */}
                                <div className="flex items-center font-medium text-gray-900 text-sm">
                                    {Number(stats.sent || 0).toLocaleString()}
                                </div>

                                {/* Received */}
                                <div className="flex items-center font-medium text-gray-900 text-sm">
                                    {Number(stats.replied || 0).toLocaleString()}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center justify-end gap-2">
                                    {/* Deliverability Badge for mobile */}
                                    <div className="md:hidden flex items-center">
                                        <div className="bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded text-xs font-medium">
                                            {stats.deliverability}%
                                        </div>
                                    </div>

                                    {/* Toggle Switch */}
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={email.warmupStatus === 'active'}
                                            onChange={() => handleToggle(email.address, email.warmupStatus)}
                                            className="sr-only peer"
                                            disabled={togglingEmails[email.address]}
                                        />
                                        <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-4 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                                        {togglingEmails[email.address] && (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            </div>
                                        )}
                                    </label>

                                    {/* Settings Button */}
                                    <button
                                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                        onClick={() => handleSettingsClick(email)}
                                    >
                                        <FiSettings size={14} />
                                    </button>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="flex flex-col items-center justify-center py-12">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                            <FiMail className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-600 mb-2">No email accounts found</h3>
                        <p className="text-gray-500 text-sm mb-6 text-center max-w-md">
                            Get started by connecting your first email account to begin the warmup process.
                        </p>
                        <button
                            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-lg hover:from-teal-600 hover:to-teal-700 transition-all duration-200 shadow hover:shadow-md"
                            onClick={() => setShowProviderModal(true)}
                        >
                            <FiPlus className="w-4 h-4" />
                            <span className="font-medium">Add Your First Account</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Settings Panel */}
            {showSettingsPanel && selectedEmail && (
                <div className="fixed top-16 right-4 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-40">
                    <div className="flex justify-between items-center p-4 border-b border-gray-200">
                        <h3 className="font-semibold text-gray-900">Settings</h3>
                        <button
                            className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                            onClick={closeSettingsPanel}
                        >
                            <FiX size={16} />
                        </button>
                    </div>
                    <div className="p-2">
                        <button className="flex items-center gap-3 w-full p-3 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                            <FiPower className="text-gray-400" />
                            Disconnect Email
                        </button>
                        <button
                            className="flex items-center gap-3 w-full p-3 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            onClick={() => {
                                setWarmupSettingsEmail(selectedEmail);
                                setShowWarmupSettings(true);
                                closeSettingsPanel();
                            }}
                        >
                            <FiSettings className="text-gray-400" />
                            Warmup Settings
                        </button>
                        <button className="flex items-center gap-3 w-full p-3 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                            <FiLink className="text-gray-400" />
                            Connection Settings
                        </button>
                        <button className="flex items-center gap-3 w-full p-3 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                            <FiBarChart2 className="text-gray-400" />
                            Warmup Report
                        </button>
                        <button
                            className="flex items-center gap-3 w-full p-3 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-2"
                            onClick={() => handleDeleteEmail(selectedEmail.id)}
                        >
                            <FiTrash2 />
                            Delete Email
                        </button>
                    </div>
                </div>
            )}

            {/* Warmup Settings Panel */}
            {showWarmupSettings && (
                <WarmupSettingsPanel
                    email={warmupSettingsEmail}
                    onClose={() => setShowWarmupSettings(false)}
                    onSave={saveWarmupSettings}
                />
            )}

            {/* Compact Provider Modal */}
            {showProviderModal && <ProviderModal />}

            {/* Selected Provider Component */}
            {selectedProvider && selectedProvider.component}
        </div>
    );
};

export default Dashboard;