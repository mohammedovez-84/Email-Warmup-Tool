import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { memo } from 'react';

const MainLayout = memo(() => {
    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            {/* Fixed Sidebar */}
            <Sidebar />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 lg:ml-72">
                {/* Fixed Navbar */}
                <Navbar />

                {/* Main Content */}
                <main className="flex-1 overflow-auto bg-gray-50/50">
                    <div className="max-w-full mx-auto p-4 lg:p-8">
                        <Outlet />
                    </div>
                </main>

                {/* Footer */}
                <footer className="bg-white border-t border-gray-200 py-6">
                    <div className="max-w-full mx-auto px-4 lg:px-8">
                        <Footer />
                    </div>
                </footer>
            </div>
        </div>
    );
});

MainLayout.displayName = 'MainLayout';

export default MainLayout;