// src/hooks/useAuthNavigation.js
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const useAuthNavigation = () => {
    const navigate = useNavigate();
    const { login: authLogin, logout: authLogout } = useAuth();

    const login = (token, userData) => {
        authLogin(token, userData);
        navigate('/dashboard', { replace: true });
    };

    const logout = () => {
        authLogout();
        navigate('/login', { replace: true });
    };

    return { login, logout };
};