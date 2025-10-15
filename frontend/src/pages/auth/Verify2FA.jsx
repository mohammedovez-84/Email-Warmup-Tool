import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, ArrowRight, X, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { resendOTP } from '../../services/authService';
import { verify2FA } from '../../services/twoFAService';
import { AnimatedGradientBorder } from '../../components/ui/animated-gradient-border';

export default function Verify2FA() {
    // ✅ CORRECT: Hooks must be called INSIDE the component function
    const { user, login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { email, method } = location.state || {};
    // const { method } = location.state || {};
    // const email = user?.email;
    const [token, setToken] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isResending, setIsResending] = useState(false);

    const handleVerify = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            // 🔎 Log payload before sending
            const payload = {
                otp: token,
                email,
                method
            };
            console.log("📤 Sending payload to backend:", payload);
            const res = await verify2FA(payload);
            console.log("✅ 2FA verification response:", res);

            // 🔎 Log response
            // console.log("✅ 2FA verification response:", res);

            if (res.token && res.user) {
                login(res.token, res.user);
                localStorage.setItem('authToken', res.token);

                toast.success('2FA verification successful!', {
                    position: 'top-center',
                    duration: 2000,
                });

                if (res.user.role === 'superadmin') {
                    navigate('/superadmin/dashboard', { replace: true });
                } else {
                    navigate('/dashboard', { replace: true });
                }
            }
        } catch (err) {
            // 🔎 Log error details
            console.error("❌ 2FA verification failed:");
            console.error("   • Error object:", err);
            console.error("   • Response data:", err?.response?.data);
            console.error("   • Status:", err?.response?.status);
            console.error("   • Payload was:", { otp: token, email, method });

            toast.error('Verification failed', {
                position: 'top-center',
                duration: 2000,
                description: err?.response?.data?.message || 'Invalid or expired code',
            });
        } finally {
            setIsLoading(false);
        }
    };



    const handleResendOTP = async () => {
        setIsResending(true);
        try {
            await resendOTP({ email });   // 👈 fix here
            toast.success("OTP resent successfully!", {
                position: 'top-center',
                duration: 2000,
            });
        } catch (err) {
            console.error('Failed to resend OTP:', err);
            toast.error("Could not resend OTP", {
                position: 'top-center',
                duration: 2000,
                description: err?.response?.data?.message || 'Please try again',
            });
        } finally {
            setIsResending(false);
        }
    };



    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
            <motion.div
                className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
            >
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-4">
                        <AnimatedGradientBorder borderRadius="100%" className="w-16 h-16">
                            <div className="w-full h-full rounded-full bg-white/10 dark:bg-gray-900/10 flex items-center justify-center">
                                <Shield className="text-blue-500" size={32} />
                            </div>
                        </AnimatedGradientBorder>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
                        Two-Factor Authentication
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        {method === 'email'
                            ? `Enter the verification code sent to ${email}`
                            : 'Enter the code from your authenticator app'}
                    </p>
                </div>

                <form onSubmit={handleVerify} className="space-y-6">
                    <div>
                        <label htmlFor="token" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Verification Code
                        </label>
                        <AnimatedGradientBorder borderRadius="0.75rem">
                            <input
                                id="token"
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                placeholder="Enter 6-digit code"
                                className="w-full px-4 py-3 bg-transparent rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                value={token}
                                onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                required
                                autoFocus
                            />
                        </AnimatedGradientBorder>
                    </div>

                    <div className="flex items-center justify-between">
                        <button
                            type="button"
                            onClick={handleResendOTP}
                            disabled={isResending}
                            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center"
                        >
                            {isResending ? (
                                <>
                                    <RotateCw className="w-4 h-4 mr-1 animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <RotateCw className="w-4 h-4 mr-1" />
                                    Resend Code
                                </>
                            )}
                        </button>
                    </div>

                    <motion.button
                        type="submit"
                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-4 rounded-lg font-medium shadow hover:shadow-md transition-all duration-300 flex items-center justify-center gap-2"
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        disabled={isLoading || token.length < 6}
                    >
                        {isLoading ? (
                            <>
                                <span className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                Verifying...
                            </>
                        ) : (
                            <>
                                Verify
                                <ArrowRight className="w-5 h-5" />
                            </>
                        )}
                    </motion.button>
                </form>
            </motion.div>
        </div>
    );
}