import React, { useState, useEffect } from 'react';
import { CSSTransition } from 'react-transition-group';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from 'axios';
import {
    FiUser,
    FiLock,
    FiTrash2,
    FiShield,
    FiMail,
    FiClock,
    FiSave,
    FiPhone,
    FiCheck,
    FiX,
    FiEye,
    FiEyeOff,
    FiArrowLeft
} from 'react-icons/fi';

const API_BASE_URL = 'http://localhost:5000';

const SettingsPage = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('profile');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [userData, setUserData] = useState({
        name: '',
        lastname: '',
        phone: '',
        title: '',
        industry: '',
        email: '',
    });
    const [passwordData, setPasswordData] = useState({
        oldPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [showPassword, setShowPassword] = useState({
        oldPassword: false,
        newPassword: false,
        confirmPassword: false
    });
    const [twoFactorAuth, setTwoFactorAuth] = useState({
        enabled: false,
        method: null,
        secret: '',
        qrCodeUrl: '',
        verificationCode: '',
        phone: '',
        showSetup: false,
    });
    const [deleteConfirm, setDeleteConfirm] = useState({
        password: '',
        confirmText: '',
        showConfirmation: false,
    });
    const [otpVerification, setOtpVerification] = useState({
        otpSent: false,
        code: '',
        resendTimer: 60,
    });

    const [saveStatus, setSaveStatus] = useState({
        show: false,
        message: '',
        type: ''
    });

    const [passwordError, setPasswordError] = useState({
        oldPassword: '',
        confirmPassword: ''
    });
    const [passwordSuccess, setPasswordSuccess] = useState(false);

    useEffect(() => {
        let timer;
        if (otpVerification.otpSent && otpVerification.resendTimer > 0) {
            timer = setTimeout(() => {
                setOtpVerification(prev => ({
                    ...prev,
                    resendTimer: prev.resendTimer - 1
                }));
            }, 1000);
        }
        return () => clearTimeout(timer);
    }, [otpVerification.otpSent, otpVerification.resendTimer]);

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                setLoading(true);
                const token = localStorage.getItem('token');
                if (!token) {
                    navigate('/login');
                    return;
                }

                const response = await axios.get(`${API_BASE_URL}/api/users/me`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const is2FAEnabled = response.data.two_fa_enabled || false;

                setUserData({
                    name: response.data.name || '',
                    lastname: response.data.lastname || '',
                    phone: response.data.phone || '',
                    title: response.data.title || '',
                    industry: response.data.industry || '',
                    email: response.data.email || '',
                    two_fa_enabled: is2FAEnabled
                });

                setTwoFactorAuth(prev => ({
                    ...prev,
                    method: response.data.two_fa_method || null,
                    enabled: is2FAEnabled,
                    showSetup: false,
                    verificationCode: '',
                }));

            } catch (error) {
                console.error('Error fetching user data:', error);
                if (error.response?.status === 401) {
                    handleUnauthorized();
                } else {
                    toast.error('Failed to load user profile');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, [navigate, activeTab]);

    const handleUnauthorized = () => {
        localStorage.removeItem('token');
        navigate('/login');
        toast.info('Session expired. Please login again.');
    };

    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            await axios.put(`${API_BASE_URL}/api/users/me`, userData, {
                headers: { Authorization: `Bearer ${token}` }
            });

            toast.success('Profile updated successfully');
            setSaveStatus({
                show: true,
                message: 'Changes saved successfully',
                type: 'success'
            });

            setTimeout(() => {
                setSaveStatus(prev => ({ ...prev, show: false }));
            }, 60000);

        } catch (error) {
            console.error('Error updating profile:', error);
            toast.error('Failed to update profile');
            setSaveStatus({
                show: true,
                message: 'Failed to save changes',
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    const togglePasswordVisibility = (field) => {
        setShowPassword(prev => ({
            ...prev,
            [field]: !prev[field]
        }));
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();

        setPasswordError({ oldPassword: '', confirmPassword: '' });
        setPasswordSuccess(false);

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setPasswordError({
                confirmPassword: 'Passwords do not match',
                oldPassword: ''
            });
            return;
        }

        if (passwordData.newPassword.length < 8) {
            setPasswordError({
                confirmPassword: 'Password must be at least 8 characters long',
                oldPassword: ''
            });
            return;
        }

        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await axios.put(`${API_BASE_URL}/api/users/password`, {
                oldPassword: passwordData.oldPassword,
                newPassword: passwordData.newPassword
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
            setPasswordSuccess(true);
            toast.success('Password changed successfully');
        } catch (error) {
            console.error('Password change error:', error);

            if (error.response?.status === 400) {
                const errorMsg = error.response.data?.message?.toLowerCase() || '';

                if (errorMsg.includes('old') || errorMsg.includes('current') || errorMsg.includes('incorrect')) {
                    setPasswordError({
                        oldPassword: 'The password you entered is incorrect',
                        confirmPassword: ''
                    });
                } else {
                    setPasswordError({
                        oldPassword: error.response.data?.message || 'Password change failed',
                        confirmPassword: ''
                    });
                }
            } else {
                setPasswordError({
                    oldPassword: 'Failed to change password. Please try again.',
                    confirmPassword: ''
                });
            }
        } finally {
            setLoading(false);
        }
    };

    const toggleTwoFactorAuth = async (method) => {
        try {
            const token = localStorage.getItem("token");

            if (userData.two_fa_enabled) {
                await axios.post(
                    `${API_BASE_URL}/api/auth/2fa/disable`,
                    { email: userData.email },
                    { headers: { Authorization: `Bearer ${token}` } }
                );

                setTwoFactorAuth({
                    enabled: false,
                    method: null,
                    secret: '',
                    qrCodeUrl: '',
                    verificationCode: '',
                    showSetup: false
                });
                setUserData(prev => ({ ...prev, two_fa_enabled: false }));
                toast.success("Two-Factor Authentication disabled");
            } else {
                await initiate2FASetup(method);
            }
        } catch (err) {
            console.error("2FA toggle error:", err.response?.data || err.message);
            toast.error("Failed to toggle 2FA");
        }
    };

    const initiate2FASetup = async (method) => {
        try {
            const token = localStorage.getItem("token");

            if (method === "app") {
                const response = await axios.post(
                    `${API_BASE_URL}/api/auth/2fa/setup`,
                    { email: userData.email, method },
                    { headers: { Authorization: `Bearer ${token}` } }
                );

                setTwoFactorAuth(prev => ({
                    ...prev,
                    method: "app",
                    secret: response.data.secret,
                    qrCodeUrl: response.data.qr_code,
                    showSetup: true,
                }));

                toast.success("Scan QR or enter secret in your Authenticator app.");

            } else if (method === "email") {
                await axios.post(
                    `${API_BASE_URL}/api/auth/2fa/send-otp`,
                    {
                        email: userData.email,
                        method: "email"
                    },
                    { headers: { Authorization: `Bearer ${token}` } }
                );

                setTwoFactorAuth(prev => ({
                    ...prev,
                    method: "email",
                    showSetup: true,
                    verificationCode: ''
                }));

                toast.info("OTP sent to your email. Enter it below to verify.");
            }

        } catch (err) {
            console.error("2FA setup error:", err.response?.data || err.message);
            toast.error(err.response?.data?.message || "Failed to initiate 2FA setup");
        }
    };

    const verify2FA = async () => {
        if (!twoFactorAuth.verificationCode) {
            toast.error("Enter the verification code first");
            return;
        }

        try {
            const token = localStorage.getItem("token");

            const payload = {
                email: userData.email,
                otp: twoFactorAuth.verificationCode,
                method: twoFactorAuth.method
            };

            const response = await axios.post(
                `${API_BASE_URL}/api/auth/2fa/verify`,
                payload,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.data.token) {
                localStorage.setItem("token", response.data.token);
            }

            setTwoFactorAuth(prev => ({
                ...prev,
                enabled: true,
                showSetup: false,
                verificationCode: ''
            }));

            setUserData(prev => ({ ...prev, two_fa_enabled: true }));

            toast.success("2FA verified successfully!");

        } catch (err) {
            console.error("2FA verification error:", err);

            if (err.response?.status === 400) {
                if (err.response.data?.message === "Invalid 2FA token") {
                    toast.error("Invalid verification code. Please check and try again.");
                } else if (err.response.data?.message === "Invalid or expired OTP") {
                    toast.error("The code has expired. Please request a new one.");
                } else if (err.response.data?.message === "Email or JWT required for verification") {
                    toast.error("Authentication error. Please try logging in again.");
                } else {
                    toast.error(err.response.data?.message || "Verification failed. Please try again.");
                }
            } else if (err.response?.status === 404) {
                toast.error("User not found. Please check your email address.");
            } else {
                toast.error("Failed to verify 2FA. Please try again.");
            }
        }
    };

    const disable2FA = async () => {
        if (!window.confirm("Are you sure you want to disable 2FA?")) return;

        try {
            setLoading(true);
            setError(null);

            const token = localStorage.getItem("token");
            await axios.post(`${API_BASE_URL}/api/auth/2fa/disable`,
                { email: userData.email },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setUserData(prev => ({
                ...prev,
                two_fa_enabled: false
            }));

            setTwoFactorAuth({
                enabled: false,
                method: null,
                secret: '',
                qrCodeUrl: '',
                verificationCode: '',
                showSetup: false
            });

            toast.success("2FA disabled");

        } catch (err) {
            console.error("Disable 2FA Error:", err.response?.data || err.message);
            setError(err.response?.data?.message || "Failed to disable 2FA");
        } finally {
            setLoading(false);
        }
    };

    const confirmAccountDeletion = () => {
        setDeleteConfirm({ ...deleteConfirm, showConfirmation: true });
    };

    const cancelAccountDeletion = () => {
        setDeleteConfirm({
            password: '',
            confirmText: '',
            showConfirmation: false,
        });
        setOtpVerification({ otpSent: false, code: '', resendTimer: 60 });
    };

    const sendDeletionOtp = async () => {
        if (deleteConfirm.confirmText.toLowerCase() !== 'delete my account') {
            toast.error('Please type "delete my account" to confirm.');
            return;
        }

        if (!deleteConfirm.password) {
            toast.error('Please enter your password.');
            return;
        }

        try {
            setLoading(true);
            const token = localStorage.getItem('token');

            await axios.post(`${API_BASE_URL}/api/users/send-delete-otp`, {
                password: deleteConfirm.password,
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });

            setOtpVerification({ otpSent: true, code: '', resendTimer: 60 });
            toast.info('OTP sent to your email. Enter it below to confirm deletion.');
        } catch (err) {
            console.error('Send OTP error:', err.response?.data || err.message);
            toast.error(err.response?.data?.message || 'Failed to send OTP.');
        } finally {
            setLoading(false);
        }
    };

    const verifyOtpAndDeleteAccount = async () => {
        if (!otpVerification.code) {
            toast.error('Please enter the OTP sent to your email.');
            return;
        }

        try {
            setLoading(true);
            const token = localStorage.getItem('token');

            await axios.post(`${API_BASE_URL}/api/users/verify-delete-otp`, {
                otp: otpVerification.code,
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });

            toast.success('OTP verified! Deleting your account...');

            await axios.delete(`${API_BASE_URL}/api/users/me`, {
                data: { password: deleteConfirm.password },
                headers: { Authorization: `Bearer ${token}` },
            });

            toast.success('Account deleted successfully!');
            localStorage.removeItem('token');
            navigate('/login');
        } catch (err) {
            console.error('OTP verification or deletion error:', err.response?.data || err.message);
            toast.error(err.response?.data?.message || 'Failed to verify OTP or delete account.');
        } finally {
            setLoading(false);
            cancelAccountDeletion();
        }
    };

    const resendDeletionOtp = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');

            await axios.post(`${API_BASE_URL}/api/users/send-delete-otp`, {
                password: deleteConfirm.password,
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });

            toast.info('A new OTP has been sent to your email.');
            setOtpVerification(prev => ({ ...prev, resendTimer: 60 }));
        } catch (err) {
            console.error('Resend OTP error:', err.response?.data || err.message);
            toast.error(err.response?.data?.message || 'Failed to resend OTP.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 xl:ml-2 w-full lg:w-[calc(100%)] xl:w-[calc(100%)] relative overflow-hidden font-sans">
            {/* Header Section */}
            <div className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Settings</h1>
                        <p className="text-gray-600 mt-1 text-sm sm:text-base">Manage your account settings and preferences</p>
                    </div>
                </div>
            </div>

            <div className="p-4 sm:p-6 lg:p-8">
                <div className="max-w-9xl mx-auto">
                    {/* Tabs */}
                    <div className="flex justify-center mb-8 border-b border-gray-200">
                        <div className="flex space-x-4 sm:space-x-8 overflow-x-auto">
                            {[
                                { id: 'profile', icon: FiUser, label: 'Profile' },
                                { id: 'password', icon: FiLock, label: 'Password' },
                                { id: 'security', icon: FiShield, label: 'Security' },
                                { id: 'danger', icon: FiTrash2, label: 'Danger Zone' }
                            ].map((tab) => {
                                const Icon = tab.icon;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex items-center space-x-2 pb-4 px-1 border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id
                                            ? 'border-teal-600 text-teal-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700'
                                            }`}
                                    >
                                        <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                                        <span className="font-medium text-sm sm:text-base">{tab.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
                        {loading && (
                            <div className="flex justify-center py-8">
                                <div className="w-8 h-8 border-3 border-teal-200 border-t-teal-600 rounded-full animate-spin"></div>
                            </div>
                        )}

                        {/* Profile Tab */}
                        {!loading && activeTab === 'profile' && (
                            <form onSubmit={handleProfileUpdate}>
                                <div className="flex items-center space-x-3 mb-6">
                                    <FiUser className="w-6 h-6 text-gray-700" />
                                    <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">Profile Information</h2>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                                        <input
                                            type="text"
                                            value={userData.name || ''}
                                            onChange={(e) => setUserData({ ...userData, name: e.target.value })}
                                            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                                        <input
                                            type="text"
                                            value={userData.lastname || ''}
                                            onChange={(e) => setUserData({ ...userData, lastname: e.target.value })}
                                            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Phone No</label>
                                        <input
                                            type="tel"
                                            value={userData.phone || ''}
                                            onChange={(e) => {
                                                const digitsOnly = e.target.value.replace(/\D/g, '');
                                                setUserData({ ...userData, phone: digitsOnly });
                                            }}
                                            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                                        <input
                                            type="text"
                                            value={userData.title || ''}
                                            onChange={(e) => setUserData({ ...userData, title: e.target.value })}
                                            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Industry</label>
                                        <input
                                            type="text"
                                            value={userData.industry || ''}
                                            onChange={(e) => setUserData({ ...userData, industry: e.target.value })}
                                            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="mb-6">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                                    <input
                                        type="email"
                                        value={userData.email}
                                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed"
                                        disabled
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white px-6 py-3 rounded-lg font-medium transition-all duration-300 shadow-md hover:shadow-lg flex items-center space-x-2"
                                >
                                    <FiSave className="w-5 h-5" />
                                    <span>Save Changes</span>
                                </button>

                                <CSSTransition
                                    in={saveStatus.show}
                                    timeout={300}
                                    classNames="fade"
                                    unmountOnExit
                                >
                                    <div className={`mt-4 p-4 rounded-lg border ${saveStatus.type === 'success'
                                        ? 'bg-green-50 border-green-200 text-green-800'
                                        : 'bg-red-50 border-red-200 text-red-800'
                                        }`}>
                                        <div className="flex items-center space-x-2">
                                            {saveStatus.type === 'success' ? (
                                                <FiCheck className="w-5 h-5" />
                                            ) : (
                                                <FiX className="w-5 h-5" />
                                            )}
                                            <span>{saveStatus.message}</span>
                                        </div>
                                    </div>
                                </CSSTransition>
                            </form>
                        )}

                        {/* Password Tab */}
                        {!loading && activeTab === 'password' && (
                            <div className="min-h-screen flex items-center justify-center  px-4 sm:px-2 lg:px-3">
                                <div className="w-full max-w-xl  rounded-2xl p-8 sm:p-10">
                                    <form onSubmit={handlePasswordChange} className="space-y-6">
                                        {/* Heading */}
                                        <div className="flex items-center justify-center space-x-3 mb-6">
                                            <FiLock className="w-7  h-7 text-teal-600" />
                                            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center">
                                                Change Password
                                            </h2>
                                        </div>

                                        {/* Old Password */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Old Password
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type={showPassword.oldPassword ? 'text' : 'password'}
                                                    value={passwordData.oldPassword}
                                                    onChange={(e) =>
                                                        setPasswordData({ ...passwordData, oldPassword: e.target.value })
                                                    }
                                                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-teal-500 transition-all duration-300 pr-10 ${passwordError.oldPassword
                                                        ? 'border-red-500 focus:border-red-500'
                                                        : 'border-gray-300 focus:border-teal-500'
                                                        }`}
                                                    required
                                                    autoComplete="current-password"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => togglePasswordVisibility('oldPassword')}
                                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-teal-600"
                                                >
                                                    {showPassword.oldPassword ? (
                                                        <FiEyeOff className="w-5 h-5" />
                                                    ) : (
                                                        <FiEye className="w-5 h-5" />
                                                    )}
                                                </button>
                                            </div>
                                            {passwordError.oldPassword && (
                                                <div className="flex items-center space-x-1 mt-2 text-red-600 text-sm">
                                                    <FiX className="w-4 h-4" />
                                                    <span>{passwordError.oldPassword}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* New Password */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                New Password
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type={showPassword.newPassword ? 'text' : 'password'}
                                                    value={passwordData.newPassword}
                                                    onChange={(e) =>
                                                        setPasswordData({ ...passwordData, newPassword: e.target.value })
                                                    }
                                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-300 pr-10"
                                                    required
                                                    minLength="8"
                                                    autoComplete="new-password"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => togglePasswordVisibility('newPassword')}
                                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-teal-600"
                                                >
                                                    {showPassword.newPassword ? (
                                                        <FiEyeOff className="w-5 h-5" />
                                                    ) : (
                                                        <FiEye className="w-5 h-5" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Confirm New Password */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Confirm New Password
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type={showPassword.confirmPassword ? 'text' : 'password'}
                                                    value={passwordData.confirmPassword}
                                                    onChange={(e) =>
                                                        setPasswordData({
                                                            ...passwordData,
                                                            confirmPassword: e.target.value,
                                                        })
                                                    }
                                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-300 pr-10"
                                                    required
                                                    autoComplete="new-password"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => togglePasswordVisibility('confirmPassword')}
                                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-teal-600"
                                                >
                                                    {showPassword.confirmPassword ? (
                                                        <FiEyeOff className="w-5 h-5" />
                                                    ) : (
                                                        <FiEye className="w-5 h-5" />
                                                    )}
                                                </button>
                                            </div>
                                            {passwordError.confirmPassword && (
                                                <div className="mt-2 text-red-600 text-sm">
                                                    {passwordError.confirmPassword}
                                                </div>
                                            )}
                                        </div>

                                        {/* Submit Button */}
                                        <button
                                            type="submit"
                                            className="w-full bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-300 shadow-md hover:shadow-lg flex items-center justify-center space-x-2"
                                        >
                                            <FiSave className="w-5 h-5" />
                                            <span>Change Password</span>
                                        </button>

                                        {/* Success Message */}
                                        {passwordSuccess && (
                                            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 flex items-center justify-center space-x-2">
                                                <FiCheck className="w-5 h-5" />
                                                <span>Password changed successfully for {userData.email}</span>
                                            </div>
                                        )}

                                        {/* Forgot Password Link */}
                                        <div className="text-center pt-4">
                                            <a
                                                href="/forgot-password"
                                                className="text-teal-600 hover:text-teal-700 font-medium"
                                            >
                                                Forgot Password?
                                            </a>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}


                        {/* Security Tab */}
                        {!loading && activeTab === 'security' && (
                            <div>
                                <div className="flex items-center space-x-3 mb-6">
                                    <FiShield className="w-6 h-6 text-gray-700" />
                                    <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">Security Settings</h2>
                                </div>

                                {/* Two-Factor Authentication Card */}
                                <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
                                    <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3">Two-Factor Authentication</h3>
                                    <p className="text-gray-600 mb-5">
                                        Add an extra layer of security to your account
                                    </p>

                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-gray-200 mb-5">
                                        <div>
                                            {userData.two_fa_enabled ? (
                                                <div className="flex items-center space-x-2 text-green-600">
                                                    <FiCheck className="w-5 h-5" />
                                                    <span className="font-medium">Enabled ({twoFactorAuth.method})</span>
                                                </div>
                                            ) : (
                                                <span className="text-gray-600 font-medium">Not Enabled</span>
                                            )}
                                        </div>

                                        {!userData.two_fa_enabled ? (
                                            <button
                                                onClick={() => setTwoFactorAuth({
                                                    ...twoFactorAuth,
                                                    showSetup: true,
                                                    method: null
                                                })}
                                                className="bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white px-5 py-2.5 rounded-lg font-medium transition-all duration-300 shadow-md hover:shadow-lg"
                                            >
                                                Enable 2FA
                                            </button>
                                        ) : (
                                            <button
                                                onClick={disable2FA}
                                                className="text-red-600 hover:text-red-700 font-medium flex items-center space-x-2 px-4 py-2.5 rounded-lg hover:bg-red-50 transition-colors border border-red-200"
                                            >
                                                <FiX className="w-5 h-5" />
                                                <span>Disable 2FA</span>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* 2FA Setup Modal */}
                                {twoFactorAuth.showSetup && (
                                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ margin: 0 }}>
                                        <div className="bg-white rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                                            {/* Back Button */}
                                            <div className="mb-5">
                                                <button
                                                    onClick={() => setTwoFactorAuth({
                                                        ...twoFactorAuth,
                                                        showSetup: false,
                                                        method: null
                                                    })}
                                                    className="text-gray-600 hover:text-gray-700 flex items-center space-x-2 transition-colors"
                                                >
                                                    <FiArrowLeft className="w-5 h-5" />
                                                    <span>Back</span>
                                                </button>
                                            </div>

                                            <h3 className="text-xl font-semibold text-gray-900 mb-5">
                                                Set Up Two-Factor Authentication
                                            </h3>

                                            {!twoFactorAuth.method ? (
                                                // Method Selection
                                                <div>
                                                    <p className="text-gray-600 mb-6">
                                                        Choose your preferred 2FA method:
                                                    </p>

                                                    <div className="space-y-4">
                                                        <button
                                                            onClick={() => initiate2FASetup('app')}
                                                            className="w-full p-5 border border-gray-300 rounded-lg text-left hover:border-teal-500 transition-colors flex items-center space-x-4"
                                                        >
                                                            <FiShield className="w-6 h-6 text-teal-600" />
                                                            <div>
                                                                <div className="font-medium text-gray-900">Authenticator App</div>
                                                                <div className="text-sm text-gray-600">Use Microsoft Authenticator or similar</div>
                                                            </div>
                                                        </button>

                                                        <button
                                                            onClick={() => initiate2FASetup('email')}
                                                            className="w-full p-5 border border-gray-300 rounded-lg text-left hover:border-teal-500 transition-colors flex items-center space-x-4"
                                                        >
                                                            <FiMail className="w-6 h-6 text-teal-600" />
                                                            <div>
                                                                <div className="font-medium text-gray-900">Email Verification</div>
                                                                <div className="text-sm text-gray-600">Receive one-time passcodes via email</div>
                                                            </div>
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                // Method-specific Setup
                                                <div>
                                                    {twoFactorAuth.method === 'app' ? (
                                                        <div className="bg-gray-50 rounded-lg p-5 mb-5 text-center">
                                                            <p className="text-gray-600 mb-4">
                                                                Scan this QR code with your authenticator app:
                                                            </p>

                                                            {twoFactorAuth.qrCodeUrl && (
                                                                <img
                                                                    src={twoFactorAuth.qrCodeUrl}
                                                                    alt="2FA QR Code"
                                                                    className="w-48 h-48 mx-auto mb-4"
                                                                />
                                                            )}

                                                            <p className="text-gray-600 mb-3">
                                                                Or enter this secret key manually:
                                                            </p>
                                                            <div className="bg-gray-100 px-4 py-3 rounded-lg font-mono text-sm break-all">
                                                                {twoFactorAuth.secret}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="bg-gray-50 rounded-lg p-5 mb-5 text-center">
                                                            <p className="text-gray-600">
                                                                We've sent a verification code to your email address.
                                                            </p>
                                                        </div>
                                                    )}

                                                    <div className="mb-5">
                                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                                            Verification Code
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={twoFactorAuth.verificationCode}
                                                            onChange={(e) => setTwoFactorAuth({ ...twoFactorAuth, verificationCode: e.target.value })}
                                                            placeholder="Enter 6-digit code"
                                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                                                        />
                                                    </div>

                                                    <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                                                        <button
                                                            onClick={verify2FA}
                                                            className="bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white px-5 py-2.5 rounded-lg font-medium flex items-center space-x-2 transition-all duration-300 shadow-md hover:shadow-lg flex-1 justify-center"
                                                        >
                                                            <FiCheck className="w-5 h-5" />
                                                            <span>Verify and Enable</span>
                                                        </button>
                                                        <button
                                                            onClick={() => setTwoFactorAuth({
                                                                ...twoFactorAuth,
                                                                showSetup: false,
                                                                method: null
                                                            })}
                                                            className="bg-white border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg font-medium flex items-center space-x-2 hover:bg-gray-50 transition-colors flex-1 justify-center"
                                                        >
                                                            <FiX className="w-5 h-5" />
                                                            <span>Cancel</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Danger Zone Tab */}
                        {!loading && activeTab === 'danger' && (
                            <div>
                                <div className="flex items-center space-x-3 mb-6">
                                    <FiTrash2 className="w-6 h-6 text-gray-700" />
                                    <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">Danger Zone</h2>
                                </div>

                                {!deleteConfirm.showConfirmation ? (
                                    // Initial Delete Prompt
                                    <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                                        <h3 className="text-red-800 font-semibold mb-3">Delete Your Account</h3>
                                        <p className="text-red-700 mb-4">
                                            Warning: This action is irreversible. Deleting your account will permanently remove all your
                                            personal data, settings, and history associated with this account.
                                        </p>
                                        <button
                                            onClick={confirmAccountDeletion}
                                            className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg font-medium flex items-center space-x-2 transition-colors shadow-md hover:shadow-lg"
                                        >
                                            <FiTrash2 className="w-5 h-5" />
                                            <span>Delete Account</span>
                                        </button>
                                    </div>
                                ) : (
                                    // OTP Verification
                                    <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                                        <h3 className="text-red-800 font-semibold mb-3">Email Verification Required</h3>
                                        <p className="text-red-700 mb-4">
                                            An OTP has been sent to your registered email. Enter it below to verify your identity and permanently
                                            delete your account. This ensures your account cannot be deleted accidentally or by someone else.
                                        </p>

                                        <div className="mb-4">
                                            <label className="block text-sm font-medium text-red-700 mb-2">Enter OTP</label>
                                            <input
                                                type="text"
                                                value={otpVerification.code}
                                                onChange={(e) => setOtpVerification({ ...otpVerification, code: e.target.value })}
                                                className="w-full px-4 py-3 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
                                                required
                                            />
                                        </div>

                                        <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                                            <button
                                                onClick={verifyOtpAndDeleteAccount}
                                                className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg font-medium flex items-center space-x-2 transition-colors shadow-md hover:shadow-lg flex-1 justify-center"
                                            >
                                                <FiTrash2 className="w-5 h-5" />
                                                <span>Verify OTP & Delete Account</span>
                                            </button>
                                            <button
                                                onClick={cancelAccountDeletion}
                                                className="bg-white border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg font-medium flex items-center space-x-2 hover:bg-gray-50 transition-colors flex-1 justify-center"
                                            >
                                                <FiX className="w-5 h-5" />
                                                <span>Cancel</span>
                                            </button>
                                        </div>

                                        <div className="mt-4">
                                            {otpVerification.resendTimer > 0 ? (
                                                <p className="text-sm text-red-600">
                                                    You can resend OTP in {otpVerification.resendTimer}s
                                                </p>
                                            ) : (
                                                <button
                                                    onClick={resendDeletionOtp}
                                                    className="text-red-600 hover:text-red-700 font-medium text-sm"
                                                >
                                                    Resend OTP
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;