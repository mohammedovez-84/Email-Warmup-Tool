import React, { useState, useEffect, useCallback } from 'react';
import { FiX, FiSave, FiAlertCircle, FiCheckCircle, FiHelpCircle } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000';

// Toast Notification Component
const Toast = ({ message, type = 'success', onClose, action }) => {
  return (
    <motion.div
      className={`fixed top-4 right-4 z-[100] flex items-center p-4 rounded-xl shadow-lg border ${type === 'success'
        ? 'bg-green-50 text-green-800 border-green-200'
        : type === 'warning'
          ? 'bg-orange-50 text-orange-800 border-orange-200'
          : 'bg-red-50 text-red-800 border-red-200'
        } min-w-[300px] max-w-md`}
      initial={{ opacity: 0, x: 300, scale: 0.8 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 300, scale: 0.8 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
    >
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${type === 'success'
        ? 'bg-green-100'
        : type === 'warning'
          ? 'bg-orange-100'
          : 'bg-red-100'
        }`}>
        {type === 'success' ? (
          <FiCheckCircle className="text-green-600 text-sm" />
        ) : type === 'warning' ? (
          <FiAlertCircle className="text-orange-600 text-sm" />
        ) : (
          <FiAlertCircle className="text-red-600 text-sm" />
        )}
      </div>
      <div className="ml-3 flex-1">
        <p className="text-sm font-medium font-['Poppins']">{message}</p>
        {action && (
          <div className="flex space-x-2 mt-2">
            <button
              onClick={action.onConfirm}
              className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors font-['Poppins']"
            >
              {action.confirmText || 'Discard'}
            </button>
            <button
              onClick={action.onCancel}
              className="px-3 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors font-['Poppins']"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
      {!action && (
        <button
          onClick={onClose}
          className={`ml-4 flex-shrink-0 p-1 rounded-full hover:bg-opacity-20 transition-colors ${type === 'success'
            ? 'hover:bg-green-600'
            : type === 'warning'
              ? 'hover:bg-orange-600'
              : 'hover:bg-red-600'
            }`}
        >
          <FiX className={`text-sm ${type === 'success'
            ? 'text-green-600'
            : type === 'warning'
              ? 'text-orange-600'
              : 'text-red-600'
            }`} />
        </button>
      )}
    </motion.div>
  );
};

const WarmupSettings = ({ email, onClose, onSave }) => {
  const [settings, setSettings] = useState({
    startEmailsPerDay: 3,
    increaseByPerDay: 3,
    maxEmailsPerDay: 25,
    replyRate: 0,
    senderName: '',
    customFolderName: ''
  });

  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [activeField, setActiveField] = useState('');

  // Memoized email address getter
  const getEmailAddress = useCallback(() => {
    if (typeof email === 'string') return email;
    return email?.email || 'sathya01.dcm@gmail.com';
  }, [email]);

  // Toast functions
  const showToast = (message, type = 'success', duration = 4000, action = null) => {
    const id = Date.now().toString();
    const toast = { id, message, type, action };

    setToasts(prev => [...prev, toast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  // Validation function
  const validateSettings = useCallback((settings) => {
    const errors = [];

    if (settings.startEmailsPerDay < 1) {
      errors.push('Start emails must be at least 1');
    }

    if (settings.increaseByPerDay < 1) {
      errors.push('Increase emails must be at least 1');
    }

    if (settings.maxEmailsPerDay < 1) {
      errors.push('Maximum emails must be at least 1');
    }

    if (settings.startEmailsPerDay > settings.maxEmailsPerDay) {
      errors.push('Start emails cannot be greater than maximum emails');
    }

    if (settings.replyRate < 0 || settings.replyRate > 100) {
      errors.push('Reply rate must be between 0 and 100');
    }

    return errors;
  }, []);

  const validationErrors = validateSettings(settings);
  const isInvalid = validationErrors.length > 0;

  // Load settings on component mount
  useEffect(() => {
    const loadSettings = async () => {
      const emailAddress = getEmailAddress();
      console.log('📧 Loading settings for:', emailAddress);

      let finalSettings = { ...settings };

      // Try to fetch from API first
      try {
        setIsLoading(true);
        const response = await axios.get(`${API_BASE_URL}/api/warmup/${encodeURIComponent(emailAddress)}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        if (response.data.success) {
          const apiData = response.data.data;
          console.log('✅ API data received:', apiData);

          // Map API data to our settings format
          finalSettings = {
            startEmailsPerDay: apiData.startEmailsPerDay || 3,
            increaseByPerDay: apiData.increaseEmailsPerDay || 3,
            maxEmailsPerDay: apiData.maxEmailsPerDay || 25,
            replyRate: apiData.replyRate || 0,
            senderName: apiData.name || apiData.sender_name || '',
            customFolderName: apiData.customFolderName || ''
          };
        }
      } catch (error) {
        console.warn('⚠️ API not available, using defaults:', error.message);
        // Fallback to localStorage
        const cachedSettings = localStorage.getItem(`warmup_settings_${emailAddress}`);
        if (cachedSettings) {
          try {
            const parsedSettings = JSON.parse(cachedSettings);
            console.log('📦 Loaded from localStorage:', parsedSettings);
            finalSettings = { ...finalSettings, ...parsedSettings };
          } catch (e) {
            console.error('❌ Error parsing cached settings:', e);
          }
        }
      } finally {
        setSettings(finalSettings);
        localStorage.setItem(`warmup_settings_${emailAddress}`, JSON.stringify(finalSettings));
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [getEmailAddress]);

  // Handle input changes
  const handleChange = useCallback((e) => {
    const { name, value, type } = e.target;
    const newValue = type === 'number' ? (value === '' ? '' : Number(value)) : value;

    setSettings(prev => ({
      ...prev,
      [name]: newValue
    }));

    setHasChanges(true);
  }, []);

  // Handle save with better error handling
  const handleSave = async () => {
    if (isInvalid) {
      showToast('Please fix validation errors before saving.', 'error');
      return;
    }

    setIsSaving(true);

    try {
      const emailAddress = getEmailAddress();

      // Validate once more before saving
      const errors = validateSettings(settings);
      if (errors.length > 0) {
        showToast(errors[0], 'error');
        setIsSaving(false);
        return;
      }

      // Save to localStorage immediately
      localStorage.setItem(`warmup_settings_${emailAddress}`, JSON.stringify(settings));
      console.log('💾 Saved to localStorage:', settings);

      // Try to save to API
      try {
        const response = await axios.put(
          `${API_BASE_URL}/api/warmup/update/settings/${encodeURIComponent(emailAddress)}`,
          {
            startEmailsPerDay: parseInt(settings.startEmailsPerDay),
            increaseByPerDay: parseInt(settings.increaseByPerDay),
            maxEmailsPerDay: parseInt(settings.maxEmailsPerDay),
            replyRate: parseInt(settings.replyRate),
            senderName: settings.senderName,
            customFolderName: settings.customFolderName || ""
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          }
        );

        if (response.data.success) {
          console.log('✅ Successfully saved to API');
          showToast('Warmup settings saved successfully!', 'success');
        } else {
          throw new Error(response.data.message || 'Failed to save settings');
        }
      } catch (apiError) {
        console.warn('⚠️ API not available, saved locally only');
        showToast('Settings saved locally (API unavailable)', 'success');
      }

      // Call parent onSave
      if (onSave) {
        await onSave(settings);
      }

      setHasChanges(false);

      // Auto-close after success
      setTimeout(() => {
        handleClose();
      }, 1500);

    } catch (error) {
      console.error('❌ Save error:', error);
      showToast(`Failed to save settings: ${error.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  const handleDiscard = () => {
    if (hasChanges && !isSaving) {
      // Show confirmation toast instead of native confirm
      showToast(
        'You have unsaved changes. Are you sure you want to discard them?',
        'warning',
        0, // No auto-close
        {
          onConfirm: () => {
            removeToast(toasts[toasts.length - 1]?.id);
            handleClose();
          },
          onCancel: () => {
            removeToast(toasts[toasts.length - 1]?.id);
          },
          confirmText: 'Discard Changes'
        }
      );
    } else {
      handleClose();
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      handleDiscard();
    }
  };

  const handleCustomFolderToggle = (e) => {
    setSettings(prev => ({
      ...prev,
      customFolderName: e.target.checked ? 'Custom Folder' : ''
    }));
    setHasChanges(true);
  };

  const handleSendSettings = () => {
    showToast('Send Settings functionality would be implemented here', 'success');
  };



  return (
    <>
      {/* Toast Notifications */}
      <AnimatePresence>
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
            action={toast.action}
          />
        ))}
      </AnimatePresence>

      {/* Main Modal - Exact same background as GoogleConnect */}
      <div className="fixed inset-0 bg-white/10 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <motion.div
          className="bg-white rounded-xl w-full max-w-2xl mx-auto shadow-2xl border border-gray-200 max-h-[90vh] overflow-hidden flex flex-col"
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
        >
          {/* Header - Exact same as GoogleConnect */}
          <div className="bg-gradient-to-r from-teal-800 to-teal-600 px-6 py-4 border-b border-teal-700">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-white font-['Montserrat']">
                  Warm-up Settings
                </h2>
                <p className="text-teal-100 text-sm mt-1 font-['Poppins']">
                  Configure warmup settings for {getEmailAddress()}
                </p>
                {hasChanges && (
                  <p className="text-orange-200 text-xs mt-1 flex items-center font-['Poppins']">
                    <FiAlertCircle className="mr-1" />
                    You have unsaved changes
                  </p>
                )}
              </div>
              <motion.button
                className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-lg flex items-center justify-center w-8 h-8 transition-all"
                onClick={handleDiscard}
                disabled={isSaving}
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
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <motion.div
                    className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  />
                </div>
              ) : (
                <div className="space-y-6">

                  {/* Start Emails Per Day */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <label className="block text-gray-700 mb-2 font-medium text-sm font-['Poppins'] flex items-center">
                      Start with emails/day
                      <span className="ml-2 bg-teal-100 text-teal-800 text-xs px-2 py-1 rounded font-medium">
                        Recommended: 3
                      </span>
                    </label>
                    <motion.input
                      type="number"
                      name="startEmailsPerDay"
                      className={`w-full px-4 py-3 border rounded-lg text-sm bg-white transition-all font-['Poppins'] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 ${settings.startEmailsPerDay < 1 ? 'border-red-300' : 'border-gray-300'
                        }`}
                      value={settings.startEmailsPerDay}
                      onChange={handleChange}
                      onFocus={() => setActiveField('startEmailsPerDay')}
                      onBlur={() => setActiveField('')}
                      min="1"
                      max="100"
                      disabled={isSaving}
                      whileFocus={{
                        scale: 1.01,
                        transition: { duration: 0.2 }
                      }}
                    />
                  </motion.div>

                  {/* Increase By Per Day */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <label className="block text-gray-700 mb-2 font-medium text-sm font-['Poppins'] flex items-center">
                      Increase by emails every day
                      <span className="ml-2 bg-teal-100 text-teal-800 text-xs px-2 py-1 rounded font-medium">
                        Recommended: 3
                      </span>
                    </label>
                    <motion.input
                      type="number"
                      name="increaseByPerDay"
                      className={`w-full px-4 py-3 border rounded-lg text-sm bg-white transition-all font-['Poppins'] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 ${settings.increaseByPerDay < 1 ? 'border-red-300' : 'border-gray-300'
                        }`}
                      value={settings.increaseByPerDay}
                      onChange={handleChange}
                      onFocus={() => setActiveField('increaseByPerDay')}
                      onBlur={() => setActiveField('')}
                      min="1"
                      max="50"
                      disabled={isSaving}
                      whileFocus={{
                        scale: 1.01,
                        transition: { duration: 0.2 }
                      }}
                    />
                  </motion.div>

                  {/* Max Emails Per Day */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <label className="block text-gray-700 mb-2 font-medium text-sm font-['Poppins'] flex items-center">
                      Maximum emails to be sent per day
                      <span className="ml-2 bg-teal-100 text-teal-800 text-xs px-2 py-1 rounded font-medium">
                        Recommended: 25
                      </span>
                    </label>
                    <motion.input
                      type="number"
                      name="maxEmailsPerDay"
                      className={`w-full px-4 py-3 border rounded-lg text-sm bg-white transition-all font-['Poppins'] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 ${settings.maxEmailsPerDay < 1 || settings.startEmailsPerDay > settings.maxEmailsPerDay
                        ? 'border-red-300'
                        : 'border-gray-300'
                        }`}
                      value={settings.maxEmailsPerDay}
                      onChange={handleChange}
                      onFocus={() => setActiveField('maxEmailsPerDay')}
                      onBlur={() => setActiveField('')}
                      min="1"
                      max="200"
                      disabled={isSaving}
                      whileFocus={{
                        scale: 1.01,
                        transition: { duration: 0.2 }
                      }}
                    />
                  </motion.div>

                  {/* Reply Rate */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <label className="block text-gray-700 mb-2 font-medium text-sm font-['Poppins']">
                      Reply rate (%)
                    </label>
                    <motion.input
                      type="number"
                      name="replyRate"
                      className={`w-full px-4 py-3 border rounded-lg text-sm bg-white transition-all font-['Poppins'] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 ${(settings.replyRate < 0 || settings.replyRate > 100) ? 'border-red-300' : 'border-gray-300'
                        }`}
                      value={settings.replyRate}
                      onChange={handleChange}
                      onFocus={() => setActiveField('replyRate')}
                      onBlur={() => setActiveField('')}
                      min="0"
                      max="100"
                      step="0.1"
                      disabled={isSaving}
                      whileFocus={{
                        scale: 1.01,
                        transition: { duration: 0.2 }
                      }}
                    />
                  </motion.div>

                  {/* Sender Name */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    <label className="block text-gray-700 mb-2 font-medium text-sm font-['Poppins']">
                      Sender name
                    </label>
                    <motion.input
                      type="text"
                      name="senderName"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white transition-all font-['Poppins'] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      value={settings.senderName}
                      onChange={handleChange}
                      onFocus={() => setActiveField('senderName')}
                      onBlur={() => setActiveField('')}
                      placeholder="Enter sender name"
                      disabled={isSaving}
                      whileFocus={{
                        scale: 1.01,
                        transition: { duration: 0.2 }
                      }}
                    />
                  </motion.div>

                  {/* Custom Folder Toggle */}
                  <motion.div
                    className="flex items-center space-x-3 p-4 rounded-lg border border-gray-200 bg-gray-50"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 }}
                  >
                    <input
                      type="checkbox"
                      id="customFolder"
                      className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500 focus:ring-2"
                      checked={!!settings.customFolderName}
                      onChange={handleCustomFolderToggle}
                      disabled={isSaving}
                    />
                    <label
                      htmlFor="customFolder"
                      className="text-sm font-medium text-gray-700 cursor-pointer select-none font-['Poppins']"
                    >
                      + Add custom name for warmup folder
                    </label>
                  </motion.div>

                  {/* Custom Folder Name Input */}
                  {settings.customFolderName && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      transition={{ duration: 0.3 }}
                    >
                      <motion.input
                        type="text"
                        name="customFolderName"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white transition-all font-['Poppins'] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                        value={settings.customFolderName}
                        onChange={handleChange}
                        onFocus={() => setActiveField('customFolderName')}
                        onBlur={() => setActiveField('')}
                        placeholder="Enter folder name"
                        disabled={isSaving}
                        whileFocus={{
                          scale: 1.01,
                          transition: { duration: 0.2 }
                        }}
                      />
                    </motion.div>
                  )}

                  {/* Validation Errors Summary */}
                  {isInvalid && (
                    <motion.div
                      className="p-4 bg-red-50 border border-red-200 rounded-lg"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <h4 className="text-sm font-medium text-red-800 mb-2 font-['Poppins'] flex items-center">
                        <FiAlertCircle className="mr-2" />
                        Please fix the following errors:
                      </h4>
                      <ul className="text-sm text-red-700 list-disc list-inside space-y-1 font-['Poppins']">
                        {validationErrors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </motion.div>
                  )}

                  {/* Instructions Card */}
                  <motion.div
                    className="p-4 bg-teal-50 rounded-lg border border-teal-200"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                  >
                    <h3 className="text-teal-700 text-sm font-semibold mb-3 font-['Montserrat'] flex items-center">
                      <FiHelpCircle className="mr-2" />
                      Warm-up Guidelines
                    </h3>
                    <ul className="space-y-2 text-gray-600 text-xs font-['Poppins']">
                      <motion.li
                        className="flex items-start"
                        whileHover={{ x: 5 }}
                        transition={{ type: "spring", stiffness: 300 }}
                      >
                        <span className="text-teal-600 mr-2 mt-1">•</span>
                        <span>Start with 3-5 emails per day to build reputation gradually</span>
                      </motion.li>
                      <motion.li
                        className="flex items-start"
                        whileHover={{ x: 5 }}
                        transition={{ type: "spring", stiffness: 300, delay: 0.1 }}
                      >
                        <span className="text-teal-600 mr-2 mt-1">•</span>
                        <span>Increase volume slowly to avoid spam filters</span>
                      </motion.li>
                      <motion.li
                        className="flex items-start"
                        whileHover={{ x: 5 }}
                        transition={{ type: "spring", stiffness: 300, delay: 0.2 }}
                      >
                        <span className="text-teal-600 mr-2 mt-1">•</span>
                        <span>Monitor engagement rates and adjust accordingly</span>
                      </motion.li>
                      <motion.li
                        className="flex items-start"
                        whileHover={{ x: 5 }}
                        transition={{ type: "spring", stiffness: 300, delay: 0.3 }}
                      >
                        <span className="text-teal-600 mr-2 mt-1">•</span>
                        <span>Use custom folders to organize warmup emails</span>
                      </motion.li>
                    </ul>
                  </motion.div>
                </div>
              )}
            </div>
          </div>

          {/* Footer - Exact same as GoogleConnect */}
          <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
            <div className="flex justify-between items-center">
              <motion.button
                type="button"
                className="px-6 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg font-semibold text-sm hover:bg-gray-50 hover:border-gray-400 transition-all font-['Poppins']"
                onClick={handleDiscard}
                disabled={isSaving}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Cancel
              </motion.button>
              <div className="flex space-x-3">
                <motion.button
                  type="button"
                  className="px-6 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg font-semibold text-sm hover:bg-gray-50 hover:border-gray-400 transition-all font-['Poppins']"
                  onClick={handleSendSettings}
                  disabled={isSaving || isInvalid}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Send Settings
                </motion.button>
                <motion.button
                  onClick={handleSave}
                  disabled={isInvalid || isSaving || !hasChanges}
                  className={`px-8 py-2.5 rounded-lg font-semibold text-sm shadow-lg transition-all font-['Poppins'] flex items-center ${isInvalid || isSaving || !hasChanges
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed shadow-none'
                    : 'bg-gradient-to-r from-teal-800 to-teal-600 text-white hover:shadow-xl'
                    }`}
                  whileHover={!(isInvalid || isSaving || !hasChanges) ? { scale: 1.02 } : {}}
                  whileTap={!(isInvalid || isSaving || !hasChanges) ? { scale: 0.98 } : {}}
                >
                  {isSaving ? (
                    <span className="inline-flex items-center">
                      <motion.span
                        className="w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      />
                      Saving...
                    </span>
                  ) : (
                    <>
                      <FiSave className="mr-2" />
                      Save Settings
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Global Styles - Exact same as GoogleConnect */}
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
    </>
  );
};

export default WarmupSettings;