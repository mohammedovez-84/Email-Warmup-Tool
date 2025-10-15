// src/utils/api.js
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Create a base fetch wrapper with common functionality
const fetchWrapper = async (endpoint, options = {}) => {
    // Get auth token if exists
    const token = localStorage.getItem('authToken');

    // Set default headers
    const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
    };

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers,
        });

        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('authToken');
                window.location.href = '/login';
                return;
            }

            const errorData = await response.json();
            throw new Error(errorData.message || 'API request failed');
        }


        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
};

// Main API methods
export const api = {
    async get(endpoint) {
        return fetchWrapper(endpoint);
    },

    async post(endpoint, data) {
        return fetchWrapper(endpoint, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    async patch(endpoint, data) {
        return fetchWrapper(endpoint, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    },

    async put(endpoint, data) {
        return fetchWrapper(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

    async delete(endpoint) {
        return fetchWrapper(endpoint, {
            method: 'DELETE',
        });
    },
};

// API endpoints organized by domain
export const authAPI = {
    login: (credentials) => api.post('/auth/login', credentials),
    signup: (userData) => api.post('/auth/signup', userData),
    verifyOTP: (data) => api.post('/auth/verify-otp', data),
    forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
    resetPassword: (data) => api.post('/auth/reset-password', data),
    refreshToken: () => api.post('/auth/refresh-token'),
};

export const emailAPI = {
    getInbox: () => api.get('/emails/inbox'),
    getSent: () => api.get('/emails/sent'),
    sendEmail: (data) => api.post('/emails/send', data),
    warmupStatus: () => api.get('/emails/warmup-status'),
};

export const userAPI = {
    getProfile: () => api.get('/users/me'),
    updateProfile: (data) => api.patch('/users/me', data),
};

// Error handling utility
export const handleApiError = (error) => {
    if (error.response) {
        return {
            message: error.response.data?.message || 'An error occurred',
            status: error.response.status,
            data: error.response.data,
        };
    }

    return {
        message: error.message || 'API request failed',
        status: null,
    };
};