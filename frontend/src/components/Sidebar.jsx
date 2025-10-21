import React, { memo, useMemo } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
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
    FiChevronRight
} from "react-icons/fi";
import logo from "../assets/image.png";

const Sidebar = memo(() => {
    const { currentUser, logout } = useAuth();
    const navigate = useNavigate();

    // Memoize navItems to prevent recreation on every render
    const navItems = useMemo(() => [
        { name: "Dashboard", icon: <FiHome className="w-5 h-5" />, path: "/dashboard", color: "from-blue-500 to-blue-600" },
        { name: "Analytics", icon: <FiBarChart2 className="w-5 h-5" />, path: "/analytics", color: "from-green-500 to-green-600" },
        { name: "Template Checker", icon: <FiCheckSquare className="w-5 h-5" />, path: "/template-checker", color: "from-purple-500 to-purple-600" },
        { name: "Authentication", icon: <FiShield className="w-5 h-5" />, path: "/authenticationchecker", color: "from-orange-500 to-orange-600" },
        { name: "IP & Domain", icon: <FiGlobe className="w-5 h-5" />, path: "/ipdomain-checker", color: "from-indigo-500 to-indigo-600" },
        { name: "Alerts", icon: <FiBell className="w-5 h-5" />, path: "/alert", color: "from-red-500 to-red-600" },
        { name: "Settings", icon: <FiSettings className="w-5 h-5" />, path: "/settings", color: "from-gray-500 to-gray-600" }
    ], []);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // Memoize user info to prevent unnecessary recalculations
    const userInfo = useMemo(() => ({
        name: currentUser?.name || "No Name",
        email: currentUser?.email || "No Email",
        initial: (currentUser?.name?.charAt(0) || "N").toUpperCase()
    }), [currentUser?.name, currentUser?.email]);

    return (
        <div className="fixed left-0 top-0 bottom-0 w-72 bg-white shadow-2xl border-r border-gray-100 z-40">
            <div className="flex flex-col h-full">
                {/* Header with Logo */}
                <div className="h-24 border-b border-gray-100 flex items-center justify-center px-6 bg-gradient-to-r from-white to-gray-50/50">
                    <Link
                        to="/dashboard"
                        className="flex items-center justify-center w-full h-full transition-transform duration-200 hover:scale-105"
                    >
                        <div className="w-52 h-14 flex items-center justify-center">
                            <img
                                src={logo}
                                alt="Logo"
                                className="w-full h-full object-contain filter drop-shadow-md"
                            />
                        </div>
                    </Link>
                </div>

                {/* Navigation Items */}
                <nav className="flex-1 p-6 space-y-3 overflow-y-auto">
                    {navItems.map((item) => (
                        <div key={item.name}>
                            <NavLink
                                to={item.path}
                                className={({ isActive }) => `
                                    group flex items-center no-underline
                                    p-4 rounded-2xl transition-all duration-300 relative
                                    border-2 border-transparent overflow-hidden
                                    ${isActive
                                        ? `bg-gradient-to-r ${item.color} text-white shadow-lg`
                                        : 'text-gray-600 bg-white hover:shadow-md border-gray-100'
                                    }
                                    justify-start
                                `}
                            >
                                {({ isActive }) => (
                                    <>
                                        {/* Background */}
                                        {!isActive && (
                                            <div
                                                className={`absolute inset-0 bg-gradient-to-r ${item.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}
                                            />
                                        )}

                                        {/* Icon */}
                                        <span
                                            className={`
                                                relative z-10 flex justify-center items-center
                                                transition-all duration-300
                                                ${isActive
                                                    ? 'text-white transform scale-110'
                                                    : 'text-gray-500 group-hover:text-gray-700'
                                                }
                                                text-lg
                                            `}
                                        >
                                            {item.icon}
                                        </span>

                                        {/* Text and Arrow */}
                                        <div className="flex items-center flex-1 ml-4">
                                            <span className={`
                                                text-sm font-semibold tracking-wide
                                                ${isActive ? 'text-white' : 'text-gray-700'}
                                            `}>
                                                {item.name}
                                            </span>
                                            <span
                                                className={`
                                                    ml-auto transition-all duration-300
                                                    ${isActive ? 'text-white' : 'text-gray-400'}
                                                `}
                                            >
                                                <FiChevronRight className={`
                                                    text-sm transition-transform duration-300
                                                    group-hover:translate-x-1
                                                    ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'}
                                                `} />
                                            </span>
                                        </div>

                                        {/* Active State Effect */}
                                        {isActive && (
                                            <div
                                                className="absolute inset-0 bg-white opacity-20 rounded-2xl"
                                            />
                                        )}
                                    </>
                                )}
                            </NavLink>
                        </div>
                    ))}
                </nav>

                {/* Footer Section */}
                <div className="p-6 border-t border-gray-100 space-y-4 bg-gradient-to-b from-white to-gray-50/30">
                    {/* Profile Section */}
                    <div className="group">
                        <div className={`
                            flex items-center rounded-2xl transition-all duration-300 
                            text-gray-600 hover:shadow-md border-2 border-transparent
                            hover:border-teal-200 bg-white cursor-pointer p-4 justify-start
                        `}>
                            <div
                                className={`
                                    rounded-xl flex items-center justify-center flex-shrink-0
                                    bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-md
                                    w-10 h-10 mr-4
                                `}
                            >
                                <FiUser className="w-5 h-5" />
                            </div>

                            {/* Profile Info */}
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-gray-900 truncate">
                                    {userInfo.name}
                                </div>
                                <div className="text-xs text-gray-500 truncate mt-1">
                                    {userInfo.email}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Logout Button */}
                    <button
                        onClick={handleLogout}
                        className={`
                            group flex items-center w-full rounded-2xl 
                            transition-all duration-300 
                            text-gray-600 hover:shadow-md border-2 border-transparent
                            hover:border-red-200 bg-white p-4 justify-start
                        `}
                    >
                        <span
                            className={`
                                flex justify-center transition-colors duration-300
                                text-lg group-hover:text-red-600
                            `}
                        >
                            <FiLogOut />
                        </span>

                        {/* Text */}
                        <span className="ml-4 text-sm font-semibold text-gray-700 group-hover:text-red-600">
                            Logout
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar;