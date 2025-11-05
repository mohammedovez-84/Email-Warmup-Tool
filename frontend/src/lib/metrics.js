import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000';

export const metricsAPI = {
    // Get comprehensive metrics for a single email
    getEmailMetrics: async (email) => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(
                `${API_BASE_URL}/api/emails/${encodeURIComponent(email)}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                    timeout: 10000
                }
            );
            return response.data;
        } catch (error) {
            console.error('Error fetching email metrics:', error);
            throw error;
        }
    },

    // Get metrics for all emails (dashboard summary)
    getAllEmailsMetrics: async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(
                `${API_BASE_URL}/api/accounts/data`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                    timeout: 15000
                }
            );
            return response.data;
        } catch (error) {
            console.error('Error fetching all emails metrics:', error);
            throw error;
        }
    },

    // Get real-time warmup progress
    getWarmupProgress: async (email) => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(
                `${API_BASE_URL}/api/warmup/progress/${encodeURIComponent(email)}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                    timeout: 8000
                }
            );
            return response.data;
        } catch (error) {
            console.error('Error fetching warmup progress:', error);
            throw error;
        }
    }
};