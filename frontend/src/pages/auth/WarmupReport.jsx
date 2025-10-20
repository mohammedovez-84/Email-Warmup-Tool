import React, { useState, useEffect } from 'react';
import {
    FiX, FiDownload, FiCalendar, FiMail, FiTrendingUp, FiActivity,
    FiBarChart2, FiEye, FiUsers, FiTarget, FiClock, FiAward,
    FiMessageSquare, FiFilter, FiRefreshCw, FiPieChart, FiStar,
    FiCheck, FiAlertCircle, FiInfo
} from 'react-icons/fi';
import axios from 'axios';
import { toast } from 'react-toastify';

const API_BASE_URL = 'http://localhost:5000';

const WarmupReport = ({ email, onClose }) => {
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState('7d');
    const [activeTab, setActiveTab] = useState('overview');
    const [chartType, setChartType] = useState('volume');

    // Enhanced mock data generator with more metrics
    const generateMockReportData = (email) => {
        const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
        const baseDate = new Date();

        const dailyStats = Array.from({ length: days }, (_, i) => {
            const date = new Date(baseDate);
            date.setDate(date.getDate() - (days - i - 1));

            const sent = Math.floor(Math.random() * 50) + 15;
            const replies = Math.floor(Math.random() * 12) + 3;
            const deliverability = Math.floor(Math.random() * 15) + 80;
            const opens = Math.floor(sent * (Math.random() * 0.3 + 0.4));
            const clicks = Math.floor(opens * (Math.random() * 0.2 + 0.1));

            return {
                date: date.toISOString().split('T')[0],
                sent,
                replies,
                deliverability,
                inbox: Math.floor(Math.random() * 10) + 85,
                spam: Math.floor(Math.random() * 3) + 1,
                opened: opens,
                clicked: clicks,
                bounce: Math.floor(Math.random() * 3),
                unsubscribed: Math.floor(Math.random() * 2)
            };
        });

        const totalSent = dailyStats.reduce((sum, day) => sum + day.sent, 0);
        const totalReplies = dailyStats.reduce((sum, day) => sum + day.replies, 0);
        const totalOpened = dailyStats.reduce((sum, day) => sum + day.opened, 0);
        const totalClicked = dailyStats.reduce((sum, day) => sum + day.clicked, 0);
        const avgDeliverability = Math.round(dailyStats.reduce((sum, day) => sum + day.deliverability, 0) / days);

        return {
            email: email.address,
            period: timeRange,
            summary: {
                totalSent,
                totalReplies,
                totalOpened,
                totalClicked,
                averageDeliverability: avgDeliverability,
                spamRate: 2.5,
                inboxRate: 87.3,
                bounceRate: 1.2,
                engagementScore: Math.floor(Math.random() * 30) + 65
            },
            dailyStats,
            performanceMetrics: {
                replyRate: Math.round((totalReplies / totalSent) * 100),
                openRate: Math.round((totalOpened / totalSent) * 100),
                clickRate: Math.round((totalClicked / totalOpened) * 100),
                engagementRate: Math.round(((totalReplies + totalClicked) / totalSent) * 100),
                growthRate: Math.round((dailyStats[dailyStats.length - 1].sent - dailyStats[0].sent) / dailyStats[0].sent * 100),
                deliverabilityTrend: Math.random() > 0.5 ? 'up' : 'down',
                spamTrend: Math.random() > 0.7 ? 'up' : 'down'
            },
            analytics: {
                bestPerformingDay: dailyStats.reduce((best, day) => day.sent > best.sent ? day : best, dailyStats[0]),
                worstPerformingDay: dailyStats.reduce((worst, day) => day.sent < worst.sent ? day : worst, dailyStats[0]),
                peakHour: Math.floor(Math.random() * 12) + 8,
                audienceEngagement: {
                    active: Math.floor(Math.random() * 200) + 150,
                    responsive: Math.floor(Math.random() * 100) + 50,
                    inactive: Math.floor(Math.random() * 50) + 10
                },
                senderReputation: Math.floor(Math.random() * 30) + 70
            },
            recommendations: [
                "Gradually increase daily send volume by 10-15%",
                "Focus on improving reply rates with personalized content",
                "Monitor spam folder regularly and adjust content strategy",
                "Optimize send times based on engagement patterns",
                "Consider A/B testing subject lines for better open rates"
            ],
            comparison: {
                industryAverage: {
                    deliverability: 85,
                    replyRate: 12,
                    openRate: 42
                },
                previousPeriod: {
                    deliverability: avgDeliverability - 5,
                    replyRate: Math.round((totalReplies / totalSent) * 100) - 3,
                    openRate: Math.round((totalOpened / totalSent) * 100) - 8
                }
            }
        };
    };

    useEffect(() => {
        const fetchReportData = async () => {
            try {
                setLoading(true);
                const token = localStorage.getItem('token');

                if (!token) {
                    toast.error('Please login again');
                    return;
                }

                // Simulate API delay
                setTimeout(() => {
                    const mockData = generateMockReportData(email);
                    setReportData(mockData);
                    setLoading(false);
                }, 800);

            } catch (error) {
                console.error('Error fetching report data:', error);
                toast.error('Failed to load warmup report');
                setLoading(false);
            }
        };

        if (email) {
            fetchReportData();
        }
    }, [email, timeRange]);

    const exportReport = () => {
        if (!reportData) return;

        const dataStr = JSON.stringify(reportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `warmup-report-${email.address}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success('Report exported successfully');
    };

    const getProgressColor = (percentage) => {
        if (percentage >= 80) return 'bg-teal-500';
        if (percentage >= 60) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    const getStatusColor = (percentage) => {
        if (percentage >= 80) return 'text-teal-700 bg-teal-100 border-teal-200';
        if (percentage >= 60) return 'text-yellow-700 bg-yellow-100 border-yellow-200';
        return 'text-red-700 bg-red-100 border-red-200';
    };

    const getMetricColor = (value, type = 'positive') => {
        if (type === 'positive') {
            return value >= 80 ? 'text-teal-600' : value >= 60 ? 'text-yellow-600' : 'text-red-600';
        }
        return value <= 2 ? 'text-teal-600' : value <= 5 ? 'text-yellow-600' : 'text-red-600';
    };

    const getTrendIcon = (trend) => {
        return trend === 'up' ? '↗' : '↘';
    };

    const getTrendColor = (trend) => {
        return trend === 'up' ? 'text-teal-500' : 'text-red-500';
    };

    const getCardColor = (index) => {
        const colors = [
            'bg-teal-100 text-teal-600 border-teal-200',
            'bg-blue-100 text-blue-600 border-blue-200',
            'bg-purple-100 text-purple-600 border-purple-200',
            'bg-orange-100 text-orange-600 border-orange-200'
        ];
        return colors[index % colors.length];
    };

    // Loading State
    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl w-full max-w-4xl shadow-2xl border border-teal-200">
                    <div className="flex justify-between items-center p-5 border-b border-teal-100">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg flex items-center justify-center">
                                <FiBarChart2 className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">Warmup Report</h2>
                                <p className="text-gray-500 text-sm">Loading analytics...</p>
                            </div>
                        </div>
                        <button
                            className="text-gray-400 hover:text-gray-600 p-2 rounded-lg transition-colors hover:bg-gray-100"
                            onClick={onClose}
                        >
                            <FiX className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="flex items-center justify-center py-16">
                        <div className="text-center">
                            <div className="w-10 h-10 border-3 border-teal-200 border-t-teal-600 rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-gray-600 text-sm">Generating comprehensive report...</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Performance Tab Content
    const renderPerformanceTab = () => (
        <div className="space-y-6">
            {/* Performance Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    {
                        title: 'Engagement Score',
                        value: reportData.summary.engagementScore,
                        icon: FiAward,
                        description: 'Overall performance'
                    },
                    {
                        title: 'Reply Rate',
                        value: reportData.performanceMetrics.replyRate,
                        icon: FiMessageSquare,
                        description: 'Response effectiveness'
                    },
                    {
                        title: 'Open Rate',
                        value: reportData.performanceMetrics.openRate,
                        icon: FiEye,
                        description: 'Content吸引力'
                    },
                    {
                        title: 'Click Rate',
                        value: reportData.performanceMetrics.clickRate,
                        icon: FiTarget,
                        description: 'Link engagement'
                    }
                ].map((metric, index) => (
                    <div key={index} className="bg-white rounded-xl p-5 border border-teal-200 shadow-sm hover:shadow-md transition-shadow group hover:border-teal-300">
                        <div className="flex items-center justify-between mb-3">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${getCardColor(index)} group-hover:bg-teal-200 transition-colors`}>
                                <metric.icon className="w-6 h-6" />
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-bold text-gray-900">{metric.value}%</div>
                                <div className="text-xs text-gray-500 mt-1">{metric.description}</div>
                            </div>
                        </div>
                        <p className="text-sm font-medium text-gray-700">{metric.title}</p>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                            <div
                                className={`h-2 rounded-full transition-all duration-500 ${getProgressColor(metric.value)}`}
                                style={{ width: `${metric.value}%` }}
                            ></div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Performance Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Deliverability Trend */}
                <div className="bg-white rounded-xl p-5 border border-teal-200 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">Deliverability Trend</h3>
                        <span className={`text-sm font-medium ${getTrendColor(reportData.performanceMetrics.deliverabilityTrend)}`}>
                            {getTrendIcon(reportData.performanceMetrics.deliverabilityTrend)} Trend
                        </span>
                    </div>
                    <div className="flex items-end justify-between h-40 gap-1 px-2">
                        {reportData.dailyStats.slice(-14).map((day, index) => {
                            const height = (day.deliverability / 100) * 120;
                            return (
                                <div key={index} className="flex flex-col items-center flex-1 group">
                                    <div
                                        className="w-full bg-gradient-to-t from-teal-500 to-teal-400 rounded-t-lg transition-all duration-300 group-hover:from-teal-400 group-hover:to-teal-300 relative"
                                        style={{ height: `${height}px` }}
                                    >
                                        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                                            {day.deliverability}%
                                            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1 w-2 h-2 bg-gray-900 rotate-45"></div>
                                        </div>
                                    </div>
                                    <span className="text-xs text-gray-500 mt-2 font-medium">
                                        {new Date(day.date).getDate()}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Engagement Metrics */}
                <div className="bg-white rounded-xl p-5 border border-teal-200 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Engagement Metrics</h3>
                    <div className="space-y-4">
                        {[
                            { label: 'Reply to Open Rate', value: Math.round((reportData.summary.totalReplies / reportData.summary.totalOpened) * 100) },
                            { label: 'Click-to-Open Rate', value: reportData.performanceMetrics.clickRate },
                            { label: 'Overall Engagement', value: reportData.performanceMetrics.engagementRate },
                            { label: 'Growth Momentum', value: reportData.performanceMetrics.growthRate }
                        ].map((metric, index) => (
                            <div key={index} className="space-y-2">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-600">{metric.label}</span>
                                    <span className={`font-semibold ${getMetricColor(metric.value)}`}>
                                        {metric.value}%
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className={`h-2 rounded-full transition-all duration-500 ${getProgressColor(metric.value)}`}
                                        style={{ width: `${Math.min(metric.value, 100)}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Performance Comparison */}
            <div className="bg-white rounded-xl p-5 border border-teal-200 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Comparison</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                        {
                            label: 'Deliverability',
                            current: reportData.summary.averageDeliverability,
                            industry: reportData.comparison.industryAverage.deliverability,
                            previous: reportData.comparison.previousPeriod.deliverability
                        },
                        {
                            label: 'Reply Rate',
                            current: reportData.performanceMetrics.replyRate,
                            industry: reportData.comparison.industryAverage.replyRate,
                            previous: reportData.comparison.previousPeriod.replyRate
                        },
                        {
                            label: 'Open Rate',
                            current: reportData.performanceMetrics.openRate,
                            industry: reportData.comparison.industryAverage.openRate,
                            previous: reportData.comparison.previousPeriod.openRate
                        }
                    ].map((metric, index) => (
                        <div key={index} className="text-center p-4 bg-teal-50 rounded-lg border border-teal-100">
                            <div className="text-sm font-medium text-gray-700 mb-3">{metric.label}</div>
                            <div className="text-2xl font-bold text-gray-900 mb-2">{metric.current}%</div>
                            <div className="space-y-1 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Industry Avg:</span>
                                    <span className={metric.current > metric.industry ? 'text-teal-600' : 'text-red-600'}>
                                        {metric.industry}%
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Previous:</span>
                                    <span className={metric.current > metric.previous ? 'text-teal-600' : 'text-red-600'}>
                                        {metric.previous}%
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    // Analytics Tab Content
    const renderAnalyticsTab = () => (
        <div className="space-y-6">
            {/* Analytics Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                    {
                        title: 'Best Performing Day',
                        value: new Date(reportData.analytics.bestPerformingDay.date).toLocaleDateString('en', { weekday: 'long' }),
                        icon: FiTrendingUp,
                        stat: `${reportData.analytics.bestPerformingDay.sent} emails`
                    },
                    {
                        title: 'Peak Engagement Hour',
                        value: `${reportData.analytics.peakHour}:00`,
                        icon: FiClock,
                        stat: 'Optimal send time'
                    },
                    {
                        title: 'Sender Reputation',
                        value: reportData.analytics.senderReputation,
                        icon: FiUsers,
                        stat: 'Good standing'
                    }
                ].map((item, index) => (
                    <div key={index} className="bg-white rounded-xl p-5 border border-teal-200 shadow-sm hover:shadow-md transition-shadow group hover:border-teal-300">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${getCardColor(index)} group-hover:bg-teal-200 transition-colors`}>
                                <item.icon className="w-6 h-6" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-gray-700 mb-1">{item.title}</p>
                                <p className="text-lg font-bold text-gray-900">{item.value}</p>
                                <p className="text-xs text-gray-500">{item.stat}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Audience Engagement */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl p-5 border border-teal-200 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <FiUsers className="w-5 h-5 text-teal-600" />
                        Audience Engagement
                    </h3>
                    <div className="space-y-4">
                        {[
                            { label: 'Active Subscribers', value: reportData.analytics.audienceEngagement.active, color: 'bg-teal-500' },
                            { label: 'Responsive Audience', value: reportData.analytics.audienceEngagement.responsive, color: 'bg-blue-500' },
                            { label: 'Inactive Users', value: reportData.analytics.audienceEngagement.inactive, color: 'bg-gray-300' }
                        ].map((item, index) => {
                            const total = Object.values(reportData.analytics.audienceEngagement).reduce((a, b) => a + b, 0);
                            const percentage = Math.round((item.value / total) * 100);
                            return (
                                <div key={index} className="space-y-2">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-600">{item.label}</span>
                                        <span className="font-semibold text-gray-900">
                                            {item.value} ({percentage}%)
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-3">
                                        <div
                                            className={`h-3 rounded-full ${item.color} transition-all duration-500`}
                                            style={{ width: `${percentage}%` }}
                                        ></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Performance Distribution */}
                <div className="bg-white rounded-xl p-5 border border-teal-200 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <FiPieChart className="w-5 h-5 text-teal-600" />
                        Performance Distribution
                    </h3>
                    <div className="space-y-4">
                        {reportData.dailyStats.slice(-7).map((day, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-teal-50 rounded-lg border border-teal-100 group hover:bg-teal-100 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center group-hover:bg-teal-200 transition-colors">
                                        <span className="text-teal-600 text-sm font-bold">
                                            {new Date(day.date).getDate()}
                                        </span>
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-gray-900">{day.sent} emails</div>
                                        <div className="text-xs text-gray-500">
                                            {day.replies} replies • {day.deliverability}% deliverability
                                        </div>
                                    </div>
                                </div>
                                <div className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(day.deliverability)}`}>
                                    {day.deliverability}%
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Detailed Analytics */}
            <div className="bg-white rounded-xl border border-teal-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-teal-100 bg-white">
                    <h3 className="text-lg font-semibold text-gray-900">Detailed Performance Analytics</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-teal-50">
                            <tr>
                                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider text-xs">Date</th>
                                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider text-xs">Sent</th>
                                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider text-xs">Opened</th>
                                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider text-xs">Clicked</th>
                                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider text-xs">Replies</th>
                                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider text-xs">Bounce</th>
                                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider text-xs">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {reportData.dailyStats.slice(-10).map((day, index) => (
                                <tr key={index} className="hover:bg-teal-50 transition-colors">
                                    <td className="px-4 py-3 whitespace-nowrap text-gray-900 font-medium">
                                        {new Date(day.date).toLocaleDateString('en', {
                                            month: 'short',
                                            day: 'numeric'
                                        })}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-gray-900">{day.sent}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-gray-900">{day.opened}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-gray-900">{day.clicked}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-gray-900">{day.replies}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-gray-900">{day.bounce}</td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(day.deliverability)}`}>
                                            {day.deliverability}%
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col shadow-2xl border border-teal-200">

                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 border-b border-teal-100 bg-gradient-to-r from-teal-50 to-white flex-shrink-0 gap-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl flex items-center justify-center shadow-sm">
                                <FiBarChart2 className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">Warmup Performance Report</h1>
                                <p className="text-teal-600 text-sm mt-1 break-all">{email.address}</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                        <select
                            value={timeRange}
                            onChange={(e) => setTimeRange(e.target.value)}
                            className="px-3 py-2 border border-teal-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white shadow-sm"
                        >
                            <option value="7d">Last 7 Days</option>
                            <option value="30d">Last 30 Days</option>
                            <option value="90d">Last 90 Days</option>
                        </select>

                        <button
                            onClick={exportReport}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-lg hover:from-teal-700 hover:to-teal-600 transition-all duration-200 shadow-sm hover:shadow-md text-sm font-medium border border-teal-600"
                        >
                            <FiDownload className="w-4 h-4" />
                            <span className="hidden sm:inline">Export</span>
                        </button>
                        <button
                            className="text-gray-400 hover:text-gray-600 p-2 rounded-lg transition-colors hover:bg-gray-100 border border-gray-300"
                            onClick={onClose}
                        >
                            <FiX className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="flex border-b border-teal-100 bg-white px-6 flex-shrink-0 overflow-x-auto">
                    {['overview', 'performance', 'analytics'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab
                                ? 'border-teal-600 text-teal-600'
                                : 'border-transparent text-gray-500 hover:text-teal-600'
                                }`}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-teal-50/30">
                    {reportData && (
                        <div className="space-y-6">
                            {activeTab === 'overview' && (
                                <>
                                    {/* Key Metrics Grid */}
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                                        {[
                                            {
                                                title: 'Total Sent',
                                                value: reportData.summary.totalSent.toLocaleString(),
                                                icon: FiMail,
                                                color: 'bg-teal-100 text-teal-600'
                                            },
                                            {
                                                title: 'Total Replies',
                                                value: reportData.summary.totalReplies.toLocaleString(),
                                                icon: FiTrendingUp,
                                                color: 'bg-green-100 text-green-600'
                                            },
                                            {
                                                title: 'Deliverability',
                                                value: `${reportData.summary.averageDeliverability}%`,
                                                icon: FiActivity,
                                                color: 'bg-purple-100 text-purple-600'
                                            },
                                            {
                                                title: 'Reply Rate',
                                                value: `${reportData.performanceMetrics.replyRate}%`,
                                                icon: FiMessageSquare,
                                                color: 'bg-orange-100 text-orange-600'
                                            }
                                        ].map((metric, index) => (
                                            <div key={index} className="bg-white rounded-xl p-4 sm:p-5 border border-teal-200 shadow-sm hover:shadow-md transition-shadow group hover:border-teal-300">
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center ${metric.color} group-hover:bg-teal-200 group-hover:text-teal-600 transition-colors`}>
                                                        <metric.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                                                    </div>
                                                    <span className={`text-xl sm:text-2xl font-bold ${index === 2 || index === 3 ? getMetricColor(parseInt(metric.value)) : 'text-gray-900'}`}>
                                                        {metric.value}
                                                    </span>
                                                </div>
                                                <p className="text-sm font-medium text-gray-700">{metric.title}</p>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    {index === 0 ? 'Emails delivered' :
                                                        index === 1 ? 'Engagement received' :
                                                            index === 2 ? 'Success rate' : 'Response percentage'}
                                                </p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Charts and Detailed Metrics */}
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                                        {/* Performance Chart */}
                                        <div className="lg:col-span-2 bg-white rounded-xl p-4 sm:p-5 border border-teal-200 shadow-sm">
                                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Email Volume Trend</h3>
                                            <div className="flex items-end justify-between h-40 sm:h-48 gap-1 sm:gap-2 px-1 sm:px-2">
                                                {reportData.dailyStats.slice(-14).map((day, index) => {
                                                    const maxSent = Math.max(...reportData.dailyStats.map(d => d.sent));
                                                    const height = (day.sent / maxSent) * 100;
                                                    return (
                                                        <div key={index} className="flex flex-col items-center flex-1 group">
                                                            <div
                                                                className="w-full bg-gradient-to-t from-teal-500 to-teal-400 rounded-t-lg transition-all duration-300 group-hover:from-teal-400 group-hover:to-teal-300 relative"
                                                                style={{ height: `${height}%` }}
                                                            >
                                                                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                                                                    {day.sent} emails
                                                                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1 w-2 h-2 bg-gray-900 rotate-45"></div>
                                                                </div>
                                                            </div>
                                                            <span className="text-xs text-gray-500 mt-2 font-medium">
                                                                {new Date(day.date).toLocaleDateString('en', { day: 'numeric' })}
                                                            </span>
                                                            <span className="text-[10px] text-gray-400 uppercase tracking-wide">
                                                                {new Date(day.date).toLocaleDateString('en', { month: 'short' })}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Performance Metrics */}
                                        <div className="bg-white rounded-xl p-4 sm:p-5 border border-teal-200 shadow-sm">
                                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Score</h3>
                                            <div className="space-y-4">
                                                {[
                                                    { label: 'Reply Rate', value: reportData.performanceMetrics.replyRate },
                                                    { label: 'Engagement Rate', value: reportData.performanceMetrics.engagementRate },
                                                    { label: 'Open Rate', value: reportData.performanceMetrics.openRate },
                                                    { label: 'Click Rate', value: reportData.performanceMetrics.clickRate },
                                                    { label: 'Growth Rate', value: reportData.performanceMetrics.growthRate }
                                                ].map((metric, index) => (
                                                    <div key={index} className="space-y-2">
                                                        <div className="flex justify-between items-center text-sm">
                                                            <span className="text-gray-600">{metric.label}</span>
                                                            <span className={`font-semibold ${getMetricColor(metric.value)}`}>
                                                                {metric.value}%
                                                            </span>
                                                        </div>
                                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                                            <div
                                                                className={`h-2 rounded-full transition-all duration-500 ${getProgressColor(metric.value)}`}
                                                                style={{ width: `${metric.value}%` }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Detailed Statistics and Activity */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                                        {/* Recent Activity Table */}
                                        <div className="bg-white rounded-xl border border-teal-200 shadow-sm overflow-hidden">
                                            <div className="px-4 sm:px-5 py-4 border-b border-teal-100 bg-white">
                                                <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-teal-50">
                                                        <tr>
                                                            <th className="px-3 sm:px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider text-xs">
                                                                Date
                                                            </th>
                                                            <th className="px-3 sm:px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider text-xs">
                                                                Sent
                                                            </th>
                                                            <th className="px-3 sm:px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider text-xs">
                                                                Replies
                                                            </th>
                                                            <th className="px-3 sm:px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider text-xs">
                                                                Status
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white divide-y divide-gray-200">
                                                        {reportData.dailyStats.slice(-6).map((day, index) => (
                                                            <tr key={index} className="hover:bg-teal-50 transition-colors">
                                                                <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-gray-900 font-medium">
                                                                    {new Date(day.date).toLocaleDateString('en', {
                                                                        month: 'short',
                                                                        day: 'numeric'
                                                                    })}
                                                                </td>
                                                                <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-gray-900">
                                                                    {day.sent}
                                                                </td>
                                                                <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-gray-900">
                                                                    {day.replies}
                                                                </td>
                                                                <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                                                                    <span className={`inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(day.deliverability)}`}>
                                                                        {day.deliverability}%
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        {/* Recommendations */}
                                        <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-xl border border-teal-200 p-4 sm:p-5 shadow-sm">
                                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                                <FiEye className="w-5 h-5 text-teal-600" />
                                                Recommendations
                                            </h3>
                                            <div className="space-y-3">
                                                {reportData.recommendations.map((rec, index) => (
                                                    <div key={index} className="flex items-start gap-3 p-3 bg-white/80 rounded-lg border border-teal-100 group hover:bg-white transition-colors">
                                                        <div className="w-6 h-6 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-teal-200 transition-colors">
                                                            <span className="text-teal-600 text-xs font-bold">{index + 1}</span>
                                                        </div>
                                                        <p className="text-sm text-gray-700">{rec}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {activeTab === 'performance' && renderPerformanceTab()}
                            {activeTab === 'analytics' && renderAnalyticsTab()}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-t border-teal-100 bg-white flex-shrink-0 gap-3">
                    <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                        <span>Report generated on {new Date().toLocaleDateString()}</span>
                        <span className="text-gray-300 hidden sm:inline">•</span>
                        <span className="text-teal-600 font-medium">
                            {reportData?.period === '7d' ? '7 Days' : reportData?.period === '30d' ? '30 Days' : '90 Days'} Analysis
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm bg-white border border-teal-600 text-teal-600 rounded-lg hover:bg-teal-600 hover:text-white transition-all duration-200 font-medium w-full sm:w-auto"
                    >
                        Close Report
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WarmupReport;












// import React, { useState, useEffect } from 'react';
// import { FiX, FiDownload, FiCalendar, FiMail, FiTrendingUp, FiActivity, FiBarChart2, FiEye } from 'react-icons/fi';
// import axios from 'axios';
// import { toast } from 'react-toastify';

// const API_BASE_URL = 'http://localhost:5000';

// const WarmupReport = ({ email, onClose }) => {
//     const [reportData, setReportData] = useState(null);
//     const [loading, setLoading] = useState(true);
//     const [timeRange, setTimeRange] = useState('7d');
//     const [activeTab, setActiveTab] = useState('overview');

//     // Enhanced mock data generator
//     const generateMockReportData = (email) => {
//         const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
//         const baseDate = new Date();

//         const dailyStats = Array.from({ length: days }, (_, i) => {
//             const date = new Date(baseDate);
//             date.setDate(date.getDate() - (days - i - 1));

//             const sent = Math.floor(Math.random() * 50) + 15;
//             const replies = Math.floor(Math.random() * 12) + 3;
//             const deliverability = Math.floor(Math.random() * 25) + 70;

//             return {
//                 date: date.toISOString().split('T')[0],
//                 sent,
//                 replies,
//                 deliverability,
//                 inbox: Math.floor(Math.random() * 15) + 80,
//                 spam: Math.floor(Math.random() * 3) + 1,
//                 opened: Math.floor(sent * (Math.random() * 0.3 + 0.4)),
//                 clicked: Math.floor(sent * (Math.random() * 0.2 + 0.1))
//             };
//         });

//         const totalSent = dailyStats.reduce((sum, day) => sum + day.sent, 0);
//         const totalReplies = dailyStats.reduce((sum, day) => sum + day.replies, 0);
//         const avgDeliverability = Math.round(dailyStats.reduce((sum, day) => sum + day.deliverability, 0) / days);

//         return {
//             email: email.address,
//             period: timeRange,
//             summary: {
//                 totalSent,
//                 totalReplies,
//                 averageDeliverability: avgDeliverability,
//                 spamRate: 2.5,
//                 inboxRate: 87.3,
//                 totalOpened: dailyStats.reduce((sum, day) => sum + day.opened, 0),
//                 totalClicked: dailyStats.reduce((sum, day) => sum + day.clicked, 0)
//             },
//             dailyStats,
//             performanceMetrics: {
//                 replyRate: Math.round((totalReplies / totalSent) * 100),
//                 engagementRate: Math.round((dailyStats.reduce((sum, day) => sum + day.opened, 0) / totalSent) * 100),
//                 growthRate: Math.round((dailyStats[dailyStats.length - 1].sent - dailyStats[0].sent) / dailyStats[0].sent * 100),
//                 openRate: Math.round((dailyStats.reduce((sum, day) => sum + day.opened, 0) / totalSent) * 100),
//                 clickRate: Math.round((dailyStats.reduce((sum, day) => sum + day.clicked, 0) / totalSent) * 100)
//             },
//             recommendations: [
//                 "Increase daily send volume gradually",
//                 "Focus on improving reply rates",
//                 "Monitor spam folder regularly"
//             ]
//         };
//     };

//     useEffect(() => {
//         const fetchReportData = async () => {
//             try {
//                 setLoading(true);
//                 const token = localStorage.getItem('token');

//                 if (!token) {
//                     toast.error('Please login again');
//                     return;
//                 }

//                 // Simulate API delay
//                 setTimeout(() => {
//                     const mockData = generateMockReportData(email);
//                     setReportData(mockData);
//                     setLoading(false);
//                 }, 600);

//             } catch (error) {
//                 console.error('Error fetching report data:', error);
//                 toast.error('Failed to load warmup report');
//                 setLoading(false);
//             }
//         };

//         if (email) {
//             fetchReportData();
//         }
//     }, [email, timeRange]);

//     const exportReport = () => {
//         if (!reportData) return;

//         const dataStr = JSON.stringify(reportData, null, 2);
//         const dataBlob = new Blob([dataStr], { type: 'application/json' });
//         const url = URL.createObjectURL(dataBlob);
//         const link = document.createElement('a');
//         link.href = url;
//         link.download = `warmup-report-${email.address}-${new Date().toISOString().split('T')[0]}.json`;
//         document.body.appendChild(link);
//         link.click();
//         document.body.removeChild(link);
//         URL.revokeObjectURL(url);

//         toast.success('Report exported successfully');
//     };

//     const getProgressColor = (percentage) => {
//         if (percentage >= 80) return 'bg-green-500';
//         if (percentage >= 60) return 'bg-yellow-500';
//         return 'bg-red-500';
//     };

//     const getStatusColor = (percentage) => {
//         if (percentage >= 80) return 'text-green-700 bg-green-100 border-green-200';
//         if (percentage >= 60) return 'text-yellow-700 bg-yellow-100 border-yellow-200';
//         return 'text-red-700 bg-red-100 border-red-200';
//     };

//     const getMetricColor = (value, type = 'positive') => {
//         if (type === 'positive') {
//             return value >= 80 ? 'text-green-600' : value >= 60 ? 'text-yellow-600' : 'text-red-600';
//         }
//         return value <= 2 ? 'text-green-600' : value <= 5 ? 'text-yellow-600' : 'text-red-600';
//     };

//     // Loading State
//     if (loading) {
//         return (
//             <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
//                 <div className="bg-white rounded-xl w-full max-w-4xl shadow-2xl border border-gray-200/80">
//                     <div className="flex justify-between items-center p-5 border-b border-gray-200">
//                         <div className="flex items-center gap-3">
//                             <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
//                                 <FiBarChart2 className="w-4 h-4 text-white" />
//                             </div>
//                             <div>
//                                 <h2 className="text-lg font-semibold text-gray-900">Warmup Report</h2>
//                                 <p className="text-gray-500 text-sm">Loading analytics...</p>
//                             </div>
//                         </div>
//                         <button
//                             className="text-gray-400 hover:text-gray-600 p-2 rounded-lg transition-colors hover:bg-gray-100"
//                             onClick={onClose}
//                         >
//                             <FiX className="w-5 h-5" />
//                         </button>
//                     </div>
//                     <div className="flex items-center justify-center py-16">
//                         <div className="text-center">
//                             <div className="w-10 h-10 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
//                             <p className="text-gray-600 text-sm">Generating comprehensive report...</p>
//                         </div>
//                     </div>
//                 </div>
//             </div>
//         );
//     }

//     return (
//         <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
//             <div className="bg-white rounded-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-gray-200/80">

//                 {/* Header - Elegant Design */}
//                 <div className="flex justify-between items-start p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white flex-shrink-0">
//                     <div className="flex-1 min-w-0">
//                         <div className="flex items-center gap-3 mb-2">
//                             <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-sm">
//                                 <FiBarChart2 className="w-5 h-5 text-white" />
//                             </div>
//                             <div>
//                                 <h1 className="text-xl font-bold text-gray-900">Warmup Performance Report</h1>
//                                 <p className="text-gray-600 text-sm mt-1">{email.address}</p>
//                             </div>
//                         </div>
//                     </div>
//                     <div className="flex items-center gap-3 ml-6 flex-shrink-0">
//                         <select
//                             value={timeRange}
//                             onChange={(e) => setTimeRange(e.target.value)}
//                             className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm"
//                         >
//                             <option value="7d">Last 7 Days</option>
//                             <option value="30d">Last 30 Days</option>
//                             <option value="90d">Last 90 Days</option>
//                         </select>

//                         <button
//                             onClick={exportReport}
//                             className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg hover:from-blue-700 hover:to-blue-600 transition-all duration-200 shadow-sm hover:shadow-md text-sm font-medium"
//                         >
//                             <FiDownload className="w-4 h-4" />
//                             Export
//                         </button>
//                         <button
//                             className="text-gray-400 hover:text-gray-600 p-2 rounded-lg transition-colors hover:bg-gray-100"
//                             onClick={onClose}
//                         >
//                             <FiX className="w-5 h-5" />
//                         </button>
//                     </div>
//                 </div>

//                 {/* Navigation Tabs */}
//                 <div className="flex border-b border-gray-200 bg-white px-6 flex-shrink-0">
//                     <button
//                         onClick={() => setActiveTab('overview')}
//                         className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'overview'
//                             ? 'border-blue-500 text-blue-600'
//                             : 'border-transparent text-gray-500 hover:text-gray-700'
//                             }`}
//                     >
//                         Overview
//                     </button>
//                     <button
//                         onClick={() => setActiveTab('performance')}
//                         className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'performance'
//                             ? 'border-blue-500 text-blue-600'
//                             : 'border-transparent text-gray-500 hover:text-gray-700'
//                             }`}
//                     >
//                         Performance
//                     </button>
//                     <button
//                         onClick={() => setActiveTab('analytics')}
//                         className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'analytics'
//                             ? 'border-blue-500 text-blue-600'
//                             : 'border-transparent text-gray-500 hover:text-gray-700'
//                             }`}
//                     >
//                         Analytics
//                     </button>
//                 </div>

//                 {/* Content Area */}
//                 <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
//                     {reportData && (
//                         <div className="space-y-6">

//                             {/* Key Metrics Grid */}
//                             <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
//                                 <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
//                                     <div className="flex items-center justify-between mb-3">
//                                         <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
//                                             <FiMail className="w-5 h-5 text-blue-600" />
//                                         </div>
//                                         <span className="text-2xl font-bold text-gray-900">
//                                             {reportData.summary.totalSent.toLocaleString()}
//                                         </span>
//                                     </div>
//                                     <p className="text-sm font-medium text-gray-700">Total Sent</p>
//                                     <p className="text-xs text-gray-500 mt-1">Emails delivered</p>
//                                 </div>

//                                 <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
//                                     <div className="flex items-center justify-between mb-3">
//                                         <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
//                                             <FiTrendingUp className="w-5 h-5 text-green-600" />
//                                         </div>
//                                         <span className="text-2xl font-bold text-gray-900">
//                                             {reportData.summary.totalReplies.toLocaleString()}
//                                         </span>
//                                     </div>
//                                     <p className="text-sm font-medium text-gray-700">Total Replies</p>
//                                     <p className="text-xs text-gray-500 mt-1">Engagement received</p>
//                                 </div>

//                                 <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
//                                     <div className="flex items-center justify-between mb-3">
//                                         <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
//                                             <FiActivity className="w-5 h-5 text-purple-600" />
//                                         </div>
//                                         <span className={`text-2xl font-bold ${getMetricColor(reportData.summary.averageDeliverability)}`}>
//                                             {reportData.summary.averageDeliverability}%
//                                         </span>
//                                     </div>
//                                     <p className="text-sm font-medium text-gray-700">Deliverability</p>
//                                     <p className="text-xs text-gray-500 mt-1">Success rate</p>
//                                 </div>

//                                 <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
//                                     <div className="flex items-center justify-between mb-3">
//                                         <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
//                                             <FiCalendar className="w-5 h-5 text-orange-600" />
//                                         </div>
//                                         <span className={`text-2xl font-bold ${getMetricColor(reportData.performanceMetrics.replyRate)}`}>
//                                             {reportData.performanceMetrics.replyRate}%
//                                         </span>
//                                     </div>
//                                     <p className="text-sm font-medium text-gray-700">Reply Rate</p>
//                                     <p className="text-xs text-gray-500 mt-1">Response percentage</p>
//                                 </div>
//                             </div>

//                             {/* Charts and Detailed Metrics */}
//                             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

//                                 {/* Performance Chart */}
//                                 <div className="lg:col-span-2 bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
//                                     <h3 className="text-lg font-semibold text-gray-900 mb-4">Email Volume Trend</h3>
//                                     <div className="flex items-end justify-between h-48 gap-2 px-2">
//                                         {reportData.dailyStats.slice(-14).map((day, index) => {
//                                             const maxSent = Math.max(...reportData.dailyStats.map(d => d.sent));
//                                             const height = (day.sent / maxSent) * 100;
//                                             return (
//                                                 <div key={index} className="flex flex-col items-center flex-1 group">
//                                                     <div
//                                                         className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-lg transition-all duration-300 group-hover:from-blue-400 group-hover:to-blue-300 relative"
//                                                         style={{ height: `${height}%` }}
//                                                     >
//                                                         <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
//                                                             {day.sent} emails
//                                                             <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1 w-2 h-2 bg-gray-900 rotate-45"></div>
//                                                         </div>
//                                                     </div>
//                                                     <span className="text-xs text-gray-500 mt-2 font-medium">
//                                                         {new Date(day.date).toLocaleDateString('en', { day: 'numeric' })}
//                                                     </span>
//                                                     <span className="text-[10px] text-gray-400 uppercase tracking-wide">
//                                                         {new Date(day.date).toLocaleDateString('en', { month: 'short' })}
//                                                     </span>
//                                                 </div>
//                                             );
//                                         })}
//                                     </div>
//                                 </div>

//                                 {/* Performance Metrics */}
//                                 <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
//                                     <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Score</h3>
//                                     <div className="space-y-4">
//                                         {[
//                                             { label: 'Reply Rate', value: reportData.performanceMetrics.replyRate },
//                                             { label: 'Engagement Rate', value: reportData.performanceMetrics.engagementRate },
//                                             { label: 'Open Rate', value: reportData.performanceMetrics.openRate },
//                                             { label: 'Click Rate', value: reportData.performanceMetrics.clickRate },
//                                             { label: 'Growth Rate', value: reportData.performanceMetrics.growthRate }
//                                         ].map((metric, index) => (
//                                             <div key={index} className="space-y-2">
//                                                 <div className="flex justify-between items-center text-sm">
//                                                     <span className="text-gray-600">{metric.label}</span>
//                                                     <span className={`font-semibold ${getMetricColor(metric.value)}`}>
//                                                         {metric.value}%
//                                                     </span>
//                                                 </div>
//                                                 <div className="w-full bg-gray-200 rounded-full h-2">
//                                                     <div
//                                                         className={`h-2 rounded-full transition-all duration-500 ${getProgressColor(metric.value)}`}
//                                                         style={{ width: `${metric.value}%` }}
//                                                     ></div>
//                                                 </div>
//                                             </div>
//                                         ))}
//                                     </div>
//                                 </div>
//                             </div>

//                             {/* Detailed Statistics and Activity */}
//                             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

//                                 {/* Recent Activity Table */}
//                                 <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
//                                     <div className="px-5 py-4 border-b border-gray-200 bg-white">
//                                         <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
//                                     </div>
//                                     <div className="overflow-x-auto">
//                                         <table className="w-full text-sm">
//                                             <thead className="bg-gray-50">
//                                                 <tr>
//                                                     <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider text-xs">
//                                                         Date
//                                                     </th>
//                                                     <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider text-xs">
//                                                         Sent
//                                                     </th>
//                                                     <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider text-xs">
//                                                         Replies
//                                                     </th>
//                                                     <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider text-xs">
//                                                         Status
//                                                     </th>
//                                                 </tr>
//                                             </thead>
//                                             <tbody className="bg-white divide-y divide-gray-200">
//                                                 {reportData.dailyStats.slice(-6).map((day, index) => (
//                                                     <tr key={index} className="hover:bg-gray-50 transition-colors">
//                                                         <td className="px-4 py-3 whitespace-nowrap text-gray-900 font-medium">
//                                                             {new Date(day.date).toLocaleDateString('en', {
//                                                                 month: 'short',
//                                                                 day: 'numeric',
//                                                                 year: 'numeric'
//                                                             })}
//                                                         </td>
//                                                         <td className="px-4 py-3 whitespace-nowrap text-gray-900">
//                                                             {day.sent}
//                                                         </td>
//                                                         <td className="px-4 py-3 whitespace-nowrap text-gray-900">
//                                                             {day.replies}
//                                                         </td>
//                                                         <td className="px-4 py-3 whitespace-nowrap">
//                                                             <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(day.deliverability)}`}>
//                                                                 {day.deliverability}%
//                                                             </span>
//                                                         </td>
//                                                     </tr>
//                                                 ))}
//                                             </tbody>
//                                         </table>
//                                     </div>
//                                 </div>

//                                 {/* Recommendations */}
//                                 <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-5 shadow-sm">
//                                     <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
//                                         <FiEye className="w-5 h-5 text-blue-600" />
//                                         Recommendations
//                                     </h3>
//                                     <div className="space-y-3">
//                                         {reportData.recommendations.map((rec, index) => (
//                                             <div key={index} className="flex items-start gap-3 p-3 bg-white/80 rounded-lg border border-blue-100">
//                                                 <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
//                                                     <span className="text-blue-600 text-xs font-bold">{index + 1}</span>
//                                                 </div>
//                                                 <p className="text-sm text-gray-700">{rec}</p>
//                                             </div>
//                                         ))}
//                                     </div>
//                                 </div>
//                             </div>
//                         </div>
//                     )}
//                 </div>

//                 {/* Footer */}
//                 <div className="flex justify-between items-center p-4 border-t border-gray-200 bg-white flex-shrink-0">
//                     <div className="flex items-center gap-4 text-sm text-gray-500">
//                         <span>Report generated on {new Date().toLocaleDateString()}</span>
//                         <span className="text-gray-300">•</span>
//                         <span>{reportData?.period === '7d' ? '7 Days' : reportData?.period === '30d' ? '30 Days' : '90 Days'} Analysis</span>
//                     </div>
//                     <button
//                         onClick={onClose}
//                         className="px-4 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
//                     >
//                         Close Report
//                     </button>
//                 </div>
//             </div>
//         </div>
//     );
// };

// export default WarmupReport;