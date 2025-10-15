import React, { useState, useEffect } from 'react';
import { CSSTransition } from 'react-transition-group';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from 'axios';
import { FiUser, FiLock, FiTrash2, FiShield, FiMail, FiClock, FiSave, FiPhone, FiCheck, FiX } from 'react-icons/fi';
import QRCode from 'react-qr-code';

const API_BASE_URL = 'http://localhost:5000';

const SettingsPage = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('profile');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [qrCode, setQrCode] = useState(null);

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
    const [twoFactorAuth, setTwoFactorAuth] = useState({
        // enabled: userData?.two_fa_enabled || false,
        enabled: false,
        method: null, // 'app' or 'email'
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
        resendTimer: 60, // seconds before user can resend OTP
    });
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

    // Fetch user data on component mount
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
                setUserData(prev => ({
                    ...prev,
                    two_fa_enabled: response.data.two_fa_enabled || false
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
    const [saveStatus, setSaveStatus] = useState({
        show: false,
        message: '',
        type: '' // 'success' or 'error'
    });

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

            // Hide the message after 3 seconds
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

    const [passwordError, setPasswordError] = useState({
        oldPassword: '',
        confirmPassword: ''
    });
    const [passwordSuccess, setPasswordSuccess] = useState(false);

    const handlePasswordChange = async (e) => {
        e.preventDefault();

        // Reset all messages
        setPasswordError({ oldPassword: '', confirmPassword: '' });
        setPasswordSuccess(false);

        // Client-side validation
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setPasswordError({
                confirmPassword: 'Passwords do not match',
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

            // Success case
            setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
            setPasswordSuccess(true);
            toast.success('Password changed successfully');
        } catch (error) {
            console.error('Password change error:', error);

            // Check if this is a wrong password error
            if (error.response?.status === 400) {
                const errorMsg = error.response.data?.message?.toLowerCase() || '';

                if (errorMsg.includes('old') || errorMsg.includes('current') || errorMsg.includes('incorrect')) {
                    setPasswordError({
                        oldPassword: 'The password you entered is incorrect',
                        confirmPassword: ''
                    });
                } else {
                    // For other 400 errors, show the message from the server
                    setPasswordError({
                        oldPassword: error.response.data?.message || 'Password change failed',
                        confirmPassword: ''
                    });
                }
            } else {
                // For other errors, show a generic message
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
                // Disable 2FA
                await axios.post(
                    `${API_BASE_URL}/api/auth/2fa/disable`,
                    { email: userData.email },
                    { headers: { Authorization: `Bearer ${token}` } }
                );


                // Update local state
                setTwoFactorAuth({
                    enabled: false,
                    method: null,       // reset method
                    secret: '',
                    qrCodeUrl: '',
                    verificationCode: '',
                    showSetup: false
                });
                setUserData(prev => ({ ...prev, two_fa_enabled: false }));
                toast.success("Two-Factor Authentication disabled");
            } else {
                // Enable 2FA
                await initiate2FASetup(method);  // send method here
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
                // Authenticator app setup
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
                // Use the dedicated sendLoginOTP endpoint for email 2FA
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

            console.log("2FA verification payload:", payload);

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

            console.log("2FA verify response:", response.data);

            // save JWT returned from server
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
            console.error("Error response:", err.response?.data);

            // More specific error handling
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
    // Disable 2FA
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



    // Step 1: Show confirmation form
    const confirmAccountDeletion = () => {
        setDeleteConfirm({ ...deleteConfirm, showConfirmation: true });
    };

    // Step 2: Cancel deletion
    const cancelAccountDeletion = () => {
        setDeleteConfirm({
            password: '',
            confirmText: '',
            showConfirmation: false,
        });
        setOtpVerification({ otpSent: false, code: '' });
    };

    // Step 3: Send OTP after confirmation text & password are entered
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

            // Send OTP to user email
            await axios.post(`${API_BASE_URL}/api/users/send-delete-otp`, {
                password: deleteConfirm.password,
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });

            setOtpVerification({ otpSent: true, code: '' });
            toast.info('OTP sent to your email. Enter it below to confirm deletion.');
        } catch (err) {
            console.error('Send OTP error:', err.response?.data || err.message);
            toast.error(err.response?.data?.message || 'Failed to send OTP.');
        } finally {
            setLoading(false);
        }
    };

    // Step 4: Verify OTP & delete account
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

            // Delete account after OTP verification
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
            setOtpVerification(prev => ({ ...prev, resendTimer: 60 })); // reset countdown
        } catch (err) {
            console.error('Resend OTP error:', err.response?.data || err.message);
            toast.error(err.response?.data?.message || 'Failed to resend OTP.');
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="settings-container">
            <style jsx>{`
                .settings-container {
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                    max-width: 1500px;
                    margin: 0 auto;
                    padding: 20px 30px;
                    color: #333;
                    background-color: #f8fafc;
                    min-height: 100vh;
                    width: calc(100% - 240px);
                    margin-left: 240px;
                }

                .settings-header {
                    text-align: center;
                    margin-bottom: 2rem;
                }

                .settings-title {
                    font-size: 2rem;
                    font-weight: 600;
                    color: #3d51d7;
                    margin-bottom: 0.5rem;
                }

                .settings-tabs {
                    display: flex;
                    justify-content: center;
                    margin-bottom: 2rem;
                    border-bottom: 1px solid #e2e8f0;
                }

                .settings-tab {
                    padding: 0.75rem 1.5rem;
                    cursor: pointer;
                    font-weight: 500;
                    color: #3d51d7;
                    border-bottom: 2px solid transparent;
                    transition: all 0.3s ease;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .settings-tab:hover {
                    color: #3d51d7;
                }

                .settings-tab.active {
                    color: #3d51d7;
                    border-bottom-color: #3d51d7;
                }

                .settings-content {
                    background-color: white;
                    border-radius: 0.75rem;
                    padding: 2rem;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                    animation: fadeIn 0.5s ease;
                }

                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .section-title {
                    font-size: 1.25rem;
                    font-weight: 600;
                    color: #1e293b;
                    margin-bottom: 1.5rem;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .form-group {
                    margin-bottom: 1.5rem;
                }

                .form-row {
                    display: flex;
                    gap: 1rem;
                    margin-bottom: 1rem;
                }

                .form-label {
                    display: block;
                    margin-bottom: 0.5rem;
                    font-weight: 500;
                    color: #475569;
                }

                .form-input {
                    width: 100%;
                    padding: 0.75rem 1rem;
                    border: 1px solid #e2e8f0;
                    border-radius: 0.5rem;
                    font-size: 1rem;
                    transition: all 0.2s ease;
                }

                .form-input:focus {
                    outline: none;
                    border-color: #3d51d7;
                    box-shadow: 0 0 0 3px rgba(61, 81, 215, 0.1);
                }

                .btn {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0.75rem 1.5rem;
                    border-radius: 0.5rem;
                    font-size: 1rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    gap: 0.5rem;
                    border: none;
                }

                .btn-primary {
                    background: linear-gradient(135deg, #3d51d7 0%, #3d51d7 70%);
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

                .btn-danger {
                    background: #ef4444;
                    color: white;
                }

                .btn-danger:hover {
                    background: #dc2626;
                }

                .btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .two-factor-box {
                    background-color: #f8fafc;
                    border-radius: 0.75rem;
                    padding: 1.5rem;
                    margin-bottom: 2rem;
                }

                .two-factor-status {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin-bottom: 1rem;
                }

                .status-badge {
                    display: inline-flex;
                    align-items: center;
                    padding: 0.25rem 0.75rem;
                    border-radius: 9999px;
                    font-size: 0.875rem;
                    font-weight: 500;
                }

                .status-active {
                    background-color: #dcfce7;
                    color: #166534;
                }

                .status-inactive {
                    background-color: #fee2e2;
                    color: #991b1b;
                }

                .qrcode-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    margin: 1.5rem 0;
                    padding: 1.5rem;
                    background-color: white;
                    border-radius: 0.5rem;
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
                }

                .secret-key {
                    font-family: monospace;
                    background-color: #f1f5f9;
                    padding: 0.5rem 1rem;
                    border-radius: 0.25rem;
                    margin: 1rem 0;
                    word-break: break-all;
                }

                .delete-confirmation {
                    background-color: #fee2e2;
                    border-radius: 0.75rem;
                    padding: 1.5rem;
                    margin-top: 2rem;
                }

                .delete-warning {
                    color: #991b1b;
                    margin-bottom: 1rem;
                }

                .loading-spinner {
                    width: 1.5rem;
                    height: 1.5rem;
                    border: 3px solid rgba(61, 81, 215, 0.2);
                    border-top-color: #3d51d7;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 0 auto;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                @media (max-width: 768px) {
                    .settings-container {
                        padding: 1rem;
                    }

                    .settings-tabs {
                        flex-wrap: wrap;
                    }

                    .settings-content {
                        padding: 1.5rem;
                    }

                    .form-row {
                        flex-direction: column;
                        gap: 0;
                    }
                }

                .save-status {
        margin-top: 0.75rem;
        padding: 0.75rem 1rem;
        border-radius: 0.5rem;
        font-size: 0.875rem;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        transition: all 0.3s ease;
        transform-origin: top;
        overflow: hidden;
    }

    .save-status.success {
        background-color: #f0fdf4;
        color: #16a34a;
        border: 1px solid #86efac;
    }

    .save-status.error {
        background-color: #fef2f2;
        color: #dc2626;
        border: 1px solid #fca5a5;
    }

    .save-status-enter {
        opacity: 0;
        transform: translateY(-10px);
        max-height: 0;
    }

    .save-status-enter-active {
        opacity: 1;
        transform: translateY(0);
        max-height: 100px;
        transition: all 0.3s ease;
    }

    .save-status-exit {
        opacity: 1;
        transform: translateY(0);
        max-height: 100px;
    }

    .save-status-exit-active {
        opacity: 0;
        transform: translateY(-10px);
        max-height: 0;
        transition: all 0.3s ease;
    }

    .status-icon {
        font-size: 1.1rem;
        flex-shrink: 0;
    }
        .error-message {
    color: #dc2626;
    font-size: 0.875rem;
    margin-top: 0.25rem;
}

.success-message {
    margin-top: 1rem;
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    background-color: #f0fdf4;
    color: #16a34a;
    border: 1px solid #86efac;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}
    .input-error {
    border-color: #dc2626 !important;
    box-shadow: 0 0 0 1px #dc2626 !important;
}

.error-message {
    color: #dc2626;
    font-size: 0.875rem;
    margin-top: 0.25rem;
    display: flex;
    align-items: center;
}
    .two-factor-box {
    background-color: white;
    border-radius: 0.75rem;
    padding: 1.5rem;
    margin-bottom: 2rem;
    border: 1px solid #e2e8f0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.two-factor-box h3 {
    font-size: 1.1rem;
    margin-bottom: 1rem;
    color: #1e293b;
}
    <QRCode
    value={twoFactorAuth.qrCodeUrl}
    size={160}
    level="H"
    includeMargin={false}
    style={{ margin: '0 auto 12px' }}
/>
            `}</style>

            <div className="settings-header">
                <h1 className="settings-title">Settings</h1>
            </div>

            <div className="settings-tabs">
                <div
                    className={`settings-tab ${activeTab === 'profile' ? 'active' : ''}`}
                    onClick={() => setActiveTab('profile')}
                >
                    <FiUser /> Profile
                </div>
                <div
                    className={`settings-tab ${activeTab === 'password' ? 'active' : ''}`}
                    onClick={() => setActiveTab('password')}
                >
                    <FiLock /> Password
                </div>
                <div
                    className={`settings-tab ${activeTab === 'security' ? 'active' : ''}`}
                    onClick={() => setActiveTab('security')}
                >
                    <FiShield /> Security
                </div>
                <div
                    className={`settings-tab ${activeTab === 'danger' ? 'active' : ''}`}
                    onClick={() => setActiveTab('danger')}
                >
                    <FiTrash2 /> Danger Zone
                </div>
            </div>

            <div className="settings-content">
                {loading && (
                    <div className="loading-spinner"></div>
                )}

                {!loading && activeTab === 'profile' && (
                    <form onSubmit={handleProfileUpdate}>
                        <h2 className="section-title">
                            <FiUser /> Profile Information
                        </h2>

                        <div className="form-row">
                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">First Name</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={userData.name || ''}
                                    onChange={(e) => setUserData({ ...userData, name: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">Last Name</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={userData.lastname || ''}
                                    onChange={(e) => setUserData({ ...userData, lastname: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">Phone No</label>
                                <input
                                    type="tel"
                                    className="form-input"
                                    value={userData.phone || ''}
                                    onChange={(e) => {
                                        const digitsOnly = e.target.value.replace(/\D/g, ''); // remove non-digits
                                        setUserData({ ...userData, phone: digitsOnly });
                                    }}
                                    required
                                />
                            </div>

                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">Title</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={userData.title || ''}
                                    onChange={(e) => setUserData({ ...userData, title: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">Industry</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={userData.industry || ''}
                                    onChange={(e) => setUserData({ ...userData, industry: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Email Address</label>
                            <input
                                type="email"
                                className="form-input"
                                value={userData.email}
                                onChange={(e) => setUserData({ ...userData, email: e.target.value })}
                                required
                                disabled
                            />
                        </div>


                        <button type="submit" className="btn btn-primary">
                            <FiSave /> Save Changes
                        </button>

                        <CSSTransition
                            in={saveStatus.show}
                            timeout={300}
                            classNames="save-status"
                            unmountOnExit
                        >
                            <div className={`save-status ${saveStatus.type}`}>
                                {saveStatus.type === 'success' ? (
                                    <FiCheck className="status-icon" />
                                ) : (
                                    <FiX className="status-icon" />
                                )}
                                {saveStatus.message}
                            </div>
                        </CSSTransition>
                    </form>
                )}

                {!loading && activeTab === 'password' && (
                    <form onSubmit={handlePasswordChange}>
                        <h2 className="section-title">
                            <FiLock /> Change Password
                        </h2>
                        <div className="form-group">
                            <label className="form-label">Old Password</label>
                            <input
                                type="password"
                                className={`form-input ${passwordError.oldPassword ? 'input-error' : ''}`}
                                value={passwordData.oldPassword}
                                onChange={(e) => setPasswordData({ ...passwordData, oldPassword: e.target.value })}
                                required
                                autoComplete="current-password"
                            />
                            {passwordError.oldPassword && (
                                <div className="error-message">
                                    <FiX size={14} style={{ marginRight: '4px' }} />
                                    {passwordError.oldPassword}
                                </div>
                            )}

                        </div>
                        <div className="form-group">
                            <label className="form-label">New Password</label>
                            <input
                                type="password"
                                className="form-input"
                                value={passwordData.newPassword}
                                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                required
                                minLength="8"
                                autoComplete="new-password"
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Confirm New Password</label>
                            <input
                                type="password"
                                className="form-input"
                                value={passwordData.confirmPassword}
                                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                required
                                autoComplete="new-password"
                            />
                            {passwordError.confirmPassword && (
                                <div className="error-message">
                                    {passwordError.confirmPassword}
                                </div>
                            )}
                        </div>

                        <button type="submit" className="btn btn-primary">
                            <FiSave /> Change Password
                        </button>

                        {passwordSuccess ? (
                            <div className="success-message">
                                <FiCheck />
                                Password changed successfully for {userData.email}
                            </div>
                        ) : null}

                        <div className="form-group" style={{ marginTop: '1rem' }}>
                            <a href="/forgot-password" style={{ color: '#3d51d7', textDecoration: 'none' }}>
                                Forgot Password?
                            </a>
                        </div>
                    </form>
                )}
                {!loading && activeTab === 'security' && (
                    <div style={{
                        fontFamily: 'Inter, sans-serif',
                        maxWidth: '800px',
                        margin: '0 auto',
                        fontSize: '16px' // Increased base font size
                    }}>
                        <h2 style={{
                            fontSize: '24px', // Increased size
                            fontWeight: 600,
                            color: '#111827',
                            marginBottom: '28px', // Increased spacing
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px' // Increased gap
                        }}>
                            <FiShield size={24} /> Security Settings
                        </h2>

                        {/* Two-Factor Authentication Card */}
                        <div style={{
                            backgroundColor: 'white',
                            borderRadius: '12px', // Slightly larger radius
                            border: '1px solid #E5E7EB',
                            padding: '28px', // Increased padding
                            marginBottom: '28px', // Increased spacing
                            fontSize: '16px' // Increased font size
                        }}>
                            <h3 style={{
                                fontSize: '20px', // Increased size
                                fontWeight: 600,
                                color: '#111827',
                                marginBottom: '12px' // Increased spacing
                            }}>
                                Two-Factor Authentication
                            </h3>
                            <p style={{
                                fontSize: '16px', // Increased size
                                color: '#6B7280',
                                marginBottom: '20px' // Increased spacing
                            }}>
                                Add an extra layer of security to your account
                            </p>

                            {/* Status indicator - becomes a button when enabled */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '24px', // Increased spacing
                                paddingBottom: '24px', // Increased spacing
                                borderBottom: '1px solid #E5E7EB'
                            }}>
                                {userData.two_fa_enabled ? (
                                    <button
                                        onClick={disable2FA}
                                        style={{
                                            backgroundColor: 'transparent',
                                            color: '#DC2626',
                                            border: 'none',
                                            fontSize: '16px', // Increased size
                                            fontWeight: 500,
                                            cursor: 'pointer',
                                            padding: '8px 12px', // Increased padding
                                            borderRadius: '6px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px' // Increased gap
                                        }}
                                        onMouseOver={(e) => {
                                            e.target.style.backgroundColor = '#F3F4F6';
                                            e.target.style.color = '#DC2626';
                                        }}
                                        onMouseOut={(e) => {
                                            e.target.style.backgroundColor = 'transparent';
                                            e.target.style.color = '#DC2626';
                                        }}
                                    >
                                        <FiCheck size={16} /> Disable
                                    </button>
                                ) : (
                                    <span style={{
                                        fontSize: '16px', // Increased size
                                        color: '#6B7280',
                                        fontWeight: 500,
                                        padding: '8px 12px' // Increased padding
                                    }}>
                                        Not Enabled
                                    </span>
                                )}

                                {!userData.two_fa_enabled && (
                                    <button
                                        onClick={() => setTwoFactorAuth({
                                            ...twoFactorAuth,
                                            showSetup: true,
                                            method: null
                                        })}
                                        style={{
                                            backgroundColor: '#2563EB',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '8px', // Slightly larger radius
                                            padding: '10px 20px', // Increased padding
                                            fontSize: '16px', // Increased size
                                            fontWeight: 500,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Enable
                                    </button>
                                )}
                            </div>

                            {/* Authentication methods list - REMOVED THE EXTRA BUTTONS */}

                        </div>

                        {/* 2FA Setup Modal/Popup */}
                        {twoFactorAuth.showSetup && (
                            <div style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 1000
                            }}>
                                <div style={{
                                    backgroundColor: 'white',
                                    borderRadius: '12px',
                                    padding: '28px', // Increased padding
                                    width: '90%',
                                    maxWidth: '520px', // Slightly wider
                                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
                                    fontSize: '16px' // Increased font size
                                }}>
                                    {/* Back button at the top */}
                                    <div style={{ marginBottom: '20px' }}> {/* Increased spacing */}
                                        <button
                                            onClick={() => setTwoFactorAuth({
                                                ...twoFactorAuth,
                                                showSetup: false,
                                                method: null
                                            })}
                                            style={{
                                                backgroundColor: 'transparent',
                                                border: 'none',
                                                color: '#6B7280',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                fontSize: '16px', // Increased size
                                                padding: 0
                                            }}
                                        >
                                            <FiX size={18} /> Back {/* Increased size */}
                                        </button>
                                    </div>

                                    <h3 style={{
                                        fontSize: '20px', // Increased size
                                        fontWeight: 600,
                                        color: '#111827',
                                        marginBottom: '20px' // Increased spacing
                                    }}>
                                        Set Up Two-Factor Authentication
                                    </h3>

                                    {!twoFactorAuth.method ? (
                                        // Method selection
                                        <div>
                                            <p style={{ marginBottom: '24px', color: '#6B7280', fontSize: '16px' }}> {/* Increased size */}
                                                Choose your preferred 2FA method:
                                            </p>

                                            <div style={{ marginBottom: '24px' }}> {/* Increased spacing */}
                                                <button
                                                    onClick={() => initiate2FASetup('app')}
                                                    style={{
                                                        width: '100%',
                                                        padding: '16px 20px', // Increased padding
                                                        marginBottom: '16px', // Increased spacing
                                                        backgroundColor: 'white',
                                                        border: '1px solid #E5E7EB',
                                                        borderRadius: '8px',
                                                        textAlign: 'left',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '12px',
                                                        fontSize: '16px' // Increased size
                                                    }}
                                                >
                                                    <FiShield size={22} /> {/* Increased size */}
                                                    <div>
                                                        <div style={{ fontWeight: 500 }}>Authenticator App</div>
                                                        <div style={{ fontSize: '14px', color: '#6B7280' }}>Use Microsoft Authenticator or similar</div>
                                                    </div>
                                                </button>

                                                <button
                                                    onClick={() => initiate2FASetup('email')}
                                                    style={{
                                                        width: '100%',
                                                        padding: '16px 20px', // Increased padding
                                                        backgroundColor: 'white',
                                                        border: '1px solid #E5E7EB',
                                                        borderRadius: '8px',
                                                        textAlign: 'left',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '12px',
                                                        fontSize: '16px' // Increased size
                                                    }}
                                                >
                                                    <FiMail size={22} /> {/* Increased size */}
                                                    <div>
                                                        <div style={{ fontWeight: 500 }}>Email Verification</div>
                                                        <div style={{ fontSize: '14px', color: '#6B7280' }}>Receive one-time passcodes via email</div>
                                                    </div>
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        // Method-specific setup
                                        <div>
                                            {twoFactorAuth.method === 'app' ? (
                                                <div style={{
                                                    backgroundColor: '#F9FAFB',
                                                    borderRadius: '8px', // Slightly larger radius
                                                    padding: '20px', // Increased padding
                                                    marginBottom: '20px', // Increased spacing
                                                    textAlign: 'center'
                                                }}>
                                                    <p style={{ fontSize: '16px', color: '#6B7280', marginBottom: '16px' }}> {/* Increased size */}
                                                        Scan this QR code with your authenticator app:
                                                    </p>

                                                    {twoFactorAuth.qrCodeUrl && (
                                                        <img
                                                            src={twoFactorAuth.qrCodeUrl}
                                                            alt="2FA QR Code"
                                                            style={{
                                                                width: 180, // Increased size
                                                                height: 180, // Increased size
                                                                margin: '0 auto 16px', // Increased spacing
                                                                display: 'block'
                                                            }}
                                                        />
                                                    )}

                                                    <p style={{ fontSize: '16px', color: '#6B7280', marginBottom: '12px' }}> {/* Increased size */}
                                                        Or enter this secret key manually:
                                                    </p>
                                                    <div style={{
                                                        fontFamily: 'monospace',
                                                        backgroundColor: '#F3F4F6',
                                                        padding: '12px 16px', // Increased padding
                                                        borderRadius: '6px', // Slightly larger radius
                                                        fontSize: '16px', // Increased size
                                                        wordBreak: 'break-all',
                                                        margin: '0 auto',
                                                        maxWidth: '85%' // Slightly wider
                                                    }}>
                                                        {twoFactorAuth.secret}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div style={{
                                                    backgroundColor: '#F9FAFB',
                                                    borderRadius: '8px', // Slightly larger radius
                                                    padding: '20px', // Increased padding
                                                    marginBottom: '20px', // Increased spacing
                                                    textAlign: 'center'
                                                }}>
                                                    <p style={{ fontSize: '16px', color: '#6B7280', marginBottom: '16px' }}> {/* Increased size */}
                                                        We've sent a verification code to your email address.
                                                    </p>
                                                </div>
                                            )}

                                            <div style={{ marginBottom: '20px' }}> {/* Increased spacing */}
                                                <label style={{
                                                    display: 'block',
                                                    fontSize: '16px', // Increased size
                                                    fontWeight: 500,
                                                    color: '#374151',
                                                    marginBottom: '8px' // Increased spacing
                                                }}>
                                                    Verification Code
                                                </label>
                                                <input
                                                    type="text"
                                                    value={twoFactorAuth.verificationCode}
                                                    onChange={(e) => setTwoFactorAuth({ ...twoFactorAuth, verificationCode: e.target.value })}
                                                    placeholder="Enter 6-digit code"
                                                    style={{
                                                        width: '100%',
                                                        padding: '12px 16px', // Increased padding
                                                        border: '1px solid #D1D5DB',
                                                        borderRadius: '8px', // Slightly larger radius
                                                        fontSize: '16px' // Increased size
                                                    }}
                                                />
                                            </div>

                                            <div style={{ display: 'flex', gap: '16px' }}> {/* Increased spacing */}
                                                <button
                                                    type="button"
                                                    onClick={verify2FA}
                                                    style={{
                                                        backgroundColor: '#2563EB',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '8px', // Slightly larger radius
                                                        padding: '12px 20px', // Increased padding
                                                        fontSize: '16px', // Increased size
                                                        fontWeight: 500,
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px'
                                                    }}
                                                >
                                                    <FiCheck size={18} /> Verify and Enable {/* Increased size */}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setTwoFactorAuth({
                                                        ...twoFactorAuth,
                                                        showSetup: false,
                                                        method: null
                                                    })}
                                                    style={{
                                                        backgroundColor: 'white',
                                                        color: '#374151',
                                                        border: '1px solid #D1D5DB',
                                                        borderRadius: '8px', // Slightly larger radius
                                                        padding: '12px 20px', // Increased padding
                                                        fontSize: '16px', // Increased size
                                                        fontWeight: 500,
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px'
                                                    }}
                                                >
                                                    <FiX size={18} /> Cancel {/* Increased size */}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )} {!loading && activeTab === 'danger' && (
                    <div>
                        <h2 className="section-title">
                            <FiTrash2 /> Danger Zone
                        </h2>

                        {!deleteConfirm.showConfirmation ? (
                            // Step 1: Initial delete prompt
                            <div className="delete-confirmation">
                                <h3 className="delete-warning">Delete Your Account</h3>
                                <p>
                                    Warning: This action is irreversible. Deleting your account will permanently remove all your
                                    personal data, settings, and history associated with this account.
                                </p>
                                <button
                                    type="button"
                                    className="btn btn-danger"
                                    onClick={confirmAccountDeletion}
                                >
                                    <FiTrash2 /> Delete Account
                                </button>
                            </div>
                        ) : !otpVerification.otpSent ? (
                            // Step 2: Confirm deletion form (password + type "delete my account")
                            <form onSubmit={(e) => e.preventDefault()}>
                                <div className="delete-confirmation">
                                    <h3 className="delete-warning">Email Verification Required</h3>
                                    <p>
                                        An OTP has been sent to your registered email. Enter it below to verify your identity and permanently
                                        delete your account. This ensures your account cannot be deleted accidentally or by someone else.
                                    </p>

                                    <div className="form-group">
                                        <label className="form-label">Enter OTP</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={otpVerification.code}
                                            onChange={(e) => setOtpVerification({ ...otpVerification, code: e.target.value })}
                                            required
                                        />
                                    </div>

                                    <button
                                        type="button"
                                        className="btn btn-danger"
                                        onClick={verifyOtpAndDeleteAccount}
                                    >
                                        <FiTrash2 /> Verify OTP & Delete Account
                                    </button>

                                    <button
                                        type="button"
                                        className="btn btn-outline"
                                        style={{ marginLeft: '0.5rem' }}
                                        onClick={cancelAccountDeletion}
                                    >
                                        <FiX /> Cancel
                                    </button>

                                    {/* Resend OTP section */}
                                    <div style={{ marginTop: '1rem' }}>
                                        {otpVerification.resendTimer > 0 ? (
                                            <p style={{ fontSize: '0.9rem', color: '#555' }}>
                                                You can resend OTP in {otpVerification.resendTimer}s
                                            </p>
                                        ) : (
                                            <button
                                                type="button"
                                                className="btn btn-outline"
                                                onClick={resendDeletionOtp}
                                            >
                                                Resend OTP
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </form>
                        ) : (
                            // Step 3: OTP verification form
                            <form onSubmit={(e) => e.preventDefault()}>
                                <div className="delete-confirmation">
                                    <h3 className="delete-warning">Email Verification Required</h3>
                                    <p>
                                        An OTP has been sent to your registered email address. Enter the OTP below to verify your
                                        identity and permanently delete your account. This is a security measure to protect your
                                        account from accidental deletion.
                                    </p>

                                    <div className="form-group">
                                        <label className="form-label">Enter OTP</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={otpVerification.code}
                                            onChange={(e) => setOtpVerification({ ...otpVerification, code: e.target.value })}
                                            required
                                        />
                                    </div>

                                    <button
                                        type="button"
                                        className="btn btn-danger"
                                        onClick={verifyOtpAndDeleteAccount}
                                    >
                                        <FiTrash2 /> Verify OTP & Delete Account
                                    </button>

                                    <button
                                        type="button"
                                        className="btn btn-outline"
                                        style={{ marginLeft: '0.5rem' }}
                                        onClick={cancelAccountDeletion}
                                    >
                                        <FiX /> Cancel
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SettingsPage;