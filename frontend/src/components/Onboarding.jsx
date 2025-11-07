import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Check, ArrowRight, ArrowLeft, Mail, Shield, Zap,
    BarChart3, Users, Rocket, Star, Sparkles
} from 'lucide-react';
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
        id: 3,
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
        id: 4,
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

export default function Onboarding() {
    const [currentStep, setCurrentStep] = useState(0);
    const [completed, setCompleted] = useState(false);
    const navigate = useNavigate();

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

                                    {/* Features List */}
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

                            <motion.button
                                onClick={nextStep}
                                className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-[#0B1E3F] to-[#008080] text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                {currentStep === onboardingSteps.length - 1 ? 'Get Started' : 'Next Step'}
                                <ArrowRight className="w-4 h-4" />
                            </motion.button>
                        </div>
                    </div>
                </motion.div>
            </AuroraBackground>
        </div>
    );
}