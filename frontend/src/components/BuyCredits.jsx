import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FiCheck,
    FiArrowRight,
    FiCheckCircle,
    FiShoppingCart,
    FiInfo,
    FiShield,
    FiCreditCard,
    FiStar
} from 'react-icons/fi';
import { toast } from 'sonner';

// Mock API service for credit purchases
const creditService = {
    processPayment: async (plan, paymentMethod) => {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                const success = Math.random() > 0.1;
                if (success) {
                    resolve({
                        success: true,
                        transactionId: 'TXN_' + Math.random().toString(36).substr(2, 9).toUpperCase(),
                        creditsAdded: plan.credits,
                        newBalance: 1250 + plan.credits
                    });
                } else {
                    reject(new Error('Payment processing failed. Please try again.'));
                }
            }, 2000);
        });
    }
};

const BuyCredits = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [loading, setLoading] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('card');
    const [showSuccess, setShowSuccess] = useState(false);
    const [transactionDetails, setTransactionDetails] = useState(null);
    const [promoCode, setPromoCode] = useState('');
    const [appliedPromo, setAppliedPromo] = useState(null);
    const [activeFaq, setActiveFaq] = useState(null);

    // Credit plans for email warmup
    const creditPlans = useMemo(() => [
        {
            id: '10k',
            name: '10K Credits',
            credits: 10000,
            monthlyPrice: 40,
            annualPrice: 480,
            perEmail: 0.004,
            features: [
                '10,000 email warmups',
                'Authentication Checker',
                'IP & Domain Checker',
                'Basic Analytics',
                'Email Support',
                '30-day data retention'
            ],
            popular: false
        },
        {
            id: '25k',
            name: '25K Credits',
            credits: 25000,
            monthlyPrice: 75,
            annualPrice: 900,
            perEmail: 0.003,
            features: [
                '25,000 email warmups',
                'Authentication Checker',
                'IP & Domain Checker',
                'Advanced Analytics',
                'Priority Support',
                '60-day data retention',
                'Custom Warmup Sequences'
            ],
            popular: false
        },
        {
            id: '50k',
            name: '50K Credits',
            credits: 50000,
            monthlyPrice: 135,
            annualPrice: 1620,
            perEmail: 0.0027,
            features: [
                '50,000 email warmups',
                'Authentication Checker',
                'IP & Domain Checker',
                'Advanced Analytics',
                'Priority Support',
                '90-day data retention',
                'Custom Warmup Sequences',
                'A/B Testing'
            ],
            popular: true
        },
        {
            id: '100k',
            name: '100K Credits',
            credits: 100000,
            monthlyPrice: 200,
            annualPrice: 2400,
            perEmail: 0.002,
            features: [
                '100,000 email warmups',
                'Authentication Checker',
                'IP & Domain Checker',
                'Advanced Analytics',
                '24/7 Priority Support',
                '180-day data retention',
                'Custom Warmup Sequences',
                'A/B Testing',
                'Team Collaboration'
            ],
            popular: false
        },
        {
            id: '250k',
            name: '250K Credits',
            credits: 250000,
            monthlyPrice: 320,
            annualPrice: 3840,
            perEmail: 0.00128,
            features: [
                '250,000 email warmups',
                'Authentication Checker',
                'IP & Domain Checker',
                'Enterprise Analytics',
                '24/7 Dedicated Support',
                '365-day data retention',
                'Custom Warmup Sequences',
                'A/B Testing',
                'Team Collaboration',
                'API Access'
            ],
            popular: false
        },
        {
            id: '500k',
            name: '500K Credits',
            credits: 500000,
            monthlyPrice: 450,
            annualPrice: 5400,
            perEmail: 0.0009,
            features: [
                '500,000 email warmups',
                'Authentication Checker',
                'IP & Domain Checker',
                'Enterprise Analytics',
                '24/7 Dedicated Support',
                'Unlimited data retention',
                'Custom Warmup Sequences',
                'A/B Testing',
                'Team Collaboration',
                'Full API Access',
                'White-label Options'
            ],
            popular: false
        },
        {
            id: '1m',
            name: '1M Credits',
            credits: 1000000,
            monthlyPrice: 750,
            annualPrice: 9000,
            perEmail: 0.00075,
            features: [
                '1,000,000 email warmups',
                'Authentication Checker',
                'IP & Domain Checker',
                'Enterprise Analytics',
                '24/7 Dedicated Support',
                'Unlimited data retention',
                'Custom Warmup Sequences',
                'A/B Testing',
                'Team Collaboration',
                'Full API Access',
                'White-label Options',
                'Custom Integrations'
            ],
            popular: false
        }
    ], []);

    // Payment methods
    const paymentMethods = [
        { id: 'card', name: 'Credit Card', icon: <FiCreditCard className="w-5 h-5" /> },
        { id: 'paypal', name: 'PayPal', icon: '🔵' },
        { id: 'bank', name: 'Bank Transfer', icon: '🏦' }
    ];

    // Promo codes
    const validPromoCodes = {
        'WELCOME10': 0.1,
        'SAVE20': 0.2,
        'NEWUSER': 0.15,
        'WARMUP25': 0.25
    };

    // FAQ data
    const faqs = [
        {
            question: 'How long do my credits last?',
            answer: 'Credits never expire and roll over month to month. You can use them whenever you need for email warmup, authentication checks, and domain verification.'
        },
        {
            question: 'What payment methods do you accept?',
            answer: 'We accept all major credit cards (Visa, MasterCard, American Express), PayPal, and bank transfers.'
        },
        {
            question: 'Can I get a refund for unused credits?',
            answer: 'Yes, we offer refunds for unused credits within 30 days of purchase. Contact our support team for assistance with refund requests.'
        },
        {
            question: 'Do you offer discounts for non-profits?',
            answer: 'Absolutely! We offer special discounts for non-profit organizations and educational institutions. Contact our sales team with your documentation for custom pricing.'
        },
        {
            question: 'What is included in Authentication Checker?',
            answer: 'Our Authentication Checker verifies SPF, DKIM, DMARC records, checks domain reputation, and validates email authentication protocols to ensure deliverability.'
        },
        {
            question: 'How does IP & Domain Checker work?',
            answer: 'The IP & Domain Checker monitors your sending IP reputation, checks blacklist status, verifies domain authentication, and provides real-time alerts for any issues affecting email deliverability.'
        }
    ];

    const handlePurchase = async () => {
        if (!selectedPlan) {
            toast.error('Please select a credit plan');
            return;
        }

        setLoading(true);
        try {
            const result = await creditService.processPayment(selectedPlan, paymentMethod);
            setTransactionDetails(result);
            setShowSuccess(true);

            toast.success(`Successfully purchased ${selectedPlan.credits.toLocaleString()} credits!`);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCloseSuccess = () => {
        setShowSuccess(false);
        setSelectedPlan(null);
        setTransactionDetails(null);
        setAppliedPromo(null);
        setPromoCode('');
    };

    const applyPromoCode = () => {
        const code = promoCode.trim().toUpperCase();
        if (validPromoCodes[code]) {
            setAppliedPromo({
                code: code,
                discount: validPromoCodes[code]
            });
            toast.success(`Promo code applied! ${(validPromoCodes[code] * 100)}% discount`);
        } else {
            toast.error('Invalid promo code');
        }
    };

    const calculateDiscount = () => {
        if (!appliedPromo || !selectedPlan) return 0;
        return selectedPlan.monthlyPrice * appliedPromo.discount;
    };

    const calculateTotal = () => {
        if (!selectedPlan) return 0;
        return selectedPlan.monthlyPrice - calculateDiscount();
    };

    const toggleFaq = (index) => {
        setActiveFaq(activeFaq === index ? null : index);
    };

    if (showSuccess && transactionDetails) {
        return (
            <div className="min-h-screen bg-gray-50 py-8">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center"
                    >
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <FiCheckCircle className="w-8 h-8 text-green-500" />
                        </div>

                        <h1 className="text-2xl font-bold text-gray-900 mb-4">
                            Payment Successful
                        </h1>

                        <p className="text-gray-600 mb-2">
                            You've successfully purchased
                        </p>
                        <div className="text-3xl font-bold text-gray-900 mb-6">
                            {transactionDetails.creditsAdded.toLocaleString()} Credits
                        </div>

                        <div className="bg-gray-50 rounded-lg p-6 mb-6 border border-gray-200">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                <div>
                                    <p className="text-gray-500 text-xs font-medium">Transaction ID</p>
                                    <p className="font-mono text-gray-900">{transactionDetails.transactionId}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 text-xs font-medium">Credits Added</p>
                                    <p className="font-semibold text-gray-900">{transactionDetails.creditsAdded.toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 text-xs font-medium">New Balance</p>
                                    <p className="font-semibold text-gray-900">{transactionDetails.newBalance.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="px-6 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors duration-200"
                            >
                                Go to Dashboard
                            </button>
                            <button
                                onClick={handleCloseSuccess}
                                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors duration-200"
                            >
                                Buy More Credits
                            </button>
                        </div>
                    </motion.div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="text-center mb-12">
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-3xl font-bold text-gray-900 mb-4"
                    >
                        Choose Your Plan
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-lg text-gray-600 max-w-3xl mx-auto"
                    >
                        Billed annually. Credits never expire and roll over month to month.
                    </motion.p>
                </div>

                {/* Credit Plans Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-12">
                    {creditPlans.map((plan, index) => (
                        <motion.div
                            key={plan.id}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className={`relative group cursor-pointer ${selectedPlan?.id === plan.id ? 'ring-2 ring-gray-900 ring-offset-2' : ''
                                }`}
                            onClick={() => setSelectedPlan(plan)}
                        >
                            {/* Card */}
                            <div className={`
                                relative bg-white rounded-lg border-2 overflow-hidden transition-all duration-300 h-full flex flex-col
                                ${selectedPlan?.id === plan.id
                                    ? 'border-gray-900 shadow-lg'
                                    : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                                }
                                ${plan.popular ? 'border-blue-500' : ''}
                            `}>
                                {/* Header */}
                                <div className="p-6 border-b border-gray-100">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                                        {plan.popular && (
                                            <div className="flex items-center space-x-1 bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                                                <FiStar className="w-3 h-3" />
                                                <span>Popular</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-baseline mb-2">
                                        <span className="text-3xl font-bold text-gray-900">${plan.monthlyPrice}</span>
                                        <span className="text-gray-500 ml-2 text-lg">/month</span>
                                    </div>
                                    <p className="text-sm text-gray-600">
                                        Billed annually (${plan.annualPrice})
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        ${plan.perEmail.toFixed(4)} per email warmup
                                    </p>
                                </div>

                                {/* Features */}
                                <div className="p-6 flex-grow">
                                    <div className="space-y-4">
                                        {plan.features.map((feature, featureIndex) => (
                                            <div key={featureIndex} className="flex items-start space-x-3">
                                                <FiCheck className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                                <span className="text-gray-700">{feature}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="p-6 pt-0">
                                    <button
                                        className={`
                                            w-full py-4 rounded-lg font-semibold transition-all duration-200 border-2
                                            ${selectedPlan?.id === plan.id
                                                ? 'bg-gray-900 text-white border-gray-900'
                                                : plan.popular
                                                    ? 'bg-blue-500 text-white border-blue-500 hover:bg-blue-600'
                                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                                            }
                                        `}
                                    >
                                        {selectedPlan?.id === plan.id ? '✓ Selected' : 'Select Plan'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Enterprise Section */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-lg border border-gray-200 p-8 mb-12"
                >
                    <div className="flex flex-col lg:flex-row items-center justify-between">
                        <div className="flex-1 mb-6 lg:mb-0">
                            <h3 className="text-2xl font-bold text-gray-900 mb-3">Enterprise</h3>
                            <p className="text-gray-600 mb-4 text-lg">
                                Custom volume with best pricing
                            </p>
                            <ul className="space-y-3">
                                <li className="flex items-center space-x-3">
                                    <FiCheck className="w-5 h-5 text-green-500" />
                                    <span className="text-gray-700">IM+ email verifications</span>
                                </li>
                                <li className="flex items-center space-x-3">
                                    <FiCheck className="w-5 h-5 text-green-500" />
                                    <span className="text-gray-700">Custom pricing</span>
                                </li>
                                <li className="flex items-center space-x-3">
                                    <FiCheck className="w-5 h-5 text-green-500" />
                                    <span className="text-gray-700">Priority support</span>
                                </li>
                            </ul>
                        </div>
                        <div className="text-center lg:text-right">
                            <p className="text-gray-700 mb-4 font-semibold text-lg">
                                Need custom volume?
                            </p>
                            <p className="text-gray-600 mb-6 max-w-md">
                                Contact our sales team to discuss your specific requirements and get the best pricing.
                            </p>
                            <button className="bg-gray-900 text-white px-8 py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors duration-200">
                                Contact Sales Team
                            </button>
                        </div>
                    </div>
                </motion.div>

                {/* Bottom Section - Order Summary and FAQ */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Order Summary - 2/3 width */}
                    <div className="lg:col-span-2">
                        <AnimatePresence>
                            {selectedPlan ? (
                                <motion.div
                                    initial={{ opacity: 0, y: 30 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 30 }}
                                    className="bg-white rounded-lg border border-gray-200 p-8"
                                >
                                    <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
                                        Complete Your Purchase
                                    </h2>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                        {/* Order Details */}
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h3>

                                            {/* Selected Plan */}
                                            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 mb-6">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div>
                                                        <p className="font-bold text-gray-900 text-xl">{selectedPlan.name}</p>
                                                        <p className="text-gray-600">{selectedPlan.credits.toLocaleString()} email warmups</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-bold text-gray-900 text-2xl">${selectedPlan.monthlyPrice}</p>
                                                        <p className="text-gray-500 text-sm line-through">${selectedPlan.annualPrice}/year</p>
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex items-center space-x-2 text-sm text-green-600">
                                                        <FiCheck className="w-4 h-4" />
                                                        <span>Includes Authentication Checker</span>
                                                    </div>
                                                    <div className="flex items-center space-x-2 text-sm text-green-600">
                                                        <FiCheck className="w-4 h-4" />
                                                        <span>Includes IP & Domain Checker</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Promo Code */}
                                            <div className="mb-6">
                                                <h3 className="font-semibold text-gray-900 mb-3">Promo Code</h3>
                                                <div className="flex space-x-3">
                                                    <input
                                                        type="text"
                                                        placeholder="Enter promo code"
                                                        value={promoCode}
                                                        onChange={(e) => setPromoCode(e.target.value)}
                                                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                                                    />
                                                    <button
                                                        onClick={applyPromoCode}
                                                        className="px-6 py-3 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors duration-200"
                                                    >
                                                        Apply
                                                    </button>
                                                </div>
                                                {appliedPromo && (
                                                    <div className="mt-3 text-green-600 font-semibold">
                                                        Promo code {appliedPromo.code} applied! -${calculateDiscount().toFixed(2)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Payment Section */}
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Details</h3>

                                            {/* Total */}
                                            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 mb-6">
                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-gray-600">Subtotal</span>
                                                        <span className="text-gray-900 font-semibold">${selectedPlan.monthlyPrice}</span>
                                                    </div>
                                                    {appliedPromo && (
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-gray-600">Discount</span>
                                                            <span className="text-green-600 font-semibold">-${calculateDiscount().toFixed(2)}</span>
                                                        </div>
                                                    )}
                                                    <div className="border-t border-gray-200 pt-3">
                                                        <div className="flex justify-between items-center text-xl font-bold">
                                                            <span className="text-gray-900">Total</span>
                                                            <span className="text-gray-900">${calculateTotal().toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Payment Method */}
                                            <div className="mb-6">
                                                <h3 className="font-semibold text-gray-900 mb-3">Payment Method</h3>
                                                <div className="grid grid-cols-3 gap-3">
                                                    {paymentMethods.map((method) => (
                                                        <button
                                                            key={method.id}
                                                            onClick={() => setPaymentMethod(method.id)}
                                                            className={`p-4 rounded-lg border-2 transition-all duration-200 flex flex-col items-center ${paymentMethod === method.id
                                                                    ? 'border-gray-900 bg-gray-100'
                                                                    : 'border-gray-200 hover:border-gray-300'
                                                                }`}
                                                        >
                                                            <div className="text-xl mb-2">{method.icon}</div>
                                                            <div className="text-sm font-medium text-gray-700">{method.name}</div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Security Notice */}
                                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                                                <div className="flex items-center space-x-3">
                                                    <FiShield className="w-5 h-5 text-gray-600 flex-shrink-0" />
                                                    <div>
                                                        <p className="font-semibold text-gray-900">Secure Payment</p>
                                                        <p className="text-sm text-gray-600">
                                                            Your payment information is encrypted and secure. We never store your credit card details.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Purchase Button */}
                                            <button
                                                onClick={handlePurchase}
                                                disabled={loading}
                                                className="w-full bg-gray-900 text-white py-4 rounded-lg font-bold text-lg hover:bg-gray-800 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-3"
                                            >
                                                {loading ? (
                                                    <>
                                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                        <span>Processing Payment...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <FiShoppingCart className="w-5 h-5" />
                                                        <span>Complete Purchase</span>
                                                        <FiArrowRight className="w-5 h-5" />
                                                    </>
                                                )}
                                            </button>

                                            {/* Cancel Button */}
                                            <button
                                                onClick={() => setSelectedPlan(null)}
                                                className="w-full mt-4 text-gray-600 hover:text-gray-700 font-medium py-3 transition-colors duration-200"
                                            >
                                                Choose Different Plan
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div
                                    initial={{ opacity: 0, y: 30 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-white rounded-lg border border-gray-200 p-12 text-center"
                                >
                                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <FiShoppingCart className="w-10 h-10 text-gray-400" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-gray-900 mb-4">
                                        No Plan Selected
                                    </h3>
                                    <p className="text-gray-600 text-lg mb-6 max-w-md mx-auto">
                                        Choose a credit plan from the options above to continue with your purchase for email warmup services.
                                    </p>
                                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 max-w-md mx-auto">
                                        <p className="text-gray-700 font-semibold">
                                            All plans include Authentication Checker & IP & Domain Checker
                                        </p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* FAQ Section - 1/3 width */}
                    <div className="lg:col-span-1">
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="bg-white rounded-lg border border-gray-200 p-6 sticky top-8"
                        >
                            <h2 className="text-2xl font-bold text-gray-900 mb-6">
                                Frequently Asked Questions
                            </h2>
                            <div className="space-y-4">
                                {faqs.map((faq, index) => (
                                    <div key={index} className="border-b border-gray-200 pb-4 last:border-b-0">
                                        <button
                                            onClick={() => toggleFaq(index)}
                                            className="w-full text-left flex items-start justify-between focus:outline-none group"
                                        >
                                            <div className="flex items-start space-x-3 flex-1">
                                                <FiInfo className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" />
                                                <h3 className="font-semibold text-gray-900 text-left group-hover:text-gray-700 transition-colors duration-200">
                                                    {faq.question}
                                                </h3>
                                            </div>
                                            <span className={`text-gray-500 ml-2 flex-shrink-0 transition-transform duration-200 ${activeFaq === index ? 'rotate-180' : ''}`}>
                                                ▼
                                            </span>
                                        </button>
                                        {activeFaq === index && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="mt-3 pl-8"
                                            >
                                                <p className="text-gray-600 text-sm leading-relaxed">
                                                    {faq.answer}
                                                </p>
                                            </motion.div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BuyCredits;