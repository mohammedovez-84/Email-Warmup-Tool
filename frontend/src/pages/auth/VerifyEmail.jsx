import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { verifyEmail, resendOTP } from "../../services/authService";

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
            const res = await verifyEmail(email, otp);
            setMessage(res.message || "Email verified successfully!");
            // redirect after a short delay
            setTimeout(() => navigate("/login"), 1500);
        } catch (err) {
            console.error("❌ Verify error:", err.response?.data || err.message);
            setError(err.response?.data?.message || "Verification failed");
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        setError("");
        setMessage("");
        setLoading(true);
        try {
            const res = await resendOTP(email);
            setMessage(res.message || "OTP resent successfully!");
        } catch (err) {
            setError(err.response?.data?.message || "Failed to resend OTP");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-sm">
                <h2 className="text-2xl font-bold text-center mb-6">Verify Email</h2>
                <form onSubmit={handleVerify} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring focus:border-blue-300"
                            placeholder="Enter your email"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">OTP</label>
                        <input
                            type="text"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring focus:border-blue-300"
                            placeholder="Enter OTP"
                            required
                        />
                    </div>
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    {message && <p className="text-green-500 text-sm">{message}</p>}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        {loading ? "Verifying..." : "Verify"}
                    </button>
                </form>
                <div className="mt-4 text-center">
                    <button
                        onClick={handleResend}
                        disabled={loading}
                        className="text-sm text-blue-500 hover:underline"
                    >
                        Resend OTP
                    </button>
                </div>
            </div>
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
