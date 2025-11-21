import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { memo } from 'react';

const MainLayout = memo(() => {
    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            {/* Sidebar */}
            <Sidebar />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Navbar */}
                <Navbar />

                {/* Main Content */}
                <main className="flex-1 overflow-auto bg-gray-50">
                    <div className="max-w-full mx-auto p-4 lg:p-6">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
});

MainLayout.displayName = 'MainLayout';

export default MainLayout;