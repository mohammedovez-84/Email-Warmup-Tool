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
    FiMail,
    FiBarChart2,
    FiLayers,
    FiPieChart,
    FiSend,
    FiZap,
    FiDollarSign,
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
        { icon: <FiUser className="mr-2" />, label: 'Profile', path: '/profile' },
        { icon: <FiSettings className="mr-2" />, label: 'Settings', path: '/settings' },
        { icon: <FiHelpCircle className="mr-2" />, label: 'Help', path: '/help' },
        { icon: <FiLogOut className="mr-2" />, label: 'Logout', action: handleLogout }
    ];

    const publicMenuItems = [
        { icon: <FiZap className="mr-2" />, label: 'Features', path: '/features' },
        { icon: <FiCreditCard className="mr-2" />, label: 'Credits', path: '/credits' },
    ];

    const userMenuItems = [
        { icon: <FiPieChart className="mr-2" />, label: 'Dashboard', path: '/dashboard' },
        { icon: <FiLayers className="mr-2" />, label: 'Pool Manager', path: '/pool-manager' },
        { icon: <FiBarChart2 className="mr-2" />, label: 'Analytics', path: '/analytics' },
        // { icon: <FiSend className="mr-2" />, label: 'Campaigns', path: '/campaigns' }
    ];

    return (
        <>
            <style>{`
                .navbar {
                    background: linear-gradient(to right, #0B1E3F 0%, #008080 100%);
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
                    position: sticky;
                    top: 0;
                    z-index: 40;
                    margin-left: 240px;
                    width: calc(100% - 240px);
                    height: 64px;
                    transition: all 0.3s ease;
                }

                .navbar:hover {
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08);
                }

                .navbar-container {
                    max-width: 100%;
                    padding: 0 2rem;
                    height: 100%;
                }

                .navbar-inner {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    height: 100%;
                    position: relative;
                }

                .logo-container {
                    display: none;
                }

                .desktop-nav {
                    display: none;
                    align-items: center;
                    height: 100%;
                }

                .nav-left {
                    display: flex;
                    align-items: center;
                    height: 100%;
                }

                .nav-right {
                    display: flex;
                    align-items: center;
                    height: 100%;
                    margin-left: auto;
                }

                .nav-link {
                    display: flex;
                    align-items: center;
                    padding: 0 1.25rem;
                    font-size: 0.875rem;
                    font-weight: 500;
                    color: rgba(255, 255, 255, 0.9);
                    transition: all 0.2s ease;
                    text-decoration: none;
                    height: 100%;
                    position: relative;
                }

                .nav-link:hover {
                    color: white;
                }

                .nav-link::after {
                    content: '';
                    position: absolute;
                    right: 1rem;
                    bottom: 1rem;
                    left: 1rem;
                    height: 2px;
                    background: white;
                    transform: scaleX(0);
                    transform-origin: right;
                    transition: transform 0.3s ease;
                }

                .nav-link:hover::after {
                    transform: scaleX(1);
                    transform-origin: left;
                }

                .profile-dropdown {
                    margin-left: 1rem;
                    position: relative;
                    height: 100%;
                    display: flex;
                    align-items: center;
                }

                .profile-button {
                    display: flex;
                    align-items: center;
                    font-size: 0.875rem;
                    border-radius: 9999px;
                    outline: none;
                    text-decoration: none;
                    padding: 0.25rem;
                    height: 100%;
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    color: white;
                }

                .profile-button:hover {
                    background: rgba(255, 255, 255, 0.1);
                }

                .profile-avatar {
                    height: 2.25rem;
                    width: 2.25rem;
                    border-radius: 9999px;
                    background: rgba(255, 255, 255, 0.2);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: 500;
                    transition: all 0.2s ease;
                }

                .profile-button:hover .profile-avatar {
                    background: rgba(255, 255, 255, 0.3);
                }

                .profile-name {
                    margin-left: 0.5rem;
                    color: white;
                    font-weight: 500;
                }

                .profile-chevron {
                    margin-left: 0.25rem;
                    height: 1rem;
                    width: 1rem;
                    color: rgba(255, 255, 255, 0.7);
                    transition: all 0.2s ease;
                }

                .profile-chevron-open {
                    transform: rotate(180deg);
                    color: white;
                }

                .dropdown-menu {
                    position: absolute;
                    right: 0;
                    top: 100%;
                    margin-top: 0.25rem;
                    width: 12rem;
                    border-radius: 0.5rem;
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
                    background: linear-gradient(to right, #0B1E3F 0%, #008080 100%);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    z-index: 50;
                    overflow: hidden;
                    backdrop-filter: blur(5px);
                }

                .dropdown-header {
                    padding: 0.75rem 1rem;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                }

                .dropdown-name {
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: white;
                }

                .dropdown-email {
                    font-size: 0.75rem;
                    color: rgba(255, 255, 255, 0.7);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .dropdown-item {
                    display: flex;
                    align-items: center;
                    padding: 0.5rem 1rem;
                    font-size: 0.875rem;
                    color: rgba(255, 255, 255, 0.9);
                    width: 100%;
                    text-align: left;
                    text-decoration: none;
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .dropdown-item:hover {
                    background: rgba(255, 255, 255, 0.1);
                    color: white;
                }

                .signup-button {
                    margin-left: 1rem;
                    padding: 0.5rem 1.25rem;
                    border-radius: 0.375rem;
                    font-size: 0.875rem;
                    font-weight: 500;
                    color: #0B1E3F;
                    background: white;
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
                    text-decoration: none;
                    transition: all 0.2s ease;
                }

                .signup-button:hover {
                    background: rgba(255, 255, 255, 0.9);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }

                .mobile-menu-button {
                    display: flex;
                    align-items: center;
                    margin-right: -0.5rem;
                }

                .mobile-menu-icon {
                    height: 1.5rem;
                    width: 1.5rem;
                    color: white;
                    transition: all 0.2s ease;
                }

                .mobile-menu-button:hover .mobile-menu-icon {
                    transform: rotate(90deg);
                }

                .mobile-menu {
                    position: absolute;
                    top: 64px;
                    left: 240px;
                    width: calc(100% - 240px);
                    background: linear-gradient(to right, #0B1E3F 0%, #008080 100%);
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    z-index: 30;
                    overflow: hidden;
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                }

                .mobile-menu-inner {
                    padding: 1rem;
                }

                .mobile-nav-link {
                    display: flex;
                    align-items: center;
                    padding: 0.75rem;
                    border-radius: 0.375rem;
                    font-size: 1rem;
                    font-weight: 500;
                    color: rgba(255, 255, 255, 0.9);
                    text-decoration: none;
                    transition: all 0.2s ease;
                    margin: 0.25rem 0;
                }

                .mobile-nav-link:hover {
                    color: white;
                    background: rgba(255, 255, 255, 0.1);
                    transform: translateX(5px);
                }

                .mobile-profile-section {
                    padding-top: 1rem;
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                    margin-top: 1rem;
                }

                .mobile-profile-info {
                    display: flex;
                    align-items: center;
                    padding: 0.75rem;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 0.375rem;
                    transition: all 0.2s ease;
                }

                .mobile-profile-info:hover {
                    background: rgba(255, 255, 255, 0.1);
                }

                .mobile-profile-avatar {
                    height: 2.25rem;
                    width: 2.25rem;
                    border-radius: 9999px;
                    background: rgba(255, 255, 255, 0.2);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: 500;
                }

                .mobile-profile-details {
                    margin-left: 0.75rem;
                }

                .mobile-profile-name {
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: white;
                }

                .mobile-profile-email {
                    font-size: 0.75rem;
                    color: rgba(255, 255, 255, 0.7);
                }

                .mobile-menu-items {
                    margin-top: 0.75rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                }

                .mobile-menu-item {
                    display: flex;
                    align-items: center;
                    padding: 0.75rem;
                    border-radius: 0.375rem;
                    font-size: 0.875rem;
                    font-weight: 500;
                    color: rgba(255, 255, 255, 0.9);
                    text-decoration: none;
                    transition: all 0.2s ease;
                }

                .mobile-menu-item:hover {
                    color: white;
                    background: rgba(255, 255, 255, 0.1);
                    padding-left: 1rem;
                }

                .mobile-signup-button {
                    display: block;
                    padding: 0.75rem;
                    border-radius: 0.375rem;
                    font-size: 1rem;
                    font-weight: 500;
                    text-align: center;
                    color: #0B1E3F;
                    background: white;
                    text-decoration: none;
                    margin-top: 0.5rem;
                    transition: all 0.2s ease;
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
                }

                .mobile-signup-button:hover {
                    background: rgba(255, 255, 255, 0.9);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }

                @media (min-width: 768px) {
                    .desktop-nav {
                        display: flex;
                        width: 100%;
                    }
                    .mobile-menu-button {
                        display: none;
                    }
                }
            `}</style>

            <nav className="navbar">
                <div className="navbar-container">
                    <div className="navbar-inner">
                        <div className="logo-container">
                            {/* Logo removed as it's in sidebar */}
                        </div>

                        <div className="desktop-nav">
                            {user ? (
                                <>
                                    <div className="nav-left">
                                        {userMenuItems.map((item, index) => (
                                            <NavLink
                                                key={index}
                                                to={item.path}
                                                label={
                                                    <>
                                                        {item.icon}
                                                        {item.label}
                                                    </>
                                                }
                                                onMouseEnter={() => setHoveredItem(index)}
                                                onMouseLeave={() => setHoveredItem(null)}
                                                isHovered={hoveredItem === index}
                                            />
                                        ))}
                                    </div>
                                    <div className="nav-right">
                                        <div className="profile-dropdown" ref={profileRef}>
                                            <button
                                                onClick={() => setProfileOpen(!profileOpen)}
                                                className="profile-button"
                                            >
                                                <div className="profile-avatar">
                                                    {user.name.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="profile-name">
                                                    {user.name.split(' ')[0]}
                                                </span>
                                                <HiOutlineChevronDown className={`profile-chevron ${profileOpen ? 'profile-chevron-open' : ''}`} />
                                            </button>

                                            <AnimatePresence>
                                                {profileOpen && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: -10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: -10 }}
                                                        transition={{ duration: 0.2 }}
                                                        className="dropdown-menu"
                                                    >
                                                        <div className="dropdown-header">
                                                            <p className="dropdown-name">{user.name}</p>
                                                            <p className="dropdown-email">{user.email}</p>
                                                        </div>
                                                        {profileMenuItems.map((item, index) => (
                                                            <motion.div
                                                                key={index}
                                                                initial={{ x: 10, opacity: 0 }}
                                                                animate={{ x: 0, opacity: 1 }}
                                                                transition={{ delay: index * 0.05 }}
                                                            >
                                                                {item.path ? (
                                                                    <Link
                                                                        to={item.path}
                                                                        onClick={() => setProfileOpen(false)}
                                                                        className="dropdown-item"
                                                                    >
                                                                        {item.icon}
                                                                        {item.label}
                                                                    </Link>
                                                                ) : (
                                                                    <button
                                                                        onClick={item.action}
                                                                        className="dropdown-item"
                                                                    >
                                                                        {item.icon}
                                                                        {item.label}
                                                                    </button>
                                                                )}
                                                            </motion.div>
                                                        ))}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="nav-left"></div>
                                    <div className="nav-right">
                                        {publicMenuItems.map((item, index) => (
                                            <NavLink
                                                key={index}
                                                to={item.path}
                                                label={
                                                    <>
                                                        {item.icon}
                                                        {item.label}
                                                    </>
                                                }
                                                onMouseEnter={() => setHoveredItem(index)}
                                                onMouseLeave={() => setHoveredItem(null)}
                                                isHovered={hoveredItem === index}
                                            />
                                        ))}
                                        <Link
                                            to="/login"
                                            className="signup-button"
                                        >
                                            Get Started
                                        </Link>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="mobile-menu-button">
                            <button
                                onClick={() => setIsOpen(!isOpen)}
                                className="p-2 rounded-md hover:bg-white/10 focus:outline-none"
                            >
                                <span className="sr-only">Open menu</span>
                                {isOpen ? (
                                    <FiX className="mobile-menu-icon" />
                                ) : (
                                    <FiMenu className="mobile-menu-icon" />
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                            className="mobile-menu"
                        >
                            <div className="mobile-menu-inner">
                                {user ? (
                                    <>
                                        {userMenuItems.map((item, index) => (
                                            <motion.div
                                                key={index}
                                                initial={{ x: 10, opacity: 0 }}
                                                animate={{ x: 0, opacity: 1 }}
                                                transition={{ delay: index * 0.05 }}
                                            >
                                                <MobileNavLink
                                                    to={item.path}
                                                    label={
                                                        <>
                                                            {item.icon}
                                                            {item.label}
                                                        </>
                                                    }
                                                    setIsOpen={setIsOpen}
                                                />
                                            </motion.div>
                                        ))}

                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: userMenuItems.length * 0.05 }}
                                            className="mobile-profile-section"
                                        >
                                            <div className="mobile-profile-info">
                                                <div className="mobile-profile-avatar">
                                                    {user.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="mobile-profile-details">
                                                    <p className="mobile-profile-name">{user.name}</p>
                                                    <p className="mobile-profile-email">{user.email}</p>
                                                </div>
                                            </div>
                                            <div className="mobile-menu-items">
                                                {profileMenuItems.map((item, index) => (
                                                    <motion.div
                                                        key={index}
                                                        initial={{ x: 10, opacity: 0 }}
                                                        animate={{ x: 0, opacity: 1 }}
                                                        transition={{ delay: (userMenuItems.length + index) * 0.05 }}
                                                    >
                                                        {item.path ? (
                                                            <Link
                                                                to={item.path}
                                                                onClick={() => setIsOpen(false)}
                                                                className="mobile-menu-item"
                                                            >
                                                                <div className="flex items-center">
                                                                    {item.icon}
                                                                    {item.label}
                                                                </div>
                                                            </Link>
                                                        ) : (
                                                            <button
                                                                onClick={() => {
                                                                    item.action();
                                                                    setIsOpen(false);
                                                                }}
                                                                className="mobile-menu-item"
                                                            >
                                                                <div className="flex items-center">
                                                                    {item.icon}
                                                                    {item.label}
                                                                </div>
                                                            </button>
                                                        )}
                                                    </motion.div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    </>
                                ) : (
                                    <>
                                        {publicMenuItems.map((item, index) => (
                                            <motion.div
                                                key={index}
                                                initial={{ x: 10, opacity: 0 }}
                                                animate={{ x: 0, opacity: 1 }}
                                                transition={{ delay: index * 0.05 }}
                                            >
                                                <MobileNavLink
                                                    to={item.path}
                                                    label={
                                                        <>
                                                            {item.icon}
                                                            {item.label}
                                                        </>
                                                    }
                                                    setIsOpen={setIsOpen}
                                                />
                                            </motion.div>
                                        ))}
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: publicMenuItems.length * 0.05 }}
                                        >
                                            <Link
                                                to="/signup"
                                                onClick={() => setIsOpen(false)}
                                                className="mobile-signup-button"
                                            >
                                                Sign Up
                                            </Link>
                                        </motion.div>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </nav>
        </>
    );
}

function NavLink({ to, label, onMouseEnter, onMouseLeave, isHovered }) {
    return (
        <Link
            to={to}
            className="nav-link"
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {label}
            {isHovered && (
                <motion.span
                    className="absolute right-1rem bottom-1rem left-1rem h-0.5 bg-white"
                    layoutId="navHover"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    exit={{ scaleX: 0 }}
                    transition={{ duration: 0.3 }}
                />
            )}
        </Link>
    );
}

function MobileNavLink({ to, label, setIsOpen }) {
    return (
        <Link
            to={to}
            onClick={() => setIsOpen(false)}
            className="mobile-nav-link"
        >
            {label}
        </Link>
    );
}