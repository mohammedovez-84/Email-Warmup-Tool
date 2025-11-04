import React, { useState, useEffect } from 'react';
import { FiX, FiSave, FiArrowLeft } from 'react-icons/fi';

const WarmupSettings = ({ email, onClose, onSave }) => {
  const [settings, setSettings] = useState({
    startEmailsPerDay: email?.warmupSettings?.startEmailsPerDay || 3,
    increaseByPerDay: email?.warmupSettings?.increaseByPerDay || 3,
    maxEmailsPerDay: email?.warmupSettings?.maxEmailsPerDay || 25,
    replyRate: email?.warmupSettings?.replyRate || 0,
    senderName: email?.warmupSettings?.senderName || email?.name || '',
    customFolderName: email?.warmupSettings?.customFolderName || ''
  });

  const [isClosing, setIsClosing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Check for changes
  useEffect(() => {
    const originalSettings = {
      startEmailsPerDay: email?.warmupSettings?.startEmailsPerDay || 3,
      increaseByPerDay: email?.warmupSettings?.increaseByPerDay || 3,
      maxEmailsPerDay: email?.warmupSettings?.maxEmailsPerDay || 25,
      replyRate: email?.warmupSettings?.replyRate || 0,
      senderName: email?.warmupSettings?.senderName || email?.name || '',
      customFolderName: email?.warmupSettings?.customFolderName || ''
    };

    setHasChanges(JSON.stringify(settings) !== JSON.stringify(originalSettings));
  }, [settings, email]);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value
    }));
  };

  const handleSave = async () => {
    if (isInvalid) return;

    setIsSaving(true);

    try {
      // Call the onSave prop with the settings
      if (onSave) {
        await onSave(settings);
      }

      // Close the panel immediately after save
      handleClose();
    } catch (error) {
      console.error('Error saving settings:', error);
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
      const confirmDiscard = window.confirm('You have unsaved changes. Are you sure you want to discard them?');
      if (!confirmDiscard) return;
    }
    handleClose();
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      handleDiscard();
    }
  };

  const isInvalid =
    settings.startEmailsPerDay < 1 ||
    settings.increaseByPerDay < 1 ||
    settings.maxEmailsPerDay < 1 ||
    settings.startEmailsPerDay > settings.maxEmailsPerDay ||
    settings.replyRate < 0 ||
    settings.replyRate > 100;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300 opacity-100"
        onClick={handleBackdropClick}
      />

      {/* Settings Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <button
                  onClick={handleDiscard}
                  disabled={isSaving}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-all duration-200 mr-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FiArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Warm-up Settings
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {email?.email || 'sutty.ori.com@gmail.com'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleDiscard}
                disabled={isSaving}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Form Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-6">
              {/* Start Emails Per Day */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  Start with emails/day
                  <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-medium">
                    Recommended: 3
                  </span>
                </label>
                <input
                  type="number"
                  name="startEmailsPerDay"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white transition-all duration-200 focus:outline-none"
                  value={settings.startEmailsPerDay}
                  onChange={handleChange}
                  min="1"
                  disabled={isSaving}
                />
                {settings.startEmailsPerDay < 1 && (
                  <p className="text-red-600 text-xs mt-1">
                    Value must be at least 1
                  </p>
                )}
              </div>

              {/* Increase By Per Day */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  Increase by emails every day
                  <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-medium">
                    Recommended: 3
                  </span>
                </label>
                <input
                  type="number"
                  name="increaseByPerDay"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white transition-all duration-200 focus:outline-none"
                  value={settings.increaseByPerDay}
                  onChange={handleChange}
                  min="1"
                  disabled={isSaving}
                />
                {settings.increaseByPerDay < 1 && (
                  <p className="text-red-600 text-xs mt-1">
                    Value must be at least 1
                  </p>
                )}
              </div>

              {/* Max Emails Per Day */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  Maximum emails to be sent per day
                  <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-medium">
                    Recommended: 25
                  </span>
                </label>
                <input
                  type="number"
                  name="maxEmailsPerDay"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white transition-all duration-200 focus:outline-none"
                  value={settings.maxEmailsPerDay}
                  onChange={handleChange}
                  min="1"
                  disabled={isSaving}
                />
                {settings.maxEmailsPerDay < 1 && (
                  <p className="text-red-600 text-xs mt-1">
                    Value must be at least 1
                  </p>
                )}
                {settings.startEmailsPerDay > settings.maxEmailsPerDay && (
                  <p className="text-red-600 text-xs mt-1">
                    Start emails cannot be greater than maximum emails
                  </p>
                )}
              </div>

              {/* Reply Rate */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Reply rate (%)
                </label>
                <input
                  type="number"
                  name="replyRate"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white transition-all duration-200 focus:outline-none"
                  value={settings.replyRate}
                  onChange={handleChange}
                  min="0"
                  max="100"
                  disabled={isSaving}
                />
                {(settings.replyRate < 0 || settings.replyRate > 100) && (
                  <p className="text-red-600 text-xs mt-1">
                    Reply rate must be between 0 and 100
                  </p>
                )}
              </div>

              {/* Sender Name */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Sender name
                </label>
                <input
                  type="text"
                  name="senderName"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white transition-all duration-200 focus:outline-none"
                  value={settings.senderName}
                  onChange={handleChange}
                  placeholder="Enter sender name"
                  disabled={isSaving}
                />
              </div>

              {/* Custom Folder Toggle */}
              <div className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 bg-gray-50">
                <input
                  type="checkbox"
                  id="customFolder"
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                  checked={!!settings.customFolderName}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    customFolderName: e.target.checked ? 'Custom Folder' : ''
                  }))}
                  disabled={isSaving}
                />
                <label
                  htmlFor="customFolder"
                  className="text-sm font-medium text-gray-700 cursor-pointer select-none"
                >
                  + Add custom name for warmup folder
                </label>
              </div>

              {/* Custom Folder Name Input */}
              {settings.customFolderName && (
                <div className="space-y-2">
                  <input
                    type="text"
                    name="customFolderName"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white transition-all duration-200 focus:outline-none"
                    value={settings.customFolderName}
                    onChange={handleChange}
                    placeholder="Enter folder name"
                    disabled={isSaving}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex justify-between items-center">
              <button
                onClick={handleDiscard}
                disabled={isSaving}
                className="flex items-center px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiX className="w-4 h-4 mr-2" />
                Cancel
              </button>

              <div className="flex space-x-3">
                <button
                  onClick={handleDiscard}
                  disabled={isSaving}
                  className="px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send Settings
                </button>
                <button
                  onClick={handleSave}
                  disabled={isInvalid || isSaving}
                  className={`flex items-center px-6 py-3 text-sm font-medium text-white rounded-lg transition-all duration-200 ${isInvalid || isSaving
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                >
                  {isSaving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <FiSave className="w-4 h-4 mr-2" />
                      Save
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default WarmupSettings;