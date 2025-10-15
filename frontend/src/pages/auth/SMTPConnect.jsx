import React, { useState } from 'react';
import { FiX } from 'react-icons/fi';
import axios from 'axios';
import { motion } from 'framer-motion';

const SMTPConnect = ({ onSuccess, onClose }) => {
    const token = localStorage.getItem('token');
    const API_BASE_URL = 'http://localhost:5000';

    const [formData, setFormData] = useState({
        senderName: '',
        username: '',
        email: '',
        password: '',
        smtpHost: '',
        smtpPort: '465',
        encryption: 'SSL',
        useDifferentUsername: false,
        imapHost: '',
        imapPort: '993',
        imapEncryption: 'SSL',
        useSmtpCredentialsForImap: true,
        imapEmail: '',
        imapPassword: ''
    });

    const [activeTab, setActiveTab] = useState('smtp');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const toggleUsername = () => {
        setFormData(prev => ({
            ...prev,
            useDifferentUsername: !prev.useDifferentUsername
        }));
    };

    const toggleUseSmtpCredentialsForImap = () => {
        setFormData(prev => ({
            ...prev,
            useSmtpCredentialsForImap: !prev.useSmtpCredentialsForImap
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const payload = {
                sender_name: formData.senderName,
                email: formData.email,
                smtp_host: formData.smtpHost,
                smtp_port: formData.smtpPort,
                smtp_user: formData.useDifferentUsername ? formData.username : formData.email,
                smtp_pass: formData.password,
                smtp_encryption: formData.encryption,
                imap_host: formData.imapHost,
                imap_port: formData.imapPort,
                imap_user: formData.useSmtpCredentialsForImap ? formData.email : formData.imapEmail,
                imap_pass: formData.useSmtpCredentialsForImap ? formData.password : formData.imapPassword,
                imap_encryption: formData.imapEncryption
            };

            await axios.post(`${API_BASE_URL}/api/account`, payload, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            onSuccess();
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to connect SMTP account');
        } finally {
            setLoading(false);
        }
    };

    const handleTestSmtp = async () => {
        try {
            const payload = {
                smtp_host: formData.smtpHost,
                smtp_port: formData.smtpPort,
                smtp_user: formData.useDifferentUsername ? formData.username : formData.email,
                smtp_pass: formData.password,
                smtp_encryption: formData.encryption,
                email: formData.email
            };
            await axios.post(`${API_BASE_URL}/api/account/test-smtp`, payload, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            alert('✅ SMTP test successful');
        } catch (err) {
            alert(err.response?.data?.error || 'SMTP test failed');
        }
    };

    const handleTestImap = async () => {
        try {
            const payload = {
                imap_host: formData.imapHost,
                imap_port: formData.imapPort,
                imap_user: formData.email,
                imap_pass: formData.useSmtpCredentialsForImap ? formData.password : formData.imapPassword,
                imap_encryption: formData.imapEncryption,
                email: formData.email,
                smtp_pass: formData.password
            };
            await axios.post(`${API_BASE_URL}/api/account/test-imap`, payload, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            alert('✅ IMAP test successful');
        } catch (err) {
            alert(err.response?.data?.error || 'IMAP test failed');
        }
    };

    return (
        <div className="smtp-connect-modal">
            <div className="modal-overlay">
                <div className="modal-content">
                    <div className="modal-header">
                        <motion.h2
                            initial={{ scale: 1 }}
                            whileHover={{
                                scale: 1.05,
                                rotate: [0, -2, 2, -2, 2, 0],
                                transition: { duration: 0.6 }
                            }}
                        >
                            SMTP Details - Sending Emails
                        </motion.h2>
                        <button className="close-btn" onClick={onClose}>
                            <FiX />
                        </button>
                    </div>

                    <div className="tabs">
                        <button
                            className={`tab ${activeTab === 'smtp' ? 'active' : ''}`}
                            onClick={() => setActiveTab('smtp')}
                        >
                            <span>SMTP</span>
                        </button>
                        <button
                            className={`tab ${activeTab === 'imap' ? 'active' : ''}`}
                            onClick={() => setActiveTab('imap')}
                        >
                            <span>IMAP</span>
                        </button>
                    </div>

                    {error && (
                        <motion.div
                            className="error-message"
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            {error}
                        </motion.div>
                    )}

                    {activeTab === 'smtp' ? (
                        <form onSubmit={handleSubmit} className="smtp-form">
                            <div className="form-section">
                                <label>Sender Name</label>
                                <input
                                    type="text"
                                    name="senderName"
                                    placeholder="Enter Name"
                                    value={formData.senderName}
                                    onChange={handleChange}
                                    required
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
                                            checked={formData.useDifferentUsername}
                                            onChange={toggleUsername}
                                            className="toggle-input"
                                        />
                                        <span className="toggle-slider"></span>
                                    </div>
                                </label>
                            </div>

                            {formData.useDifferentUsername && (
                                <div className="form-section">
                                    <label>Username</label>
                                    <input
                                        type="text"
                                        name="username"
                                        placeholder="Enter username"
                                        value={formData.username}
                                        onChange={handleChange}
                                    />
                                </div>
                            )}
                            <div className="form-section">
                                <label>Email Address</label>
                                <input
                                    type="email"
                                    name="email"
                                    placeholder="Enter Email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                />
                            </div>

                            <div className="form-section">
                                <label>Password</label>
                                <input
                                    type="password"
                                    name="password"
                                    placeholder="Enter Password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    required
                                />
                            </div>

                            <div className="form-section">
                                <label>SMTP Host</label>
                                <input
                                    type="text"
                                    name="smtpHost"
                                    placeholder="Enter SMTP Host"
                                    value={formData.smtpHost}
                                    onChange={handleChange}
                                    required
                                />
                            </div>

                            <div className="form-section">
                                <label>SMTP Port</label>
                                <input
                                    type="text"
                                    name="smtpPort"
                                    placeholder="Enter SMTP Port"
                                    value={formData.smtpPort}
                                    onChange={handleChange}
                                    required
                                />
                            </div>

                            <div className="form-section">
                                <label>Encryption</label>
                                <div className="radio-group">
                                    <label className="radio-label">
                                        <input
                                            type="radio"
                                            name="encryption"
                                            value="SSL"
                                            checked={formData.encryption === 'SSL'}
                                            onChange={handleChange}
                                        />
                                        <span className="radio-custom"></span>
                                        SSL
                                    </label>
                                    <label className="radio-label">
                                        <input
                                            type="radio"
                                            name="encryption"
                                            value="TLS"
                                            checked={formData.encryption === 'TLS'}
                                            onChange={handleChange}
                                        />
                                        <span className="radio-custom"></span>
                                        TLS
                                    </label>
                                    <label className="radio-label">
                                        <input
                                            type="radio"
                                            name="encryption"
                                            value="None"
                                            checked={formData.encryption === 'None'}
                                            onChange={handleChange}
                                        />
                                        <span className="radio-custom"></span>
                                        None
                                    </label>
                                </div>
                            </div>

                            <div className="instructions">
                                <h3>Instructions to connect your email account through the SMTP Method</h3>
                                <ul>
                                    <li>Make sure SMTP is enabled on your email account.</li>
                                    <li>If you're using a regular password, ensure that any two-factor authentication is disabled on your email account.</li>
                                    <li>If your ESP supports an app password, use that instead of a regular password.</li>
                                    <li>Use correct SMTP details like host & port from your email provider.</li>
                                </ul>
                            </div>

                            <div className="test-buttons">
                                <motion.button
                                    type="button"
                                    className="btn-test"
                                    onClick={handleTestSmtp}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    Test SMTP
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
                                    {loading ? 'Connecting...' : 'Connect & Save'}
                                </motion.button>
                            </div>
                        </form>
                    ) : (
                        <form onSubmit={handleSubmit} className="imap-form">
                            <div className="form-section">
                                <label className="toggle-label">
                                    Use the same username and password from SMTP
                                    <div className="toggle-switch">
                                        <input
                                            type="checkbox"
                                            name="useSmtpCredentialsForImap"
                                            checked={formData.useSmtpCredentialsForImap}
                                            onChange={toggleUseSmtpCredentialsForImap}
                                            className="toggle-input"
                                        />
                                        <span className="toggle-slider"></span>
                                    </div>
                                </label>
                            </div>

                            <div className="form-section">
                                <label>Email Address</label>
                                <input
                                    type="email"
                                    name="imapEmail"
                                    placeholder="Enter Email"
                                    value={formData.useSmtpCredentialsForImap ? formData.email : formData.imapEmail}
                                    onChange={handleChange}
                                    disabled={formData.useSmtpCredentialsForImap}
                                    required
                                />
                            </div>

                            <div className="form-section">
                                <label>Password</label>
                                <input
                                    type="password"
                                    name="imapPassword"
                                    placeholder="Enter Password"
                                    value={formData.useSmtpCredentialsForImap ? formData.password : formData.imapPassword}
                                    onChange={handleChange}
                                    disabled={formData.useSmtpCredentialsForImap}
                                    required
                                />
                            </div>

                            <div className="form-section">
                                <label>IMAP Host</label>
                                <input
                                    type="text"
                                    name="imapHost"
                                    placeholder="Enter IMAP Host"
                                    value={formData.imapHost}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="form-section">
                                <label>IMAP Port</label>
                                <input
                                    type="text"
                                    name="imapPort"
                                    placeholder="Enter IMAP Port"
                                    value={formData.imapPort}
                                    onChange={handleChange}
                                    required
                                />
                            </div>

                            <div className="form-section">
                                <label>Encryption</label>
                                <div className="radio-group">
                                    <label className="radio-label">
                                        <input
                                            type="radio"
                                            name="imapEncryption"
                                            value="SSL"
                                            checked={formData.imapEncryption === 'SSL'}
                                            onChange={handleChange}
                                        />
                                        <span className="radio-custom"></span>
                                        SSL
                                    </label>
                                    <label className="radio-label">
                                        <input
                                            type="radio"
                                            name="imapEncryption"
                                            value="TLS"
                                            checked={formData.imapEncryption === 'TLS'}
                                            onChange={handleChange}
                                        />
                                        <span className="radio-custom"></span>
                                        TLS
                                    </label>
                                    <label className="radio-label">
                                        <input
                                            type="radio"
                                            name="imapEncryption"
                                            value="None"
                                            checked={formData.imapEncryption === 'None'}
                                            onChange={handleChange}
                                        />
                                        <span className="radio-custom"></span>
                                        None
                                    </label>
                                </div>
                            </div>

                            <div className="test-buttons">
                                <motion.button
                                    type="button"
                                    className="btn-test"
                                    onClick={handleTestImap}
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
                                    {loading ? 'Connecting...' : 'Connect & Save'}
                                </motion.button>
                            </div>
                        </form>
                    )}
                </div>
            </div>

            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Montserrat:wght@400;500;600;700&display=swap');
            `}</style>

            <style jsx>{`
                .smtp-connect-modal {
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
                    width: 850px;
                    max-width: 90%;
                    max-height: 90vh;
                    overflow-y: auto;
                    padding: 30px;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    backdrop-filter: blur(10px);
                }

                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 25px;
                    position: relative;
                }

                .modal-header h2 {
                    margin: 0;
                    font-size: 26px;
                    color: #4f46e5;
                    font-weight: 700;
                    font-family: 'Montserrat', sans-serif;
                    background: linear-gradient(135deg, #4be03dff 0%, #3d51d7ff 70%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                    letter-spacing: 0.5px;
                }

                .close-btn {
                    background: #ff4757;
                    border: none;
                    font-size: 20px;
                    cursor: pointer;
                    color: white;
                    padding: 8px;
                    border-radius: 50%;
                    transition: all 0.3s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 36px;
                    height: 36px;
                    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
                }

                .close-btn:hover {
                    background: #ff6b81;
                    transform: rotate(90deg);
                }

                .tabs {
                    display: flex;
                    border-bottom: 2px solid #a7b3dbff;
                    margin-bottom: 25px;
                }

                .tab {
                    padding: 12px 25px;
                    background: none;
                    border: none;
                    border-bottom: 3px solid transparent;
                    cursor: pointer;
                    font-weight: 600;
                    color: #6b7280;
                    transition: all 0.3s;
                    font-size: 15px;
                    position: relative;
                    font-family: 'Montserrat', sans-serif;
                    letter-spacing: 0.5px;
                }

                .tab span {
                    position: relative;
                    z-index: 1;
                }

                .tab:hover {
                    color: #4f46e5;
                }

                .tab.active {
                    color: #4f46e5;
                    border-bottom-color: #4f46e5;
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

                .form-section input:disabled {
                    background-color: #f1f5f9;
                    cursor: not-allowed;
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

                .radio-group {
                    display: flex;
                    align-items: center;
                    gap: 20px;
                    margin: 15px 0;
                }

                .radio-label {
                    display: flex;
                    align-items: center;
                    cursor: pointer;
                    font-size: 15px;
                    color: #4b5563;
                    font-family: 'Poppins', sans-serif;
                    position: relative;
                    padding-left: 30px;
                    margin-bottom: 0;
                }

                .radio-label input[type="radio"] {
                    position: absolute;
                    opacity: 0;
                    cursor: pointer;
                    height: 0;
                    width: 0;
                }

                .radio-custom {
                    position: absolute;
                    top: 0;
                    left: 0;
                    height: 20px;
                    width: 20px;
                    background-color: #f8fafc;
                    border-radius: 50%;
                    border: 2px solid #cbd5e1;
                    transition: all 0.3s;
                }

                .radio-label:hover input ~ .radio-custom {
                    border-color: #4f46e5;
                }

                .radio-label input:checked ~ .radio-custom {
                    background-color: #4f46e5;
                    border-color: #4f46e5;
                    box-shadow: inset 0 0 0 4px white;
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
                    margin: 25px 0;
                }

                .btn-test {
                    padding: 12px 24px;
                    background: linear-gradient(90deg, #4f46e5, #672bceff);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    font-size: 15px;
                    transition: all 0.3s;
                    font-family: 'Poppins', sans-serif;
                    box-shadow: 0 4px 6px rgba(79, 70, 229, 0.2);
                    letter-spacing: 0.5px;
                }

                .btn-test:hover {
                    background: linear-gradient(90deg, #4338ca, #6d28d9);
                    box-shadow: 0 6px 8px rgba(79, 70, 229, 0.3);
                    transform: translateY(-2px);
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
                    letter-spacing: 0.5px;
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
                    color: #1e293b;
                }

                .btn-confirm {
                    background: linear-gradient(90deg, #4f46e5, #7c3aed);
                    color: white;
                    border: 2px solid transparent;
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

                @media (max-width: 768px) {
                    .modal-content {
                        width: 95%;
                        padding: 20px;
                    }

                    .modal-header h2 {
                        font-size: 22px;
                    }

                    .radio-group {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 12px;
                    }

                    .modal-actions {
                        flex-direction: column;
                        gap: 12px;
                    }

                    .btn-cancel, .btn-confirm {
                        width: 100%;
                        text-align: center;
                    }

                    .tabs {
                        justify-content: center;
                    }

                    .tab {
                        padding: 10px 15px;
                        font-size: 14px;
                    }
                }

                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
                    20%, 40%, 60%, 80% { transform: translateX(5px); }
                }

                .shake-on-hover:hover {
                    animation: shake 0.5s ease-in-out;
                }
            `}</style>
        </div>
    );
};

export default SMTPConnect;