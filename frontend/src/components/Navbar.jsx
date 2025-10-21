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
    FiMenu,
    FiX,
    FiUser,
    FiBell,
    FiHome
} from 'react-icons/fi';
import { HiOutlineChevronDown } from 'react-icons/hi';

const Navbar = memo(() => {
    const { user, logout, currentUser } = useAuth();
    const [profileOpen, setProfileOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const profileRef = useRef(null);
    const mobileMenuRef = useRef(null);
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

    // Memoize profile menu items
    const profileMenuItems = useMemo(() => [
        { icon: <FiUser className="w-4 h-4" />, label: 'Profile', path: '/profile' },
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
            if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target)) {
                setMobileMenuOpen(false);
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
        setMobileMenuOpen(false);
        navigate('/login');
    }, [logout, navigate]);

    const handleMobileMenuToggle = () => {
        setMobileMenuOpen(!mobileMenuOpen);
    };

    // Buy Credits Button Component
    const BuyCreditsButton = memo(({ mobile = false }) => (
        <button
            className={`flex items-center justify-center space-x-2 font-semibold transition-all duration-300 
                bg-gradient-to-r from-[#0B1E3F] to-[#008080] hover:from-[#0A2A5A] hover:to-[#009999] 
                text-white shadow-lg hover:shadow-xl
                ${mobile
                    ? 'w-full py-4 rounded-xl text-sm border border-teal-500/30'
                    : 'px-6 py-3 rounded-xl text-sm border border-teal-500/30'
                }`}
        >
            <FiZap className="w-4 h-4" />
            <span>Buy Credits</span>
        </button>
    ));

    BuyCreditsButton.displayName = 'BuyCreditsButton';

    // Credits Display Component
    const CreditsDisplay = memo(({ mobile = false }) => (
        <div
            className={`flex items-center bg-gradient-to-r from-teal-50/80 to-teal-50/60 
                rounded-xl border border-teal-200/50 backdrop-blur-sm
                ${mobile ? 'p-3 justify-between' : 'px-4 py-3'}`}
        >
            <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-r from-[#0B1E3F] to-[#008080] rounded-lg shadow-sm">
                    <FiCreditCard className="w-4 h-4 text-white" />
                </div>
                <div className="flex flex-col">
                    <span className="text-gray-900 font-semibold text-sm">1,250</span>
                    <span className="text-teal-600 text-xs">available credits</span>
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
            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-teal-200/80 overflow-hidden z-50">
                {/* Header */}
                <div className="p-4 border-b border-teal-100 bg-gradient-to-r from-teal-50 to-white">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">Notifications</h3>
                        <span className="text-xs text-[#008080] font-medium bg-teal-50 px-2 py-1 rounded-full">
                            {unreadCount} new
                        </span>
                    </div>
                </div>

                {/* Notifications List */}
                <div className="max-h-96 overflow-y-auto">
                    {notifications.length > 0 ? (
                        <div className="p-2">
                            {notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={`p-3 rounded-xl transition-all duration-300 cursor-pointer border ${notification.read
                                        ? 'bg-white border-transparent hover:border-teal-200'
                                        : 'bg-teal-50/50 border-teal-200/50 hover:border-teal-300'
                                        }`}
                                >
                                    <div className="flex items-start space-x-3">
                                        <div
                                            className={`w-2 h-2 rounded-full mt-2 ${notification.read ? 'bg-gray-300' : 'bg-[#008080]'
                                                }`}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-gray-900 text-sm">
                                                {notification.title}
                                            </p>
                                            <p className="text-gray-600 text-xs mt-1">
                                                {notification.message}
                                            </p>
                                            <p className="text-gray-400 text-xs mt-2">
                                                {notification.time}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-8 text-center">
                            <FiBell className="w-8 h-8 text-teal-300 mx-auto mb-2" />
                            <p className="text-teal-600 text-sm">No notifications</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-teal-100 bg-teal-50/50">
                    <button className="w-full text-center text-[#008080] hover:text-[#0B1E3F] text-sm font-medium py-2 rounded-lg hover:bg-teal-50 transition-all duration-300">
                        View All Notifications
                    </button>
                </div>
            </div>
        );
    });

    NotificationsDropdown.displayName = 'NotificationsDropdown';

    // Profile Dropdown Component
    const ProfileDropdown = memo(() => (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-teal-200/80 overflow-hidden z-50">
            {/* Header Section */}
            <div className="p-4 border-b border-teal-100 bg-gradient-to-r from-teal-50 to-white">
                <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-[#0B1E3F] to-[#008080] flex items-center justify-center text-white font-semibold text-lg shadow-lg">
                        {userInfo.initial}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-gray-900 font-semibold text-sm truncate">
                            {userInfo.name}
                        </p>
                        <p className="text-teal-600 text-xs truncate">
                            {userInfo.email}
                        </p>
                    </div>
                </div>
            </div>

            {/* Menu Items */}
            <div className="p-2">
                <div className="space-y-1">
                    {profileMenuItems.map((item, index) => (
                        <div key={index}>
                            {item.path ? (
                                <Link
                                    to={item.path}
                                    onClick={() => setProfileOpen(false)}
                                    className="flex items-center space-x-3 w-full px-3 py-3 text-sm text-gray-700 hover:bg-teal-50 hover:text-[#008080] rounded-xl transition-all duration-300 group border border-transparent hover:border-teal-100"
                                >
                                    <div className="text-gray-400 group-hover:text-[#008080] transition-colors">
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
                                    className="flex items-center space-x-3 w-full px-3 py-3 text-sm text-gray-700 hover:bg-red-50 hover:text-red-700 rounded-xl transition-all duration-300 group border border-transparent hover:border-red-100"
                                >
                                    <div className="text-gray-400 group-hover:text-red-600 transition-colors">
                                        {item.icon}
                                    </div>
                                    <span className="font-medium">{item.label}</span>
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Sign Out Section */}
            <div className="p-3 border-t border-teal-100 bg-teal-50/50">
                <button
                    onClick={handleLogout}
                    className="flex items-center space-x-3 w-full px-3 py-3 text-sm text-gray-700 hover:bg-red-50 hover:text-red-700 rounded-xl transition-all duration-300 group border border-transparent hover:border-red-100"
                >
                    <FiLogOut className="w-4 h-4 text-gray-400 group-hover:text-red-600 transition-colors" />
                    <span className="font-medium">Sign Out</span>
                </button>
            </div>
        </div>
    ));

    ProfileDropdown.displayName = 'ProfileDropdown';

    // Mobile Menu Component
    const MobileMenu = memo(() => (
        <div className="fixed inset-0 z-50 lg:hidden" ref={mobileMenuRef}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleMobileMenuToggle} />
            <div className="absolute right-0 top-0 bottom-0 w-80 bg-white/95 backdrop-blur-xl shadow-2xl border-l border-teal-200/60">
                {/* Mobile Menu Header */}
                <div className="flex items-center justify-between p-6 border-b border-teal-200/60 bg-gradient-to-r from-teal-50 to-white/50">
                    <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-[#0B1E3F] to-[#008080] flex items-center justify-center text-white font-semibold text-lg shadow-lg">
                            {userInfo.initial}
                        </div>
                        <div>
                            <p className="text-gray-900 font-semibold text-sm">
                                {userInfo.name}
                            </p>
                            <p className="text-teal-600 text-xs">
                                {userInfo.email}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleMobileMenuToggle}
                        className="p-2 rounded-xl hover:bg-teal-100 transition-colors duration-300"
                    >
                        <FiX className="w-5 h-5 text-teal-600" />
                    </button>
                </div>

                {/* Mobile Menu Content */}
                <div className="p-6 space-y-6 h-full overflow-y-auto">
                    <CreditsDisplay mobile />
                    <BuyCreditsButton mobile />

                    <div className="space-y-2">
                        {profileMenuItems.map((item, index) => (
                            <div key={index}>
                                {item.path ? (
                                    <Link
                                        to={item.path}
                                        onClick={handleMobileMenuToggle}
                                        className="flex items-center space-x-3 w-full px-4 py-3.5 text-sm text-gray-700 hover:bg-teal-50 hover:text-[#008080] rounded-xl transition-all duration-300 group border border-transparent hover:border-teal-100"
                                    >
                                        <div className="text-gray-400 group-hover:text-[#008080] transition-colors">
                                            {item.icon}
                                        </div>
                                        <span className="font-medium">{item.label}</span>
                                    </Link>
                                ) : null}
                            </div>
                        ))}

                        <button
                            onClick={handleLogout}
                            className="flex items-center space-x-3 w-full px-4 py-3.5 text-sm text-gray-700 hover:bg-red-50 hover:text-red-700 rounded-xl transition-all duration-300 group border border-transparent hover:border-red-100"
                        >
                            <FiLogOut className="w-4 h-4 text-gray-400 group-hover:text-red-600 transition-colors" />
                            <span className="font-medium">Sign Out</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    ));

    MobileMenu.displayName = 'MobileMenu';

    const unreadNotifications = useMemo(() =>
        notifications.filter(n => !n.read).length,
        [notifications]);

    return (
        <>
            <nav className="fixed top-0 left-72 right-0 h-20 bg-white/80 backdrop-blur-xl shadow-lg border-b border-teal-200/60 z-30">
                <div className="h-full px-6 lg:px-8">
                    <div className="flex items-center justify-between h-full">
                        {/* Left Section - Mobile Menu Button and Breadcrumb */}
                        <div className="flex items-center space-x-4">
                            {/* Mobile Menu Button */}
                            <button
                                onClick={handleMobileMenuToggle}
                                className="lg:hidden p-3 rounded-xl hover:bg-teal-100 transition-all duration-300 border border-teal-200/60"
                            >
                                <FiMenu className="w-5 h-5 text-teal-600" />
                            </button>

                            {/* Breadcrumb */}
                            <div className="hidden lg:flex items-center space-x-2">
                                <FiHome className="w-4 h-4 text-teal-600" />
                                <span className="text-sm text-gray-500">/</span>
                                <span className="text-sm font-medium text-gray-900 capitalize">
                                    {location.pathname.split('/')[1] || 'Dashboard'}
                                </span>
                            </div>
                        </div>

                        {/* Right Section - Navigation Items */}
                        <div className="flex items-center space-x-4" ref={profileRef}>
                            {/* Notifications */}
                            <div className="relative" ref={notificationsRef}>
                                <button
                                    onClick={() => setNotificationsOpen(!notificationsOpen)}
                                    className="relative p-3 rounded-xl hover:bg-teal-100 transition-all duration-300 border border-teal-200/60 text-teal-600 hover:text-teal-900"
                                >
                                    <FiBell className="w-5 h-5" />
                                    {unreadNotifications > 0 && (
                                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#008080] text-white text-xs rounded-full flex items-center justify-center font-semibold border-2 border-white">
                                            {unreadNotifications}
                                        </span>
                                    )}
                                </button>
                                {notificationsOpen && <NotificationsDropdown />}
                            </div>

                            {/* Desktop Only Items */}
                            <div className="hidden lg:flex items-center space-x-4">
                                <BuyCreditsButton />
                                <CreditsDisplay />
                            </div>

                            {/* Profile Button */}
                            <div className="relative">
                                <button
                                    onClick={() => setProfileOpen(!profileOpen)}
                                    className="flex items-center space-x-3 px-4 py-3 text-gray-700 hover:text-gray-900 font-medium text-sm hover:bg-teal-50 rounded-xl transition-all duration-300 border border-teal-200/60 hover:border-teal-300"
                                >
                                    <div className="w-9 h-9 rounded-xl bg-gradient-to-r from-[#0B1E3F] to-[#008080] flex items-center justify-center text-white font-semibold text-sm shadow-sm">
                                        {userInfo.initial}
                                    </div>
                                    <HiOutlineChevronDown
                                        className={`w-4 h-4 text-teal-600 transition-transform duration-300 ${profileOpen ? 'rotate-180' : ''
                                            }`}
                                    />
                                </button>

                                {profileOpen && <ProfileDropdown />}
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Mobile Menu */}
            {mobileMenuOpen && <MobileMenu />}

            {/* Spacer for fixed navbar */}
            <div className="h-20"></div>
        </>
    );
});

Navbar.displayName = 'Navbar';

export default Navbar;