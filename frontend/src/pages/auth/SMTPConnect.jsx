import React, { useState } from 'react';
import { FiX, FiMail, FiLock, FiUser, FiServer, FiShield, FiCheck, FiHelpCircle } from 'react-icons/fi';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

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
        if (!formData.smtpHost || !formData.email || !formData.password) {
            setError('Please fill in all required SMTP fields first');
            return;
        }

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
        if (!formData.imapHost || !formData.email) {
            setError('Please fill in all required IMAP fields first');
            return;
        }

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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
                className="bg-white rounded-xl w-full max-w-4xl mx-auto shadow-2xl border border-gray-200 max-h-[90vh] overflow-hidden flex flex-col"
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-teal-800 to-teal-600 px-6 py-4 border-b border-teal-700">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-bold text-white font-['Montserrat']">
                                SMTP Configuration
                            </h2>
                            <p className="text-teal-100 text-sm mt-1 font-['Poppins']">
                                Connect your email account for sending & receiving
                            </p>
                        </div>
                        <motion.button
                            className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-lg flex items-center justify-center w-8 h-8 transition-all"
                            onClick={onClose}
                            whileHover={{ rotate: 90, scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                        >
                            <FiX className="text-sm" />
                        </motion.button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 bg-gray-50">
                    <button
                        className={`flex items-center space-x-2 px-6 py-3 border-b-2 font-medium text-sm transition-all duration-200 ${activeTab === 'smtp'
                            ? 'border-teal-600 text-teal-700 bg-white'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        onClick={() => setActiveTab('smtp')}
                    >
                        <FiMail className="text-lg" />
                        <span>SMTP Settings</span>
                    </button>
                    <button
                        className={`flex items-center space-x-2 px-6 py-3 border-b-2 font-medium text-sm transition-all duration-200 ${activeTab === 'imap'
                            ? 'border-teal-600 text-teal-700 bg-white'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        onClick={() => setActiveTab('imap')}
                    >
                        <FiServer className="text-lg" />
                        <span>IMAP Settings</span>
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto">
                    <div className="p-6">
                        {/* Error Message */}
                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    className="bg-red-50 text-red-700 p-4 rounded-lg mb-6 text-sm border border-red-200 font-['Poppins'] flex items-start"
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                >
                                    <div className="bg-red-100 p-1 rounded mr-3 mt-0.5">
                                        <FiX className="text-red-600 text-sm" />
                                    </div>
                                    <div className="flex-1">
                                        <strong className="font-semibold">Error:</strong> {error}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {activeTab === 'smtp' ? (
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Sender Name */}
                                    <motion.div
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.1 }}
                                    >
                                        <label className="block text-gray-700 mb-2 font-medium text-sm font-['Poppins'] flex items-center">
                                            <FiUser className="mr-2 text-teal-600" />
                                            Sender Name
                                        </label>
                                        <motion.input
                                            type="text"
                                            name="senderName"
                                            placeholder="Enter your display name"
                                            value={formData.senderName}
                                            onChange={handleChange}
                                            required
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white transition-all font-['Poppins'] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                            whileFocus={{
                                                scale: 1.01,
                                                transition: { duration: 0.2 }
                                            }}
                                        />
                                    </motion.div>

                                    {/* Email Address */}
                                    <motion.div
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.2 }}
                                    >
                                        <label className="block text-gray-700 mb-2 font-medium text-sm font-['Poppins'] flex items-center">
                                            <FiMail className="mr-2 text-teal-600" />
                                            Email Address
                                        </label>
                                        <motion.input
                                            type="email"
                                            name="email"
                                            placeholder="your.email@example.com"
                                            value={formData.email}
                                            onChange={handleChange}
                                            required
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white transition-all font-['Poppins'] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                            whileFocus={{
                                                scale: 1.01,
                                                transition: { duration: 0.2 }
                                            }}
                                        />
                                    </motion.div>
                                </div>

                                {/* Username Toggle */}
                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                                    <label className="flex items-center space-x-2 text-gray-700 font-medium text-sm cursor-pointer">
                                        <span>Use different username for SMTP</span>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={toggleUsername}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${formData.useDifferentUsername ? 'bg-teal-600' : 'bg-gray-300'
                                            }`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${formData.useDifferentUsername ? 'translate-x-6' : 'translate-x-1'
                                                }`}
                                        />
                                    </button>
                                </div>

                                {/* Username Field (Conditional) */}
                                <AnimatePresence>
                                    {formData.useDifferentUsername && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.3 }}
                                        >
                                            <label className="block text-gray-700 mb-2 font-medium text-sm font-['Poppins'] flex items-center">
                                                <FiUser className="mr-2 text-teal-600" />
                                                SMTP Username
                                            </label>
                                            <motion.input
                                                type="text"
                                                name="username"
                                                placeholder="Enter username"
                                                value={formData.username}
                                                onChange={handleChange}
                                                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white transition-all font-['Poppins'] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                                whileFocus={{
                                                    scale: 1.01,
                                                    transition: { duration: 0.2 }
                                                }}
                                            />
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Password */}
                                    <motion.div
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.3 }}
                                    >
                                        <label className="block text-gray-700 mb-2 font-medium text-sm font-['Poppins'] flex items-center">
                                            <FiLock className="mr-2 text-teal-600" />
                                            Password
                                        </label>
                                        <motion.input
                                            type="password"
                                            name="password"
                                            placeholder="Enter your password"
                                            value={formData.password}
                                            onChange={handleChange}
                                            required
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white transition-all font-['Poppins'] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                            whileFocus={{
                                                scale: 1.01,
                                                transition: { duration: 0.2 }
                                            }}
                                        />
                                    </motion.div>

                                    {/* SMTP Host */}
                                    <motion.div
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.4 }}
                                    >
                                        <label className="block text-gray-700 mb-2 font-medium text-sm font-['Poppins'] flex items-center">
                                            <FiServer className="mr-2 text-teal-600" />
                                            SMTP Host
                                        </label>
                                        <motion.input
                                            type="text"
                                            name="smtpHost"
                                            placeholder="smtp.example.com"
                                            value={formData.smtpHost}
                                            onChange={handleChange}
                                            required
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white transition-all font-['Poppins'] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                            whileFocus={{
                                                scale: 1.01,
                                                transition: { duration: 0.2 }
                                            }}
                                        />
                                    </motion.div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* SMTP Port */}
                                    <motion.div
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.5 }}
                                    >
                                        <label className="block text-gray-700 mb-2 font-medium text-sm font-['Poppins'] flex items-center">
                                            <FiServer className="mr-2 text-teal-600" />
                                            SMTP Port
                                        </label>
                                        <motion.input
                                            type="number"
                                            name="smtpPort"
                                            placeholder="465"
                                            value={formData.smtpPort}
                                            onChange={handleChange}
                                            required
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white transition-all font-['Poppins'] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                            whileFocus={{
                                                scale: 1.01,
                                                transition: { duration: 0.2 }
                                            }}
                                            min="1"
                                            max="65535"
                                        />
                                    </motion.div>

                                    {/* Encryption */}
                                    <div>
                                        <label className="block text-gray-700 mb-2 font-medium text-sm font-['Poppins'] flex items-center">
                                            <FiShield className="mr-2 text-teal-600" />
                                            Encryption
                                        </label>
                                        <div className="flex space-x-4">
                                            {['SSL', 'TLS', 'None'].map((type) => (
                                                <label key={type} className="flex items-center space-x-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="encryption"
                                                        value={type}
                                                        checked={formData.encryption === type}
                                                        onChange={handleChange}
                                                        className="text-teal-600 focus:ring-teal-500"
                                                    />
                                                    <span className="text-sm text-gray-700">{type}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Instructions Card */}
                                <motion.div
                                    className="p-4 bg-teal-50 rounded-lg border border-teal-200"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.6 }}
                                >
                                    <h3 className="text-teal-700 text-sm font-semibold mb-3 font-['Montserrat'] flex items-center">
                                        <FiHelpCircle className="mr-2" />
                                        SMTP Connection Guide
                                    </h3>
                                    <ul className="space-y-2 text-gray-600 text-xs">
                                        <motion.li
                                            className="flex items-start"
                                            whileHover={{ x: 5 }}
                                            transition={{ type: "spring", stiffness: 300 }}
                                        >
                                            <span className="text-teal-600 mr-2 mt-1">•</span>
                                            <span>Ensure SMTP is enabled in your email provider settings</span>
                                        </motion.li>
                                        <motion.li
                                            className="flex items-start"
                                            whileHover={{ x: 5 }}
                                            transition={{ type: "spring", stiffness: 300, delay: 0.1 }}
                                        >
                                            <span className="text-teal-600 mr-2 mt-1">•</span>
                                            <span>Use app password if 2FA is enabled on your account</span>
                                        </motion.li>
                                        <motion.li
                                            className="flex items-start"
                                            whileHover={{ x: 5 }}
                                            transition={{ type: "spring", stiffness: 300, delay: 0.2 }}
                                        >
                                            <span className="text-teal-600 mr-2 mt-1">•</span>
                                            <span>Common SMTP ports: 465 (SSL), 587 (TLS), 25 (None)</span>
                                        </motion.li>
                                    </ul>
                                </motion.div>
                            </form>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-5">
                                {/* IMAP Credentials Toggle */}
                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                                    <label className="flex items-center space-x-2 text-gray-700 font-medium text-sm cursor-pointer">
                                        <span>Use same credentials as SMTP</span>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={toggleUseSmtpCredentialsForImap}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${formData.useSmtpCredentialsForImap ? 'bg-teal-600' : 'bg-gray-300'
                                            }`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${formData.useSmtpCredentialsForImap ? 'translate-x-6' : 'translate-x-1'
                                                }`}
                                        />
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* IMAP Email */}
                                    <div>
                                        <label className="block text-gray-700 mb-2 font-medium text-sm font-['Poppins'] flex items-center">
                                            <FiMail className="mr-2 text-teal-600" />
                                            Email Address
                                        </label>
                                        <input
                                            type="email"
                                            name="imapEmail"
                                            placeholder="your.email@example.com"
                                            value={formData.useSmtpCredentialsForImap ? formData.email : formData.imapEmail}
                                            onChange={handleChange}
                                            disabled={formData.useSmtpCredentialsForImap}
                                            required
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all font-['Poppins'] disabled:bg-gray-50 disabled:cursor-not-allowed"
                                        />
                                    </div>

                                    {/* IMAP Password */}
                                    <div>
                                        <label className="block text-gray-700 mb-2 font-medium text-sm font-['Poppins'] flex items-center">
                                            <FiLock className="mr-2 text-teal-600" />
                                            Password
                                        </label>
                                        <input
                                            type="password"
                                            name="imapPassword"
                                            placeholder="Enter your password"
                                            value={formData.useSmtpCredentialsForImap ? formData.password : formData.imapPassword}
                                            onChange={handleChange}
                                            disabled={formData.useSmtpCredentialsForImap}
                                            required
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all font-['Poppins'] disabled:bg-gray-50 disabled:cursor-not-allowed"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* IMAP Host */}
                                    <motion.div
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.1 }}
                                    >
                                        <label className="block text-gray-700 mb-2 font-medium text-sm font-['Poppins'] flex items-center">
                                            <FiServer className="mr-2 text-teal-600" />
                                            IMAP Host
                                        </label>
                                        <motion.input
                                            type="text"
                                            name="imapHost"
                                            placeholder="imap.example.com"
                                            value={formData.imapHost}
                                            onChange={handleChange}
                                            required
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white transition-all font-['Poppins'] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                            whileFocus={{
                                                scale: 1.01,
                                                transition: { duration: 0.2 }
                                            }}
                                        />
                                    </motion.div>

                                    {/* IMAP Port */}
                                    <motion.div
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.2 }}
                                    >
                                        <label className="block text-gray-700 mb-2 font-medium text-sm font-['Poppins'] flex items-center">
                                            <FiServer className="mr-2 text-teal-600" />
                                            IMAP Port
                                        </label>
                                        <motion.input
                                            type="number"
                                            name="imapPort"
                                            placeholder="993"
                                            value={formData.imapPort}
                                            onChange={handleChange}
                                            required
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white transition-all font-['Poppins'] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                            whileFocus={{
                                                scale: 1.01,
                                                transition: { duration: 0.2 }
                                            }}
                                            min="1"
                                            max="65535"
                                        />
                                    </motion.div>
                                </div>

                                {/* IMAP Encryption */}
                                <div>
                                    <label className="block text-gray-700 mb-2 font-medium text-sm font-['Poppins'] flex items-center">
                                        <FiShield className="mr-2 text-teal-600" />
                                        Encryption
                                    </label>
                                    <div className="flex space-x-4">
                                        {['SSL', 'TLS', 'None'].map((type) => (
                                            <label key={type} className="flex items-center space-x-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="imapEncryption"
                                                    value={type}
                                                    checked={formData.imapEncryption === type}
                                                    onChange={handleChange}
                                                    className="text-teal-600 focus:ring-teal-500"
                                                />
                                                <span className="text-sm text-gray-700">{type}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* IMAP Instructions Card */}
                                <motion.div
                                    className="p-4 bg-teal-50 rounded-lg border border-teal-200"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                >
                                    <h3 className="text-teal-700 text-sm font-semibold mb-3 font-['Montserrat'] flex items-center">
                                        <FiHelpCircle className="mr-2" />
                                        IMAP Connection Guide
                                    </h3>
                                    <ul className="space-y-2 text-gray-600 text-xs">
                                        <motion.li
                                            className="flex items-start"
                                            whileHover={{ x: 5 }}
                                            transition={{ type: "spring", stiffness: 300 }}
                                        >
                                            <span className="text-teal-600 mr-2 mt-1">•</span>
                                            <span>Ensure IMAP is enabled in your email provider settings</span>
                                        </motion.li>
                                        <motion.li
                                            className="flex items-start"
                                            whileHover={{ x: 5 }}
                                            transition={{ type: "spring", stiffness: 300, delay: 0.1 }}
                                        >
                                            <span className="text-teal-600 mr-2 mt-1">•</span>
                                            <span>Use same password as SMTP if using same credentials</span>
                                        </motion.li>
                                        <motion.li
                                            className="flex items-start"
                                            whileHover={{ x: 5 }}
                                            transition={{ type: "spring", stiffness: 300, delay: 0.2 }}
                                        >
                                            <span className="text-teal-600 mr-2 mt-1">•</span>
                                            <span>Common IMAP ports: 993 (SSL), 143 (TLS), 110 (None)</span>
                                        </motion.li>
                                    </ul>
                                </motion.div>
                            </form>
                        )}

                        {/* Test Buttons */}
                        <motion.div
                            className="grid grid-cols-2 gap-3 mt-6"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.7 }}
                        >
                            <motion.button
                                type="button"
                                className="bg-white border border-teal-200 text-teal-700 py-3 rounded-lg font-semibold text-sm hover:bg-teal-50 hover:border-teal-300 transition-all font-['Poppins'] flex items-center justify-center"
                                onClick={activeTab === 'smtp' ? handleTestSmtp : handleTestImap}
                                whileHover={{ scale: 1.02, y: -1 }}
                                whileTap={{ scale: 0.98 }}
                                disabled={
                                    activeTab === 'smtp'
                                        ? !formData.smtpHost || !formData.email || !formData.password
                                        : !formData.imapHost || !formData.email
                                }
                            >
                                <FiMail className="mr-2" />
                                Test {activeTab.toUpperCase()}
                            </motion.button>
                            {/*  */}
                        </motion.div>
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
                    <div className="flex justify-between items-center">
                        <motion.button
                            type="button"
                            className="px-6 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg font-semibold text-sm hover:bg-gray-50 hover:border-gray-400 transition-all font-['Poppins']"
                            onClick={onClose}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            Cancel
                        </motion.button>
                        <motion.button
                            type="submit"
                            onClick={handleSubmit}
                            disabled={loading}
                            className="px-8 py-2.5 bg-gradient-to-r from-teal-800 to-teal-600 text-white rounded-lg font-semibold text-sm shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all font-['Poppins'] flex items-center"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            {loading ? (
                                <span className="inline-flex items-center">
                                    <motion.span
                                        className="w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                    />
                                    Connecting...
                                </span>
                            ) : (
                                'Save Configuration'
                            )}
                        </motion.button>
                    </div>
                </div>
            </motion.div>

            {/* Global Styles */}
            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Montserrat:wght@400;500;600;700&display=swap');
                
                body {
                    font-family: 'Poppins', sans-serif;
                }
                
                /* Custom scrollbar for the modal */
                .overflow-y-auto::-webkit-scrollbar {
                    width: 6px;
                }
                
                .overflow-y-auto::-webkit-scrollbar-track {
                    background: rgba(0, 0, 0, 0.05);
                    border-radius: 10px;
                }
                
                .overflow-y-auto::-webkit-scrollbar-thumb {
                    background: rgba(0, 0, 0, 0.2);
                    border-radius: 10px;
                }
                
                .overflow-y-auto::-webkit-scrollbar-thumb:hover {
                    background: rgba(0, 0, 0, 0.3);
                }
            `}</style>
        </div>
    );
};

export default SMTPConnect;