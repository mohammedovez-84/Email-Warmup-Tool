import React, { memo, useMemo, useState, useCallback, useEffect } from "react";
import { NavLink, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
    FiUser,
    FiSettings,
    FiLogOut,
    FiBarChart2,
    FiCheckSquare,
    FiShield,
    FiGlobe,
    FiBell,
    FiHome,
    FiChevronRight,
    FiX,
    FiMenu
} from "react-icons/fi";
import logo from "../assets/image.png";

const Sidebar = memo(() => {
    const { currentUser, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [mobileOpen, setMobileOpen] = useState(false);

    // Memoize navItems to prevent recreation on every render
    const navItems = useMemo(() => [
        {
            name: "Dashboard",
            icon: <FiHome className="w-4 h-4 md:w-5 md:h-5" />,
            path: "/dashboard",
            color: "from-teal-800 to-teal-600"
        },
        {
            name: "Analytics",
            icon: <FiBarChart2 className="w-4 h-4 md:w-5 md:h-5" />,
            path: "/analytics",
            color: "from-teal-800 to-teal-600"
        },
        {
            name: "Template Checker",
            icon: <FiCheckSquare className="w-4 h-4 md:w-5 md:h-5" />,
            path: "/template-checker",
            color: "from-teal-800 to-teal-600"
        },
        {
            name: "Authentication",
            icon: <FiShield className="w-4 h-4 md:w-5 md:h-5" />,
            path: "/authenticationchecker",
            color: "from-teal-800 to-teal-600"
        },
        {
            name: "IP & Domain",
            icon: <FiGlobe className="w-4 h-4 md:w-5 md:h-5" />,
            path: "/ipdomain-checker",
            color: "from-teal-800 to-teal-600"
        },
        {
            name: "Alerts",
            icon: <FiBell className="w-4 h-4 md:w-5 md:h-5" />,
            path: "/alert",
            color: "from-teal-800 to-teal-600"
        },
        {
            name: "Settings",
            icon: <FiSettings className="w-4 h-4 md:w-5 md:h-5" />,
            path: "/settings",
            color: "from-teal-800 to-teal-600"
        }
    ], []);

    const handleLogout = useCallback(() => {
        logout();
        navigate('/login');
        setMobileOpen(false);
    }, [logout, navigate]);

    const closeMobileSidebar = useCallback(() => {
        setMobileOpen(false);
    }, []);

    const toggleMobileSidebar = useCallback(() => {
        setMobileOpen(prev => !prev);
    }, []);

    // Close mobile sidebar when route changes
    useEffect(() => {
        setMobileOpen(false);
    }, [location.pathname]);

    // Close mobile sidebar on window resize when switching to desktop
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 1024) {
                setMobileOpen(false);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Memoize user info to prevent unnecessary recalculations
    const userInfo = useMemo(() => ({
        name: currentUser?.name || "Guest User",
        email: currentUser?.email || "guest@example.com",
        initial: (currentUser?.name?.charAt(0) || "G").toUpperCase()
    }), [currentUser?.name, currentUser?.email]);

    return (
        <>
            {/* Mobile Menu Button - Smaller and in left corner */}
            <button
                onClick={toggleMobileSidebar}
                className="lg:hidden fixed top-3 left-3 z-50 p-2 rounded-lg bg-white/95 backdrop-blur-xl shadow-md border border-teal-200/60 hover:bg-teal-100 transition-all duration-300 hover:scale-110 active:scale-95"
            >
                <FiMenu className="w-3.5 h-3.5 text-gray-900" />
            </button>

            {/* Mobile Overlay */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
                    onClick={closeMobileSidebar}
                />
            )}

            {/* Sidebar */}
            <div className={`
                fixed lg:sticky top-0 left-0 h-screen w-56 md:w-72 bg-white shadow-2xl border-r border-teal-200/60 z-40
                transform transition-transform duration-300 ease-in-out font-sans
                ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                <div className="flex flex-col h-full">
                    {/* Header with Logo and Close Button */}
                    <div className="h-16 md:h-24 border-b border-teal-200/60 flex items-center justify-between px-3 md:px-6 bg-gradient-to-r from-white to-teal-50/50">
                        <Link
                            to="/dashboard"
                            className="flex items-center justify-center w-full h-full transition-transform duration-200 hover:scale-105"
                            onClick={closeMobileSidebar}
                        >
                            <div className="w-36 md:w-52 h-10 md:h-14 flex items-center justify-center">
                                <img
                                    src={logo}
                                    alt="Logo"
                                    className="w-full h-full object-contain filter drop-shadow-md"
                                />
                            </div>
                        </Link>

                        {/* Mobile Close Button */}
                        <button
                            onClick={closeMobileSidebar}
                            className="lg:hidden p-1.5 rounded-xl hover:bg-teal-100 transition-colors duration-300"
                        >
                            <FiX className="w-4 h-4 text-gray-900" />
                        </button>
                    </div>

                    {/* Navigation Items */}
                    <nav className="flex-1 p-3 md:p-6 space-y-1.5 md:space-y-3 overflow-y-auto">
                        {navItems.map((item) => {
                            const isActive = location.pathname === item.path ||
                                (item.path !== '/dashboard' && location.pathname.startsWith(item.path));

                            return (
                                <div key={item.name}>
                                    <NavLink
                                        to={item.path}
                                        onClick={closeMobileSidebar}
                                        className={`
                                            group flex items-center w-full no-underline
                                            p-2.5 md:p-4 rounded-lg md:rounded-2xl transition-all duration-300 relative
                                            border border-transparent overflow-hidden
                                            ${isActive
                                                ? `bg-gradient-to-r ${item.color} text-white shadow-lg`
                                                : 'text-gray-900 bg-white hover:shadow-md border-teal-100 hover:border-teal-200'
                                            }
                                            hover:scale-105 active:scale-95
                                        `}
                                    >
                                        {/* Background */}
                                        {!isActive && (
                                            <div
                                                className={`absolute inset-0 bg-gradient-to-r ${item.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300 rounded-lg md:rounded-2xl`}
                                            />
                                        )}

                                        {/* Icon */}
                                        <span
                                            className={`
                                                relative z-10 flex justify-center items-center
                                                transition-all duration-300
                                                ${isActive
                                                    ? 'text-white transform scale-110'
                                                    : 'text-gray-700 group-hover:text-gray-900'
                                                }
                                            `}
                                        >
                                            {item.icon}
                                        </span>

                                        {/* Text and Arrow */}
                                        <div className="flex items-center flex-1 ml-2.5 md:ml-4">
                                            <span className={`
                                                text-sm font-bold tracking-wide font-sans
                                                ${isActive ? 'text-white' : 'text-gray-900'}
                                            `}>
                                                {item.name}
                                            </span>
                                            <FiChevronRight
                                                className={`
                                                    ml-auto text-sm transition-transform duration-300
                                                    ${isActive ? 'text-white' : 'text-gray-500'}
                                                    group-hover:translate-x-0.5
                                                `}
                                            />
                                        </div>

                                        {/* Active State Effect */}
                                        {isActive && (
                                            <div
                                                className="absolute inset-0 bg-white opacity-20 rounded-lg md:rounded-2xl"
                                            />
                                        )}

                                        {/* Hover Border Effect */}
                                        <div className={`
                                            absolute inset-0 border border-transparent rounded-lg md:rounded-2xl transition-all duration-300
                                            ${!isActive ? 'group-hover:border-teal-300' : ''}
                                        `} />
                                    </NavLink>
                                </div>
                            );
                        })}
                    </nav>

                    {/* User Section */}
                    <div className="p-3 md:p-6 border-t border-teal-200/60 space-y-2 md:space-y-4 bg-gradient-to-b from-white to-teal-50/30">
                        {/* Profile Info */}
                        <div className="group">
                            <div
                                className="flex items-center rounded-lg md:rounded-2xl transition-all duration-300 
                                    text-gray-900 hover:shadow-md border border-transparent
                                    hover:border-teal-300 bg-white cursor-pointer p-2.5 md:p-4 justify-start
                                    hover:scale-105 active:scale-95"
                                onClick={closeMobileSidebar}
                            >
                                <div
                                    className="rounded-md md:rounded-xl flex items-center justify-center flex-shrink-0
                                        bg-gradient-to-r from-teal-800 to-teal-600 text-white shadow-md
                                        w-7 h-7 md:w-10 md:h-10 mr-2.5 md:mr-4 transition-transform duration-300 group-hover:scale-110"
                                >
                                    <FiUser className="w-3 h-3 md:w-4 md:h-4" />
                                </div>

                                {/* Profile Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-bold text-gray-900 truncate font-sans">
                                        {userInfo.name}
                                    </div>
                                    <div className="text-xs font-medium text-gray-600 truncate mt-0.5 font-sans">
                                        {userInfo.email}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Logout Button */}
                        <button
                            onClick={handleLogout}
                            className="flex items-center w-full rounded-lg md:rounded-2xl 
                                transition-all duration-300 
                                text-gray-900 hover:shadow-md border border-transparent
                                hover:border-red-300 bg-white p-2.5 md:p-4 justify-start
                                hover:scale-105 active:scale-95 group"
                        >
                            <span
                                className="flex justify-center transition-colors duration-300
                                    text-sm md:text-lg group-hover:text-red-600 transform group-hover:scale-110"
                            >
                                <FiLogOut className="w-3 h-3 md:w-4 md:h-4 text-gray-700 group-hover:text-red-600" />
                            </span>

                            {/* Text */}
                            <span className="ml-2.5 md:ml-4 text-sm font-bold text-gray-900 group-hover:text-red-600 font-sans">
                                Logout
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar;