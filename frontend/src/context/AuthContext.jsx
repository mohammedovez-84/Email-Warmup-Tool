// import { createContext, useContext, useState, useEffect } from 'react';
// import axios from 'axios';
// import { useNavigate } from 'react-router-dom';

// const AuthContext = createContext();

// export function AuthProvider({ children }) {
//     const [currentUser, setCurrentUser] = useState(null);
//     const [isLoading, setIsLoading] = useState(true);
//     const [temp2FAData, setTemp2FAData] = useState(null);
//     const navigate = useNavigate();

//     // Check for existing session on initial load
//     useEffect(() => {
//         const checkAuth = async () => {
//             try {
//                 const token = localStorage.getItem('token');
//                 if (token) {
//                     const response = await axios.get('/api/auth/me', {
//                         headers: { Authorization: `Bearer ${token}` }
//                     });
//                     setCurrentUser(response.data.user);
//                 }
//             } catch (err) {
//                 localStorage.removeItem('token');
//             } finally {
//                 setIsLoading(false);
//             }
//         };

//         checkAuth();
//     }, []);

//     const login = async (token, userData) => {
//         localStorage.setItem('token', token);
//         setCurrentUser(userData);
//         navigate('/dashboard');
//     };

//     const logout = async () => {
//         try {
//             await axios.post('/api/auth/logout');
//         } catch (err) {
//             console.error('Logout error:', err);
//         } finally {
//             localStorage.removeItem('token');
//             setCurrentUser(null);
//             navigate('/login');
//         }
//     };

//     const verifyEmail = async (email, otp) => {
//         try {
//             const response = await axios.post('/api/auth/verify-email', { email, otp });
//             return response.data;
//         } catch (err) {
//             throw err;
//         }
//     };

//     const value = {
//         currentUser,
//         isLoading,
//         temp2FAData,
//         setTemp2FAData,
//         login,
//         logout,
//         verifyEmail
//     };

//     return (
//         <AuthContext.Provider value={value}>
//             {!isLoading && children}
//         </AuthContext.Provider>
//     );
// }

// export function useAuth() {
//     return useContext(AuthContext);
// }

// import { createContext, useContext, useState, useEffect } from 'react';
// import axios from 'axios';
// import { useNavigate } from 'react-router-dom';

// const AuthContext = createContext();

// export function AuthProvider({ children }) {
//     const [currentUser, setCurrentUser] = useState(() => {
//         try {
//             const storedUser = localStorage.getItem('user');
//             // Only parse if it exists and is valid JSON
//             return storedUser && storedUser !== 'undefined'
//                 ? JSON.parse(storedUser)
//                 : null;
//         } catch (error) {
//             console.error('Error parsing user from localStorage:', error);
//             return null;
//         }
//     });

//     const [isLoading, setIsLoading] = useState(true);
//     const [temp2FAData, setTemp2FAData] = useState(null);
//     const navigate = useNavigate();

//     useEffect(() => {
//         const checkAuth = async () => {
//             try {
//                 const token = localStorage.getItem('token');
//                 if (token) {
//                     const response = await axios.get('/api/auth/me', {
//                         headers: { Authorization: `Bearer ${token}` }
//                     });
//                     setCurrentUser(response.data.user);
//                     localStorage.setItem('user', JSON.stringify(response.data.user));
//                 }
//             } catch (err) {
//                 console.error('Auth check failed:', err);
//                 localStorage.removeItem('token');
//                 localStorage.removeItem('user');
//                 setCurrentUser(null);
//             } finally {
//                 setIsLoading(false);
//             }
//         };

//         checkAuth();
//     }, []);

//     const login = async (token, userData) => {
//         localStorage.setItem('token', token);
//         localStorage.setItem('user', JSON.stringify(userData));
//         setCurrentUser(userData);
//         navigate('/dashboard', { replace: true });
//     };

//     // const logout = async () => {
//     //     try {
//     //         await axios.post('/api/auth/logout');
//     //     } catch (err) {
//     //         console.error('Logout error:', err);
//     //     } finally {
//     //         localStorage.removeItem('token');
//     //         localStorage.removeItem('user');
//     //         setCurrentUser(null);
//     //         navigate('/login', { replace: true });
//     //     }
//     // };
//     const logout = () => {
//         localStorage.removeItem('authToken');
//         localStorage.removeItem('user');
//         setToken(null);
//         setUser(null);
//     };
//     const verifyEmail = async (email, otp) => {
//         try {
//             const response = await axios.post('/api/auth/verify-email', { email, otp });
//             return response.data;
//         } catch (err) {
//             throw err;
//         }
//     };

//     const value = {
//         currentUser,
//         isLoading,
//         temp2FAData,
//         setTemp2FAData,
//         login,
//         logout,
//         verifyEmail
//     };

//     return (
//         <AuthContext.Provider value={value}>
//             {children}
//         </AuthContext.Provider>
//     );
//     // return (
//     //     <AuthContext.Provider value={{ user, token, login, logout }}>
//     //         {children}
//     //     </AuthContext.Provider>
//     // );
// }

// export function useAuth() {
//     return useContext(AuthContext);
// }



import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(() => {
        try {
            const storedUser = localStorage.getItem('user');
            return storedUser && storedUser !== 'undefined'
                ? JSON.parse(storedUser)
                : null;
        } catch (error) {
            console.error('Error parsing user from localStorage:', error);
            return null;
        }
    });

    const [isLoading, setIsLoading] = useState(true);
    const [temp2FAData, setTemp2FAData] = useState(null);
    const navigate = useNavigate();

    // Add this function to check authentication status
    const isAuthenticated = () => {
        const token = localStorage.getItem('token');
        return !!token; // Returns true if token exists, false otherwise
    };

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    setIsLoading(false);
                    return;
                }

                const response = await axios.get('/api/users/me', {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (response.data?.user) {
                    setCurrentUser(response.data.user);
                    localStorage.setItem('user', JSON.stringify(response.data.user));
                }
            } catch (err) {
                console.error('Auth check failed:', err);

                // Only clear storage if token is actually invalid
                if (err?.response?.status === 401) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    setCurrentUser(null);
                }
            } finally {
                setIsLoading(false);
            }
        };

        checkAuth();
    }, []);

    const login = (token, userData) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(userData));
        setCurrentUser(userData);
        navigate('/dashboard', { replace: true });
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setCurrentUser(null);
        navigate('/login', { replace: true });
    };

    const verifyEmail = async (email, otp) => {
        try {
            const response = await axios.post('/api/auth/verify-email', { email, otp });
            return response.data;
        } catch (err) {
            throw err;
        }
    };

    const value = {
        currentUser,
        isLoading,
        temp2FAData,
        setTemp2FAData,
        login,
        logout,
        verifyEmail,
        isAuthenticated // Add this function to the context value
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}