// services/twoFAService.js
import axios from "axios";

const API_URL = "http://localhost:5000/api/auth";

// Helper function to get auth headers
const getAuthHeaders = () => {
    const token = localStorage.getItem('authToken');
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
};

// 🔐 Verify 2FA
export const verify2FA = async (payload) => {
    const response = await axios.post(`${API_URL}/2fa/verify`, payload, {
        headers: getAuthHeaders()
    });
    return response.data;
};

// 🔐 Send Login OTP
export const sendLoginOTP = async (data) => {
    const res = await axios.post(`${API_URL}/2fa/send-otp`, data, {
        headers: getAuthHeaders()
    });
    return res.data;
};

// 🔐 Setup 2FA
export const setup2FA = async () => {
    const res = await axios.patch(`${API_URL}/2fa/setup`, {}, {
        headers: getAuthHeaders()
    });
    return res.data;
};

// 🔐 Disable 2FA
export const disable2FA = async () => {
    const res = await axios.patch(`${API_URL}/2fa/disable`, {}, {
        headers: getAuthHeaders()
    });
    return res.data;
};