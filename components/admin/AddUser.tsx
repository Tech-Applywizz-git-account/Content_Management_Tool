import React, { useState, useRef } from 'react';
import { toast } from 'sonner';
import { Role, UserStatus } from '../../types';
import { db } from '../../services/supabaseDb';
import { ArrowLeft, Save, User as UserIcon, Mail, Shield, Smartphone, Bell, Lock } from 'lucide-react';

interface Props {
    onBack: () => void;
    onUserAdded: () => void;
}

const AddUser: React.FC<Props> = ({ onBack, onUserAdded }) => {
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        phone: '',
        role: Role.WRITER,
        status: UserStatus.ACTIVE,
        sendEmail: true,
        ssoAllowed: false
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isSubmittingRef = useRef(false); // Immediate lock to prevent double-click

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (isSubmittingRef.current || isSubmitting) return;

        console.log('Form submitted with data:', formData);
        isSubmittingRef.current = true;
        setIsSubmitting(true);

        try {
            // Use the centralized db service which handles:
            // 1. inviteUserByEmail with correct redirect
            // 2. Safe ID extraction
            // 3. Database record creation (bypassing RLS via admin client/Edge Function)
            // 4. Ghost user prevention
            await db.inviteUser(formData.email, {
                full_name: formData.full_name,
                role: formData.role,
                phone: formData.phone && formData.phone.trim() !== '' ? formData.phone : undefined
            });

            toast.success(`Invitation sent to ${formData.email}`, {
                description: 'User has been created and invitation email sent.'
            });
            
            // Navigate back to users list and refresh data
            onUserAdded();
            onBack();
        } catch (error: any) {
            console.error('Error creating user:', error);
            const msg = error.message || "Unknown error";
            toast.error('Failed to create user', {
                description: msg
            });
        } finally {
            isSubmittingRef.current = false;
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-fade-in-up">
            <div className="flex items-center space-x-4 mb-6">
                <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-200 transition-colors">
                    <ArrowLeft className="w-5 h-5 text-slate-600" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Add New User</h1>
                    <p className="text-sm text-slate-500">Create a new account and assign system access.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Left Column: Identity */}
                <div className="space-y-6">

                    {/* Personal Information Card */}
                    <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 h-full">
                        <div className="flex items-center space-x-3 mb-8 border-b border-slate-100 pb-4">
                            <div className="p-2 bg-blue-50 rounded-lg">
                                <UserIcon className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">Personal Information</h2>
                                <p className="text-sm text-slate-500">Basic profile details for the user.</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Full Name <span className="text-red-500">*</span></label>
                                <input
                                    required
                                    type="text"
                                    placeholder="e.g. John Doe"
                                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                                    value={formData.full_name}
                                    onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Email Address <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
                                    <input
                                        required
                                        type="email"
                                        placeholder="john@company.com"
                                        className="w-full pl-10 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value.toLowerCase() })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Phone Number</label>
                                <div className="relative">
                                    <Smartphone className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
                                    <input
                                        type="tel"
                                        placeholder="+1 (555) 000-0000"
                                        className="w-full pl-10 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: System Access */}
                <div className="space-y-6">
                    {/* Role Assignment Card */}
                    <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex items-center space-x-3 mb-6 border-b border-slate-100 pb-4">
                            <div className="p-2 bg-purple-50 rounded-lg">
                                <Shield className="w-5 h-5 text-purple-600" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">Role & Permissions</h2>
                                <p className="text-sm text-slate-500">Define what this user can do.</p>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">System Role <span className="text-red-500">*</span></label>
                            <select
                                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none bg-slate-50 transition-shadow"
                                value={formData.role}
                                onChange={e => setFormData({ ...formData, role: e.target.value as Role })}
                            >
                                {Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                            <div className="flex items-start mt-3 space-x-2 text-slate-500">
                                <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <p className="text-xs leading-relaxed">
                                    Permissions are automatically applied based on the selected role. Refer to the Roles Matrix for details.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Account Settings */}
                    <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                        <h2 className="text-lg font-bold text-slate-800 mb-6 border-b border-slate-100 pb-4">Account Configuration</h2>

                        <div className="space-y-6">
                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                                <div>
                                    <p className="text-sm font-bold text-slate-900">Account Status</p>
                                    <p className="text-xs text-slate-500">Toggle system access</p>
                                </div>
                                <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                                    <input
                                        type="checkbox"
                                        name="toggle"
                                        id="status-toggle"
                                        checked={formData.status === UserStatus.ACTIVE}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.checked ? UserStatus.ACTIVE : UserStatus.INACTIVE })}
                                        className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                                        style={{ right: formData.status === UserStatus.ACTIVE ? 0 : 'auto', left: formData.status === UserStatus.ACTIVE ? 'auto' : 0 }}
                                    />
                                    <label htmlFor="status-toggle" className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${formData.status === UserStatus.ACTIVE ? 'bg-green-500' : 'bg-slate-300'}`}></label>
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-slate-900">SSO Allowed</p>
                                    <p className="text-xs text-slate-500">Allow login via Google/Microsoft</p>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={formData.ssoAllowed}
                                    onChange={(e) => setFormData({ ...formData, ssoAllowed: e.target.checked })}
                                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-slate-300"
                                />
                            </div>

                            <div className="pt-4 border-t border-slate-100">
                                <div className="flex items-start space-x-3">
                                    <input
                                        type="checkbox"
                                        id="sendEmail"
                                        checked={formData.sendEmail}
                                        onChange={(e) => setFormData({ ...formData, sendEmail: e.target.checked })}
                                        className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-slate-300"
                                    />
                                    <label htmlFor="sendEmail" className="text-sm text-slate-600 cursor-pointer select-none">
                                        Send welcome email with login instructions to the user.
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex space-x-4 pt-2">
                        <button
                            type="button"
                            onClick={onBack}
                            className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 p-4 rounded-xl font-bold transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 bg-slate-900 hover:bg-slate-800 text-white p-4 rounded-xl font-bold shadow-lg shadow-slate-200 transition-transform active:scale-95 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Save className="w-5 h-5 mr-2" />
                            {isSubmitting ? 'Creating...' : 'Create User'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default AddUser;
