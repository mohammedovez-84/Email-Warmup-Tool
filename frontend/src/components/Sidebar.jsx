import React, { useState, useRef } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
    FiUser,
    FiSettings,
    FiLogOut,
    FiPieChart,
    FiBarChart2,
    FiSend,
    FiChevronLeft,
    FiMenu,
    FiMail,
    FiCheckSquare,
    FiShield,
    FiGlobe,
    FiBell,
    FiChevronRight
} from "react-icons/fi";
import { motion } from "framer-motion";
import logo from "../assets/image (2).png";

const Sidebar = ({ onToggle }) => {
    const { currentUser, logout } = useAuth();
    const navigate = useNavigate();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [activeItem, setActiveItem] = useState("Dashboard");
    const sidebarRef = useRef(null);

    const navItems = [
        { name: "Dashboard", icon: <FiPieChart />, path: "/dashboard" },
        { name: "Analytics", icon: <FiBarChart2 />, path: "/analytics" },
        { name: "Template", icon: <FiCheckSquare />, path: "/template-checker" },
        { name: "Authentication", icon: <FiShield />, path: "/authenticationchecker" },
        { name: "IP & Domain Checker", icon: <FiGlobe />, path: "/ipdomain-checker" },
        { name: "Alerts", icon: <FiBell />, path: "/alert" },
        { name: "Settings", icon: <FiSettings />, path: "/settings" }
    ];

    const handleItemClick = (name) => {
        setActiveItem(name);
    };

    const handleToggle = () => {
        const newState = !isCollapsed;
        setIsCollapsed(newState);
        if (onToggle) onToggle(newState);
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div
            ref={sidebarRef}
            className={`
                fixed left-0 top-0 bottom-0 z-40 
                bg-gradient-to-r from-[#0B1E3F] to-[#008080]
                text-white shadow-xl
                transition-all duration-300 ease-in-out
                ${isCollapsed ? 'w-20' : 'w-64'}
            `}
        >
            <motion.div
                className="flex flex-col h-full relative"
                initial={{ x: -300 }}
                animate={{ x: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
                {/* Header with Perfectly Fixed Logo */}
                <div className={`
                    h-20 border-b border-white/10 
                    flex items-center justify-center
                    transition-all duration-300
                    relative
                `}>
                    <Link
                        to="/dashboard"
                        className="flex items-center justify-center w-full h-full"
                    >
                        {/* Logo Container */}
                        <div className={`
                            flex items-center justify-center
                            transition-all duration-300
                            ${isCollapsed ? 'w-12 h-12' : 'w-66 h-19'}
                        `}>
                            <img
                                src={logo}
                                alt="Endbounce Warmup"
                                className={`
                                    w-full h-full
                                    object-contain
                                    drop-shadow-lg
                                    transition-all duration-300
                                    ${isCollapsed ? 'rounded-lg' : 'rounded-xl'}
                                    hover:scale-110
                                `}
                            />
                        </div>
                    </Link>
                </div>

                {/* Navigation Items */}
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.name}
                            to={item.path}
                            className={({ isActive }) => `
                                group flex items-center text-white/80 no-underline
                                p-3 rounded-lg transition-all duration-300 relative
                                hover:bg-white/10 hover:text-white
                                ${isActive ? 'bg-white/20 text-white font-medium' : ''}
                                ${isCollapsed ? 'justify-center' : 'justify-start'}
                            `}
                            onClick={() => handleItemClick(item.name)}
                        >
                            {({ isActive }) => (
                                <>
                                    {/* Active Indicator */}
                                    {isActive && (
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-white rounded-r"></div>
                                    )}

                                    {/* Icon */}
                                    <span className={`
                                        flex justify-center
                                        ${isCollapsed ? 'text-xl' : 'text-lg'}
                                    `}>
                                        {item.icon}
                                    </span>

                                    {/* Text and Arrow - Only show when expanded */}
                                    {!isCollapsed && (
                                        <>
                                            <span className="ml-3 flex-1 text-sm font-medium">
                                                {item.name}
                                            </span>
                                            <FiChevronRight className="text-sm opacity-70 transition-transform duration-200 group-hover:translate-x-1" />
                                        </>
                                    )}

                                    {/* Tooltip for collapsed state */}
                                    {isCollapsed && (
                                        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 pointer-events-none transition-opacity duration-200 group-hover:opacity-100 z-50 whitespace-nowrap shadow-xl border border-gray-700">
                                            {item.name}
                                            <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-l-4 border-transparent border-r-gray-900"></div>
                                        </div>
                                    )}
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* Footer Section */}
                <div className="p-4 border-t border-white/10 space-y-2">
                    {/* Profile Section */}
                    <div className="group relative">
                        <div className={`
                            flex items-center rounded-lg transition-all duration-300 
                            text-white/80 hover:bg-white/10 hover:text-white
                            ${isCollapsed ? 'justify-center p-3' : 'justify-start p-2'}
                        `}>
                            <div className={`
                                rounded-full bg-white/20 flex items-center justify-center flex-shrink-0
                                ${isCollapsed ? 'w-10 h-10' : 'w-8 h-8 mr-3'}
                            `}>
                                <FiUser className={isCollapsed ? "text-lg" : "text-sm"} />
                            </div>

                            {/* Profile Info - Only show when expanded */}
                            {!isCollapsed && (
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium truncate">
                                        {currentUser?.name || "No Name"}
                                    </div>
                                    <div className="text-xs opacity-70 truncate">
                                        {currentUser?.email || "No Email"}
                                    </div>
                                </div>
                            )}

                            {/* Tooltip for collapsed state */}
                            {isCollapsed && (
                                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 pointer-events-none transition-opacity duration-200 group-hover:opacity-100 z-50 whitespace-nowrap shadow-xl border border-gray-700">
                                    <div className="font-semibold">{currentUser?.name || "No Name"}</div>
                                    <div className="opacity-80 mt-1">{currentUser?.email || "No Email"}</div>
                                    <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-l-4 border-transparent border-r-gray-900"></div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Logout Button */}
                    <button
                        onClick={handleLogout}
                        className={`
                            group flex items-center w-full rounded-lg 
                            transition-all duration-300 text-white/80 
                            hover:bg-red-700 hover:text-white-500 relative
                            ${isCollapsed ? 'justify-center p-7' : 'justify-start p-3'}
                        `}
                    >
                        <span className={`
                            flex justify-center
                            ${isCollapsed ? 'text-xl' : 'text-lg'}
                        `}>
                            <FiLogOut />
                        </span>

                        {/* Text - Only show when expanded */}
                        {!isCollapsed && (
                            <span className="ml-3 text-sm font-medium">Logout</span>
                        )}

                        {/* Tooltip for collapsed state */}
                        {/* {isCollapsed && (
                            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 pointer-events-none transition-opacity duration-200 group-hover:opacity-100 z-50 whitespace-nowrap shadow-xl border border-gray-700">
                                Logout
                                <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-l-4 border-transparent border-r-gray-900"></div>
                            </div>
                        )} */}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default Sidebar;