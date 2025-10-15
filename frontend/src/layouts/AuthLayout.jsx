import { Outlet } from 'react-router-dom';
import React from 'react';

const AuthLayout = () => {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <Outlet />
        </div>
    );
};

export default AuthLayout;