import axios from "axios";

const API_URL = "http://localhost:5000/api/auth";

// 🔐 Signup user
export const signupUser = async (data) => {
  const res = await axios.post(`${API_URL}/signup`, data);
  return res.data;
};

// 🔐 Verify email with OTP
export const verifyEmail = async (email, otp) => {

  const res = await axios.post(`${API_URL}/verify-email`, { email, otp });
  return res.data;
};


// // 🔐 Resend OTP
// export const resendOTP = async ({ email, method }) => {
//   const res = await axios.post(`${API_URL}/resend-otp`, { email, method });
//   return res.data;
// };
// authService.js
export const resendOTP = async (data) => {
  const res = await axios.post(`${API_URL}/resend-otp`, data);
  return res.data;
};


// 🔐 Login
export const loginUser = async (credentials) => {
  const res = await axios.post(`${API_URL}/login`, credentials);
  return res.data;
};

// 🔐 Verify 2FA
export const verify2FA = async (payload) => {
  try {
    const response = await axios.post('/api/auth/2fa/verify', payload);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// 🔐 Setup 2FA
export const setup2FA = async () => {
  const res = await axios.patch(`${API_URL}/2fa/setup`);
  return res.data;
};

// 🔐 Disable 2FA
export const disable2FA = async () => {
  const res = await axios.patch(`${API_URL}/2fa/disable`);
  return res.data;
};

// 🔑 Forgot Password
export const forgotPassword = async (email) => {
  const res = await axios.post(`${API_URL}/forgot-password`, { email });
  return res.data;
};

// 🔑 Verify Reset OTP
export const verifyResetOtp = async (data) => {
  const res = await axios.post(`${API_URL}/verify-reset-otp`, data);
  return res.data;
};


export const sendLoginOTP = async (data) => {
  const res = await axios.post(`${API_URL}/2fa/send-otp`, data);
  return res.data;
};