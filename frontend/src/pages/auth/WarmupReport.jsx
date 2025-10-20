import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    FiX, FiDownload, FiCalendar, FiMail, FiTrendingUp, FiActivity,
    FiBarChart2, FiEye, FiUsers, FiTarget, FiClock, FiAward,
    FiMessageSquare, FiFilter, FiRefreshCw, FiPieChart, FiStar,
    FiCheck, FiAlertCircle, FiInfo, FiFileText, FiArrowUp, FiArrowDown
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const API_BASE_URL = 'http://localhost:5000';

// Constants for better maintainability
const TIME_RANGES = {
    '7d': { label: 'Last 7 Days', days: 7 },
    '30d': { label: 'Last 30 Days', days: 30 },
    '90d': { label: 'Last 90 Days', days: 90 }
};

const PERFORMANCE_THRESHOLDS = {
    EXCELLENT: 80,
    GOOD: 60,
    POOR: 0
};

const WarmupReport = ({ email, onClose }) => {
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState('7d');
    const [activeTab, setActiveTab] = useState('overview');
    const [exporting, setExporting] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const reportRef = useRef();

    // Prevent background scrolling when modal is open
    useEffect(() => {
        // Store the original body overflow value
        const originalStyle = window.getComputedStyle(document.body).overflow;
        // Disable scrolling on body
        document.body.style.overflow = 'hidden';

        // Re-enable scrolling when component unmounts
        return () => {
            document.body.style.overflow = originalStyle;
        };
    }, []);

    // Enhanced mock data generator with realistic patterns
    const generateMockReportData = useCallback((email) => {
        const { days } = TIME_RANGES[timeRange];
        const baseDate = new Date();

        const dailyStats = Array.from({ length: days }, (_, i) => {
            const date = new Date(baseDate);
            date.setDate(date.getDate() - (days - i - 1));

            // More realistic data with trends
            const baseSent = 20 + Math.sin(i * 0.5) * 10 + Math.random() * 15;
            const sent = Math.max(10, Math.round(baseSent));
            const deliverability = 85 + Math.sin(i * 0.3) * 5 + (Math.random() * 4 - 2);
            const openRate = 0.4 + Math.sin(i * 0.4) * 0.1 + (Math.random() * 0.1);
            const clickRate = 0.15 + Math.sin(i * 0.6) * 0.05 + (Math.random() * 0.05);
            const replyRate = 0.08 + Math.sin(i * 0.7) * 0.03 + (Math.random() * 0.02);

            const opens = Math.floor(sent * openRate);
            const clicks = Math.floor(opens * clickRate);
            const replies = Math.floor(sent * replyRate);

            return {
                date: date.toISOString().split('T')[0],
                sent,
                replies,
                deliverability: Math.round(deliverability),
                inbox: Math.floor(Math.random() * 8) + 88,
                spam: Math.floor(Math.random() * 2) + 1,
                opened: opens,
                clicked: clicks,
                bounce: Math.floor(Math.random() * 2),
                unsubscribed: Math.floor(Math.random() * 1)
            };
        });

        const totalSent = dailyStats.reduce((sum, day) => sum + day.sent, 0);
        const totalReplies = dailyStats.reduce((sum, day) => sum + day.replies, 0);
        const totalOpened = dailyStats.reduce((sum, day) => sum + day.opened, 0);
        const totalClicked = dailyStats.reduce((sum, day) => sum + day.clicked, 0);
        const avgDeliverability = Math.round(dailyStats.reduce((sum, day) => sum + day.deliverability, 0) / days);

        // Calculate trends
        const recentAvg = dailyStats.slice(-7).reduce((sum, day) => sum + day.deliverability, 0) / 7;
        const previousAvg = dailyStats.slice(-14, -7).reduce((sum, day) => sum + day.deliverability, 0) / 7;
        const deliverabilityTrend = recentAvg > previousAvg ? 'up' : 'down';

        return {
            email: email.address,
            period: timeRange,
            summary: {
                totalSent,
                totalReplies,
                totalOpened,
                totalClicked,
                averageDeliverability: avgDeliverability,
                spamRate: 1.8,
                inboxRate: 89.2,
                bounceRate: 0.8,
                engagementScore: Math.floor(Math.random() * 25) + 70,
                growthRate: Math.floor(Math.random() * 100) + 150
            },
            dailyStats,
            performanceMetrics: {
                replyRate: Math.round((totalReplies / totalSent) * 100),
                openRate: Math.round((totalOpened / totalSent) * 100),
                clickRate: Math.round((totalClicked / totalOpened) * 100),
                engagementRate: Math.round(((totalReplies + totalClicked) / totalSent) * 100),
                growthRate: Math.floor(Math.random() * 100) + 150,
                deliverabilityTrend,
                spamTrend: Math.random() > 0.6 ? 'up' : 'down',
                inboxPlacement: Math.floor(Math.random() * 10) + 85
            },
            analytics: {
                bestPerformingDay: dailyStats.reduce((best, day) =>
                    day.replies > best.replies ? day : best, dailyStats[0]),
                worstPerformingDay: dailyStats.reduce((worst, day) =>
                    day.replies < worst.replies ? day : worst, dailyStats[0]),
                peakHour: Math.floor(Math.random() * 8) + 9, // 9 AM - 5 PM
                audienceEngagement: {
                    highlyActive: Math.floor(Math.random() * 100) + 80,
                    active: Math.floor(Math.random() * 150) + 100,
                    responsive: Math.floor(Math.random() * 80) + 40,
                    inactive: Math.floor(Math.random() * 30) + 10
                },
                senderReputation: Math.floor(Math.random() * 20) + 75,
                domainAuthority: Math.floor(Math.random() * 20) + 70
            },
            recommendations: [
                {
                    title: "Increase Send Volume",
                    description: "Gradually increase daily send volume by 10-15%",
                    priority: "high",
                    impact: "high"
                },
                {
                    title: "Personalize Content",
                    description: "Focus on improving reply rates with personalized content",
                    priority: "medium",
                    impact: "high"
                },
                {
                    title: "Monitor Spam Folders",
                    description: "Regularly check spam folders and adjust content strategy",
                    priority: "medium",
                    impact: "medium"
                },
                {
                    title: "Optimize Send Times",
                    description: "Schedule emails based on engagement patterns",
                    priority: "low",
                    impact: "medium"
                },
                {
                    title: "A/B Test Subject Lines",
                    description: "Test different subject lines for better open rates",
                    priority: "low",
                    impact: "medium"
                }
            ],
            insights: {
                topPerformingDays: ['Tuesday', 'Wednesday'],
                optimalSendTime: '10:00 AM - 2:00 PM',
                engagementPeak: '11:00 AM',
                improvementAreas: ['Reply Rates', 'Content Personalization']
            },
            comparison: {
                industryAverage: {
                    deliverability: 85,
                    replyRate: 12,
                    openRate: 42,
                    clickRate: 8
                },
                previousPeriod: {
                    deliverability: avgDeliverability - 3,
                    replyRate: Math.round((totalReplies / totalSent) * 100) - 2,
                    openRate: Math.round((totalOpened / totalSent) * 100) - 5,
                    clickRate: Math.round((totalClicked / totalOpened) * 100) - 1
                }
            }
        };
    }, [timeRange]);

    // Fetch report data
    const fetchReportData = useCallback(async (showRefresh = false) => {
        try {
            if (showRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            const token = localStorage.getItem('token');
            if (!token) {
                toast.error('Please login again');
                return;
            }

            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 800));
            const mockData = generateMockReportData(email);
            setReportData(mockData);

            if (showRefresh) {
                toast.success('Report data refreshed!');
            }
        } catch (error) {
            console.error('Error fetching report data:', error);
            toast.error('Failed to load warmup report');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [email, generateMockReportData]);

    useEffect(() => {
        if (email) {
            fetchReportData();
        }
    }, [email, timeRange, fetchReportData]);

    // Enhanced PDF export with better formatting
    const exportToPDF = async () => {
        if (!reportData) {
            toast.error('No report data available');
            return;
        }

        setExporting(true);
        try {
            const input = reportRef.current;

            // Create a clone of the element for PDF generation
            const clone = input.cloneNode(true);

            // Remove interactive elements
            const buttons = clone.querySelectorAll('button');
            buttons.forEach(button => button.remove());

            const selects = clone.querySelectorAll('select');
            selects.forEach(select => select.remove());

            // Add PDF-specific styling
            clone.style.width = '794px'; // A4 width
            clone.style.padding = '20px';
            clone.style.backgroundColor = 'white';
            clone.style.fontSize = '12px';
            clone.style.position = 'absolute';
            clone.style.left = '-9999px';
            clone.style.top = '0';

            // Append clone to body
            document.body.appendChild(clone);

            const canvas = await html2canvas(clone, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                width: clone.scrollWidth,
                height: clone.scrollHeight,
                scrollX: 0,
                scrollY: 0
            });

            // Remove the clone
            document.body.removeChild(clone);

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgWidth = 190; // Slightly smaller for margins
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            // Add header
            pdf.setFillColor(19, 78, 74);
            pdf.rect(0, 0, 210, 25, 'F');
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(16);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Email Warmup Performance Report', 105, 12, { align: 'center' });

            pdf.setFontSize(10);
            pdf.text(`Generated on ${new Date().toLocaleDateString()}`, 105, 18, { align: 'center' });

            // Add report summary
            pdf.setTextColor(0, 0, 0);
            pdf.setFontSize(11);
            pdf.text(`Email: ${email.address}`, 15, 35);
            pdf.text(`Period: ${TIME_RANGES[timeRange].label}`, 15, 42);
            pdf.text(`Report Focus: ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`, 15, 49);

            // Add main content
            pdf.addImage(imgData, 'PNG', 10, 55, imgWidth, imgHeight);

            // Add footer to all pages
            const pageCount = pdf.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                pdf.setPage(i);
                pdf.setFontSize(8);
                pdf.setTextColor(100, 100, 100);
                pdf.text(`Page ${i} of ${pageCount}`, 105, 287, { align: 'center' });
                pdf.text('Confidential - Email Warmup Report', 105, 292, { align: 'center' });
            }

            const fileName = `warmup-report-${email.address.replace(/[@.]/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
            pdf.save(fileName);
            toast.success('PDF report downloaded successfully!');

        } catch (error) {
            console.error('Error generating PDF:', error);
            toast.error('Failed to generate PDF report');
        } finally {
            setExporting(false);
        }
    };

    // Utility functions with memoization
    const getProgressColor = useCallback((percentage) => {
        if (percentage >= PERFORMANCE_THRESHOLDS.EXCELLENT) return 'bg-gradient-to-r from-green-500 to-teal-500';
        if (percentage >= PERFORMANCE_THRESHOLDS.GOOD) return 'bg-gradient-to-r from-yellow-500 to-amber-500';
        return 'bg-gradient-to-r from-red-500 to-pink-500';
    }, []);

    const getStatusColor = useCallback((percentage) => {
        if (percentage >= PERFORMANCE_THRESHOLDS.EXCELLENT) return 'text-green-700 bg-green-100 border-green-200';
        if (percentage >= PERFORMANCE_THRESHOLDS.GOOD) return 'text-yellow-700 bg-yellow-100 border-yellow-200';
        return 'text-red-700 bg-red-100 border-red-200';
    }, []);

    const getMetricColor = useCallback((value, type = 'positive') => {
        if (type === 'positive') {
            return value >= PERFORMANCE_THRESHOLDS.EXCELLENT ? 'text-green-600' :
                value >= PERFORMANCE_THRESHOLDS.GOOD ? 'text-yellow-600' : 'text-red-600';
        }
        return value <= 2 ? 'text-green-600' : value <= 5 ? 'text-yellow-600' : 'text-red-600';
    }, []);

    const getTrendIcon = useCallback((trend) => {
        return trend === 'up' ? <FiArrowUp className="w-4 h-4" /> : <FiArrowDown className="w-4 h-4" />;
    }, []);

    const getTrendColor = useCallback((trend) => {
        return trend === 'up' ? 'text-green-500' : 'text-red-500';
    }, []);

    const getCardColor = useCallback((index) => {
        const colors = [
            'bg-gradient-to-br from-teal-100 to-teal-50 text-teal-600 border-teal-200',
            'bg-gradient-to-br from-blue-100 to-blue-50 text-blue-600 border-blue-200',
            'bg-gradient-to-br from-purple-100 to-purple-50 text-purple-600 border-purple-200',
            'bg-gradient-to-br from-orange-100 to-orange-50 text-orange-600 border-orange-200',
            'bg-gradient-to-br from-green-100 to-green-50 text-green-600 border-green-200'
        ];
        return colors[index % colors.length];
    }, []);

    const getPriorityColor = useCallback((priority) => {
        switch (priority) {
            case 'high': return 'border-l-red-400 bg-red-50';
            case 'medium': return 'border-l-yellow-400 bg-yellow-50';
            case 'low': return 'border-l-green-400 bg-green-50';
            default: return 'border-l-gray-400 bg-gray-50';
        }
    }, []);

    // Memoized chart data
    const chartData = useMemo(() => {
        if (!reportData) return null;

        return {
            labels: reportData.dailyStats.slice(-14).map(day =>
                new Date(day.date).toLocaleDateString('en', { day: 'numeric', month: 'short' })
            ),
            sent: reportData.dailyStats.slice(-14).map(day => day.sent),
            deliverability: reportData.dailyStats.slice(-14).map(day => day.deliverability),
            replies: reportData.dailyStats.slice(-14).map(day => day.replies)
        };
    }, [reportData]);

    // Loading State
    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl w-full max-w-4xl shadow-2xl border border-teal-200 animate-pulse">
                    <div className="flex justify-between items-center p-6 border-b border-teal-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl flex items-center justify-center">
                                <FiBarChart2 className="w-5 h-5 text-white" />
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
                    <div className="flex items-center justify-center py-20">
                        <div className="text-center">
                            <div className="w-12 h-12 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-gray-600 text-sm">Generating comprehensive analytics report...</p>
                            <p className="text-gray-400 text-xs mt-2">This may take a few seconds</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!reportData) {
        return (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl border border-teal-200">
                    <div className="flex justify-between items-center p-6 border-b border-teal-100">
                        <div className="flex items-center gap-3">
                            <FiAlertCircle className="w-6 h-6 text-red-500" />
                            <h2 className="text-lg font-semibold text-gray-900">Report Unavailable</h2>
                        </div>
                        <button
                            className="text-gray-400 hover:text-gray-600 p-2 rounded-lg transition-colors hover:bg-gray-100"
                            onClick={onClose}
                        >
                            <FiX className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="p-8 text-center">
                        <FiAlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Report</h3>
                        <p className="text-gray-600 mb-6">We couldn't generate the warmup report for this email address.</p>
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={() => fetchReportData()}
                                className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium"
                            >
                                Try Again
                            </button>
                            <button
                                onClick={onClose}
                                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Enhanced Tab Components with better organization
    const OverviewTab = () => (
        <div className="space-y-6">
            {/* Performance Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-xl p-6 border border-teal-200 shadow-sm">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Performance Overview</h2>
                            <p className="text-gray-600">Comprehensive analysis of your email warmup progress</p>
                        </div>
                        <div className="flex items-center gap-2 bg-green-50 px-3 py-2 rounded-lg border border-green-200">
                            <FiTrendingUp className="w-4 h-4 text-green-600" />
                            <span className="text-green-700 font-semibold text-sm">
                                +{reportData.summary.growthRate}% Growth
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: 'Total Sent', value: reportData.summary.totalSent, format: 'number' },
                            { label: 'Replies', value: reportData.summary.totalReplies, format: 'number' },
                            { label: 'Avg Deliverability', value: reportData.summary.averageDeliverability, format: 'percent' },
                            { label: 'Engagement Score', value: reportData.summary.engagementScore, format: 'percent' }
                        ].map((metric, index) => (
                            <div key={index} className="text-center p-4 bg-gray-50 rounded-lg">
                                <div className={`text-2xl font-bold ${metric.format === 'percent' ? getMetricColor(metric.value) : 'text-gray-900'
                                    }`}>
                                    {metric.format === 'percent' ? `${metric.value}%` : metric.value.toLocaleString()}
                                </div>
                                <div className="text-sm text-gray-600 mt-1">{metric.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quick Insights */}
                <div className="bg-white rounded-xl p-6 border border-teal-200 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <FiInfo className="w-5 h-5 text-teal-600" />
                        Quick Insights
                    </h3>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                            <span className="text-sm font-medium text-blue-700">Best Day</span>
                            <span className="text-sm font-semibold">
                                {new Date(reportData.analytics.bestPerformingDay.date).toLocaleDateString('en', { weekday: 'long' })}
                            </span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                            <span className="text-sm font-medium text-green-700">Peak Time</span>
                            <span className="text-sm font-semibold">{reportData.analytics.peakHour}:00</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                            <span className="text-sm font-medium text-purple-700">Reputation</span>
                            <span className="text-sm font-semibold">{reportData.analytics.senderReputation}/100</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Volume Trend */}
                <div className="bg-white rounded-xl p-6 border border-teal-200 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Email Volume Trend</h3>
                    <div className="flex items-end justify-between h-40 gap-2 px-2">
                        {chartData?.sent.map((value, index) => {
                            const maxValue = Math.max(...chartData.sent);
                            const height = (value / maxValue) * 100;
                            return (
                                <div key={index} className="flex flex-col items-center flex-1 group">
                                    <div
                                        className="w-full bg-gradient-to-t from-teal-500 to-teal-400 rounded-t-lg transition-all duration-300 hover:from-teal-400 hover:to-teal-300 relative"
                                        style={{ height: `${height}%` }}
                                    >
                                        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                            {value} emails
                                            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1 w-2 h-2 bg-gray-900 rotate-45"></div>
                                        </div>
                                    </div>
                                    <span className="text-xs text-gray-500 mt-2 font-medium">
                                        {chartData.labels[index]}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Performance Metrics */}
                <div className="bg-white rounded-xl p-6 border border-teal-200 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Metrics</h3>
                    <div className="space-y-4">
                        {[
                            { label: 'Reply Rate', value: reportData.performanceMetrics.replyRate },
                            { label: 'Open Rate', value: reportData.performanceMetrics.openRate },
                            { label: 'Click Rate', value: reportData.performanceMetrics.clickRate },
                            { label: 'Engagement Rate', value: reportData.performanceMetrics.engagementRate }
                        ].map((metric, index) => (
                            <div key={index} className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-gray-700">{metric.label}</span>
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

            {/* Recommendations */}
            <div className="bg-white rounded-xl p-6 border border-teal-200 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                    <FiStar className="w-5 h-5 text-teal-600" />
                    Actionable Recommendations
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {reportData.recommendations.map((rec, index) => (
                        <div
                            key={index}
                            className={`p-4 rounded-lg border-l-4 ${getPriorityColor(rec.priority)} border hover:shadow-md transition-shadow`}
                        >
                            <div className="flex items-start justify-between mb-2">
                                <h4 className="font-semibold text-gray-900">{rec.title}</h4>
                                <span className={`text-xs font-medium px-2 py-1 rounded-full ${rec.priority === 'high' ? 'bg-red-100 text-red-700' :
                                    rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-green-100 text-green-700'
                                    }`}>
                                    {rec.priority}
                                </span>
                            </div>
                            <p className="text-sm text-gray-600">{rec.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    const PerformanceTab = () => (
        <div className="space-y-6">
            {/* Performance Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    {
                        title: 'Overall Performance',
                        value: reportData.summary.engagementScore,
                        icon: FiAward,
                        trend: reportData.performanceMetrics.deliverabilityTrend,
                        description: 'Composite score'
                    },
                    {
                        title: 'Reply Rate',
                        value: reportData.performanceMetrics.replyRate,
                        icon: FiMessageSquare,
                        trend: 'up',
                        description: 'Response effectiveness'
                    },
                    {
                        title: 'Deliverability',
                        value: reportData.summary.averageDeliverability,
                        icon: FiActivity,
                        trend: reportData.performanceMetrics.deliverabilityTrend,
                        description: 'Email placement'
                    },
                    {
                        title: 'Engagement',
                        value: reportData.performanceMetrics.engagementRate,
                        icon: FiUsers,
                        trend: 'up',
                        description: 'Audience interaction'
                    }
                ].map((metric, index) => (
                    <div key={index} className="bg-white rounded-xl p-5 border border-teal-200 shadow-sm hover:shadow-md transition-all duration-300 group hover:border-teal-300">
                        <div className="flex items-center justify-between mb-3">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${getCardColor(index)} group-hover:scale-110 transition-transform`}>
                                <metric.icon className="w-6 h-6" />
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-bold text-gray-900">{metric.value}%</div>
                                <div className="flex items-center gap-1 justify-end mt-1">
                                    <span className={getTrendColor(metric.trend)}>
                                        {getTrendIcon(metric.trend)}
                                    </span>
                                    <span className="text-xs text-gray-500">{metric.description}</span>
                                </div>
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

            {/* Performance Comparison */}
            <div className="bg-white rounded-xl p-6 border border-teal-200 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Performance Benchmarking</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                        },
                        {
                            label: 'Click Rate',
                            current: reportData.performanceMetrics.clickRate,
                            industry: reportData.comparison.industryAverage.clickRate,
                            previous: reportData.comparison.previousPeriod.clickRate
                        }
                    ].map((metric, index) => (
                        <div key={index} className="text-center p-4 bg-gradient-to-br from-teal-50 to-white rounded-lg border border-teal-100">
                            <div className="text-sm font-medium text-gray-700 mb-3">{metric.label}</div>
                            <div className="text-2xl font-bold text-gray-900 mb-2">{metric.current}%</div>
                            <div className="space-y-2 text-xs">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500">Industry:</span>
                                    <span className={metric.current > metric.industry ? 'text-green-600 font-semibold' : 'text-red-600'}>
                                        {metric.industry}%
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500">Previous:</span>
                                    <span className={metric.current > metric.previous ? 'text-green-600 font-semibold' : 'text-red-600'}>
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

    const AnalyticsTab = () => (
        <div className="space-y-6">
            {/* Analytics Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                    {
                        title: 'Sender Reputation',
                        value: reportData.analytics.senderReputation,
                        max: 100,
                        icon: FiAward,
                        description: 'Domain authority score'
                    },
                    {
                        title: 'Inbox Placement',
                        value: reportData.performanceMetrics.inboxPlacement,
                        max: 100,
                        icon: FiMail,
                        description: 'Primary inbox rate'
                    },
                    {
                        title: 'Audience Health',
                        value: Math.round(
                            (reportData.analytics.audienceEngagement.highlyActive + reportData.analytics.audienceEngagement.active) /
                            Object.values(reportData.analytics.audienceEngagement).reduce((a, b) => a + b, 0) * 100
                        ),
                        max: 100,
                        icon: FiUsers,
                        description: 'Active audience percentage'
                    }
                ].map((item, index) => (
                    <div key={index} className="bg-white rounded-xl p-5 border border-teal-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${getCardColor(index)}`}>
                                <item.icon className="w-6 h-6" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-gray-700 mb-1">{item.title}</p>
                                <p className="text-lg font-bold text-gray-900">{item.value}/{item.max}</p>
                                <p className="text-xs text-gray-500">{item.description}</p>
                            </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                            <div
                                className={`h-2 rounded-full ${getProgressColor(item.value)}`}
                                style={{ width: `${(item.value / item.max) * 100}%` }}
                            ></div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Detailed Analytics Table */}
            <div className="bg-white rounded-xl border border-teal-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-teal-100 bg-white">
                    <h3 className="text-lg font-semibold text-gray-900">Daily Performance Analytics</h3>
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
                                            day: 'numeric',
                                            year: 'numeric'
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
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={(e) => {
                // Close modal when clicking on backdrop
                if (e.target === e.currentTarget) {
                    onClose();
                }
            }}
        >
            <div className="bg-white rounded-xl w-full max-w-7xl max-h-[95vh] overflow-hidden flex flex-col shadow-2xl border border-teal-200">

                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 border-b border-teal-100 bg-gradient-to-r from-teal-50 to-white flex-shrink-0 gap-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl flex items-center justify-center shadow-sm">
                                <FiBarChart2 className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">Email Warmup Report</h1>
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
                            {Object.entries(TIME_RANGES).map(([value, { label }]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>

                        <button
                            onClick={() => fetchReportData(true)}
                            disabled={refreshing}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-teal-300 text-teal-700 rounded-lg hover:bg-teal-50 transition-all duration-200 shadow-sm text-sm font-medium disabled:opacity-50"
                        >
                            <FiRefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">Refresh</span>
                        </button>

                        <button
                            onClick={exportToPDF}
                            disabled={exporting}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-lg hover:from-teal-700 hover:to-teal-600 transition-all duration-200 shadow-sm hover:shadow-md text-sm font-medium border border-teal-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {exporting ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <FiFileText className="w-4 h-4" />
                            )}
                            <span className="hidden sm:inline">{exporting ? 'Generating...' : 'Export PDF'}</span>
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
                    {[
                        { id: 'overview', label: 'Overview', icon: FiBarChart2 },
                        { id: 'performance', label: 'Performance', icon: FiTrendingUp },
                        { id: 'analytics', label: 'Analytics', icon: FiPieChart }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id
                                ? 'border-teal-600 text-teal-600'
                                : 'border-transparent text-gray-500 hover:text-teal-600'
                                }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div
                    ref={reportRef}
                    className="flex-1 overflow-y-auto p-6 bg-gradient-to-br from-teal-50/30 to-blue-50/30"
                    style={{ maxHeight: 'calc(95vh - 200px)' }} // Prevent excessive height
                >
                    {activeTab === 'overview' && <OverviewTab />}
                    {activeTab === 'performance' && <PerformanceTab />}
                    {activeTab === 'analytics' && <AnalyticsTab />}
                </div>

                {/* Footer */}
                <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-t border-teal-100 bg-white flex-shrink-0 gap-3">
                    <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                        <span>Report generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</span>
                        <span className="text-gray-300 hidden sm:inline">•</span>
                        <span className="text-teal-600 font-medium">
                            {TIME_RANGES[reportData.period].label} Analysis
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm bg-white border border-teal-600 text-teal-600 rounded-lg hover:bg-teal-600 hover:text-white transition-all duration-200 font-medium"
                        >
                            Close Report
                        </button>
                    </div>
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