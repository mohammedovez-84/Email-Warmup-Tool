// import React, { useState } from 'react';
// import { FiX } from 'react-icons/fi';
// import axios from 'axios';

// const MicrosoftConnect = ({ onSuccess, onClose }) => {
//     const [email, setEmail] = useState('');
//     const [loading, setLoading] = useState(false);
//     const [error, setError] = useState('');

//     const handleSubmit = (e) => {
//         e.preventDefault();

//         // Optional: validate email
//         if (!email || !email.includes('@')) {
//             setError("Please enter a valid Microsoft email.");
//             return;
//         }

//         // Save the email to localStorage (or context) if needed later
//         localStorage.setItem('ms_email', email);

//         // Redirect to the backend OAuth route
//         window.location.href = 'http://localhost:5000/auth/microsoft';
//     };


//     return (
//         <div className="connect-overlay">
//             <div className="connect-modal">
//                 <div className="connect-header">
//                     <div className="connect-title-group">
//                         <div className="provider-logo">
//                             <svg viewBox="0 0 23 23" width="28" height="28">
//                                 <path fill="#f25022" d="M1 1h10v10H1z"></path>
//                                 <path fill="#7fba00" d="M12 1h10v10H12z"></path>
//                                 <path fill="#00a4ef" d="M1 12h10v10H1z"></path>
//                                 <path fill="#ffb900" d="M12 12h10v10H12z"></path>
//                             </svg>
//                         </div>
//                         <div>
//                             <h2>Microsoft Account</h2>
//                             <p className="connect-subtitle">Connect your Microsoft account to start sending emails</p>
//                         </div>
//                     </div>
//                     <button className="close-btn" onClick={onClose} aria-label="Close">
//                         <FiX size={22} />
//                     </button>
//                 </div>

//                 <div className="connect-content">
//                     {error && (
//                         <div className="error-alert">
//                             <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
//                                 <path d="M8 0C3.6 0 0 3.6 0 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm0 11c-.6 0-1 .4-1 1s.4 1 1 1 1-.4 1-1-.4-1-1-1zm1-3V4H7v4h2z" fill="#a4262c" />
//                             </svg>
//                             <span>{error}</span>
//                         </div>
//                     )}

//                     <form onSubmit={handleSubmit} className="connect-form">
//                         <div className="input-section">
//                             <h3 className="section-title">EMAIL ACCOUNT</h3>
//                             <div className="input-group">
//                                 <label htmlFor="ms-email">Email, phone, or Skype</label>
//                                 <input
//                                     id="ms-email"
//                                     type="text"
//                                     placeholder="Enter your Microsoft email"
//                                     value={email}
//                                     onChange={(e) => setEmail(e.target.value)}
//                                     required
//                                     disabled={loading}
//                                     className="text-input"
//                                 />
//                             </div>
//                         </div>

//                         <div className="help-links">
//                             <a href="#" className="help-link">No account? Create one!</a>
//                             <a href="#" className="help-link">Can't access your account?</a>
//                         </div>

//                         <div className="action-buttons">
//                             <button
//                                 type="button"
//                                 className="secondary-btn"
//                                 onClick={onClose}
//                                 disabled={loading}
//                             >
//                                 Back
//                             </button>
//                             <button
//                                 type="submit"
//                                 className="primary-btn"
//                                 disabled={loading}
//                             >
//                                 {loading ? (
//                                     <span className="spinner">
//                                         <span className="spinner-dot"></span>
//                                         <span className="spinner-dot"></span>
//                                         <span className="spinner-dot"></span>
//                                     </span>
//                                 ) : 'Next'}
//                             </button>
//                         </div>
//                     </form>

//                     <div className="signin-options">
//                         <div className="divider">
//                             <span>Sign-in options</span>
//                         </div>
//                     </div>
//                 </div>

//                 <div className="connect-footer">
//                     <div className="footer-links">
//                         <a href="#" className="footer-link">Terms of use</a>
//                         <a href="#" className="footer-link">Privacy & cookies</a>
//                     </div>
//                     <div className="copyright">© Microsoft {new Date().getFullYear()}</div>
//                 </div>
//             </div>

//             <style jsx>{`
//                 /* Base Styles */
//                 .connect-overlay {
//                     position: fixed;
//                     top: 0;
//                     left: 0;
//                     right: 0;
//                     bottom: 0;
//                     background-color: rgba(0, 0, 0, 0.5);
//                     display: flex;
//                     justify-content: center;
//                     align-items: center;
//                     z-index: 1000;
//                     font-family: 'Roboto', Arial, sans-serif;
//                 }

//                 /* Modal Container */
//                 .connect-modal {
//                     background-color: #ffffff;
//                     border-radius: 8px;
//                     box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
//                     width: 480px;
//                     max-width: 95%;
//                     overflow: hidden;
//                     animation: fadeIn 0.3s ease-out;
//                 }

//                 @keyframes fadeIn {
//                     from { opacity: 0; transform: translateY(-20px); }
//                     to { opacity: 1; transform: translateY(0); }
//                 }

//                 /* Header Styles */
//                 .connect-header {
//                     display: flex;
//                     justify-content: space-between;
//                     align-items: flex-start;
//                     padding: 24px 24px 16px;
//                     border-bottom: 1px solid #e0e0e0;
//                 }

//                 .connect-title-group {
//                     display: flex;
//                     gap: 16px;
//                 }

//                 .provider-logo {
//                     margin-top: 4px;
//                 }

//                 .connect-header h2 {
//                     margin: 0 0 4px 0;
//                     font-size: 20px;
//                     font-weight: 500;
//                     color: #202124;
//                 }

//                 .connect-subtitle {
//                     margin: 0;
//                     font-size: 14px;
//                     color: #5f6368;
//                 }

//                 .close-btn {
//                     background: transparent;
//                     border: none;
//                     color: #5f6368;
//                     cursor: pointer;
//                     padding: 4px;
//                     border-radius: 50%;
//                     transition: all 0.2s;
//                 }

//                 .close-btn:hover {
//                     background-color: #f1f3f4;
//                 }

//                 /* Content Area */
//                 .connect-content {
//                     padding: 24px;
//                 }

//                 /* Error Alert */
//                 .error-alert {
//                     display: flex;
//                     align-items: center;
//                     gap: 8px;
//                     padding: 12px 16px;
//                     background-color: #fce8e6;
//                     color: #d93025;
//                     border-radius: 4px;
//                     margin-bottom: 24px;
//                     font-size: 14px;
//                 }

//                 /* Form Elements */
//                 .input-section {
//                     margin-bottom: 24px;
//                 }

//                 .section-title {
//                     margin: 0 0 16px 0;
//                     font-size: 14px;
//                     font-weight: 500;
//                     color: #5f6368;
//                     text-transform: uppercase;
//                     letter-spacing: 0.5px;
//                 }

//                 .input-group {
//                     margin-bottom: 16px;
//                 }

//                 .input-group label {
//                     display: block;
//                     margin-bottom: 8px;
//                     font-size: 14px;
//                     color: #202124;
//                     font-weight: 500;
//                 }

//                 .text-input {
//                     width: 90%;
//                     padding: 12px 12px;
//                     border: 1px solid #dadce0;
//                     border-radius: 4px;
//                     font-size: 14px;
//                     transition: all 0.2s;
//                 }

//                 .text-input:focus {
//                     outline: none;
//                     border-color: #1a73e8;
//                     box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.2);
//                 }

//                 .text-input:disabled {
//                     background-color: #f1f3f4;
//                     cursor: not-allowed;
//                 }

//                 /* Help Links */
//                 .help-links {
//                     display: flex;
//                     flex-direction: column;
//                     gap: 12px;
//                     margin-bottom: 32px;
//                 }

//                 .help-link {
//                     color: #1a73e8;
//                     text-decoration: none;
//                     font-size: 14px;
//                     transition: color 0.2s;
//                 }

//                 .help-link:hover {
//                     color: #174ea6;
//                     text-decoration: underline;
//                 }

//                 /* Action Buttons */
//                 .action-buttons {
//                     display: flex;
//                     justify-content: flex-end;
//                     gap: 8px;
//                     margin-top: 24px;
//                 }

//                 .primary-btn {
//                     background-color: #1a73e8;
//                     color: white;
//                     border: none;
//                     padding: 10px 24px;
//                     border-radius: 4px;
//                     font-weight: 500;
//                     cursor: pointer;
//                     transition: background-color 0.2s;
//                     min-width: 80px;
//                     display: flex;
//                     align-items: center;
//                     justify-content: center;
//                 }

//                 .primary-btn:hover:not(:disabled) {
//                     background-color: #1765cc;
//                     box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
//                 }

//                 .primary-btn:disabled {
//                     background-color: #8ab4f8;
//                     cursor: not-allowed;
//                 }

//                 .secondary-btn {
//                     background: transparent;
//                     border: 1px solid #dadce0;
//                     color: #1a73e8;
//                     padding: 10px 24px;
//                     border-radius: 4px;
//                     font-weight: 500;
//                     cursor: pointer;
//                     transition: all 0.2s;
//                 }

//                 .secondary-btn:hover:not(:disabled) {
//                     background-color: #f1f3f4;
//                     border-color: #d2e3fc;
//                 }

//                 .secondary-btn:disabled {
//                     opacity: 0.6;
//                     cursor: not-allowed;
//                 }

//                 /* Spinner */
//                 .spinner {
//                     display: inline-flex;
//                     align-items: center;
//                     gap: 4px;
//                 }

//                 .spinner-dot {
//                     display: inline-block;
//                     width: 6px;
//                     height: 6px;
//                     background-color: white;
//                     border-radius: 50%;
//                     animation: bounce 1.4s infinite ease-in-out both;
//                 }

//                 .spinner-dot:nth-child(1) { animation-delay: -0.32s; }
//                 .spinner-dot:nth-child(2) { animation-delay: -0.16s; }

//                 @keyframes bounce {
//                     0%, 80%, 100% { transform: scale(0); }
//                     40% { transform: scale(1); }
//                 }

//                 /* Sign-in Options Divider */
//                 .signin-options {
//                     margin-top: 32px;
//                 }

//                 .divider {
//                     position: relative;
//                     text-align: center;
//                     color: #5f6368;
//                     font-size: 14px;
//                 }

//                 .divider::before {
//                     content: "";
//                     position: absolute;
//                     top: 50%;
//                     left: 0;
//                     right: 0;
//                     height: 1px;
//                     background-color: #dadce0;
//                     z-index: -1;
//                 }

//                 .divider span {
//                     background-color: white;
//                     padding: 0 16px;
//                 }

//                 /* Footer */
//                 .connect-footer {
//                     padding: 16px 24px;
//                     border-top: 1px solid #e0e0e0;
//                     display: flex;
//                     justify-content: space-between;
//                     align-items: center;
//                     font-size: 12px;
//                     color: #5f6368;
//                 }

//                 .footer-links {
//                     display: flex;
//                     gap: 16px;
//                 }

//                 .footer-link {
//                     color: #5f6368;
//                     text-decoration: none;
//                     transition: color 0.2s;
//                 }

//                 .footer-link:hover {
//                     color: #1a73e8;
//                     text-decoration: underline;
//                 }

//                 .copyright {
//                     color: #5f6368;
//                 }
//             `}</style>
//         </div>
//     );
// };

// export default MicrosoftConnect;




import React, { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

const MicrosoftConnectModal = ({ onClose }) => {
    const { currentUser } = useAuth();

    useEffect(() => {
        if (currentUser?.id) {
            // ✅ Redirect to your backend's Microsoft login endpoint
            window.location.href = `http://localhost:5000/auth/microsoft?userId=${currentUser.id}`;
        }
    }, [currentUser]);

    return (
        <div className="modal">
            {/* <p>Redirecting to Microsoft login...</p>
            <button onClick={onClose}>Cancel</button> */}
        </div>
    );
};

export default MicrosoftConnectModal;

