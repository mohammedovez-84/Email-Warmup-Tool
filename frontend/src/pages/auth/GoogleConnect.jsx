import React, { useState } from 'react';
import { FiX, FiMail, FiLock, FiUser, FiHelpCircle } from 'react-icons/fi';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

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
    const [activeField, setActiveField] = useState('');

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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
                className="bg-white rounded-xl w-full max-w-2xl mx-auto shadow-2xl border border-gray-200 max-h-[90vh] overflow-hidden flex flex-col"
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
                                Connect Google Account
                            </h2>
                            <p className="text-teal-100 text-sm mt-1 font-['Poppins']">
                                Connect your Gmail account to start sending emails
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

                        <form onSubmit={handleSubmit}>
                            {/* Form Fields */}
                            <div className="space-y-4 mb-6">
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
                                        onFocus={() => setActiveField('senderName')}
                                        onBlur={() => setActiveField('')}
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
                                        placeholder="your.email@gmail.com"
                                        value={formData.email}
                                        onChange={handleChange}
                                        onFocus={() => setActiveField('email')}
                                        onBlur={() => setActiveField('')}
                                        required
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white transition-all font-['Poppins'] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                        whileFocus={{
                                            scale: 1.01,
                                            transition: { duration: 0.2 }
                                        }}
                                    />
                                </motion.div>

                                {/* App Password */}
                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.3 }}
                                >
                                    <label className="block text-gray-700 mb-2 font-medium text-sm font-['Poppins'] flex items-center">
                                        <FiLock className="mr-2 text-teal-600" />
                                        App Password
                                        <button
                                            type="button"
                                            className="ml-2 text-gray-400 hover:text-teal-600 transition-colors"
                                            onClick={() => window.open('https://support.google.com/accounts/answer/185833?hl=en', '_blank')}
                                        >
                                            <FiHelpCircle className="text-sm" />
                                        </button>
                                    </label>
                                    <motion.input
                                        type="password"
                                        name="appPassword"
                                        placeholder="Enter your 16-character app password"
                                        value={formData.appPassword}
                                        onChange={handleChange}
                                        onFocus={() => setActiveField('appPassword')}
                                        onBlur={() => setActiveField('')}
                                        required
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white transition-all font-['Poppins'] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                        whileFocus={{
                                            scale: 1.01,
                                            transition: { duration: 0.2 }
                                        }}
                                    />
                                    <p className="text-xs text-gray-500 mt-2 ml-1">
                                        Need help? <button type="button" className="text-teal-600 hover:underline font-medium" onClick={() => window.open('https://support.google.com/accounts/answer/185833?hl=en', '_blank')}>Learn how to create an app password</button>
                                    </p>
                                </motion.div>
                            </div>

                            {/* Instructions Card */}
                            <motion.div
                                className="mb-6 p-4 bg-teal-50 rounded-lg border border-teal-200"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                            >
                                <h3 className="text-teal-700 text-sm font-semibold mb-3 font-['Montserrat'] flex items-center">
                                    <FiHelpCircle className="mr-2" />
                                    Important Instructions
                                </h3>
                                <ul className="space-y-2 text-gray-600 text-xs">
                                    <motion.li
                                        className="flex items-start"
                                        whileHover={{ x: 5 }}
                                        transition={{ type: "spring", stiffness: 300 }}
                                    >
                                        <span className="text-teal-600 mr-2 mt-1">•</span>
                                        <span>Enable 2-factor authentication on your Google account</span>
                                    </motion.li>
                                    <motion.li
                                        className="flex items-start"
                                        whileHover={{ x: 5 }}
                                        transition={{ type: "spring", stiffness: 300, delay: 0.1 }}
                                    >
                                        <span className="text-teal-600 mr-2 mt-1">•</span>
                                        <span>Generate a 16-character app password from Google Account settings</span>
                                    </motion.li>
                                    <motion.li
                                        className="flex items-start"
                                        whileHover={{ x: 5 }}
                                        transition={{ type: "spring", stiffness: 300, delay: 0.2 }}
                                    >
                                        <span className="text-teal-600 mr-2 mt-1">•</span>
                                        <span>Use the app password instead of your regular Google password</span>
                                    </motion.li>
                                    <motion.li
                                        className="flex items-start"
                                        whileHover={{ x: 5 }}
                                        transition={{ type: "spring", stiffness: 300, delay: 0.3 }}
                                    >
                                        <span className="text-teal-600 mr-2 mt-1">•</span>
                                        <span>Ensure "Less secure app access" is enabled if not using app passwords</span>
                                    </motion.li>
                                </ul>
                            </motion.div>

                            {/* Test Buttons */}
                            <motion.div
                                className="grid grid-cols-2 gap-3 mb-6"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5 }}
                            >
                                <motion.button
                                    type="button"
                                    className="bg-white border border-teal-200 text-teal-700 py-3 rounded-lg font-semibold text-sm hover:bg-teal-50 hover:border-teal-300 transition-all font-['Poppins'] flex items-center justify-center"
                                    onClick={handleTestSMTP}
                                    whileHover={{ scale: 1.02, y: -1 }}
                                    whileTap={{ scale: 0.98 }}
                                    disabled={!formData.email || !formData.appPassword}
                                >
                                    <FiMail className="mr-2" />
                                    Test SMTP
                                </motion.button>
                                <motion.button
                                    type="button"
                                    className="bg-white border border-teal-200 text-teal-700 py-3 rounded-lg font-semibold text-sm hover:bg-teal-50 hover:border-teal-300 transition-all font-['Poppins'] flex items-center justify-center"
                                    onClick={handleTestIMAP}
                                    whileHover={{ scale: 1.02, y: -1 }}
                                    whileTap={{ scale: 0.98 }}
                                    disabled={!formData.email || !formData.appPassword}
                                >
                                    <FiMail className="mr-2" />
                                    Test IMAP
                                </motion.button>
                            </motion.div>
                        </form>
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
                            disabled={loading || !formData.senderName || !formData.email || !formData.appPassword}
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
                                'Connect Account'
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

export default GoogleConnect;