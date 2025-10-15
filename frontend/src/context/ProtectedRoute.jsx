// // ProtectedRoute.jsx
// import { Navigate, Outlet } from 'react-router-dom';
// import { useAuth } from '../context/AuthContext';

// export default function ProtectedRoute() {
//     const { currentUser, isLoading } = useAuth();

//     if (isLoading) {
//         return <div className="flex justify-center items-center h-screen">Loading...</div>;
//     }

//     return currentUser ? <Outlet /> : <Navigate to="/login" replace />;
// }

import { Navigate } from 'react-router-dom';


export default function ProtectedRoute({ isAuthenticated, isLoading, children }) {
    if (isLoading) {
        return <div className="flex justify-center items-center h-screen">Loading...</div>;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return children;
}


