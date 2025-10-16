import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const MainLayout = () => {
    return (
        <div className="flex h-screen bg-gray-50">
            {/* Sidebar */}
            <div className="w-64 bg-white shadow-lg z-10">
                <Sidebar />
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Navbar */}
                <header className="bg-white shadow-sm z-10">
                    <Navbar />
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-auto  ">
                    <div className="lg:max-w-[95%] mx-auto">
                        <Outlet />
                    </div>
                </main>

                {/* Footer */}
                <footer className="bg-white border-t border-gray-200 py-4">
                    <div className="max-w-7xl mx-auto px-6">
                        <Footer />
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default MainLayout;