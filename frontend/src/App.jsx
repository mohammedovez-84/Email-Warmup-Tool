import {
    BrowserRouter as Router,
    Routes,
    Route,
    Navigate
} from "react-router-dom";
import { lazy, Suspense } from 'react';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Onboarding from './components/Onboarding';
import SuperAdminRoute from './components/SuperAdminRoute';
import LoadingSpinner from './components/LoadingSpinner';
import MainLayout from './layouts/MainLayout';
import AuthLayout from './layouts/AuthLayout';
import { CreditProvider } from "./context/CreditContext";
import AdminOAuthCallback from "./pages/superadmin/CallbackHandler";
// Lazy load components
const Login = lazy(() => import('./pages/auth/Login'));
const Signup = lazy(() => import('./pages/auth/Signup'));
const VerifyEmail = lazy(() => import('./pages/auth/VerifyEmail'));
const Settings = lazy(() => import('./pages/auth/Settings'));
const Verify2FA = lazy(() => import('./pages/auth/Verify2FA'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'));
const TwoFactorLogin = lazy(() => import('./pages/auth/TwoFactorLogin'));
const EmailVerification = lazy(() => import('./pages/auth/EmailVerification'));
const Dashboard = lazy(() => import('./pages/auth/Dashboard'));
const Analytics = lazy(() => import('./pages/auth/Analytics'));
const Ipdomainchecker = lazy(() => import('./pages/auth/Ipdomain-checker'));
const TemplateChecker = lazy(() => import("./pages/auth/TemplateChecker"));
const Alert = lazy(() => import("./pages/auth/Alert"));
const AuthenticationChecker = lazy(() => import("./pages/auth/AuthenticationChecker"));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const SuperAdminDashboard = lazy(() => import('./pages/superadmin/SuperDashboard'));

function App() {
    return (
        <Router>
            <AuthProvider>
                <Suspense fallback={<LoadingSpinner />}>
                    <Routes>
                        {/* Default route */}
                        <Route path="/" element={<Navigate to="/login" replace />} />

                        {/* Auth routes with AuthLayout */}
                        <Route element={<AuthLayout />}>
                            <Route path="/login" element={<Login />} />
                            <Route path="/signup" element={<Signup />} />
                            <Route path="/verify-email" element={<VerifyEmail />} />
                            <Route path="/onboarding" element={<Onboarding />} />
                            <Route path="/forgot-password" element={<ForgotPassword />} />
                            <Route path="/reset-password" element={<ResetPassword />} />
                            <Route path="/two-factor-login" element={<TwoFactorLogin />} />
                            <Route path="/verify-2fa" element={<Verify2FA />} />
                            <Route path="/email-verification" element={<EmailVerification />} />
                        </Route>

                        {/* Protected routes with MainLayout */}
                        <Route element={<MainLayout />}>
                            <Route
                                path="/dashboard"
                                element={
                                    <ProtectedRoute>
                                        <Dashboard />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/settings"
                                element={
                                    <ProtectedRoute>
                                        <Settings />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/Analytics"
                                element={
                                    <ProtectedRoute>
                                        <Analytics />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/template-checker"
                                element={
                                    <ProtectedRoute>
                                        <TemplateChecker />
                                    </ProtectedRoute>
                                }
                            />

                            <Route
                                path="/AuthenticationChecker"
                                element={
                                    <ProtectedRoute>
                                        <AuthenticationChecker />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/Ipdomain-checker"
                                element={
                                    <ProtectedRoute>
                                        <Ipdomainchecker />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/Alert"
                                element={
                                    <ProtectedRoute>
                                        <Alert />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/admin/dashboard"
                                element={
                                    <AdminRoute>
                                        <AdminDashboard />
                                    </AdminRoute>
                                }
                            />

                            <Route
                                path="/superadmin/dashboard"
                                element={
                                    <SuperAdminRoute>
                                        <SuperAdminDashboard />
                                    </SuperAdminRoute>
                                }
                            />
                            <Route
                                path="/superadmin/oauth-callback"
                                element={
                                    <SuperAdminRoute>
                                        <AdminOAuthCallback />
                                    </SuperAdminRoute>
                                }
                            />
                        </Route>

                        {/* Fallback route */}
                        <Route path="*" element={<Navigate to="/login" replace />} />
                    </Routes>
                </Suspense>
            </AuthProvider>
        </Router>
    );
}

export default App;