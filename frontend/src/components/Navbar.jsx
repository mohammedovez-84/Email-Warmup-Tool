import { useState, useEffect, useRef, memo, useMemo, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    FiCreditCard,
    FiZap,
    FiSettings,
    FiLogOut,
    FiHelpCircle,
    FiDollarSign,
    FiUser,
    FiBell,
    FiHome
} from 'react-icons/fi';
import { HiOutlineChevronDown } from 'react-icons/hi';

const Navbar = memo(() => {
    const { logout, currentUser } = useAuth();
    const [profileOpen, setProfileOpen] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const profileRef = useRef(null);
    const notificationsRef = useRef(null);

    // Memoize user info
    const userInfo = useMemo(() => ({
        name: currentUser?.name || 'Guest User',
        email: currentUser?.email || 'guest@example.com',
        initial: (currentUser?.name?.charAt(0) || 'G').toUpperCase()
    }), [currentUser?.name, currentUser?.email]);

    // Memoize notifications data
    const notifications = useMemo(() => [
        { id: 1, title: 'Credit Purchase Successful', message: 'Your purchase of 500 credits was successful', time: '5 min ago', read: false },
        { id: 2, title: 'New Feature Available', message: 'Check out the new AI templates', time: '1 hour ago', read: true },
        { id: 3, title: 'Weekly Usage Report', message: 'You have used 230 credits this week', time: '2 days ago', read: true }
    ], []);

    // Memoize profile menu items (ONLY user-related items) - Profile removed
    const profileMenuItems = useMemo(() => [
        { icon: <FiSettings className="w-4 h-4" />, label: 'Settings', path: '/settings' },
        { icon: <FiDollarSign className="w-4 h-4" />, label: 'Billing & Payments', path: '/billing' },
        { icon: <FiHelpCircle className="w-4 h-4" />, label: 'Help & Support', path: '/help' },
    ], []);

    // Close dropdowns when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (profileRef.current && !profileRef.current.contains(event.target)) {
                setProfileOpen(false);
            }
            if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
                setNotificationsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleLogout = useCallback(() => {
        logout();
        setProfileOpen(false);
        navigate('/login');
    }, [logout, navigate]);

    const handleProfileToggle = useCallback(() => {
        setProfileOpen(prev => !prev);
        // Close other dropdowns when profile opens
        if (!profileOpen) {
            setNotificationsOpen(false);
        }
    }, [profileOpen]);

    const handleNotificationsToggle = useCallback(() => {
        setNotificationsOpen(prev => !prev);
        // Close other dropdowns when notifications open
        if (!notificationsOpen) {
            setProfileOpen(false);
        }
    }, [notificationsOpen]);

    // Buy Credits Button Component
    const BuyCreditsButton = memo(() => (
        <button
            onClick={() => navigate('/billing')}
            className="flex items-center justify-center space-x-2 font-medium transition-all duration-200 
                bg-gradient-to-r from-teal-800 to-teal-500 hover:from-teal-900 hover:to-teal-600
                text-white shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95
                px-3 py-2 md:px-4 md:py-2.5 rounded-lg md:rounded-xl text-xs md:text-sm font-sans"
        >
            <FiZap className="w-3 h-3 md:w-4 md:h-4" />
            <span>Buy Credits</span>
        </button>
    ));

    BuyCreditsButton.displayName = 'BuyCreditsButton';

    // Credits Display Component
    const CreditsDisplay = memo(() => (
        <div
            className="flex items-center bg-gradient-to-r from-teal-50 to-teal-100/80 rounded-lg md:rounded-xl border border-teal-200
                backdrop-blur-sm transition-all duration-300 cursor-pointer hover:shadow-md hover:scale-105
                px-3 py-2 md:px-4 md:py-2.5"
        >
            <div className="flex items-center space-x-2 md:space-x-3">
                <div className="p-1.5 md:p-2 bg-gradient-to-r from-teal-800 to-teal-500 rounded-md md:rounded-lg shadow-sm">
                    <FiCreditCard className="w-3 h-3 md:w-4 md:h-4 text-white" />
                </div>
                <div className="flex flex-col">
                    <span className="text-gray-900 font-semibold text-xs md:text-sm font-sans">1,250</span>
                    <span className="text-gray-600 text-xs font-medium font-sans">credits</span>
                </div>
            </div>
        </div>
    ));

    CreditsDisplay.displayName = 'CreditsDisplay';

    // Notifications Dropdown
    const NotificationsDropdown = memo(() => {
        const unreadCount = useMemo(() =>
            notifications.filter(n => !n.read).length,
            [notifications]);

        return (
            <div className="absolute right-0 top-full mt-2 w-72 md:w-80 bg-white rounded-xl shadow-xl border border-teal-200 overflow-hidden z-50 font-sans">
                {/* Header */}
                <div className="p-3 md:p-4 border-b border-teal-100 bg-white">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900 text-sm md:text-base">Notifications</h3>
                        {unreadCount > 0 && (
                            <span className="text-xs text-teal-600 font-medium bg-teal-50 px-2 py-1 rounded-full">
                                {unreadCount} new
                            </span>
                        )}
                    </div>
                </div>

                {/* Notifications List */}
                <div className="max-h-80 md:max-h-96 overflow-y-auto">
                    {notifications.length > 0 ? (
                        <div className="p-2">
                            {notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={`p-2 md:p-3 rounded-lg transition-colors duration-200 cursor-pointer ${notification.read
                                        ? 'bg-white hover:bg-gray-50'
                                        : 'bg-teal-50 hover:bg-teal-100'
                                        }`}
                                >
                                    <div className="flex items-start space-x-2 md:space-x-3">
                                        <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full mt-1.5 md:mt-2 ${notification.read ? 'bg-gray-300' : 'bg-teal-500'
                                            }`} />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-gray-900 text-xs md:text-sm">
                                                {notification.title}
                                            </p>
                                            <p className="text-gray-700 text-xs mt-0.5 md:mt-1">
                                                {notification.message}
                                            </p>
                                            <p className="text-gray-500 text-xs mt-1.5 md:mt-2">
                                                {notification.time}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-6 md:p-8 text-center">
                            <FiBell className="w-6 h-6 md:w-8 md:h-8 text-gray-300 mx-auto mb-2" />
                            <p className="text-gray-500 text-xs md:text-sm">No notifications</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-2 md:p-3 border-t border-teal-100 bg-gray-50">
                    <button className="w-full text-center text-gray-700 hover:text-gray-800 text-xs md:text-sm font-medium py-2 rounded hover:bg-gray-100 transition-colors duration-200">
                        View All Notifications
                    </button>
                </div>
            </div>
        );
    });

    NotificationsDropdown.displayName = 'NotificationsDropdown';

    // Profile Dropdown Component (Profile removed)
    const ProfileDropdown = memo(() => (
        <div className="absolute right-0 top-full mt-2 w-56 md:w-64 bg-white rounded-xl shadow-xl border border-teal-200 overflow-hidden z-50 font-sans">
            {/* Header Section */}
            <div className="p-3 md:p-4 border-b border-teal-100 bg-white">
                <div className="flex items-center space-x-2 md:space-x-3">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-md md:rounded-lg bg-gradient-to-r from-teal-800 to-teal-500 flex items-center justify-center text-white font-semibold text-xs">
                        {userInfo.initial}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-gray-900 font-semibold text-xs md:text-sm truncate">
                            {userInfo.name}
                        </p>
                        <p className="text-gray-600 text-xs truncate">
                            {userInfo.email}
                        </p>
                    </div>
                </div>
            </div>

            {/* Profile Menu Items - Profile removed */}
            <div className="p-1 md:p-2">
                <div className="space-y-0.5 md:space-y-1">
                    {profileMenuItems.map((item, index) => (
                        <Link
                            key={index}
                            to={item.path}
                            onClick={() => setProfileOpen(false)}
                            className="flex items-center space-x-2 md:space-x-3 w-full px-2 md:px-3 py-2 md:py-2.5 text-xs md:text-sm text-gray-900 hover:bg-teal-50 hover:text-gray-800 rounded-lg transition-colors duration-200"
                        >
                            <div className="text-gray-600">
                                {item.icon}
                            </div>
                            <span className="font-medium">{item.label}</span>
                        </Link>
                    ))}
                </div>
            </div>

            {/* Sign Out Section */}
            <div className="p-1 md:p-2 border-t border-teal-100">
                <button
                    onClick={handleLogout}
                    className="flex items-center space-x-2 md:space-x-3 w-full px-2 md:px-3 py-2 md:py-2.5 text-xs md:text-sm text-gray-900 hover:bg-red-50 hover:text-red-700 rounded-lg transition-colors duration-200"
                >
                    <FiLogOut className="w-3 h-3 md:w-4 md:h-4 text-gray-600" />
                    <span className="font-medium">Sign Out</span>
                </button>
            </div>
        </div>
    ));

    ProfileDropdown.displayName = 'ProfileDropdown';

    const unreadNotifications = useMemo(() =>
        notifications.filter(n => !n.read).length,
        [notifications]);

    return (
        <>
            <nav className="fixed top-0 left-0 lg:left-64 xl:left-72 right-0 h-14 md:h-16 bg-white shadow-sm border-b border-teal-200 z-30 font-sans">
                <div className="h-full px-3 md:px-4 lg:px-6">
                    <div className="flex items-center justify-between h-full">
                        {/* Left Section - Breadcrumb */}
                        <div className="flex items-center space-x-2 md:space-x-4">
                            {/* Breadcrumb */}
                            <div className="flex items-center space-x-1 md:space-x-2">
                                <FiHome className="w-3 h-3 md:w-4 md:h-4 text-gray-600" />
                                <span className="text-xs md:text-sm text-gray-500">/</span>
                                <span className="text-xs md:text-sm font-medium text-gray-900 capitalize font-sans">
                                    {location.pathname.split('/')[1] || 'Dashboard'}
                                </span>
                            </div>
                        </div>

                        {/* Right Section - Navigation Items */}
                        <div className="flex items-center space-x-2 md:space-x-3">
                            {/* Notifications */}
                            <div className="relative" ref={notificationsRef}>
                                <button
                                    onClick={handleNotificationsToggle}
                                    className="relative p-1.5 md:p-2 rounded-lg hover:bg-teal-50 transition-colors duration-200 text-gray-700"
                                >
                                    <FiBell className="w-4 h-4 md:w-5 md:h-5" />
                                    {unreadNotifications > 0 && (
                                        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 md:w-4 md:h-4 bg-teal-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                                            {unreadNotifications}
                                        </span>
                                    )}
                                </button>
                                {notificationsOpen && <NotificationsDropdown />}
                            </div>

                            {/* Desktop Items */}
                            <div className="hidden lg:flex items-center space-x-2 md:space-x-3">
                                <BuyCreditsButton />
                                <CreditsDisplay />
                            </div>

                            {/* Profile Button */}
                            <div className="relative" ref={profileRef}>
                                <button
                                    onClick={handleProfileToggle}
                                    className="flex items-center space-x-1 md:space-x-2 px-2 md:px-3 py-1.5 md:py-2 text-gray-900 hover:bg-teal-50 rounded-lg transition-colors duration-200 border border-teal-200"
                                >
                                    <div className="w-6 h-6 md:w-8 md:h-8 rounded-md bg-gradient-to-r from-teal-800 to-teal-500 flex items-center justify-center text-white font-semibold text-xs">
                                        {userInfo.initial}
                                    </div>
                                    <HiOutlineChevronDown
                                        className={`w-3 h-3 md:w-4 md:h-4 text-gray-600 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''
                                            }`}
                                    />
                                </button>

                                {profileOpen && <ProfileDropdown />}
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Spacer for fixed navbar */}
            <div className="h-14 md:h-16"></div>
        </>
    );
});

Navbar.displayName = 'Navbar';

export default Navbar;