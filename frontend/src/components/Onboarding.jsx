import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Check, ArrowRight, ArrowLeft, Mail, Shield, Zap,
    BarChart3, Users, Rocket, Star, Sparkles, User, Lock, Eye, EyeOff
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { AuroraBackground } from './ui/aurora-background';
import { Meteors } from './ui/meteors';
import { AnimatedGradientBorder } from './ui/animated-gradient-border';
import { TextGenerateEffect } from './ui/text-generate-effect';
import { TypewriterEffect } from './ui/typewriter-effect';
import bounceImg from '../assets/endbounce.jpg';

const onboardingSteps = [
    {
        id: 1,
        title: "Welcome to EndBounce Warmup",
        subtitle: "Let's get your email deliverability optimized",
        description: "We'll help you set up your account and start warming up your emails in just a few steps.",
        image: bounceImg,
        features: [
            "AI-powered email warmup",
            "Enterprise-grade security",
            "Real-time analytics"
        ]
    },
    {
        id: 2,
        title: "Create Your Account",
        subtitle: "Set up your login credentials",
        description: "Enter your details to create your secure account and get started.",
        icon: User,
        features: [
            "Secure account creation",
            "256-bit encryption",
            "Instant access"
        ]
    },
    {
        id: 3,
        title: "Connect Your Email Account",
        subtitle: "Secure and encrypted connection",
        description: "Connect your email provider to start the warmup process. We support all major email providers.",
        icon: Mail,
        features: [
            "Gmail, Outlook, Yahoo support",
            "256-bit encryption",
            "OAuth secure login"
        ]
    },
    {
        id: 4,
        title: "Configure Warmup Settings",
        subtitle: "AI-powered optimization",
        description: "Our AI will analyze your sending patterns and create the perfect warmup schedule for you.",
        icon: Zap,
        features: [
            "Smart sending patterns",
            "Adaptive warmup speed",
            "Spam score monitoring"
        ]
    },
    {
        id: 5,
        title: "Monitor Your Progress",
        subtitle: "Real-time analytics dashboard",
        description: "Track your email deliverability improvements with our comprehensive analytics dashboard.",
        icon: BarChart3,
        features: [
            "Delivery rate tracking",
            "Engagement metrics",
            "Spam folder reports"
        ]
    }
];

const welcomeWords = [
    { text: "Complete" },
    { text: "Your" },
    { text: "Setup" },
    { text: "🎉", className: "text-blue-600" },
];

// Fixed Google SVG icon component
const GoogleIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
    </svg>
);

export default function Onboarding() {
    const { login } = useAuth();
    const [currentStep, setCurrentStep] = useState(0);
    const [completed, setCompleted] = useState(false);
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const navigate = useNavigate();

    // Check for Google OAuth callback on component mount
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        const userData = urlParams.get('user');
        const isNewUser = urlParams.get('isNewUser') === 'true';

        if (token && userData) {
            try {
                const user = JSON.parse(decodeURIComponent(userData));

                // Store auth data
                login(token, user);
                localStorage.setItem('authToken', token);
                localStorage.setItem('user', JSON.stringify(user));

                toast.success('Google login successful!', {
                    position: 'top-center',
                    duration: 2000,
                    icon: <Rocket className="text-blue-500" />
                });

                // Redirect to dashboard
                if (user.role === 'superadmin') {
                    navigate('/superadmin/dashboard', { replace: true });
                } else {
                    navigate('/dashboard', { replace: true });
                }
            } catch (error) {
                console.error('Error processing Google OAuth callback:', error);
                toast.error('Authentication failed', {
                    position: 'top-center',
                    duration: 2000,
                    icon: <Check className="text-red-500" />
                });
            }
        }
    }, [login, navigate]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const nextStep = () => {
        if (currentStep < onboardingSteps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            setCompleted(true);
            // Redirect to dashboard after a delay
            setTimeout(() => {
                navigate('/dashboard');
            }, 3000);
        }
    };

    const prevStep = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const skipOnboarding = () => {
        navigate('/dashboard');
    };

    const handleGoogleLogin = () => {
        setIsGoogleLoading(true);

        // Use direct backend URL
        const backendUrl = 'http://localhost:5000'; // Replace with your actual backend URL
        const redirectUri = `${window.location.origin}/onboarding`;
        const googleAuthUrl = `${backendUrl}/api/auth/google?redirect_uri=${encodeURIComponent(redirectUri)}&signup=true`;

        console.log('Redirecting to Google OAuth:', googleAuthUrl);
        window.location.href = googleAuthUrl;
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
        // Handle form submission logic here
        console.log('Form data:', formData);
        nextStep();
    };

    if (completed) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
                <AuroraBackground>
                    <motion.div
                        className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-3xl p-8 text-center relative overflow-hidden border border-gray-200 dark:border-gray-700 shadow-2xl"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                    >
                        <Meteors number={15} />

                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                            className="w-24 h-24 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-6"
                        >
                            <Check className="w-12 h-12 text-green-600 dark:text-green-400" />
                        </motion.div>

                        <TypewriterEffect words={welcomeWords} className="mb-4" />

                        <p className="text-gray-600 dark:text-gray-300 text-lg mb-8">
                            Your EndBounce Warmup account is ready! Redirecting you to the dashboard...
                        </p>

                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: "100%" }}
                            transition={{ duration: 3, ease: "linear" }}
                            className="h-2 bg-gradient-to-r from-green-400 to-blue-500 rounded-full"
                        />
                    </motion.div>
                </AuroraBackground>
            </div>
        );
    }

    const step = onboardingSteps[currentStep];

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
            <AuroraBackground>
                <motion.div
                    className="w-full max-w-6xl bg-white dark:bg-gray-800 rounded-3xl overflow-hidden flex flex-col md:flex-row min-h-[600px] relative border border-gray-200 dark:border-gray-700 shadow-2xl"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    {/* Left Panel - Progress & Info */}
                    <div className="md:w-2/5 bg-gradient-to-b from-[#0B1E3F] to-[#008080] p-8 text-white relative overflow-hidden">
                        <Meteors number={8} />

                        <div className="relative z-10">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex items-center gap-3 mb-8"
                            >
                                <AnimatedGradientBorder borderRadius="0.5rem" className="w-10 h-10">
                                    <div className="w-full h-full rounded-lg bg-white/10 flex items-center justify-center">
                                        <Rocket className="w-5 h-5 text-white" />
                                    </div>
                                </AnimatedGradientBorder>
                                <h1 className="text-xl font-bold">EndBounce</h1>
                            </motion.div>

                            {/* Progress Steps */}
                            <div className="space-y-6 mb-8">
                                {onboardingSteps.map((s, index) => (
                                    <motion.div
                                        key={s.id}
                                        className={`flex items-center gap-4 p-3 rounded-lg transition-all duration-300 ${index === currentStep
                                            ? 'bg-white/20 border border-white/30'
                                            : index < currentStep
                                                ? 'bg-white/10'
                                                : 'bg-white/5'
                                            }`}
                                        whileHover={{ scale: 1.02 }}
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${index < currentStep
                                            ? 'bg-green-500'
                                            : index === currentStep
                                                ? 'bg-blue-500'
                                                : 'bg-white/20'
                                            }`}>
                                            {index < currentStep ? (
                                                <Check className="w-4 h-4 text-white" />
                                            ) : (
                                                <span className="text-sm font-medium">{index + 1}</span>
                                            )}
                                        </div>
                                        <div>
                                            <p className={`font-medium ${index === currentStep ? 'text-white' : 'text-white/80'
                                                }`}>
                                                {s.title}
                                            </p>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>

                            {/* Progress Bar */}
                            <div className="mb-4">
                                <div className="flex justify-between text-sm text-white/80 mb-2">
                                    <span>Progress</span>
                                    <span>{Math.round(((currentStep + 1) / onboardingSteps.length) * 100)}%</span>
                                </div>
                                <div className="w-full bg-white/20 rounded-full h-2">
                                    <motion.div
                                        className="bg-gradient-to-r from-green-400 to-blue-500 h-2 rounded-full"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${((currentStep + 1) / onboardingSteps.length) * 100}%` }}
                                        transition={{ duration: 0.5 }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Panel - Content */}
                    <div className="md:w-3/5 p-8 md:p-12 flex flex-col">
                        <div className="flex justify-between items-center mb-8">
                            <button
                                onClick={skipOnboarding}
                                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                            >
                                Skip onboarding
                            </button>

                            <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-yellow-500" />
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                    Step {currentStep + 1} of {onboardingSteps.length}
                                </span>
                            </div>
                        </div>

                        <div className="flex-grow flex flex-col justify-center">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={currentStep}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.3 }}
                                    className="text-center"
                                >
                                    {step.image ? (
                                        <motion.div
                                            className="mb-8"
                                            whileHover={{ scale: 1.05 }}
                                            transition={{ type: "spring", stiffness: 300 }}
                                        >
                                            <AnimatedGradientBorder borderRadius="1.5rem">
                                                <img
                                                    src={step.image}
                                                    alt="Onboarding"
                                                    className="w-48 h-48 object-contain rounded-2xl mx-auto"
                                                />
                                            </AnimatedGradientBorder>
                                        </motion.div>
                                    ) : step.icon ? (
                                        <motion.div
                                            className="mb-8"
                                            whileHover={{ rotate: 360 }}
                                            transition={{ duration: 0.5 }}
                                        >
                                            <AnimatedGradientBorder borderRadius="100%" className="w-24 h-24 mx-auto">
                                                <div className="w-full h-full rounded-full bg-gradient-to-r from-blue-500 to-teal-500 flex items-center justify-center">
                                                    <step.icon className="w-10 h-10 text-white" />
                                                </div>
                                            </AnimatedGradientBorder>
                                        </motion.div>
                                    ) : null}

                                    <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent mb-4">
                                        {step.title}
                                    </h2>

                                    <p className="text-xl text-gray-600 dark:text-gray-300 mb-2">
                                        {step.subtitle}
                                    </p>

                                    <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto">
                                        {step.description}
                                    </p>

                                    {/* Form for Step 2 (Account Creation) */}
                                    {currentStep === 1 && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.2 }}
                                            className="max-w-md mx-auto w-full space-y-4"
                                        >
                                            <form onSubmit={handleFormSubmit}>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                                                            First Name
                                                        </label>
                                                        <AnimatedGradientBorder borderRadius="0.75rem">
                                                            <div className="relative">
                                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                                                    <User className="w-5 h-5" />
                                                                </div>
                                                                <input
                                                                    type="text"
                                                                    name="firstName"
                                                                    value={formData.firstName}
                                                                    onChange={handleInputChange}
                                                                    className="w-full bg-transparent rounded-lg py-3 pl-10 pr-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white placeholder-gray-400"
                                                                    placeholder="Enter first name"
                                                                    required
                                                                />
                                                            </div>
                                                        </AnimatedGradientBorder>
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                                                            Last Name
                                                        </label>
                                                        <AnimatedGradientBorder borderRadius="0.75rem">
                                                            <div className="relative">
                                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                                                    <User className="w-5 h-5" />
                                                                </div>
                                                                <input
                                                                    type="text"
                                                                    name="lastName"
                                                                    value={formData.lastName}
                                                                    onChange={handleInputChange}
                                                                    className="w-full bg-transparent rounded-lg py-3 pl-10 pr-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white placeholder-gray-400"
                                                                    placeholder="Enter last name"
                                                                    required
                                                                />
                                                            </div>
                                                        </AnimatedGradientBorder>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                                                        Email Address
                                                    </label>
                                                    <AnimatedGradientBorder borderRadius="0.75rem">
                                                        <div className="relative">
                                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                                                <Mail className="w-5 h-5" />
                                                            </div>
                                                            <input
                                                                type="email"
                                                                name="email"
                                                                value={formData.email}
                                                                onChange={handleInputChange}
                                                                className="w-full bg-transparent rounded-lg py-3 pl-10 pr-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white placeholder-gray-400"
                                                                placeholder="Enter email address"
                                                                required
                                                            />
                                                        </div>
                                                    </AnimatedGradientBorder>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                                                        Create a Password
                                                    </label>
                                                    <AnimatedGradientBorder borderRadius="0.75rem">
                                                        <div className="relative">
                                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                                                <Lock className="w-5 h-5" />
                                                            </div>
                                                            <input
                                                                type={showPassword ? "text" : "password"}
                                                                name="password"
                                                                value={formData.password}
                                                                onChange={handleInputChange}
                                                                className="w-full bg-transparent rounded-lg py-3 pl-10 pr-12 focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white placeholder-gray-400"
                                                                placeholder="Create a password"
                                                                required
                                                            />
                                                            <button
                                                                type="button"
                                                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                                                onClick={() => setShowPassword(!showPassword)}
                                                            >
                                                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                                            </button>
                                                        </div>
                                                    </AnimatedGradientBorder>
                                                </div>

                                                {/* Regular form submit button */}
                                                <motion.button
                                                    type="submit"
                                                    className="w-full mt-6 bg-gradient-to-r from-[#0B1E3F] to-[#008080] text-white py-3.5 px-4 rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2"
                                                    whileHover={{ scale: 1.02 }}
                                                    whileTap={{ scale: 0.98 }}
                                                >
                                                    <span>Create Account</span>
                                                    <ArrowRight className="w-4 h-4" />
                                                </motion.button>
                                            </form>

                                            {/* Google Login Button */}
                                            <div className="pt-4">
                                                <div className="relative my-4">
                                                    <div className="absolute inset-0 flex items-center">
                                                        <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                                                    </div>
                                                    <div className="relative flex justify-center text-sm">
                                                        <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                                                            Or continue with
                                                        </span>
                                                    </div>
                                                </div>

                                                <motion.button
                                                    type="button"
                                                    onClick={handleGoogleLogin}
                                                    disabled={isGoogleLoading}
                                                    className="w-full bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-3 px-4 rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-3 border border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    whileHover={{ scale: isGoogleLoading ? 1 : 1.02 }}
                                                    whileTap={{ scale: isGoogleLoading ? 1 : 0.98 }}
                                                >
                                                    {isGoogleLoading ? (
                                                        <svg
                                                            className="animate-spin h-5 w-5 text-gray-400"
                                                            xmlns="http://www.w3.org/2000/svg"
                                                            fill="none"
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path
                                                                className="opacity-75"
                                                                fill="currentColor"
                                                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                                            ></path>
                                                        </svg>
                                                    ) : (
                                                        <GoogleIcon />
                                                    )}
                                                    <span>{isGoogleLoading ? 'Connecting...' : 'Continue with Google'}</span>
                                                </motion.button>
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* Features List for other steps */}
                                    {currentStep !== 1 && (
                                        <div className="space-y-3 mb-8 max-w-sm mx-auto">
                                            {step.features.map((feature, index) => (
                                                <motion.div
                                                    key={feature}
                                                    initial={{ opacity: 0, x: -20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: index * 0.1 }}
                                                    className="flex items-center gap-3 text-left"
                                                >
                                                    <div className="w-6 h-6 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center flex-shrink-0">
                                                        <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                                                    </div>
                                                    <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                                                </motion.div>
                                            ))}
                                        </div>
                                    )}
                                </motion.div>
                            </AnimatePresence>
                        </div>

                        {/* Navigation Buttons */}
                        <div className="flex justify-between items-center pt-8 border-t border-gray-200 dark:border-gray-700">
                            <motion.button
                                onClick={prevStep}
                                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-300 ${currentStep > 0
                                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                    : 'invisible'
                                    }`}
                                whileHover={{ scale: currentStep > 0 ? 1.05 : 1 }}
                                whileTap={{ scale: currentStep > 0 ? 0.95 : 1 }}
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Previous
                            </motion.button>

                            {currentStep !== 1 && (
                                <motion.button
                                    onClick={nextStep}
                                    className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-[#0B1E3F] to-[#008080] text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300"
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    {currentStep === onboardingSteps.length - 1 ? 'Get Started' : 'Next Step'}
                                    <ArrowRight className="w-4 h-4" />
                                </motion.button>
                            )}
                        </div>
                    </div>
                </motion.div>
            </AuroraBackground>
        </div>
    );
}