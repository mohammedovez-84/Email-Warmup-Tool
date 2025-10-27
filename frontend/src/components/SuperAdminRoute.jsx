import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const SuperAdminRoute = ({ children }) => {
    const { currentUser, isLoading } = useAuth();

    if (isLoading) {
        return <div>Loading...</div>;
    }

    if (!currentUser || currentUser.role !== 'superadmin') {
        return <Navigate to="/login" />;
    }

    return children;
};

export default SuperAdminRoute;