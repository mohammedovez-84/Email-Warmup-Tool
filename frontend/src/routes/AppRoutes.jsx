// import { lazy } from 'react'
// import ProtectedRoute from './components/ProtectedRoute'

// const Login = lazy(() => import('./components/Auth/Login'))
// const Signup = lazy(() => import('./components/Auth/Signup'))
// const ForgotPassword = lazy(() => import('./components/Auth/ForgotPassword'))
// const ResetPassword = lazy(() => import('./components/Auth/ResetPassword'))
// const Dashboard = lazy(() => import('./pages/Dashboard'))
// const Analytics = lazy(() => import('./components/Analytics'))
// const Campaigns = lazy(() => import('./pages/Campaigns'))
// const Settings = lazy(() => import('./pages/Settings'))

// const AppRoutes = (isAuthenticated) => [
//     {
//         path: '/login',
//         element: !isAuthenticated ? <Login /> : <Navigate to="/dashboard" />,
//     },
//     {
//         path: '/signup',
//         element: !isAuthenticated ? <Signup /> : <Navigate to="/dashboard" />,
//     },
//     {
//         path: '/forgot-password',
//         element: !isAuthenticated ? <ForgotPassword /> : <Navigate to="/dashboard" />,
//     },
//     {
//         path: '/reset-password/:token',
//         element: !isAuthenticated ? <ResetPassword /> : <Navigate to="/dashboard" />,
//     },
//     {
//         path: '/dashboard',
//         element: <ProtectedRoute isAuthenticated={isAuthenticated}><Dashboard /></ProtectedRoute>,
//     },
//     {
//         path: '/analytics',
//         element: <ProtectedRoute isAuthenticated={isAuthenticated}><Analytics /></ProtectedRoute>,
//     },
//     {
//         path: '/analytics',
//         element: <ProtectedRoute isAuthenticated={isAuthenticated}><Analytics /></ProtectedRoute>,
//     },
//     {
//         path: '/campaigns',
//         element: <ProtectedRoute isAuthenticated={isAuthenticated}><Campaigns /></ProtectedRoute>,
//     },
//     {
//         path: '/settings',
//         element: <ProtectedRoute isAuthenticated={isAuthenticated}><Settings /></ProtectedRoute>,
//     },
//     {
//         path: '/',
//         element: <Navigate to={isAuthenticated ? '/dashboard' : '/login'} />,
//     },
//     {
//         path: '*',
//         element: <Navigate to={isAuthenticated ? '/dashboard' : '/login'} />,
//     }
// ]

// export default AppRoutes
import { lazy } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

const Login = lazy(() => import('./components/Auth/Login'));
const Signup = lazy(() => import('./components/Auth/Signup'));
const ForgotPassword = lazy(() => import('./components/Auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./components/Auth/ResetPassword'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Analytics = lazy(() => import('./components/Analytics'));
const TemplateChecker = lazy(() => import('./pages/TemplateChecker'));
const Ipdomainchecker = lazy(() => import("./pages/Ipdomain-checker"));
const Settings = lazy(() => import('./pages/Settings'));

export default function AppRoutes() {
  const { currentUser, isLoading } = useAuth();
  const isAuthenticated = !!currentUser;

  return [
    // Public routes
    {
      path: '/login',
      element: isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />,
    },
    {
      path: '/signup',
      element: isAuthenticated ? <Navigate to="/dashboard" replace /> : <Signup />,
    },
    {
      path: '/forgot-password',
      element: isAuthenticated ? <Navigate to="/dashboard" replace /> : <ForgotPassword />,
    },
    {
      path: '/reset-password/:token',
      element: isAuthenticated ? <Navigate to="/dashboard" replace /> : <ResetPassword />,
    },

    // Protected routes
    {
      path: '/dashboard',
      element: (
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      ),
    },
    {
      path: '/Analytics',
      element: (
        <ProtectedRoute>
          <Analytics />
        </ProtectedRoute>
      ),
    },
    {
      path: '/TemplateChecker',
      element: (
        <ProtectedRoute>
          <TemplateChecker />
        </ProtectedRoute>
      ),
    },
    {
      path: '/Ipdomain-checker',
      element: (
        <ProtectedRoute>
          <Ipdomainchecker />
        </ProtectedRoute>
      ),
    },
    {
      path: '/Alert',
      element: (
        <ProtectedRoute>
          <Alert />
        </ProtectedRoute>
      ),
    },
    {
      path: '/settings',
      element: (
        <ProtectedRoute>
          <Settings />
        </ProtectedRoute>
      ),
    },

    // Redirect root
    {
      path: '/',
      element: <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />,
    },

    // Catch-all
    {
      path: '*',
      element: <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />,
    },
  ];
}


