import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FiMenu,
    FiX,
    FiUser,
    FiSettings,
    FiLogOut,
    FiHelpCircle,
    FiBarChart2,
    FiLayers,
    FiPieChart,
    FiZap,
    FiCreditCard
} from 'react-icons/fi';
import { HiOutlineChevronDown } from 'react-icons/hi';

export default function Navbar() {
    const { user, logout } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [hoveredItem, setHoveredItem] = useState(null);
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

    const profileMenuItems = [
        { icon: <FiUser className="w-4 h-4" />, label: 'Profile', path: '/profile' },
        { icon: <FiSettings className="w-4 h-4" />, label: 'Settings', path: '/settings' },
        { icon: <FiHelpCircle className="w-4 h-4" />, label: 'Help', path: '/help' },
        { icon: <FiLogOut className="w-4 h-4" />, label: 'Logout', action: handleLogout }
    ];


    return (
        <>
            <nav className="fixed top-0 left-64 right-0 h-16 bg-gradient-to-r from-slate-900 to-teal-600 shadow-lg border-b border-white/10 z-40 transition-all duration-300 hover:shadow-xl">
                <div className="h-full px-8">
                    <div className="flex items-center justify-between h-full">
                        {/* Right Section - User Profile or Auth */}
                        <div className="flex items-center space-x-4">
                            {user ? (
                                <div className="hidden md:flex items-center h-full" ref={profileRef}>
                                    <div className="relative h-full flex items-center">
                                        <button
                                            onClick={() => setProfileOpen(!profileOpen)}
                                            className="flex items-center space-x-2 px-3 py-2 rounded-full hover:bg-white/10 transition-all duration-200 group"
                                        >
                                            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-semibold group-hover:bg-white/30 transition-colors duration-200">
                                                {user.name.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="text-white font-medium text-sm">
                                                {user.name.split(' ')[0]}
                                            </span>
                                            <HiOutlineChevronDown
                                                className={`w-4 h-4 text-white/70 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''
                                                    }`}
                                            />
                                        </button>

                                        <AnimatePresence>
                                            {profileOpen && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                    transition={{ duration: 0.2 }}
                                                    className="absolute right-0 top-full mt-2 w-64 bg-white/95 backdrop-blur-lg rounded-xl shadow-2xl border border-white/20 overflow-hidden"
                                                >
                                                    {/* Profile Header */}
                                                    <div className="p-4 border-b border-gray-200/50 bg-gradient-to-r from-slate-900/95 to-teal-600/95">
                                                        <p className="text-white font-semibold text-sm truncate">
                                                            {user.name}
                                                        </p>
                                                        <p className="text-white/70 text-xs truncate mt-1">
                                                            {user.email}
                                                        </p>
                                                    </div>

                                                    {/* Menu Items */}
                                                    <div className="p-2">
                                                        {profileMenuItems.map((item, index) => (
                                                            <motion.div
                                                                key={index}
                                                                initial={{ x: -10, opacity: 0 }}
                                                                animate={{ x: 0, opacity: 1 }}
                                                                transition={{ delay: index * 0.05 }}
                                                            >
                                                                {item.path ? (
                                                                    <Link
                                                                        to={item.path}
                                                                        onClick={() => setProfileOpen(false)}
                                                                        className="flex items-center space-x-3 w-full px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100/80 rounded-lg transition-all duration-200 group"
                                                                    >
                                                                        <div className="text-gray-600 group-hover:text-teal-600 transition-colors duration-200">
                                                                            {item.icon}
                                                                        </div>
                                                                        <span className="font-medium">{item.label}</span>
                                                                    </Link>
                                                                ) : (
                                                                    <button
                                                                        onClick={item.action}
                                                                        className="flex items-center space-x-3 w-full px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100/80 rounded-lg transition-all duration-200 group"
                                                                    >
                                                                        <div className="text-gray-600 group-hover:text-red-600 transition-colors duration-200">
                                                                            {item.icon}
                                                                        </div>
                                                                        <span className="font-medium">{item.label}</span>
                                                                    </button>
                                                                )}
                                                            </motion.div>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            ) : (
                                <div className="hidden md:flex items-center space-x-4">
                                    {/* {publicMenuItems.map((item, index) => (
                                        <Link
                                            key={index}
                                            to={item.path}
                                            className="flex items-center space-x-1 text-white/90 hover:text-white transition-colors duration-200 text-sm font-medium px-3 py-2 rounded-lg hover:bg-white/10"
                                        >
                                            {item.icon}
                                            <span>{item.label}</span>
                                        </Link>
                                    ))} */}
                                    <Link
                                        to="/login"
                                        className="bg-white text-slate-900 hover:bg-gray-100 px-4 py-2 rounded-lg font-semibold text-sm shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
                                    >
                                        Get Started
                                    </Link>
                                </div>
                            )}

                            {/* Mobile Menu Button */}
                            <button
                                onClick={() => setIsOpen(!isOpen)}
                                className="md:hidden p-2 rounded-lg hover:bg-white/10 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white/50"
                            >
                                {isOpen ? (
                                    <FiX className="w-6 h-6 text-white" />
                                ) : (
                                    <FiMenu className="w-6 h-6 text-white" />
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Menu */}
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                            className="md:hidden absolute top-16 left-0 right-0 bg-gradient-to-b from-slate-900 to-teal-700/95 backdrop-blur-lg border-b border-white/10 shadow-2xl"
                        >
                            <div className="p-6 space-y-4">
                                {user ? (
                                    <>
                                        {/* User Menu Items */}
                                        <div className="space-y-2">
                                            {userMenuItems.map((item, index) => (
                                                <motion.div
                                                    key={index}
                                                    initial={{ x: 20, opacity: 0 }}
                                                    animate={{ x: 0, opacity: 1 }}
                                                    transition={{ delay: index * 0.1 }}
                                                >
                                                    <MobileNavLink
                                                        to={item.path}
                                                        icon={item.icon}
                                                        label={item.label}
                                                        setIsOpen={setIsOpen}
                                                    />
                                                </motion.div>
                                            ))}
                                        </div>

                                        {/* User Profile Section */}
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: userMenuItems.length * 0.1 }}
                                            className="pt-4 border-t border-white/20"
                                        >
                                            <div className="flex items-center space-x-3 p-3 bg-white/10 rounded-xl mb-3">
                                                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-semibold">
                                                    {user.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-white font-semibold text-sm truncate">
                                                        {user.name}
                                                    </p>
                                                    <p className="text-white/70 text-xs truncate">
                                                        {user.email}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                {profileMenuItems.map((item, index) => (
                                                    <motion.div
                                                        key={index}
                                                        initial={{ x: 20, opacity: 0 }}
                                                        animate={{ x: 0, opacity: 1 }}
                                                        transition={{ delay: (userMenuItems.length + index) * 0.1 }}
                                                    >
                                                        {item.path ? (
                                                            <Link
                                                                to={item.path}
                                                                onClick={() => setIsOpen(false)}
                                                                className="flex items-center space-x-3 w-full px-4 py-3 text-white/90 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200 group"
                                                            >
                                                                <div className="text-white/70 group-hover:text-white transition-colors duration-200">
                                                                    {item.icon}
                                                                </div>
                                                                <span className="font-medium">{item.label}</span>
                                                            </Link>
                                                        ) : (
                                                            <button
                                                                onClick={() => {
                                                                    item.action();
                                                                    setIsOpen(false);
                                                                }}
                                                                className="flex items-center space-x-3 w-full px-4 py-3 text-white/90 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200 group"
                                                            >
                                                                <div className="text-white/70 group-hover:text-red-300 transition-colors duration-200">
                                                                    {item.icon}
                                                                </div>
                                                                <span className="font-medium">{item.label}</span>
                                                            </button>
                                                        )}
                                                    </motion.div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    </>
                                ) : (
                                    <>
                                    </>
                                )}
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

// Desktop NavLink Component
function NavLink({ to, icon, label, isHovered, onMouseEnter, onMouseLeave }) {
    return (
        <Link
            to={to}
            className="relative flex items-center space-x-2 px-4 py-2 text-white/90 hover:text-white transition-colors duration-200 group"
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            <div className="flex items-center space-x-2">
                <div className="text-white/70 group-hover:text-white transition-colors duration-200">
                    {icon}
                </div>
                <span className="font-medium text-sm">{label}</span>
            </div>

            {/* Animated underline */}
            <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-transparent group-hover:bg-white/50 transition-all duration-300">
                {isHovered && (
                    <motion.div
                        className="h-full bg-white"
                        layoutId="navHover"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        exit={{ scaleX: 0 }}
                        transition={{ duration: 0.3 }}
                    />
                )}
            </div>
        </Link>
    );
}

// Mobile NavLink Component
function MobileNavLink({ to, icon, label, setIsOpen }) {
    return (
        <Link
            to={to}
            onClick={() => setIsOpen(false)}
            className="flex items-center space-x-3 w-full px-4 py-3 text-white/90 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200 group"
        >
            <div className="text-white/70 group-hover:text-white transition-colors duration-200">
                {icon}
            </div>
            <span className="font-medium">{label}</span>
        </Link>
    );
}