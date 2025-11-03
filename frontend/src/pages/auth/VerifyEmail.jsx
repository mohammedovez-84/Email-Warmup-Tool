import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { verifyEmail, resendOTP } from "../../services/authService";
import { motion } from "framer-motion";

const VerifyEmail = ({ email: initialEmail }) => {
    const [email, setEmail] = useState(initialEmail || "");
    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const navigate = useNavigate();

    const handleVerify = async (e) => {
        e.preventDefault();
        setError("");
        setMessage("");
        setLoading(true);
        try {
            console.log("📤 Sending verify request:", { email, otp });
            const res = await verifyEmail({ email, otp });
            setMessage(res.message || "Email verified successfully!");
            setTimeout(() => navigate("/login"), 1500);
        } catch (err) {
            console.error("❌ Verify error:", err.response?.data || err.message);
            setError(err.response?.data?.error || err.response?.data?.message || "Verification failed");
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        setError("");
        setMessage("");
        setLoading(true);
        try {
            const res = await resendOTP({ email });
            setMessage(res.message || "OTP resent successfully!");
        } catch (err) {
            setError(err.response?.data?.message || "Failed to resend OTP");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
            <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200/60"
            >
                {/* Header with Enhanced Gradient */}
                <div className="bg-gradient-to-br from-[#0B1E3F] via-[#1a3a6d] to-[#008080] p-10 text-center relative">
                    <div className="absolute top-6 left-6">
                        <button
                            onClick={() => navigate(-1)}
                            className="text-white hover:text-gray-200 transition-all duration-300 p-2 rounded-lg hover:bg-white/10"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                        </button>
                    </div>

                    <div className="pt-4">
                        <h2 className="text-3xl font-bold text-white mb-3">Verify Your Email</h2>
                        <p className="text-white/90 text-lg font-light">
                            Enter the verification code sent to your email address
                        </p>
                    </div>
                </div>

                {/* Form Content - Broader Container */}
                <div className="p-10">
                    {/* Status Messages */}
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-red-50 border-l-4 border-red-500 text-red-700 p-5 rounded-lg mb-8 shadow-sm"
                        >
                            <div className="flex items-start">
                                <svg className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                                <div>
                                    <p className="font-medium">Verification Failed</p>
                                    <p className="text-sm mt-1">{error}</p>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {message && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-green-50 border-l-4 border-green-500 text-green-700 p-5 rounded-lg mb-8 shadow-sm"
                        >
                            <div className="flex items-start">
                                <svg className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <div>
                                    <p className="font-medium">Success!</p>
                                    <p className="text-sm mt-1">{message}</p>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    <form onSubmit={handleVerify} className="space-y-8">
                        {/* Email Input */}
                        <div className="space-y-3">
                            <label htmlFor="email" className="block text-lg font-semibold text-gray-800">
                                Email Address
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-5 py-2 text-lg border-2 border-gray-300 rounded-xl focus:ring-3 focus:ring-teal-500/30 focus:border-teal-500 outline-none transition-all duration-300 hover:border-gray-400"
                                placeholder="your.email@example.com"
                                required
                                disabled={loading}
                            />
                        </div>

                        {/* OTP Input */}
                        <div className="space-y-3">
                            <label htmlFor="otp" className="block text-lg font-semibold text-gray-800">
                                Verification Code
                            </label>
                            <input
                                id="otp"
                                type="text"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                className="w-full px-5 py-4 text-lg border-2 border-gray-300 rounded-xl focus:ring-3 focus:ring-teal-500/30 focus:border-teal-500 outline-none transition-all duration-300 hover:border-gray-400 text-center font-mono tracking-widest"
                                placeholder="000000"
                                required
                                maxLength={6}
                                disabled={loading}
                            />
                            <p className="text-sm text-gray-600 text-center">
                                Enter the 6-digit code sent to your email
                            </p>
                        </div>

                        {/* Verify Button */}
                        <motion.button
                            type="submit"
                            disabled={loading}
                            whileHover={{ scale: loading ? 1 : 1.02 }}
                            whileTap={{ scale: loading ? 1 : 0.98 }}
                            className="w-full bg-gradient-to-r from-[#0B1E3F] to-[#008080] text-white py-4 rounded-xl font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl relative overflow-hidden"
                        >
                            {loading ? (
                                <div className="flex items-center justify-center">
                                    <motion.svg
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                        className="w-6 h-6 mr-3 text-white"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </motion.svg>
                                    Verifying...
                                </div>
                            ) : (
                                <span className="flex items-center justify-center">
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Verify Email Address
                                </span>
                            )}
                        </motion.button>
                    </form>

                    {/* Resend OTP Section */}
                    <div className="mt-12 text-center border-t border-gray-200 pt-8">
                        <p className="text-base text-gray-600 mb-4 font-medium">
                            Didn't receive the verification code?
                        </p>
                        <motion.button
                            onClick={handleResend}
                            disabled={loading}
                            whileHover={{ scale: loading ? 1 : 1.05 }}
                            whileTap={{ scale: loading ? 1 : 0.95 }}
                            className="inline-flex items-center px-6 py-3 text-base font-semibold text-teal-600 hover:text-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 bg-teal-50 hover:bg-teal-100 rounded-xl border border-teal-200"
                        >
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Resend Verification Code
                        </motion.button>
                    </div>

                    {/* Support Section */}
                    {/* <div className="mt-8 text-center">
                        <p className="text-sm text-gray-500 font-medium">
                            Need help?{" "}
                            <button className="text-teal-600 hover:text-teal-700 font-semibold transition-colors duration-200">
                                Contact Support
                            </button>
                        </p>
                    </div> */}
                </div>
            </motion.div>
        </div>
    );
};

export default VerifyEmail;




// import React, { useState } from "react";
// import { useNavigate } from "react-router-dom";
// import { verifyEmail, resendOTP } from "../../services/authService";
// import { motion } from "framer-motion";

// const VerifyEmail = ({ email: initialEmail }) => {
//     const [email, setEmail] = useState(initialEmail || "");
//     const [otp, setOtp] = useState("");
//     const [loading, setLoading] = useState(false);
//     const [message, setMessage] = useState("");
//     const [error, setError] = useState("");
//     const navigate = useNavigate();

//     const handleVerify = async (e) => {
//         e.preventDefault();
//         setError("");
//         setMessage("");
//         setLoading(true);
//         try {
//             console.log("📤 Sending verify request:", { otp });
//             const res = await verifyEmail({ email, otp });
//             setMessage(res.message || "Email verified successfully!");
//             setTimeout(() => navigate("/login"), 1500);
//         } catch (err) {
//             console.error("❌ Verify error:", err.response?.data || err.message);
//             setError(err.response?.data?.error || err.response?.data?.message || "Verification failed");

//         } finally {
//             setLoading(false);
//         }
//     };

//     const handleResend = async () => {
//         setError("");
//         setMessage("");
//         setLoading(true);
//         try {
//             const res = await resendOTP({ email });
//             setMessage(res.message || "OTP resent successfully!");
//         } catch (err) {
//             setError(err.response?.data?.message || "Failed to resend OTP");
//         } finally {
//             setLoading(false);
//         }
//     };

//     return (
//         <div className="flex items-center justify-center min-h-screen bg-gray-50">
//             <motion.div
//                 initial={{ opacity: 0, y: 20 }}
//                 animate={{ opacity: 1, y: 0 }}
//                 transition={{ duration: 0.5 }}
//                 className="w-full max-w-md bg-white rounded-xl shadow-lg overflow-hidden"
//             >
//                 {/* Header */}
//                 <div className="bg-gradient-to-b from-[#0B1E3F] to-[#008080] p-8">
//                     <button onClick={() => navigate(-1)}>← Back</button>
//                     <h2 className="text-2xl font-bold text-white">Verify Your Email</h2>
//                     <p className="text-white/90 text-sm mt-1">
//                         Enter the code we sent to your email
//                     </p>
//                 </div>

//                 {/* Content */}
//                 <div className="p-6">
//                     {error && (
//                         <motion.div
//                             initial={{ opacity: 0 }}
//                             animate={{ opacity: 1 }}
//                             className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4"
//                         >
//                             {error}
//                         </motion.div>
//                     )}

//                     {message && (
//                         <motion.div
//                             initial={{ opacity: 0 }}
//                             animate={{ opacity: 1 }}
//                             className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4"
//                         >
//                             {message}
//                         </motion.div>
//                     )}

//                     <form onSubmit={handleVerify} className="space-y-5">
//                         <div>
//                             <label
//                                 htmlFor="otp"
//                                 className="block text-sm font-medium text-gray-700 mb-1"
//                             >
//                                 Verification Code
//                             </label>
//                             <input
//                                 id="otp"
//                                 type="text"
//                                 required
//                                 value={otp}
//                                 onChange={(e) => setOtp(e.target.value)}
//                                 placeholder="Enter verification code"
//                                 className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
//                             />
//                         </div>

//                         <button
//                             type="submit"
//                             disabled={loading}
//                             className="w-full py-2 rounded-lg text-white font-medium bg-gradient-to-b from-[#0B1E3F] to-[#008080] p-8 "
//                         >
//                             {loading ? "Verifying..." : "Verify Email"}
//                         </button>
//                     </form>

//                     <div className="mt-6 text-center">
//                         <button
//                             onClick={handleResend}
//                             disabled={loading}
//                             className="text-sm font-medium text-teal-600 hover:text-teal-500"
//                         >
//                             Resend Verification Code
//                         </button>
//                     </div>
//                 </div>
//             </motion.div>
//         </div>
//     );
// };

// export default VerifyEmail;
