import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Lock, ArrowRight, Layers, Zap, CheckCircle, X, Mail, Key, AlertCircle, Loader, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../src/integrations/supabase/client';
import { db } from '../services/supabaseDb';
import { User } from '../types';

interface AuthProps {
    onLogin: (user: User) => Promise<void>; // Updated to pass user
    isRestoringSession: boolean; // New prop to disable login during session restore
}

const Auth: React.FC<AuthProps> = ({ onLogin, isRestoringSession }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showResetPassword, setShowResetPassword] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Check for login action in URL
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('action') === 'login') {
            setShowLoginModal(true);
        }
    }, [location.search]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) return;

        setIsLoading(true);
        setError('');

        try {
            console.log('🔵 Auth: Starting login sequence for:', email);

            // Create a timeout promise that rejects after 12 seconds
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Login process timed out")), 30000)
            );

            // Wrap the entire login sequence in a race against the timeout
            await Promise.race([
                (async () => {
                    // 1. Authenticate and get profile
                    const userProfile = await db.auth.signIn(email, password);
                    console.log('🟢 Auth: Credentials verified for:', userProfile.full_name);

                    // 2. Initialize app state (fetches projects, etc.)
                    console.log('🔵 Auth: Initializing app data...');
                    await onLogin(userProfile);
                    console.log('🟢 Auth: Login sequence completed successfully');
                })(),
                timeoutPromise
            ]);
        } catch (err: any) {
            console.error('🔴 Auth: Login flow error:', err);

            // Provide more specific error messages
            let errorMessage = err.message || 'Failed to login. Please check your credentials.';

            if (errorMessage.includes('timeout')) {
                errorMessage = 'Login timed out initializing dashboard. Please refresh and try again.';
            } else if (errorMessage.includes('Invalid login credentials')) {
                errorMessage = 'Invalid email or password. Please try again.';
            } else if (errorMessage.includes('User account created but profile not found')) {
                errorMessage = 'Account created but profile not ready. Please contact admin.';
            }

            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };


    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            if (resetEmail) {
                console.log('Sending password reset for:', resetEmail);

                // Call Supabase password reset
                const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
                    redirectTo: `${window.location.origin}/set-password`, // Redirect to set password page
                });

                if (error) throw error;

                // Show success message
                toast.success(`Reset link sent to ${resetEmail}`, {
                    description: 'Check your email to reset your password.'
                });

                // Close modal and clear form
                setShowResetPassword(false);
                setResetEmail('');
            }
        } catch (err: any) {
            console.error('Password reset failed:', err);
            const msg = err.message || 'Failed to send password reset email. Please try again.';
            setError(msg);
            toast.error("Error", { description: msg });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col font-sans bg-[#E6F8EA] text-slate-900 overflow-x-hidden">
            {/* Hero Section */}
            <div className="flex-1 flex flex-col items-center justify-center px-4 pt-24 pb-20 text-center max-w-7xl mx-auto w-full">

                <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.9] mb-6 sm:mb-8 uppercase flex flex-col items-center select-none">
                    <span>Content</span>
                    <span>Production</span>
                    <span className="bg-black text-white px-6 py-2 transform -rotate-2 mt-4 inline-block shadow-lg">Chaos Tamed</span>
                </h1>

                <p className="text-base sm:text-lg md:text-xl font-medium max-w-2xl mb-8 sm:mb-10 leading-relaxed text-slate-800 px-2">
                    The internal workflow system for high-velocity marketing teams.
                    Script, shoot, edit, approve, and publish without the mess.
                </p>

                <div className="flex flex-col sm:flex-row gap-5 w-full sm:w-auto justify-center">
                    <button
                        onClick={() => {
                            setShowLoginModal(true);
                            navigate('/login?action=login', { replace: true });
                        }}
                        className="bg-[#D946EF] border-2 border-black px-8 sm:px-12 py-4 sm:py-5 text-white font-black text-lg sm:text-xl flex items-center justify-center shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all uppercase tracking-wide w-full sm:w-auto min-h-[48px]"
                    >
                        Start Production <ArrowRight className="ml-3 w-6 h-6" />
                    </button>
                </div>

                {/* Feature Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 w-full text-left max-w-6xl">
                    {/* Blue Card */}
                    <div className="bg-[#0085FF] border-2 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-4px] transition-transform">
                        <Layers className="w-12 h-12 text-white mb-6" />
                        <h3 className="text-2xl font-black text-white uppercase mb-3 tracking-tight">Multi-Channel</h3>
                        <p className="text-white font-medium text-sm leading-relaxed opacity-90">
                            Dedicated workflows for LinkedIn, YouTube, and Instagram. Tailored steps for each format.
                        </p>
                    </div>

                    {/* Green Card */}
                    <div className="bg-[#4ADE80] border-2 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-4px] transition-transform">
                        <Zap className="w-12 h-12 text-black mb-6" />
                        <h3 className="text-2xl font-black text-black uppercase mb-3 tracking-tight">Fast Approvals</h3>
                        <p className="text-black font-medium text-sm leading-relaxed opacity-90">
                            Streamlined CMO & CEO approval loops. No more lost emails or Slack messages.
                        </p>
                    </div>

                    {/* White Card */}
                    <div className="bg-white border-2 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-4px] transition-transform">
                        <CheckCircle className="w-12 h-12 text-black mb-6" />
                        <h3 className="text-2xl font-black text-black uppercase mb-3 tracking-tight">Role Based</h3>
                        <p className="text-black font-medium text-sm leading-relaxed opacity-80">
                            Clear dashboards for Writers, Editors, Designers, and Ops. Focus on your work only.
                        </p>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <footer className="bg-black text-white py-12 px-6 mt-12 border-t-2 border-black">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center">
                    <h2 className="text-3xl font-black tracking-tighter uppercase mb-4 md:mb-0">ApplyWizz</h2>
                    <p className="text-sm text-gray-400 font-medium">© 2025 ApplyWizz Internal Systems. All rights reserved.</p>
                </div>
            </footer>

            {/* Login Modal */}
            {showLoginModal && !showResetPassword && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4 animate-fade-in overflow-y-auto">
                    <div className="bg-white border-2 border-black p-4 sm:p-8 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] w-full max-w-md relative animate-fade-in-up my-auto max-h-[90vh] overflow-y-auto">
                        <button
                            onClick={() => {
                                setShowLoginModal(false);
                                navigate('/login', { replace: true });
                            }}
                            className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>

                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-blue-600 border-2 border-black mx-auto flex items-center justify-center mb-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                <Lock className="w-8 h-8 text-white" />
                            </div>
                            <h2 className="text-3xl font-black uppercase tracking-tight mb-2">Login</h2>
                            <p className="text-slate-500 font-medium">Enter your credentials to continue</p>
                        </div>

                        <form onSubmit={handleLogin} className="space-y-6">
                            {error && (
                                <div className="bg-red-50 border-l-4 border-red-500 p-4 flex items-start">
                                    <AlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
                                    <p className="text-red-700 text-sm font-medium">{error}</p>
                                </div>
                            )}

                            {/* Email Field */}
                            <div>
                                <label className="block text-sm font-bold uppercase text-slate-700 mb-2">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-4 w-5 h-5 text-slate-400" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value.toLowerCase())}
                                        placeholder="you@applywizz.com"
                                        required
                                        className="w-full pl-12 pr-4 py-4 border-2 border-slate-300 rounded-none focus:border-black focus:ring-0 bg-slate-50 outline-none transition-all font-medium"
                                    />
                                </div>
                            </div>

                            {/* Password Field */}
                            <div>
                                <label className="block text-sm font-bold uppercase text-slate-700 mb-2">Password</label>
                                <div className="relative">
                                    <Key className="absolute left-4 top-4 w-5 h-5 text-slate-400" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                        className="w-full pl-12 pr-12 py-4 border-2 border-slate-300 rounded-none focus:border-black focus:ring-0 bg-slate-50 outline-none transition-all font-medium"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            {/* Login Button */}
                            <button
                                type="submit"
                                disabled={isLoading || isRestoringSession}
                                className={`w-full bg-black hover:bg-slate-800 text-white p-4 border-2 border-black font-black uppercase flex items-center justify-center space-x-2 transition-all shadow-[6px_6px_0px_0px_rgba(100,100,100,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(100,100,100,1)] text-lg tracking-wide ${isLoading || isRestoringSession ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader className="w-5 h-5 animate-spin" />
                                        <span>Logging in...</span>
                                    </>
                                ) : isRestoringSession ? (
                                    <>
                                        <Loader className="w-5 h-5 animate-spin" />
                                        <span>Initializing...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Login</span>
                                        <ArrowRight className="w-5 h-5" />
                                    </>
                                )}
                            </button>

                            {/* Reset Password Link */}
                            <div className="text-center pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowLoginModal(false);
                                        setShowResetPassword(true);
                                    }}
                                    className="text-sm text-blue-600 hover:text-blue-800 font-bold underline"
                                >
                                    Forgot Password? Reset Here
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Reset Password Modal */}
            {showResetPassword && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white border-2 border-black p-8 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] w-full max-w-md relative animate-fade-in-up">
                        <button
                            onClick={() => {
                                setShowResetPassword(false);
                                setResetEmail('');
                            }}
                            className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>

                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-amber-500 border-2 border-black mx-auto flex items-center justify-center mb-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                <Mail className="w-8 h-8 text-white" />
                            </div>
                            <h2 className="text-3xl font-black uppercase tracking-tight mb-2">Reset Password</h2>
                            <p className="text-slate-500 font-medium">Enter your email to receive a reset link</p>
                        </div>

                        <form onSubmit={handleResetPassword} className="space-y-6">
                            {error && (
                                <div className="bg-red-50 border-l-4 border-red-500 p-4 flex items-start">
                                    <AlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
                                    <p className="text-red-700 text-sm font-medium">{error}</p>
                                </div>
                            )}

                            {/* Email Field */}
                            <div>
                                <label className="block text-sm font-bold uppercase text-slate-700 mb-2">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-4 w-5 h-5 text-slate-400" />
                                    <input
                                        type="email"
                                        value={resetEmail}
                                        onChange={(e) => setResetEmail(e.target.value.toLowerCase())}
                                        placeholder="you@applywizz.com"
                                        required
                                        className="w-full pl-12 pr-4 py-4 border-2 border-slate-300 rounded-none focus:border-black focus:ring-0 bg-slate-50 outline-none transition-all font-medium"
                                    />
                                </div>
                            </div>

                            {/* Send Reset Link Button */}
                            <button
                                type="submit"
                                disabled={isLoading}
                                className={`w-full bg-amber-500 hover:bg-amber-600 text-white p-4 border-2 border-black font-black uppercase flex items-center justify-center space-x-2 transition-all shadow-[6px_6px_0px_0px_rgba(100,100,100,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(100,100,100,1)] text-lg tracking-wide ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader className="w-5 h-5 animate-spin" />
                                        <span>Sending...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Send Reset Link</span>
                                        <ArrowRight className="w-5 h-5" />
                                    </>
                                )}
                            </button>

                            {/* Back to Login */}
                            <div className="text-center pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowResetPassword(false);
                                        setShowLoginModal(true);
                                        setResetEmail('');
                                    }}
                                    className="text-sm text-slate-600 hover:text-slate-900 font-bold underline"
                                >
                                    Back to Login
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Auth;
