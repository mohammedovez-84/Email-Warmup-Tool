
import React, { useState } from 'react';
import { FiX, FiSave, FiTrash2, FiArrowLeft } from 'react-icons/fi';

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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = () => {
    onSave(settings);
    closePanel();
  };

  const closePanel = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 300);
  };

  return (
    <div className={`warmup-settings-container show ${isClosing ? 'closing' : ''}`}>
      <style jsx>{`
                .warmup-settings-container {
                    position: fixed;
                    top: 0;
                    right: 0;
                    bottom: 0;
                    width: 100%;
                    max-width: 500px;
                    background: white;
                    box-shadow: -2px 0 20px rgba(0, 0, 0, 0.15);
                    z-index: 1000;
                    overflow-y: auto;
                    padding: 24px;
                    transform: translateX(100%);
                    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease;
                }

                .warmup-settings-container.show {
                    transform: translateX(0);
                    box-shadow: -2px 0 30px rgba(0, 0, 0, 0.2);
                }

                .warmup-settings-container.closing {
                    transform: translateX(100%);
                    box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);
                }

                .settings-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 24px;
                    padding-bottom: 16px;
                    border-bottom: 1px solid #e2e8f0;
                    position: relative;
                }

                .back-btn {
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: #64748b;
                    font-size: 20px;
                    padding: 8px;
                    border-radius: 50%;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-right: 12px;
                }

                .back-btn:hover {
                    background-color: #f1f5f9;
                    transform: translateX(-2px);
                }

                .header-content {
                    display: flex;
                    align-items: center;
                    flex-grow: 1;
                }

                .settings-title {
                    font-size: 20px;
                    font-weight: 600;
                    color: #1e293b;
                    margin: 0;
                    transition: all 0.2s ease;
                }

                .close-btn {
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: #64748b;
                    font-size: 20px;
                    padding: 8px;
                    border-radius: 50%;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .close-btn:hover {
                    background-color: #f1f5f9;
                    transform: rotate(90deg);
                }

                .settings-form {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }

                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    animation: fadeIn 0.3s ease forwards;
                    opacity: 0;
                    transform: translateY(10px);
                }

                @keyframes fadeIn {
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .form-group:nth-child(1) { animation-delay: 0.1s; }
                .form-group:nth-child(2) { animation-delay: 0.15s; }
                .form-group:nth-child(3) { animation-delay: 0.2s; }
                .form-group:nth-child(4) { animation-delay: 0.25s; }
                .form-group:nth-child(5) { animation-delay: 0.3s; }
                .form-group:nth-child(6) { animation-delay: 0.35s; }

                .form-label {
                    font-size: 14px;
                    font-weight: 500;
                    color: #334155;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .recommended-tag {
                    background-color: #e0f2fe;
                    color: #0369a1;
                    font-size: 11px;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-weight: 500;
                }

                .form-input {
                    padding: 12px 14px;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    font-size: 14px;
                    transition: all 0.3s ease;
                    background-color: #f8fafc;
                }

                .form-input:hover {
                    border-color: #cbd5e1;
                    background-color: white;
                }

                .form-input:focus {
                    outline: none;
                    border-color: #0d9488;
                    box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.1);
                    background-color: white;
                }

                .checkbox-group {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-top: 8px;
                    padding: 8px;
                    border-radius: 8px;
                    transition: all 0.2s ease;
                }

                .checkbox-group:hover {
                    background-color: #f8fafc;
                }

                .checkbox-input {
                    width: 18px;
                    height: 18px;
                    accent-color: #0d9488;
                    cursor: pointer;
                }

                .checkbox-label {
                    font-size: 14px;
                    color: #334155;
                    cursor: pointer;
                }

                .form-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    margin-top: 32px;
                    padding-top: 16px;
                    border-top: 1px solid #f1f5f9;
                    animation: fadeIn 0.3s 0.4s ease forwards;
                    opacity: 0;
                }

                .btn {
                    padding: 12px 20px;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .btn-discard {
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    color: #64748b;
                }

                .btn-discard:hover {
                    background: #f1f5f9;
                    transform: translateY(-1px);
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
                }

                .btn-discard:active {
                    transform: translateY(0);
                }

                .btn-save {
                    background: #0d9488;
                    border: 1px solid #0d9488;
                    color: white;
                }

                .btn-save:hover {
                    background: #0f766e;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 6px rgba(13, 148, 136, 0.1);
                }

                .btn-save:active {
                    transform: translateY(0);
                }

                .btn-save:disabled {
                    background: #cbd5e1;
                    border-color: #cbd5e1;
                    cursor: not-allowed;
                    transform: none;
                    box-shadow: none;
                }

                .error-message {
                    color: #dc2626;
                    font-size: 12px;
                    margin-top: 4px;
                    animation: shake 0.3s ease;
                }

                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    20%, 60% { transform: translateX(-3px); }
                    40%, 80% { transform: translateX(3px); }
                }

                @media (max-width: 640px) {
                    .warmup-settings-container {
                        max-width: 100%;
                        padding: 20px;
                    }

                    .settings-title {
                        font-size: 18px;
                    }

                    .btn {
                        padding: 10px 16px;
                    }
                }
            `}</style>

      <div className="settings-header">
        <div className="header-content">
          <button className="back-btn" onClick={closePanel}>
            <FiArrowLeft />
          </button>
          <h2 className="settings-title">Warm-up Settings</h2>
        </div>
        <button className="close-btn" onClick={closePanel}>
          <FiX />
        </button>
      </div>

      <div className="settings-form">
        <div className="form-group">
          <label className="form-label">
            Start with emails/day
            <span className="recommended-tag">Recommended: 3</span>
          </label>
          <input
            type="number"
            name="startEmailsPerDay"
            className="form-input"
            value={settings.startEmailsPerDay}
            onChange={handleChange}
            min="1"
          />
          {settings.startEmailsPerDay < 1 && (
            <p className="error-message">The value could not be less than 1 or in fraction.</p>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">
            Increase by emails every day
            <span className="recommended-tag">Recommended: 3</span>
          </label>
          <input
            type="number"
            name="increaseByPerDay"
            className="form-input"
            value={settings.increaseByPerDay}
            onChange={handleChange}
            min="1"
          />
          {settings.increaseByPerDay < 1 && (
            <p className="error-message">The value could not be less than 1 or in fraction.</p>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">
            Maximum emails per day
            <span className="recommended-tag">Recommended: 25</span>
          </label>
          <input
            type="number"
            name="maxEmailsPerDay"
            className="form-input"
            value={settings.maxEmailsPerDay}
            onChange={handleChange}
            min="1"
          />
          {settings.maxEmailsPerDay < 1 && (
            <p className="error-message">The value could not be less than 1 or in fraction.</p>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Reply rate (%)</label>
          <input
            type="number"
            name="replyRate"
            className="form-input"
            value={settings.replyRate}
            onChange={handleChange}
            min="0"
            max="100"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Sender name</label>
          <input
            type="text"
            name="senderName"
            className="form-input"
            value={settings.senderName}
            onChange={handleChange}
          />
        </div>

        <div className="checkbox-group">
          <input
            type="checkbox"
            id="customFolder"
            className="checkbox-input"
            checked={!!settings.customFolderName}
            onChange={(e) => setSettings(prev => ({
              ...prev,
              customFolderName: e.target.checked ? 'Custom Folder' : ''
            }))}
          />
          <label htmlFor="customFolder" className="checkbox-label">
            Add custom name for warmup folder
          </label>
        </div>

        {settings.customFolderName && (
          <div className="form-group">
            <input
              type="text"
              name="customFolderName"
              className="form-input"
              value={settings.customFolderName}
              onChange={handleChange}
              placeholder="Enter folder name"
            />
          </div>
        )}
      </div>

      <div className="form-actions">
        <button className="btn btn-discard" onClick={closePanel}>
          <FiTrash2 /> Discard
        </button>
        <button
          className="btn btn-save"
          onClick={handleSave}
          disabled={
            settings.startEmailsPerDay < 1 ||
            settings.increaseByPerDay < 1 ||
            settings.maxEmailsPerDay < 1
          }
        >
          <FiSave /> Save Changes
        </button>
      </div>
    </div>
  );
};

export default WarmupSettings;
