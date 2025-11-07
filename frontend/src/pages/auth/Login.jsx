import { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { loginUser, verify2FA, sendLoginOTP } from '../../services/authService';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, Lock, ArrowRight, Sparkles, Shield, Eye, EyeOff,
  ChevronLeft, X, Fingerprint, Rocket, Satellite, Atom, Stars
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import Particles from 'react-tsparticles';
import { loadFull } from 'tsparticles';
import { AuroraBackground } from '../../components/ui/aurora-background';
import { TextGenerateEffect } from '../../components/ui/text-generate-effect';
import { AnimatedGradientBorder } from '../../components/ui/animated-gradient-border';
import { Meteors } from '../../components/ui/meteors';
import { TypewriterEffect } from '../../components/ui/typewriter-effect';
import bounceImg from '../../assets/endbounce.jpg';

const welcomeWords = [
  { text: "Welcome" },
  { text: "to" },
  { text: "EndBounce" },
  { text: "Warmup", className: "text-blue-600" },
];

const floatingShapes = [
  { id: 1, top: '10%', left: '5%', size: 'w-16 h-16', color: 'from-blue-400/20 to-indigo-400/20' },
  { id: 2, top: '25%', right: '8%', size: 'w-24 h-24', color: 'from-purple-400/20 to-pink-400/20' },
  { id: 3, bottom: '15%', left: '7%', size: 'w-20 h-20', color: 'from-green-400/20 to-teal-400/20' },
  { id: 4, bottom: '30%', right: '12%', size: 'w-12 h-12', color: 'from-yellow-400/20 to-orange-400/20' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isHoveringLogo, setIsHoveringLogo] = useState(false);
  const [isHoveringButton, setIsHoveringButton] = useState(false);
  const [particlesInitialized, setParticlesInitialized] = useState(false);

  const particlesInit = async (engine) => {
    await loadFull(engine);
    setParticlesInitialized(true);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const res = await loginUser({ email, password, rememberMe });
      console.log('Login response:', res);

      // If 2FA is required, navigate to 2FA verification page
      if (res.two_fa_required) {
        navigate('/verify-2FA', {
          state: {
            email: res.email,
            method: res.method,
            from: location.pathname
          },
          replace: true
        });
        return;
      }

      // Successful login without 2FA
      const user = res?.user;
      const token = res?.token;

      if (!user || !token) throw new Error("Unexpected error: Missing user or token");

      // Update AuthContext (saves to localStorage inside)
      login(token, user);

      if (rememberMe) {
        localStorage.setItem('authToken', token);
      } else {
        sessionStorage.setItem('authToken', token);
      }

      toast.success('Login successful!', {
        position: 'top-center',
        duration: 2000,
        icon: <Rocket className="text-blue-500" />
      });

      // Navigate based on role
      if (user.role === 'superadmin') {
        navigate('/superadmin/dashboard', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }

    } catch (err) {
      console.error('Login failed:', err);
      setError(err?.response?.data?.message || 'Invalid credentials');
      toast.error('Login failed', {
        position: 'top-center',
        duration: 2000,
        description: err?.response?.data?.message || 'Please check your credentials',
        icon: <X className="text-red-500" />
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    // Redirect to Google OAuth with redirect URL to onboarding
    const redirectUrl = `${window.location.origin}/onboarding`;
    const googleAuthUrl = `${process.env.REACT_APP_API_URL}/auth/google?redirect=${encodeURIComponent(redirectUrl)}`;

    window.location.href = googleAuthUrl;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Advanced Particle Background */}
      {particlesInitialized && (
        <Particles
          id="tsparticles"
          init={particlesInit}
          options={{
            fullScreen: { enable: false, zIndex: 0 },
            particles: {
              number: {
                value: 80,
                density: {
                  enable: true,
                  value_area: 800
                }
              },
              color: {
                value: "#3b82f6"
              },
              shape: {
                type: "circle",
                stroke: {
                  width: 0,
                  color: "#000000"
                },
                polygon: {
                  nb_sides: 5
                }
              },
              opacity: {
                value: 0.5,
                random: true,
                anim: {
                  enable: true,
                  speed: 1,
                  opacity_min: 0.1,
                  sync: false
                }
              },
              size: {
                value: 3,
                random: true,
                anim: {
                  enable: true,
                  speed: 2,
                  size_min: 0.3,
                  sync: false
                }
              },
              line_linked: {
                enable: true,
                distance: 150,
                color: "#2563eb",
                opacity: 0.4,
                width: 1
              },
              move: {
                enable: true,
                speed: 1,
                direction: "none",
                random: true,
                straight: false,
                out_mode: "out",
                bounce: false,
                attract: {
                  enable: true,
                  rotateX: 600,
                  rotateY: 1200
                }
              }
            },
            interactivity: {
              detect_on: "canvas",
              events: {
                onhover: {
                  enable: true,
                  mode: "grab"
                },
                onclick: {
                  enable: true,
                  mode: "push"
                },
                resize: true
              },
              modes: {
                grab: {
                  distance: 140,
                  line_linked: {
                    opacity: 1
                  }
                },
                bubble: {
                  distance: 400,
                  size: 40,
                  duration: 2,
                  opacity: 8,
                  speed: 3
                },
                repulse: {
                  distance: 200,
                  duration: 0.4
                },
                push: {
                  particles_nb: 4
                },
                remove: {
                  particles_nb: 2
                }
              }
            },
            retina_detect: true
          }}
        />
      )}

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
          className="w-full max-w-4xl bg-white dark:bg-gray-800 rounded-4xl overflow-hidden flex flex-col md:flex-row min-h-[600px] relative z-10 border border-gray-200 dark:border-gray-700 shadow-2xl"
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
              onHoverStart={() => setIsHoveringLogo(true)}
              onHoverEnd={() => setIsHoveringLogo(false)}
            >
              <AnimatedGradientBorder borderRadius="1.5rem">
                <motion.img
                  src={bounceImg}
                  alt="EndBounce Logo"
                  className="w-64 h-auto object-contain rounded-2xl"
                  animate={{
                    rotate: isHoveringLogo ? [0, 5, -5, 0] : 0,
                    scale: isHoveringLogo ? [1, 1.12, 1.12, 1] : 1
                  }}
                  transition={{
                    duration: 1,
                    repeat: isHoveringLogo ? Infinity : 0,
                    repeatDelay: 3
                  }}
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
                <TextGenerateEffect words="Welcome To EndBounce Warmup" />
              </h2>
              <p className="text-blue-100 leading-relaxed">
                Ready to supercharge your email deliverability? EndBounce Warmup keeps your emails out of spam and into inboxes.
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
                  <p className="text-white font-medium">Secure authentication</p>
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
                to="/signup"
                className="text-xs font-medium text-teal-600 dark:text-teal-400 hover:text-sky-800 dark:hover:text-sky-300 transition-colors duration-200"
              >
                <motion.div
                  whileHover={{ x: -3 }}
                  transition={{ type: 'spring', stiffness: 500 }}
                  className="flex items-center"
                >
                  <ChevronLeft size={18} className="mr-1 transition-transform" />
                  Back to Signup
                </motion.div>
              </Link>

              <div className="md:hidden flex items-center">
                <AnimatedGradientBorder borderRadius="0.5rem" className="w-8 h-8">
                  <div className="w-full h-full rounded-lg flex items-center justify-center bg-gradient-to-r from-teal-600 to-indigo-600">
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
                <p className="text-gray-500 dark:text-gray-400">
                  Sign in to access your EndBounce dashboard
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5 flex-grow flex flex-col">
                <div className="space-y-5">
                  {/* Email */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Email Address
                    </label>

                    <AnimatedGradientBorder
                      borderRadius="0.75rem"
                      className="bg-gradient-to-b from-[#0B1E3F] to-[#008080]"
                    >
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 dark:text-gray-500">
                          <Mail className="w-5 h-5" />
                        </div>
                        <input
                          id="email"
                          type="email"
                          name="email"
                          placeholder="your@email.com"
                          className="w-full pl-10 pr-4 py-3 bg-transparent rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 border-0 focus:ring-2 focus:ring-[#0B1E3F] focus:border-transparent transition-all duration-200"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          autoComplete="email"
                        />
                      </div>
                    </AnimatedGradientBorder>
                  </motion.div>

                  {/* Password */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <div className="flex justify-between items-center">
                      <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Password
                      </label>
                      <Link
                        to="/forgot-password"
                        className="text-xs font-medium text-teal-600 dark:text-teal-400 hover:text-sky-800 dark:hover:text-sky-300 transition-colors duration-200"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <AnimatedGradientBorder borderRadius="0.75rem">
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 dark:text-gray-500">
                          <Lock className="w-5 h-5" />
                        </div>
                        <input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          name="password"
                          placeholder="••••••••"
                          className="w-full pl-10 pr-12 py-3 bg-transparent rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 border-0 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </AnimatedGradientBorder>
                  </motion.div>

                  {/* Remember me checkbox */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="flex items-center"
                  >
                    <input
                      id="remember-me"
                      name="remember-me"
                      type="checkbox"
                      className="h-4 w-4 text-[#0B1E3F] focus:ring-[#0B1E3F] border-gray-300 rounded"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                      Remember me
                    </label>
                  </motion.div>
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm flex items-start gap-2"
                    >
                      <X className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{error}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="mt-auto pt-4">
                  <motion.button
                    type="submit"
                    className="w-full bg-gradient-to-r from-[#0B1E3F] to-[#008080] text-white py-3.5 px-4 rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2 relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    disabled={isLoading}
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
                    {isLoading ? (
                      <>
                        <svg
                          className="animate-spin h-5 w-5 text-white"
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
                        <span className="relative">Signing In...</span>
                      </>
                    ) : (
                      <>
                        <Fingerprint className="w-5 h-5 relative" />
                        <span className="relative">Sign In</span>
                        <ArrowRight className="w-5 h-5 relative" />
                      </>
                    )}
                  </motion.button>

                  {/* Divider */}
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                        Or continue with
                      </span>
                    </div>
                  </div>

                  {/* Google Login Button */}
                  <motion.button
                    type="button"
                    onClick={handleGoogleLogin}
                    className="w-full bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-3 px-4 rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-3 border border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
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
                    <span>Sign in with Google</span>
                  </motion.button>

                  <div className="mt-6 text-center">
                    <p className="text-gray-500 dark:text-gray-400">
                      Don't have an account?{' '}
                      <Link
                        to="/signup"
                        className="font-medium transition-colors bg-gradient-to-r from-[#0B1E3F] to-[#008080] bg-clip-text text-transparent hover:opacity-80"
                      >
                        Create account
                      </Link>
                    </p>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        </motion.div>
      </AuroraBackground>
    </div>
  );
}