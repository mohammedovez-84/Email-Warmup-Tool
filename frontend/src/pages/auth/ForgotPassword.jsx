import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import { ArrowLeft, Mail, Fingerprint, Key, CheckCircle } from "lucide-react";

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState(["", "", "", "", "", ""]);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [step, setStep] = useState(1); // 1: email, 2: OTP, 3: reset password
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [resendDisabled, setResendDisabled] = useState(false);
    const [countdown, setCountdown] = useState(60);
    const navigate = useNavigate();
    const otpInputs = useRef([]);

    // Countdown timer for resend OTP
    useEffect(() => {
        let timer;
        if (resendDisabled && countdown > 0) {
            timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        } else if (countdown === 0) {
            setResendDisabled(false);
        }
        return () => clearTimeout(timer);
    }, [resendDisabled, countdown]);

    // OTP handling functions
    const handleOtpChange = (index, value) => {
        if (/^[0-9]$/.test(value) || value === "") {
            const newOtp = [...otp];
            newOtp[index] = value;
            setOtp(newOtp);

            // Auto-focus next input
            if (value && index < 5) {
                otpInputs.current[index + 1].focus();
            }
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === "Backspace" && !otp[index] && index > 0) {
            otpInputs.current[index - 1].focus();
        }
    };

    // Resend OTP function
    const handleResendOtp = async () => {
        setLoading(true);
        setError("");
        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/auth/forgot-password`, {
                email,
            });
            setMessage("New verification code sent successfully!");
            setResendDisabled(true);
            setCountdown(60); // Reset countdown
        } catch (err) {
            setError(
                err.response?.data?.message ||
                "Failed to resend verification code. Please try again."
            );
        } finally {
            setLoading(false);
        }
    };

    // Step 1: Send verification code
    const handleSendVerification = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/auth/forgot-password`, {
                email,
            });
            setMessage("Verification code sent successfully!");
            setStep(2);
            setResendDisabled(true); // Enable countdown when first sending
            setCountdown(60);
        } catch (err) {
            setError(
                err.response?.data?.message ||
                "Failed to send verification code. Please try again."
            );
        } finally {
            setLoading(false);
        }
    };

    // Step 2: Verify OTP
    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        const otpCode = otp.join("");
        if (otpCode.length !== 6) {
            setError("Please enter a 6-digit code");
            setLoading(false);
            return;
        }

        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/auth/verify-reset-otp`, {
                email,
                otp: otpCode,
            });
            setMessage("OTP verified successfully!");
            setStep(3);
        } catch (err) {
            setError(err.response?.data?.error || "Invalid OTP");
        } finally {
            setLoading(false);
        }
    };

    // Step 3: Reset password
    const handleResetPassword = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        if (newPassword !== confirmPassword) {
            setError("Passwords do not match");
            setLoading(false);
            return;
        }

        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/auth/reset-password`, {
                email,
                otp: otp.join(""),
                newPassword,
            });
            setSuccess(true);
            setTimeout(() => {
                navigate("/login");
            }, 2000);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to reset password");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center px-4">
            <div className="w-full max-w-md rounded-2xl shadow-lg overflow-hidden">
                {/* Header with gradient background */}
                <div className="bg-gradient-to-r from-[#0B1E3F] to-[#008080] p-6 text-white">
                    <div className="flex items-center mb-8">
                        <button
                            onClick={() => (step === 1 ? navigate(-1) : setStep(step - 1))}
                            className="flex items-center text-sm hover:opacity-80"
                        >
                            <ArrowLeft size={18} className="mr-1" />
                            Back
                        </button>
                    </div>



                    <h1 className="text-4xl font-bold mb-2">
                        {step === 1
                            ? "Reset Your Password"
                            : step === 2
                                ? "Enter Verification Code"
                                : success
                                    ? "Password Reset Successfully!"
                                    : "Create New Password"}
                    </h1>
                </div>

                {/* Form content */}
                <div className="bg-white p-6">
                    {/* Error/Success messages */}
                    {error && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mb-4 bg-red-50 border-l-4 border-red-500 p-3 text-red-700 text-sm rounded"
                        >
                            {error}
                        </motion.div>
                    )}

                    {message && !success && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mb-4 bg-green-50 border-l-4 border-green-500 p-3 text-green-700 text-sm rounded"
                        >
                            {message}
                        </motion.div>
                    )}

                    {success ? (
                        <div className="text-center py-6">
                            <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">
                                Password reset successfully!
                            </h3>
                            <p className="text-gray-600">
                                You will be redirected to login page shortly.
                            </p>
                        </div>
                    ) : step === 1 ? (
                        <form onSubmit={handleSendVerification} className="space-y-4">
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                                    Email Address
                                </label>
                                <div className="mt-1 relative">
                                    <Mail
                                        size={18}
                                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                                    />
                                    <input
                                        id="email"
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Enter your registered email"
                                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                                <p className="mt-2 text-sm text-gray-500">
                                    We'll send a verification code to this email
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-white bg-gradient-to-r from-[#0B1E3F] to-[#008080] hover:from-[#092033] hover:to-[#006666] shadow-md transition-colors disabled:opacity-70"
                            >
                                {loading ? (
                                    <>
                                        <svg
                                            className="animate-spin h-4 w-4 text-white"
                                            xmlns="http://www.w3.org/2000/svg"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                        >
                                            <circle
                                                className="opacity-25"
                                                cx="12"
                                                cy="12"
                                                r="10"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                            ></circle>
                                            <path
                                                className="opacity-75"
                                                fill="currentColor"
                                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 
             5.291A7.962 7.962 0 014 12H0c0 
             3.042 1.135 5.824 3 7.938l3-2.647z"
                                            ></path>
                                        </svg>
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <Fingerprint size={18} />
                                        Send Verification Code
                                    </>
                                )}
                            </button>

                        </form>
                    ) : step === 2 ? (
                        <form onSubmit={handleVerifyOtp} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">

                                    Verification Code
                                </label>
                                <p className="text-sm text-gray-500 mb-4">
                                    We've sent a 6-digit code to {email}
                                </p>
                                <div className="flex justify-center space-x-2">
                                    {otp.map((digit, index) => (
                                        <input
                                            key={index}
                                            type="text"
                                            value={digit}
                                            onChange={(e) => handleOtpChange(index, e.target.value)}
                                            onKeyDown={(e) => handleKeyDown(index, e)}
                                            ref={(el) => (otpInputs.current[index] = el)}
                                            className="w-12 h-14 text-center text-3x1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            maxLength="1"
                                            pattern="[0-9]"
                                            inputMode="numeric"
                                            autoFocus={index === 0}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center justify-center">
                                <button
                                    type="button"
                                    onClick={handleResendOtp}
                                    disabled={resendDisabled || loading}
                                    className={`text-sm font-medium transition-colors disabled:text-gray-400 disabled:cursor-not-allowed 
    ${!(resendDisabled || loading) ?
                                            "bg-gradient-to-r from-[#0B1E3F] to-[#008080] bg-clip-text text-transparent hover:from-[#092033] hover:to-[#006666]"
                                            : ""}`}
                                >
                                    {resendDisabled
                                        ? `Resend code in ${countdown}s`
                                        : "Resend verification code"}
                                </button>

                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-white bg-gradient-to-r from-[#0B1E3F] to-[#008080] hover:from-[#092033] hover:to-[#006666] shadow-md transition-colors disabled:opacity-70"
                            >
                                <Fingerprint size={18} />
                                {loading ? (
                                    <>
                                        <svg
                                            className="animate-spin h-4 w-4 text-white"
                                            xmlns="http://www.w3.org/2000/svg"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                        >
                                            <circle
                                                className="opacity-25"
                                                cx="12"
                                                cy="12"
                                                r="10"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                            ></circle>
                                            <path
                                                className="opacity-75"
                                                fill="currentColor"
                                                d="M4 12a8 8 0 018-8V0C5.373 
             0 0 5.373 0 12h4zm2 5.291A7.962 
             7.962 0 014 12H0c0 3.042 1.135 
             5.824 3 7.938l3-2.647z"
                                            ></path>
                                        </svg>
                                        Verifying...
                                    </>
                                ) : (
                                    "Verify Code"
                                )}
                            </button>

                        </form>
                    ) : (
                        <form onSubmit={handleResetPassword} className="space-y-4">
                            <div>
                                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                                    New Password
                                </label>
                                <div className="mt-1 relative">
                                    <Key
                                        size={18}
                                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                                    />
                                    <input
                                        id="newPassword"
                                        type="password"
                                        required
                                        minLength="8"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Enter new password"
                                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                                    Confirm Password
                                </label>
                                <div className="mt-1 relative">
                                    <Key
                                        size={18}
                                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                                    />
                                    <input
                                        id="confirmPassword"
                                        type="password"
                                        required
                                        minLength="8"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Confirm new password"
                                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-white bg-gradient-to-r from-[#0B1E3F] to-[#008080] hover:from-[#092033] hover:to-[#006666] shadow-md transition-colors disabled:opacity-70"
                            >
                                <Fingerprint size={18} />
                                {loading ? (
                                    <>
                                        <svg
                                            className="animate-spin h-4 w-4 text-white"
                                            xmlns="http://www.w3.org/2000/svg"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                        >
                                            <circle
                                                className="opacity-25"
                                                cx="12"
                                                cy="12"
                                                r="10"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                            ></circle>
                                            <path
                                                className="opacity-75"
                                                fill="currentColor"
                                                d="M4 12a8 8 0 018-8V0C5.373 
             0 0 5.373 0 12h4zm2 5.291A7.962 
             7.962 0 014 12H0c0 3.042 1.135 
             5.824 3 7.938l3-2.647z"
                                            ></path>
                                        </svg>
                                        Resetting...
                                    </>
                                ) : (
                                    "Reset Password"
                                )}
                            </button>

                        </form>
                    )}

                    {!success && step === 1 && (
                        <p className="mt-6 text-center text-sm text-gray-600">
                            Remember your password?{" "}
                            <Link
                                to="/login"
                                className="bg-gradient-to-r from-[#0B1E3F] to-[#008080] bg-clip-text text-transparent font-medium hover:from-[#092033] hover:to-[#006666] transition-colors"
                            >
                                Sign in instead
                            </Link>

                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}