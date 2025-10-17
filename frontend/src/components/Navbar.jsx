import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FiMenu,
    FiX,
    FiCreditCard,
    FiZap,
    FiSettings,
    FiLogOut,
    FiHelpCircle,
    FiDollarSign
} from 'react-icons/fi';
import { HiOutlineChevronDown } from 'react-icons/hi';

export default function Navbar() {
    const { user, logout } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const navigate = useNavigate();

    const profileRef = useRef(null);



    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (profileRef.current && !profileRef.current.contains(event.target)) {
                setProfileOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleLogout = () => {
        logout();
        setProfileOpen(false);
        navigate('/login');
    };

    // Common dropdown menu items
    const profileMenuItems = [
        { icon: <FiSettings className="w-4 h-4" />, label: 'Settings', path: '/settings' },
        { icon: <FiDollarSign className="w-4 h-4" />, label: 'Payment History', path: '/payment-history' },
        { icon: <FiHelpCircle className="w-4 h-4" />, label: 'Help Desk', path: '/help' },
        { icon: <FiLogOut className="w-4 h-4" />, label: 'Sign Out', action: handleLogout }
    ];

    // Buttons and small UI components
    const BuyCreditsButton = ({ mobile = false, variant = 'primary' }) => (
        <button
            className={`flex items-center justify-center space-x-2 font-semibold transition-all duration-200 ${mobile ? 'w-full py-3 rounded-lg text-sm' : 'px-4 py-2 rounded-lg text-sm'
                } ${variant === 'primary'
                    ? 'bg-gradient-to-r from-teal-800 to-teal-600 text-white shadow-md hover:shadow-lg hover:from-teal-500 to-teal-300'
                    : 'bg-gray-50 hover:bg-white text-gray-700 border border-gray-200 hover:border-gray-300'
                }`}
        >
            <FiZap className="w-4 h-4" />
            <span>Buy Credits</span>
            {!mobile && variant === 'primary' && (
                <div className="bg-teal px-1.5 py-0.5 rounded text-xs font-bold"></div>
            )}
        </button>
    );

    const CreditsDisplay = ({ mobile = false }) => (
        <div
            className={`flex items-center space-x-2 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200 ${mobile ? 'p-3' : 'px-3 py-2'
                }`}
        >
            <div className="p-1.5 bg-gradient-to-r from-teal-800 to-teal-600 rounded-md">
                <FiCreditCard className="w-3 h-3 text-white" />
            </div>
            <span className="text-gray-900 font-bold text-sm">1,250</span>
            <span className="text-blue-600 text-xs font-medium">credits</span>
        </div>
    );

    // Single dropdown for both user and guest
    const ProfileDropdown = () => {
        const { currentUser } = useAuth()

        return (
            <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50"
            >
                {/* Header Section */}
                <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-teal-800 to-teal-600 flex items-center justify-center text-white font-bold">
                            {currentUser?.name?.charAt(0)?.toUpperCase() || 'G'}
                        </div>
                        <div>
                            <p className="text-teal-900 font-bold text-sm">
                                {currentUser?.name || ''}

                            </p>
                        </div>
                    </div>
                </div>

                {/* Menu Items */}
                <div className="p-3">
                    <div className="space-y-1">
                        {profileMenuItems.map((item, index) => (
                            <div key={index}>
                                {item.path ? (
                                    <Link
                                        to={item.path}
                                        onClick={() => setProfileOpen(false)}
                                        className="flex items-center space-x-3 w-full px-3 py-2.5 text-sm text-gray-700 hover:bg-teal-50 hover:text-teal-700 rounded-lg transition-all duration-200 group border border-transparent hover:border-blue-100"
                                    >
                                        <div className="text-gray-500 group-hover:text-blue-600 transition-colors">
                                            {item.icon}
                                        </div>
                                        <span className="font-medium">{item.label}</span>
                                    </Link>
                                ) : (
                                    <button
                                        onClick={() => {
                                            item.action?.();
                                            setProfileOpen(false);
                                        }}
                                        className="flex items-center space-x-3 w-full px-3 py-2.5 text-sm text-gray-700 hover:bg-red-50 hover:text-red-700 rounded-lg transition-all duration-200 group border border-transparent hover:border-red-100"
                                    >
                                        <div className="text-gray-500 group-hover:text-red-600 transition-colors">
                                            {item.icon}
                                        </div>
                                        <span className="font-medium">{item.label}</span>
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </motion.div>
        )
    }



    // Mobile Menu
    const MobileMenuContent = () => (
        <div className="space-y-4">
            <CreditsDisplay mobile />
            <div className="grid grid-cols-1 gap-3">
                <BuyCreditsButton mobile />
            </div>
        </div>
    );

    const { currentUser } = useAuth()

    return (
        <>
            <nav className="fixed top-0 left-64 right-0 h-16 bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-200/60 z-40">
                <div className="h-full px-6">
                    <div className="flex items-center justify-end h-full">
                        <div className="flex items-center space-x-3" ref={profileRef}>
                            <BuyCreditsButton />
                            <CreditsDisplay />

                            {/* Profile Button */}
                            <div className="relative">
                                <button
                                    onClick={() => setProfileOpen(!profileOpen)}
                                    className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:text-gray-900 font-medium text-sm hover:bg-gray-50  rounded-lg transition-all duration-200 "
                                >
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-teal-800 to-teal-600 flex items-center justify-center text-white font-bold">
                                        {currentUser?.name?.charAt(0)?.toUpperCase() || 'G'}
                                    </div>
                                    <HiOutlineChevronDown
                                        className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''
                                            }`}
                                    />
                                </button>

                                <AnimatePresence>
                                    {profileOpen && <ProfileDropdown />}
                                </AnimatePresence>
                            </div>

                            {/* Mobile Menu Button */}
                            <button
                                onClick={() => setIsOpen(!isOpen)}
                                className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 border border-gray-200"
                            >
                                {isOpen ? (
                                    <FiX className="w-5 h-5 text-gray-600" />
                                ) : (
                                    <FiMenu className="w-5 h-5 text-gray-600" />
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Dropdown */}
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                            className="md:hidden absolute top-16 left-0 right-0 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-lg z-40"
                        >
                            <div className="p-4">
                                <MobileMenuContent />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </nav>

            {/* Spacer for fixed navbar */}
            <div className="h-16"></div>
        </>
    );
}
