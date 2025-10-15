import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import OTPInput from '../../components/OTPInput';

export default function TwoFactorLogin() {
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { complete2FA, tempToken } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (code.length !== 6) {
            return setError('Please enter a valid 6-digit code');
        }

        setError('');
        setLoading(true);

        try {
            const success = await complete2FA(code);
            if (success) {
                navigate('/');
            } else {
                setError('Invalid verification code');
            }
        } catch (err) {
            setError('Failed to verify code. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="text-center">
                <h2 className="text-3xl font-bold text-gray-900">Two-Factor Authentication</h2>
                <p className="mt-2 text-gray-600">
                    Enter the 6-digit code from your authenticator app
                </p>
            </div>

            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex justify-center">
                    <OTPInput length={6} onChange={setCode} />
                </div>

                <div>
                    <button
                        type="submit"
                        disabled={loading || !tempToken}
                        className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${loading || !tempToken ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        {loading ? 'Verifying...' : 'Verify'}
                    </button>
                </div>
            </form>

            <div className="text-center text-sm">
                <p className="text-gray-600">
                    Having trouble?{' '}
                    <button className="font-medium text-blue-600 hover:text-blue-500">
                        Resend code
                    </button>
                </p>
            </div>
        </div>
    );
}