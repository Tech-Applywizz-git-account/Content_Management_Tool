import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, ArrowRight, CheckCircle } from 'lucide-react';
import { supabase } from '../services/supabase';

const SetPassword: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [tokenError, setTokenError] = useState(false);

    // Get email from URL params (sent in invitation email)
    const email = searchParams.get('email') || '';
    const role = searchParams.get('role') || '';

    // Check for auth session on mount
    useEffect(() => {
        const checkSession = async () => {
            const { data: { session }, error } = await supabase.auth.getSession();

            if (error || !session) {
                console.error('No active session found:', error);
                // Add retry delay before marking token as expired
                setTimeout(async () => {
                    const retry = await supabase.auth.getSession();
                    if (!retry.data.session) {
                        setTokenError(true);
                        setError('Your invitation link has expired. Please request a new invitation from the administrator.');
                    }
                }, 800);
            }
        };

        checkSession();
    }, []);

    const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
        setError('Password must be at least 8 characters long');
        return;
    }

    if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
    }

    setLoading(true);

    try {
        await supabase.auth.updateUser({ password });

        toast.success('Password set successfully');
        
        // Fetch user and redirect by role
        const { data } = await supabase.auth.getUser();
        const userRole = data.user?.user_metadata?.role;

        if (userRole === 'ADMIN') navigate('/admin');
        else if (userRole === 'CEO') navigate('/ceo');
        else if (userRole === 'CMO') navigate('/cmo');
        else if (userRole === 'WRITER') navigate('/writer');
        else navigate('/');

    } catch (err: any) {
        const message = err.message || 'Failed to set password';
        setError(message);
        toast.error(message);
    } finally {
        setLoading(false);
    }
};


    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-2 sm:p-4">
            <div className="bg-white border-2 border-black p-4 sm:p-8 md:p-12 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] w-full max-w-md relative my-auto max-h-[95vh] overflow-y-auto">

                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-green-500 border-2 border-black mx-auto flex items-center justify-center mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <Lock className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-tight mb-2 sm:mb-3">Welcome!</h1>
                    <p className="text-slate-600 font-medium">
                        You have been invited to join as <span className="font-bold text-black">{role}</span>
                    </p>
                    <p className="text-sm text-slate-500 mt-2">
                        Email: <span className="font-bold">{email}</span>
                    </p>
                </div>

                {/* Instructions */}
                <div className="bg-blue-50 border-2 border-blue-300 p-4 mb-6">
                    <div className="flex items-start space-x-3">
                        <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-blue-900 font-medium">
                            Please set your password to access the Content Management System
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSetPassword} className="space-y-6">

                    {/* Password Field */}
                    <div>
                        <label className="block text-sm font-bold uppercase text-slate-700 mb-2">
                            Password
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                required
                                className="w-full px-4 py-3 sm:py-4 pr-12 border-2 border-slate-300 rounded-none focus:border-black focus:ring-0 bg-slate-50 outline-none transition-all font-medium text-base min-h-[48px]"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        <p className="text-xs text-slate-500 mt-2">Minimum 8 characters</p>
                    </div>

                    {/* Confirm Password Field */}
                    <div>
                        <label className="block text-sm font-bold uppercase text-slate-700 mb-2">
                            Confirm Password
                        </label>
                        <div className="relative">
                            <input
                                type={showConfirmPassword ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Re-enter your password"
                                required
                                className="w-full px-4 py-4 pr-12 border-2 border-slate-300 rounded-none focus:border-black focus:ring-0 bg-slate-50 outline-none transition-all font-medium"
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
                            >
                                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-50 border-2 border-red-300 p-4">
                            <p className="text-sm text-red-800 font-medium">{error}</p>
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full bg-black hover:bg-slate-800 text-white p-4 border-2 border-black font-black uppercase flex items-center justify-center space-x-2 transition-all shadow-[6px_6px_0px_0px_rgba(100,100,100,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(100,100,100,1)] text-lg tracking-wide ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <span>{loading ? 'Setting Password...' : 'Set Password'}</span>
                        {!loading && <ArrowRight className="w-5 h-5" />}
                    </button>
                </form>

                {/* Footer */}
                <div className="mt-8 pt-6 border-t-2 border-slate-200 text-center">
                    <p className="text-xs text-slate-400 uppercase tracking-wide">
                        ApplyWizz Content Management System
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SetPassword;
