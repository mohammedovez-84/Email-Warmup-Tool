import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { signupUser } from '../../services/authService';
import { Mail, Lock, User, Briefcase, Phone, Sparkles, ChevronLeft, Check, X, Eye, EyeOff, Fingerprint, ArrowRight, Shield, Atom, Stars } from 'lucide-react';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import axios from 'axios';
import { AuroraBackground } from "../../components/ui/aurora-background";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { TextGenerateEffect } from '../../components/ui/text-generate-effect';
import { AnimatedGradientBorder } from '../../components/ui/animated-gradient-border';
import { Meteors } from '../../components/ui/meteors';
import { TypewriterEffect } from '../../components/ui/typewriter-effect';
import bounceImg from '../../assets/endbounce.jpg';

const welcomeWords = [
  { text: "Create" },
  { text: "Your" },
  { text: "Account", className: "text-blue-600" },
];

// Industry options list
const industryOptions = [
  "Veterinary",
  "Mining",
  "Dairy",
  "Oil & Energy",
  "Construction",
  "Appliances, Electrical, and Electronics Manufacturing",
  "Textile Manufacturing",
  "Furniture",
  "Paper & Forest Products",
  "Investment Banking",
  "Music",
  "Graphic Design",
  "Printing",
  "Pharmaceutical Manufacturing",
  "Chemical Manufacturing",
  "Plastics",
  "Glass, Ceramics & Concrete",
  "Defense & Space",
  "Automation Machinery Manufacturing",
  "Consumer Goods",
  "Semiconductor Manufacturing",
  "Online Audio and Video Media",
  "Computer Hardware",
  "Aviation & Aerospace",
  "Shipbuilding",
  "Alternative Dispute Resolution",
  "Railroad Equipment Manufacturing",
  "Medical Devices",
  "Sporting Goods",
  "Law Enforcement",
  "Transportation/Trucking/Railroad",
  "Maritime",
  "Airlines and Aviation",
  "Leisure, Travel & Tourism",
  "Logistics & Supply Chain",
  "Freight and Package Transportation",
  "Building Materials",
  "Renewables & Environment",
  "Wholesale",
  "Industrial Machinery Manufacturing",
  "Machinery",
  "Packaging & Containers",
  "Spectator Sports",
  "Fisheries",
  "Food & Beverages",
  "Food and Beverage Manufacturing",
  "Farming",
  "Tobacco",
  "Automotive",
  "Apparel & Fashion",
  "Computer Games",
  "Computer Networking",
  "Luxury Goods & Jewelry",
  "Book and Periodical Publishing",
  "Primary and Secondary Education",
  "Banking",
  "International Trade & Development",
  "Capital Markets",
  "Insurance",
  "Import & Export",
  "Executive Offices",
  "Information Services",
  "Real Estate",
  "Venture Capital & Private Equity",
  "Museums & Institutions",
  "Photography",
  "Political Organization",
  "Advertising Services",
  "Consumer Services",
  "Writing & Editing",
  "Retail",
  "Hospitality",
  "Human Resources",
  "Staffing & Recruiting",
  "Computer & Network Security",
  "Higher Education",
  "Computer Software",
  "Information Technology & Services",
  "Internet",
  "Outsourcing and Offshoring Consulting",
  "Think Tanks",
  "Design",
  "Events Services",
  "Financial Services",
  "Legal Services",
  "Translation & Localization",
  "Security & Investigations",
  "Animation",
  "Broadcast Media Production and Distribution",
  "Performing Arts",
  "Entertainment",
  "Gambling & Casinos",
  "Health, Wellness & Fitness",
  "Medical Practice",
  "Alternative Medicine",
  "Hospital & Health Care",
  "Law Practice",
  "Telecommunications",
  "Civic & Social Organization",
  "Education",
  "Education Administration Programs",
  "International Affairs",
  "Religious Institutions",
  "Professional Training & Coaching",
  "E-Learning",
  "Mental Health Care",
  "Nonprofit Organization Management",
  "Investment Management",
  "Individual & Family Services",
  "Libraries",
  "Public Policy",
  "Government Relations",
  "Business Consulting and Services",
  "Architecture & Planning",
  "Civil Engineering",
  "Accounting",
  "Biotechnology",
  "Market Research",
  "Research",
  "Facilities Services",
  "Public Relations & Communications",
  "Recreational Facilities",
  "Environmental Services",
  "Restaurants",
  "Legislative Office",
  "Public Safety",
  "Utilities",
  "Armed Forces",
  "Veterinary Services",
  "Dairy Product Manufacturing",
  "Oil and Gas",
  "Furniture and Home Furnishings Manufacturing",
  "Paper and Forest Product Manufacturing",
  "Musicians",
  "Printing Services",
  "Plastics Manufacturing",
  "Glass, Ceramics and Concrete Manufacturing",
  "Defense and Space Manufacturing",
  "Manufacturing",
  "Computer Hardware Manufacturing",
  "Aviation and Aerospace Component Manufacturing",
  "Medical Equipment Manufacturing",
  "Sporting Goods Manufacturing",
  "Truck Transportation",
  "Maritime Transportation",
  "Travel Arrangements",
  "Transportation, Logistics, Supply Chain and Storage",
  "Wholesale Building Materials",
  "Solar Electric Power Generation",
  "Machinery Manufacturing",
  "Packaging and Containers Manufacturing",
  "Food and Beverage Services",
  "Tobacco Manufacturing",
  "Motor Vehicle Manufacturing",
  "Retail Apparel and Fashion",
  "Computer Networking Products",
  "Retail Luxury Goods and Jewelry",
  "International Trade and Development",
  "Wholesale Import and Export",
  "Venture Capital and Private Equity Principals",
  "Museums, Historical Sites, and Zoos",
  "Political Organizations",
  "Human Resources Services",
  "Staffing and Recruiting",
  "Computer and Network Security",
  "Software Development",
  "IT Services and IT Consulting",
  "Technology, Information and Internet",
  "Design Services",
  "Animation and Post-production",
  "Entertainment Providers",
  "Gambling Facilities and Casinos",
  "Wellness and Fitness Services",
  "Medical Practices",
  "Hospitals and Health Care",
  "Civic and Social Organizations",
  "Professional Training and Coaching",
  "E-Learning Providers",
  "Non-profit Organizations",
  "Individual and Family Services",
  "Public Policy Offices",
  "Government Relations Services",
  "Biotechnology Research",
  "Research Services",
  "Public Relations and Communications Services",
  "Legislative Offices"
];

const Signup = () => {
  const [form, setForm] = useState({
    name: '',
    lastname: '',
    email: '',
    password: '',
    title: '',
    company: '',
    phone: '',
    industry: '',
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [isHoveringButton, setIsHoveringButton] = useState(false);

  const navigate = useNavigate();

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error when user starts typing
    if (error && name in form) {
      setError('');
    }
  };

  const validateForm = () => {
    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('Please enter a valid email address');
      return false;
    }

    // Password strength validation
    const passwordStrength = {
      hasMinLength: form.password.length >= 8,
      hasUpperCase: /[A-Z]/.test(form.password),
      hasNumber: /\d/.test(form.password),
      hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(form.password),
    };

    const strengthScore = Object.values(passwordStrength).filter(Boolean).length;

    if (strengthScore < 2) {
      setError('Password is too weak. Please make it stronger.');
      return false;
    }

    // Phone validation
    if (!form.phone || form.phone.length < 10) {
      setError('Please enter a valid phone number');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await signupUser(form);  // res is already the data object

      if (!res) {
        throw new Error('No data received from server');
      }

      toast.success("Signup successful! OTP sent to your email.");
      localStorage.setItem("signupEmail", form.email);

      // pass email along if your VerifyEmail.jsx needs it
      navigate("/verify-email", { state: { email: form.email } });

    } catch (err) {
      console.error('Signup error:', err);

      let errorMessage = "Something went wrong. Please try again.";

      if (err.response) {
        if (err.response.status === 400) {
          errorMessage = err.response.data?.message || 'Invalid form data';
        } else if (err.response.status === 409) {
          errorMessage = 'Email already exists. Please login instead.';
        } else if (err.response.status === 500) {
          errorMessage = 'Server error. Please try again later.';
        }
      } else if (err.request) {
        errorMessage = 'No response from server. Please check your connection.';
      }

      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Password strength indicators
  const passwordStrength = {
    hasMinLength: form.password.length >= 8,
    hasUpperCase: /[A-Z]/.test(form.password),
    hasNumber: /\d/.test(form.password),
    hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(form.password),
  };
  const strengthScore = Object.values(passwordStrength).filter(Boolean).length;

  const floatingShapes = [
    { id: 1, top: '10%', left: '5%', size: 'w-16 h-16', color: 'from-blue-400/20 to-indigo-400/20' },
    { id: 2, top: '25%', right: '8%', size: 'w-24 h-24', color: 'from-purple-400/20 to-pink-400/20' },
    { id: 3, bottom: '15%', left: '7%', size: 'w-20 h-20', color: 'from-green-400/20 to-teal-400/20' },
    { id: 4, bottom: '30%', right: '12%', size: 'w-12 h-12', color: 'from-yellow-400/20 to-orange-400/20' },
  ];

  const fieldConfig = {
    name: { icon: <User className="w-5 h-5" />, type: 'text', placeholder: 'First name' },
    lastname: { icon: <User className="w-5 h-5" />, type: 'text', placeholder: 'Last name' },
    email: { icon: <Mail className="w-5 h-5" />, type: 'email', placeholder: 'Email address' },
    password: {
      icon: <Lock className="w-5 h-5" />,
      type: showPassword ? 'text' : 'password',
      placeholder: 'Create a password'
    },
    title: { icon: <Briefcase className="w-5 h-5" />, type: 'text', placeholder: 'Job title' },
    company: { icon: <Briefcase className="w-5 h-5" />, type: 'text', placeholder: 'Company name' },
    industry: { icon: <Briefcase className="w-5 h-5" />, type: 'select', placeholder: 'Select your industry' },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      {floatingShapes.map((shape) => (
        <motion.div
          key={shape.id}
          className={`absolute rounded-full bg-gradient-to-br blur-xl ${shape.color} ${shape.size} ${shape.top} ${shape.left || ''} ${shape.right || ''} ${shape.bottom || ''}`}
          initial={{ y: 0, rotate: 0 }}
          animate={{
            y: [0, -40, 0],
            rotate: [0, 180, 360],
            opacity: [0.8, 1, 0.8]
          }}
          transition={{
            duration: Math.random() * 15 + 15,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      ))}

      {/* Aurora background effect */}
      <AuroraBackground>
        {/* Main card container */}
        <motion.div
          className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[600px] relative z-10 border border-gray-200"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {/* Left decorative panel */}
          <div className="hidden md:block w-1/3 bg-gradient-to-b from-[#0B1E3F] to-[#008080] p-8 relative overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              {[...Array(20)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full bg-white"
                  style={{
                    width: Math.random() * 10 + 5,
                    height: Math.random() * 10 + 5,
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                  }}
                  animate={{
                    y: [0, Math.random() * 40 - 20],
                    opacity: [0.3, 0.7, 0.3],
                  }}
                  transition={{
                    duration: Math.random() * 10 + 10,
                    repeat: Infinity,
                    repeatType: 'reverse',
                  }}
                />
              ))}
            </div>

            {/* Meteor effects */}
            <Meteors number={10} className="z-0" />

            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex justify-center items-center mb-8 relative z-10"
            >
              <AnimatedGradientBorder borderRadius="1.5rem">
                <motion.img
                  src={bounceImg}
                  alt="EndBounce Logo"
                  className="w-64 h-auto object-contain rounded-2xl"
                />
              </AnimatedGradientBorder>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-16 text-white relative z-10"
            >
              <h2 className="text-3xl font-bold mb-4">
                <TextGenerateEffect words="Welcome to Endbounce Warmup" />
              </h2>
              <p className="text-blue-100 leading-relaxed">
                "Finally a warmup tool that works with our enterprise security requirements". AI-powered warmup that adapts to your sending patterns.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="absolute bottom-8 left-8 right-8 z-10"
            >
              <div className="flex items-center gap-3">
                <AnimatedGradientBorder borderRadius="100%" className="w-10 h-10">
                  <div className="w-full h-full rounded-full bg-white/10 flex items-center justify-center">
                    <Shield className="text-white" size={16} />
                  </div>
                </AnimatedGradientBorder>
                <div>
                  <p className="text-white font-medium">Enterprise-grade security</p>
                  <p className="text-blue-100 text-sm">256-bit encryption</p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right form panel */}
          <div className="w-full md:w-2/3 p-8 md:p-12 flex flex-col relative">
            {/* Floating atoms animation */}
            <motion.div
              className="absolute top-0 right-0 opacity-10"
              animate={{
                rotate: 360
              }}
              transition={{
                duration: 60,
                repeat: Infinity,
                ease: "linear"
              }}
            >
              <Atom size={120} className="text-blue-500" />
            </motion.div>

            <div className="flex justify-between items-center mb-8">
              <Link
                to="/login"
                className="text-xs font-medium text-teal-600 hover:text-sky-800"
              >
                <motion.div
                  whileHover={{ x: -3 }}
                  transition={{ type: 'spring', stiffness: 500 }}
                  className="flex items-center"
                >
                  <ChevronLeft size={18} className="mr-1 group-hover:-translate-x-1 transition-transform" />
                  Back to Login
                </motion.div>
              </Link>

              <div className="md:hidden flex items-center">
                <AnimatedGradientBorder borderRadius="0.5rem" className="w-8 h-8">
                  <div className="w-full h-full rounded-lg flex items-center justify-center bg-gradient-to-r from-blue-600 to-indigo-600">
                    <Sparkles className="text-white" size={16} />
                  </div>
                </AnimatedGradientBorder>
                <h1 className="ml-2 font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  EndBounce
                </h1>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex-grow flex flex-col"
            >
              <div className="mb-8">
                <TypewriterEffect words={welcomeWords} className="mb-2" />
                <p className="text-gray-500">
                  Join EmailWarmup powerful email platform
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5 flex-grow flex flex-col">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {['name', 'lastname', 'email', 'password', 'title', 'company'].map((field, idx) => (
                    <motion.div
                      key={field}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + idx * 0.05 }}
                      className={field === 'password' || field === 'email' ? 'md:col-span-2' : ''}
                    >
                      <label htmlFor={field} className="block text-sm font-medium text-gray-700 mb-1">
                        {fieldConfig[field].placeholder}
                      </label>
                      <AnimatedGradientBorder borderRadius="0.75rem">
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                            {fieldConfig[field].icon}
                          </div>
                          <input
                            id={field}
                            name={field}
                            type={fieldConfig[field].type}
                            placeholder={fieldConfig[field].placeholder}
                            className="w-full bg-transparent rounded-lg py-3 pl-10 pr-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            value={form[field]}
                            onChange={handleChange}
                            required
                            onFocus={() => field === 'password' && setPasswordFocused(true)}
                            onBlur={() => field === 'password' && setPasswordFocused(false)}
                          />
                          {field === 'password' && (
                            <button
                              type="button"
                              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                              onClick={() => setShowPassword(!showPassword)}
                              aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                          )}
                        </div>
                      </AnimatedGradientBorder>
                    </motion.div>
                  ))}

                  {/* Phone and Industry fields side by side */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + 6 * 0.05 }}
                    className="md:col-span-1"
                  >
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                      Phone
                    </label>
                    <AnimatedGradientBorder borderRadius="0.75rem">
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                          {/* <Phone className="w-5 h-5" /> */}
                        </div>
                        <PhoneInput
                          country={'us'}
                          value={form.phone}
                          onChange={(phone) => setForm({ ...form, phone })}
                          inputProps={{
                            name: 'phone',
                            required: true,
                            className: '!w-full !bg-transparent !py-3 !pl-12 !pr-4 !rounded-lg !border-none focus:!ring-2 focus:!ring-blue-500 focus:!border-transparent !h-auto'
                          }}
                          containerClass="w-full"
                          inputClass="!w-full !bg-transparent !py-3 !pl-12 !pr-4 !rounded-lg !border-none focus:!ring-2 focus:!ring-blue-500 focus:!border-transparent !h-auto"
                          buttonClass="!bg-transparent !border-none !rounded-l-lg !pl-3"
                          dropdownClass="!z-[1000]"
                        />
                      </div>
                    </AnimatedGradientBorder>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + 7 * 0.05 }}
                    className="md:col-span-1"
                  >
                    <label htmlFor="industry" className="block text-sm font-medium text-gray-700 mb-1">
                      Industry
                    </label>
                    <AnimatedGradientBorder borderRadius="0.75rem">
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                          <Briefcase className="w-5 h-5" />
                        </div>
                        <select
                          id="industry"
                          name="industry"
                          className="w-full bg-transparent rounded-lg py-3 pl-10 pr-10 focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
                          value={form.industry}
                          onChange={handleChange}
                          required
                        >
                          <option value="">Select your industry</option>
                          {industryOptions.map((industry) => (
                            <option key={industry} value={industry}>
                              {industry}
                            </option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                          </svg>
                        </div>
                      </div>
                    </AnimatedGradientBorder>
                  </motion.div>
                </div>

                {/* Password strength meter */}
                {(passwordFocused || form.password) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Password strength</span>
                      <span className="text-xs font-medium">
                        {strengthScore < 2 ? 'Weak' : strengthScore < 4 ? 'Good' : 'Strong'}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${strengthScore < 2 ? 'bg-red-500' :
                          strengthScore < 4 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                        style={{ width: `${(strengthScore / 4) * 100}%` }}
                      ></div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                      {Object.entries(passwordStrength).map(([key, met]) => (
                        <div key={key} className="flex items-center gap-1">
                          {met ? (
                            <Check className="w-3 h-3 text-green-500" />
                          ) : (
                            <X className="w-3 h-3 text-red-500" />
                          )}
                          <span>
                            {key.replace('has', '').replace(/([A-Z])/g, ' $1').trim()}
                            {key === 'hasMinLength' && ' (8+ chars)'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="p-3 bg-red-50 rounded-lg border border-red-200 text-red-600 text-sm flex items-start gap-2"
                    >
                      <X className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{error}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="mt-auto pt-4">
                  <motion.button
                    type="submit"
                    className="w-full bg-gradient-to-r from-[#0B1E3F] to-[#008080] text-white py-3.5 px-4 rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2 relative overflow-hidden group"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    disabled={isSubmitting}
                    onHoverStart={() => setIsHoveringButton(true)}
                    onHoverEnd={() => setIsHoveringButton(false)}
                  >
                    <span className="absolute inset-0 bg-gradient-to-r from-[#0A1B35] to-[#006666] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                    <span className="absolute inset-0 flex items-center justify-center">
                      {isHoveringButton && (
                        <Stars
                          size={24}
                          className="text-white/30 animate-ping"
                          style={{
                            position: 'absolute',
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                          }}
                        />
                      )}
                    </span>
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="relative">Creating Account...</span>
                      </>
                    ) : (
                      <>
                        <Fingerprint className="w-5 h-5 relative" />
                        <span className="relative">Create Account</span>
                        <ArrowRight className="w-5 h-5 relative" />
                      </>
                    )}
                  </motion.button>

                  <div className="mt-6 text-center">
                    <p className="text-gray-500">
                      Already have an account?{' '}
                      <Link
                        to="/login"
                        className="font-medium transition-colors bg-gradient-to-r from-[#0B1E3F] to-[#008080] bg-clip-text text-transparent hover:opacity-80"
                      >
                        Sign in here
                      </Link>
                    </p>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        </motion.div >
      </AuroraBackground >
    </div >
  );
};

export default Signup;