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
            className={`sidebar-container ${isCollapsed ? 'collapsed' : ''}`}
            ref={sidebarRef}
        >
            <motion.div
                className="sidebar"
                initial={{ x: -300 }}
                animate={{ x: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
                {/* Header with Logo */}
                <div className="sidebar-header">
                    <Link to="/dashboard" className="logo-link">
                        <div className="flex items-center">
                            <FiMail className="logo-icon" />
                            {!isCollapsed && (
                                <span className="logo-text">
                                    Endbounce<span className="logo-highlight">Warmup</span>
                                </span>
                            )}
                        </div>
                    </Link>
                </div>

                {/* Navigation Items */}
                <nav className="sidebar-nav">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.name}
                            to={item.path}
                            className={({ isActive }) =>
                                `nav-item ${isActive ? 'active' : ''} ${isCollapsed ? 'collapsed' : ''}`
                            }
                            onClick={() => handleItemClick(item.name)}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            {!isCollapsed && (
                                <>
                                    <span className="nav-text">{item.name}</span>
                                    <FiChevronRight className="nav-arrow" />
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* Footer Section */}
                <div className="sidebar-footer">
                    <div className="profile-item">
                        <div className="profile-avatar">
                            <FiUser />
                        </div>
                        {!isCollapsed && (
                            <div className="profile-info">
                                <div className="profile-name">{currentUser?.name || "No Name"}</div>
                                <div className="profile-email">{currentUser?.email || "No Email"}</div>
                            </div>
                        )}
                        {isCollapsed && <span className="tooltip">Profile</span>}
                    </div>

                    <button className="logout-btn" onClick={handleLogout}>
                        <span className="logout-icon">
                            <FiLogOut />
                        </span>
                        {!isCollapsed && <span className="logout-text">Logout</span>}

                    </button>

                    <div className="footer-toggle-container">
                        {/* <button
                            className="toggle-btn"
                            onClick={handleToggle}
                            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                        >
                            {isCollapsed ? <FiMenu /> : <FiChevronLeft />}
                        </button> */}
                    </div>
                </div>
            </motion.div>

            <style jsx>{`
                .sidebar-container {
                    position: fixed;
                    left: 0;
                    top: 0;
                    bottom: 0;
                    z-index: 40;
                    width: 240px;
                    background: linear-gradient(to right, #0B1E3F 0%, #008080 100%);
                    color: #fff;
                    box-shadow: 4px 0 15px rgba(0, 0, 0, 0.1);
                    transition: width 0.3s ease;
                }

                .sidebar-container.collapsed {
                    width: 80px;
                }

                .sidebar {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    position: relative;
                }

                .sidebar-header {
                    padding: 1.5rem;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    min-height: 80px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                /* Logo animations */
                @keyframes floatLogoFast {
                    0% { transform: translateY(0px) rotate(0deg); }
                    50% { transform: translateY(-2px) rotate(0.5deg); }
                    100% { transform: translateY(0px) rotate(0deg); }
                }

                .logo-link {
                    display: inline-block;
                    animation: floatLogoFast 1.5s ease-in-out infinite;
                    transition: transform 0.2s ease, filter 0.2s ease;
                }

                @keyframes wigglePop {
                    0% { transform: scale(1) rotate(0deg); }
                    25% { transform: scale(1.1) rotate(5deg); }
                    50% { transform: scale(1) rotate(-5deg); }
                    75% { transform: scale(1.1) rotate(3deg); }
                    100% { transform: scale(1) rotate(0deg); }
                }

                .logo-link:hover {
                    animation: wigglePop 0.4s ease-in-out;
                    filter: drop-shadow(0 0 10px rgba(0, 174, 255, 0.8));
                }

                .logo-icon {
                    color: white;
                    width: 2rem;
                    height: 2rem;
                    flex-shrink: 0;
                }

                .logo-text {
                    margin-left: 0.5rem;
                    font-size: 1.25rem;
                    font-weight: 700;
                    background: linear-gradient(to right, white 0%, rgba(255,255,255,0.8) 100%);
                    -webkit-background-clip: text;
                    background-clip: text;
                    color: transparent;
                    white-space: nowrap;
                }

                .logo-highlight {
                    color: white;
                }

                .sidebar-nav {
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                    padding: 1rem;
                    flex: 1;
                    overflow-y: auto;
                }

                .nav-item {
                    color: rgba(255, 255, 255, 0.8);
                    text-decoration: none;
                    display: flex;
                    align-items: center;
                    padding: 0.75rem 1rem;
                    border-radius: 8px;
                    transition: all 0.3s ease;
                    position: relative;
                }

                .nav-item.collapsed {
                    justify-content: center;
                }

                .nav-item:hover {
                    background: rgba(255, 255, 255, 0.1);
                    color: white;
                }

                .nav-item.active {
                    background: rgba(255, 255, 255, 0.2);
                    color: white;
                    font-weight: 500;
                }

                .nav-item.active::before {
                    content: '';
                    position: absolute;
                    left: 0;
                    top: 0;
                    bottom: 0;
                    width: 4px;
                    background: white;
                    border-radius: 0 4px 4px 0;
                }

                .nav-icon {
                    font-size: 1.25rem;
                    min-width: 24px;
                }

                .nav-text {
                    margin-left: 12px;
                    flex-grow: 1;
                }

                .nav-arrow {
                    font-size: 1rem;
                    opacity: 0.7;
                    transition: transform 0.2s ease;
                }

                .nav-item:hover .nav-arrow {
                    opacity: 1;
                    transform: translateX(2px);
                }

                .sidebar-footer {
                    padding: 1rem;
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .profile-item {
                    display: flex;
                    align-items: center;
                    padding: 0.5rem;
                    border-radius: 8px;
                    transition: all 0.3s ease;
                    color: rgba(255, 255, 255, 0.8);
                    text-decoration: none;
                    position: relative;
                }

                .profile-item:hover {
                    background: rgba(255, 255, 255, 0.1);
                    color: white;
                }

                .profile-avatar {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.2);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-right: 12px;
                    flex-shrink: 0;
                }

                .profile-info {
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .profile-name {
                    font-size: 0.875rem;
                    font-weight: 500;
                }

                .profile-email {
                    font-size: 0.75rem;
                    opacity: 0.7;
                }

                .logout-btn {
                    display: flex;
                    align-items: center;
                    padding: 0.75rem 1rem;
                    border-radius: 8px;
                    background: transparent;
                    border: none;
                    color: rgba(255, 255, 255, 0.8);
                    cursor: pointer;
                    transition: all 0.3s ease;
                    width: 100%;
                    position: relative;
                }

                .logout-btn:hover {
                    background: rgba(239, 68, 68, 0.2);
                    color: #ff4d4d;
                }

                .logout-icon {
                    font-size: 1.25rem;
                    min-width: 24px;
                }

                .logout-text {
                    margin-left: 12px;
                }

                .footer-toggle-container {
                    display: flex;
                    justify-content: center;
                    margin-top: 0.5rem;
                }

                .toggle-btn {
                    background: rgba(255, 255, 255, 0.1);
                    border: none;
                    color: white;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }

                .toggle-btn:hover {
                    background: rgba(255, 255, 255, 0.2);
                    transform: rotate(180deg);
                }

                .tooltip {
                    position: absolute;
                    left: 100%;
                    top: 50%;
                    transform: translateY(-50%);
                    background: #1e293b;
                    color: white;
                    padding: 0.5rem 1rem;
                    border-radius: 6px;
                    font-size: 0.875rem;
                    white-space: nowrap;
                    pointer-events: none;
                    opacity: 0;
                    transition: opacity 0.2s;
                    margin-left: 1rem;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                    z-index: 50;
                }

                .nav-item:hover .tooltip,
                .profile-item:hover .tooltip,
                .logout-btn:hover .tooltip {
                    opacity: 1;
                }

                @media (max-width: 768px) {
                    .sidebar-container {
                        width: 240px;
                        transform: translateX(-100%);
                        transition: transform 0.3s ease;
                    }

                    .sidebar-container.collapsed {
                        transform: translateX(0);
                        width: 80px;
                    }
                }
            `}</style>
        </div>
    );
};

export default Sidebar;