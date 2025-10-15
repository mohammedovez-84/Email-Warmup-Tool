import React, { useState } from 'react';
import { FiX } from 'react-icons/fi';
import axios from 'axios';
import { motion } from 'framer-motion';

const API_BASE_URL = 'http://localhost:5000';

const GoogleConnect = ({ onSuccess, onClose }) => {
    const [formData, setFormData] = useState({
        senderName: '',
        username: '',
        email: '',
        appPassword: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [useDifferentUsername, setUseDifferentUsername] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            await axios.post(`${API_BASE_URL}/api/accounts/connect-google`, {
                name: formData.senderName,
                email: formData.email,
                appPassword: formData.appPassword,
            }, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                }
            });

            onSuccess();
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to connect Google account');
        } finally {
            setLoading(false);
        }
    };

    const handleTestSMTP = async () => {
        setError('');
        try {
            await axios.post(`${API_BASE_URL}/api/accounts/test-smtp`, {
                serviceName: 'google',
                email: formData.email,
                appPassword: formData.appPassword,
            });
            alert('✅ SMTP Test successful!');
        } catch (err) {
            setError(err.response?.data?.error || 'SMTP Test failed');
        }
    };

    const handleTestIMAP = async () => {
        setError('');
        try {
            await axios.post(`${API_BASE_URL}/api/accounts/test-imap`, {
                serviceName: 'google',
                email: formData.email,
                appPassword: formData.appPassword,
            });
            alert('✅ IMAP Test successful!');
        } catch (err) {
            setError(err.response?.data?.error || 'IMAP Test failed');
        }
    };

    return (
        <div className="google-connect-modal">
            <div className="modal-overlay">
                <motion.div
                    className="modal-content"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                >
                    <div className="modal-header">
                        <motion.h2
                            initial={{ scale: 1 }}
                            whileHover={{
                                scale: 1.05,
                                rotate: [0, -2, 2, -2, 2, 0],
                                transition: { duration: 0.6 }
                            }}
                        >
                            <span className="gradient-text">Google Account Connection</span>
                        </motion.h2>
                        <motion.button
                            className="close-btn"
                            onClick={onClose}
                            whileHover={{ rotate: 90, scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                        >
                            <FiX />
                        </motion.button>
                    </div>

                    <motion.p
                        className="modal-subtitle"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        Connect your Gmail account to start sending emails
                    </motion.p>

                    {error && (
                        <motion.div
                            className="error-message"
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            {error}
                        </motion.div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="form-section">
                            <label>Sender Name</label>
                            <motion.input
                                type="text"
                                name="senderName"
                                placeholder="Enter Name"
                                value={formData.senderName}
                                onChange={handleChange}
                                required
                                whileFocus={{
                                    boxShadow: "0 0 0 3px rgba(79, 70, 229, 0.2)",
                                    borderColor: "#4f46e5"
                                }}
                            />
                        </div>

                        <div className="toggle-group">
                            <label className="toggle-label">
                                Use different username
                                <div className="toggle-switch">
                                    <input
                                        type="checkbox"
                                        id="useDifferentUsername"
                                        name="useDifferentUsername"
                                        checked={useDifferentUsername}
                                        onChange={() => setUseDifferentUsername(!useDifferentUsername)}
                                        className="toggle-input"
                                    />
                                    <span className="toggle-slider"></span>
                                </div>
                            </label>
                        </div>

                        {useDifferentUsername && (
                            <motion.div
                                className="form-section"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                transition={{ duration: 0.3 }}
                            >
                                <label>Username</label>
                                <motion.input
                                    type="text"
                                    name="username"
                                    placeholder="Enter username"
                                    value={formData.username}
                                    onChange={handleChange}
                                    required={useDifferentUsername}
                                    whileFocus={{
                                        boxShadow: "0 0 0 3px rgba(79, 70, 229, 0.2)",
                                        borderColor: "#4f46e5"
                                    }}
                                />
                            </motion.div>
                        )}

                        <div className="form-section">
                            <label>Email Address</label>
                            <motion.input
                                type="email"
                                name="email"
                                placeholder="Enter Email"
                                value={formData.email}
                                onChange={handleChange}
                                required
                                whileFocus={{
                                    boxShadow: "0 0 0 3px rgba(79, 70, 229, 0.2)",
                                    borderColor: "#4f46e5"
                                }}
                            />
                        </div>

                        <div className="form-section">
                            <label>App Password</label>
                            <motion.input
                                type="password"
                                name="appPassword"
                                placeholder="Enter App Password"
                                value={formData.appPassword}
                                onChange={handleChange}
                                required
                                whileFocus={{
                                    boxShadow: "0 0 0 3px rgba(79, 70, 229, 0.2)",
                                    borderColor: "#4f46e5"
                                }}
                            />
                        </div>

                        <motion.div
                            className="instructions"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                        >
                            <h3>Instructions to connect your Google account</h3>
                            <ul>
                                <li>Make sure SMTP is enabled on your Google account</li>
                                <li>If you're using a regular password, ensure that any two-factor authentication is disabled</li>
                                <li>If Google supports an app password, use that instead of a regular password</li>
                                <li>Use correct SMTP details from Google's documentation</li>
                            </ul>
                        </motion.div>

                        <div className="test-buttons">
                            <motion.button
                                type="button"
                                className="btn-test"
                                onClick={handleTestSMTP}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                Test SMTP
                            </motion.button>
                            <motion.button
                                type="button"
                                className="btn-test"
                                onClick={handleTestIMAP}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                Test IMAP
                            </motion.button>
                        </div>

                        <div className="modal-actions">
                            <motion.button
                                type="button"
                                className="btn-cancel"
                                onClick={onClose}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                Cancel
                            </motion.button>
                            <motion.button
                                type="submit"
                                className="btn-confirm"
                                disabled={loading}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                {loading ? (
                                    <span className="loading-text">
                                        <span className="loading-dots">Connecting</span>
                                    </span>
                                ) : 'Connect & Save'}
                            </motion.button>
                        </div>
                    </form>
                </motion.div>
            </div>

            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Montserrat:wght@400;500;600;700&display=swap');
            `}</style>

            <style jsx>{`
                .google-connect-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                    font-family: 'Poppins', sans-serif;
                }

                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: rgba(0, 0, 0, 0.7);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                }

                .modal-content {
                    background: linear-gradient(145deg, #ffffff, #f8f9fa);
                    border-radius: 16px;
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
                    width: 600px;
                    max-width: 90%;
                    max-height: 90vh;
                    overflow-y: auto;
                    padding: 30px;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    backdrop-filter: blur(10px);
                    position: relative;
                }

                .modal-content::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 8px;
                    background: linear-gradient(90deg, #4f46e5, #3b82f6, #10b981, #f59e0b, #ef4444);
                    background-size: 400% 400%;
                    animation: gradientBG 8s ease infinite;
                    border-radius: 16px 16px 0 0;
                }

                @keyframes gradientBG {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }

                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 25px;
                    position: relative;
                    padding-top: 15px;
                }

                .modal-header h2 {
                    margin: 0;
                    font-size: 26px;
                    font-weight: 700;
                    font-family: 'Montserrat', sans-serif;
                    letter-spacing: 0.5px;
                }

                .gradient-text {
                    background: linear-gradient(90deg, #4f46e5, #3b82f6);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    text-fill-color: transparent;
                }

                .close-btn {
                    background: #ff4757;
                    border: none;
                    font-size: 20px;
                    cursor: pointer;
                    color: white;
                    padding: 8px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 36px;
                    height: 36px;
                    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
                    z-index: 1;
                }

                .close-btn:hover {
                    background: #ff6b81;
                }

                .modal-subtitle {
                    margin-top: 0;
                    margin-bottom: 25px;
                    color: #6b7280;
                    font-size: 16px;
                    font-family: 'Poppins', sans-serif;
                }

                .form-section {
                    margin-bottom: 20px;
                }

                .form-section label {
                    display: block;
                    margin-bottom: 10px;
                    font-weight: 500;
                    color: #4b5563;
                    font-size: 15px;
                    font-family: 'Poppins', sans-serif;
                }

                .form-section input[type="text"],
                .form-section input[type="email"],
                .form-section input[type="password"] {
                    width: 100%;
                    padding: 12px 15px;
                    border: 2px solid #e0e7ff;
                    border-radius: 8px;
                    font-size: 15px;
                    transition: all 0.3s;
                    background-color: #f8fafc;
                    font-family: 'Poppins', sans-serif;
                }

                .form-section input[type="text"]:focus,
                .form-section input[type="email"]:focus,
                .form-section input[type="password"]:focus {
                    outline: none;
                    border-color: #4f46e5;
                    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.2);
                    background-color: white;
                }

                .toggle-group {
                    margin: 20px 0;
                }

                .toggle-label {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    cursor: pointer;
                    font-weight: 500;
                    color: #4b5563;
                    font-size: 15px;
                    font-family: 'Poppins', sans-serif;
                }

                .toggle-switch {
                    position: relative;
                    display: inline-block;
                    width: 50px;
                    height: 26px;
                    margin-left: 15px;
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
                    height: 20px;
                    width: 20px;
                    left: 3px;
                    bottom: 3px;
                    background-color: white;
                    transition: .4s;
                    border-radius: 50%;
                    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
                }

                .toggle-input:checked + .toggle-slider {
                    background: linear-gradient(135deg, #4be03dff 0%, #3d51d7ff 70%);
                }

                .toggle-input:checked + .toggle-slider:before {
                    transform: translateX(24px);
                }

                .instructions {
                    margin: 30px 0;
                    padding: 25px;
                    background: linear-gradient(145deg, #f0f4ff, #e0e7ff);
                    border-radius: 12px;
                    border-left: 5px solid #4f46e5;
                }

                .instructions h3 {
                    margin-top: 0;
                    font-size: 17px;
                    color: #4f46e5;
                    margin-bottom: 15px;
                    font-weight: 600;
                    font-family: 'Montserrat', sans-serif;
                }

                .instructions ul {
                    padding-left: 25px;
                    margin-bottom: 0;
                    font-size: 15px;
                    color: #4b5563;
                    line-height: 1.7;
                    list-style-type: none;
                }

                .instructions li {
                    margin-bottom: 10px;
                    position: relative;
                    padding-left: 20px;
                }

                .instructions li:before {
                    content: "•";
                    color: #4f46e5;
                    font-weight: bold;
                    position: absolute;
                    left: 0;
                }

                .test-buttons {
                    display: flex;
                    gap: 15px;
                    margin: 25px 0;
                }

                .btn-test {
                    flex: 1;
                    padding: 12px;
                    background: linear-gradient(90deg, #4f46e5, #6366f1);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    font-size: 15px;
                    transition: all 0.3s;
                    font-family: 'Poppins', sans-serif;
                    box-shadow: 0 4px 6px rgba(79, 70, 229, 0.2);
                }

                .btn-test:hover {
                    background: linear-gradient(90deg, #4338ca, #4f46e5);
                    box-shadow: 0 6px 8px rgba(79, 70, 229, 0.3);
                }

                .error-message {
                    color: #dc2626;
                    background-color: #fee2e2;
                    padding: 15px;
                    border-radius: 8px;
                    margin-bottom: 25px;
                    font-size: 15px;
                    border-left: 4px solid #dc2626;
                    font-family: 'Poppins', sans-serif;
                }

                .modal-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 15px;
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 2px solid #e0e7ff;
                }

                .btn-cancel, .btn-confirm {
                    padding: 12px 25px;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s;
                    font-size: 15px;
                    font-family: 'Poppins', sans-serif;
                }

                .btn-cancel {
                    background: white;
                    color: #4b5563;
                    border: 2px solid #e0e7ff;
                    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
                }

                .btn-cancel:hover {
                    background: #f3f4f6;
                    border-color: #cbd5e1;
                }

                .btn-confirm {
                    background: linear-gradient(90deg, #4f46e5, #7c3aed);
                    color: white;
                    border: none;
                    box-shadow: 0 4px 6px rgba(79, 70, 229, 0.2);
                }

                .btn-confirm:hover {
                    background: linear-gradient(90deg, #4338ca, #6d28d9);
                    box-shadow: 0 6px 8px rgba(79, 70, 229, 0.3);
                }

                .btn-confirm:disabled {
                    background: #c7d2fe;
                    cursor: not-allowed;
                    box-shadow: none;
                }

                .loading-text {
                    display: inline-flex;
                    align-items: center;
                }

                .loading-dots::after {
                    content: "...";
                    display: inline-block;
                    width: 20px;
                    overflow: hidden;
                    vertical-align: bottom;
                    animation: ellipsis steps(4,end) 1.5s infinite;
                }

                @keyframes ellipsis {
                    to { width: 0; }
                }

                @media (max-width: 768px) {
                    .modal-content {
                        width: 95%;
                        padding: 20px;
                    }

                    .modal-header h2 {
                        font-size: 22px;
                    }

                    .test-buttons {
                        flex-direction: column;
                    }

                    .modal-actions {
                        flex-direction: column;
                    }

                    .btn-cancel, .btn-confirm {
                        width: 100%;
                    }
                }
            `}</style>
        </div>
    );
};

export default GoogleConnect;