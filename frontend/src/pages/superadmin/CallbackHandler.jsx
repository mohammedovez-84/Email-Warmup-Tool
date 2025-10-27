// components/AdminOAuthCallback.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const AdminOAuthCallback = () => {
    const [status, setStatus] = useState('processing');
    const [message, setMessage] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const handleCallback = async () => {
            // Get URL parameters
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code');
            const error = urlParams.get('error');
            const errorDescription = urlParams.get('error_description');

            console.log('Admin OAuth Callback - Params:', { code, error, errorDescription });

            if (error) {
                setStatus('error');
                setMessage(`Microsoft OAuth Error: ${error} - ${errorDescription}`);
                return;
            }

            if (!code) {
                setStatus('error');
                setMessage('No authorization code received from Microsoft');
                return;
            }

            try {
                setStatus('processing');
                setMessage('Completing authentication...');

                // The backend automatically handles the token exchange and storage
                // We just need to wait a moment and then redirect back
                setTimeout(() => {
                    setStatus('success');
                    setMessage('Microsoft account added to pool successfully!');

                    // Redirect back to admin dashboard after success
                    setTimeout(() => {
                        navigate('/superadmin/dashboard');
                    }, 2000);
                }, 1500);

            } catch (err) {
                setStatus('error');
                setMessage(`Failed to complete authentication: ${err.message}`);
            }
        };

        handleCallback();
    }, [navigate]);

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
                {status === 'processing' && (
                    <div className="text-center">
                        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <h2 className="text-xl font-semibold text-gray-800 mb-2">Processing Microsoft Authentication</h2>
                        <p className="text-gray-600">Please wait while we add your account to the pool...</p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="text-center">
                        <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold text-gray-800 mb-2">Success!</h2>
                        <p className="text-gray-600 mb-4">{message}</p>
                        <p className="text-sm text-gray-500">Redirecting you back to admin dashboard...</p>
                    </div>
                )}

                {status === 'error' && (
                    <div className="text-center">
                        <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold text-gray-800 mb-2">Authentication Failed</h2>
                        <p className="text-gray-600 mb-4">{message}</p>
                        <button
                            onClick={() => navigate('/superadmin/dashboard')}
                            className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition duration-200"
                        >
                            Back to Dashboard
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminOAuthCallback;