import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { User, Role, UserStatus, SystemLog } from '../../types';
import { supabase, supabaseAdmin } from '../../src/integrations/supabase/client';
import { Search, Plus, Filter, Edit2, Shield, Power, Key, X, User as UserIcon, AlertTriangle, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { AdminView } from '../AdminLayout';

import { useNavigate } from 'react-router-dom';

interface Props {
    users: User[];
    logs: SystemLog[];
    onRefresh: () => void;
}

const UserManagement: React.FC<Props> = ({ users, logs, onRefresh }) => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<Role | 'ALL'>('ALL');
    const [statusFilter, setStatusFilter] = useState<UserStatus | 'ALL'>('ALL');

    const [editingUser, setEditingUser] = useState<User | null>(null);

    const filteredUsers = users.filter(user => {
        const matchesSearch = user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = roleFilter === 'ALL' || user.role === roleFilter;
        const matchesStatus = statusFilter === 'ALL' || user.status === statusFilter;
        return matchesSearch && matchesRole && matchesStatus;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Users</h1>
                <button
                    onClick={() => navigate('/admin/users/add')}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-3 sm:py-2 rounded-lg font-medium flex items-center justify-center shadow-md shadow-red-100 w-full sm:w-auto min-h-[48px]"
                >
                    <Plus className="w-5 h-5 mr-2" />
                    Add User
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by name or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                </div>
                <div className="flex items-center space-x-2 w-full md:w-auto">
                    <Filter className="w-5 h-5 text-slate-400" />
                    <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value as Role | 'ALL')}
                        className="p-2 border border-slate-300 rounded-lg text-sm"
                    >
                        <option value="ALL">All Roles</option>
                        {Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as UserStatus | 'ALL')}
                        className="p-2 border border-slate-300 rounded-lg text-sm"
                    >
                        <option value="ALL">All Status</option>
                        <option value={UserStatus.ACTIVE}>Active</option>
                        <option value={UserStatus.INACTIVE}>Inactive</option>
                    </select>
                </div>
            </div>

            {/* Users Table / Mobile Cards */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                {/* Desktop view */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Login</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredUsers.map(user => (
                                <tr key={user.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold">
                                                {user.full_name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-slate-900">{user.full_name}</div>
                                                <div className="text-xs text-slate-500">{user.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.status === UserStatus.ACTIVE ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-500'
                                            }`}>
                                            {user.status === UserStatus.ACTIVE ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-500">
                                        {user.last_login ? format(new Date(user.last_login), 'MMM dd, yyyy h:mm a') : 'Never'}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end space-x-2">
                                            <button
                                                onClick={() => setEditingUser(user)}
                                                className="text-blue-600 hover:text-blue-800 font-medium text-sm px-3 py-2 rounded hover:bg-blue-50 transition-colors min-h-[44px]"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    if (window.confirm(`Are you sure you want to delete ${user.full_name}? This action cannot be undone.`)) {
                                                        try {
                                                            if (!supabaseAdmin) throw new Error("Admin client not initialized");
                                                            const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
                                                            if (authError) throw authError;
                                                            await supabaseAdmin.from('users').delete().eq('id', user.id);
                                                            toast.success('User deleted successfully');
                                                            onRefresh();
                                                        } catch (error: any) {
                                                            toast.error(`Error deleting user: ${error.message}`);
                                                        }
                                                    }
                                                }}
                                                className="text-red-600 hover:text-red-800 p-2 rounded hover:bg-red-50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                                                title="Delete User"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile view: Cards */}
                <div className="md:hidden divide-y divide-slate-100">
                    {filteredUsers.map(user => (
                        <div key={user.id} className="p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold">
                                        {user.full_name.charAt(0)}
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-slate-900">{user.full_name}</div>
                                        <div className="text-xs text-slate-500">{user.email}</div>
                                    </div>
                                </div>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${user.status === UserStatus.ACTIVE ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-500'}`}>
                                    {user.status === UserStatus.ACTIVE ? 'Active' : 'Inactive'}
                                </span>
                            </div>

                            <div className="flex justify-between items-center text-xs">
                                <div className="space-y-1">
                                    <p className="text-slate-500 font-medium">Role: <span className="text-slate-900">{user.role}</span></p>
                                    <p className="text-slate-500 font-medium">Last Login: <span className="text-slate-900">{user.last_login ? format(new Date(user.last_login), 'MMM dd') : 'Never'}</span></p>
                                </div>
                                <div className="flex space-x-2">
                                    <button
                                        onClick={() => setEditingUser(user)}
                                        className="bg-blue-50 text-blue-600 px-4 py-2 rounded-lg font-bold text-sm"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={async () => {
                                            if (window.confirm(`Delete ${user.full_name}?`)) {
                                                try {
                                                    if (!supabaseAdmin) throw new Error("Admin client not initialized");
                                                    await supabaseAdmin.auth.admin.deleteUser(user.id);
                                                    await supabaseAdmin.from('users').delete().eq('id', user.id);
                                                    toast.success('User deleted');
                                                    onRefresh();
                                                } catch (error: any) {
                                                    toast.error(`Error: ${error.message}`);
                                                }
                                            }
                                        }}
                                        className="bg-red-50 text-red-600 p-2 rounded-lg"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {filteredUsers.length === 0 && (
                        <div className="p-8 text-center text-slate-400">
                            No users found matching your filters.
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            {editingUser && (
                <EditUserModal user={editingUser} logs={logs} onClose={() => setEditingUser(null)} onRefresh={onRefresh} />
            )}
        </div>
    );
};

// --- Sub-components for Modals ---

const EditUserModal: React.FC<{ user: User; logs: SystemLog[]; onClose: () => void; onRefresh: () => void }> = ({ user, logs, onClose, onRefresh }) => {
    const [activeTab, setActiveTab] = useState<'PROFILE' | 'ROLE' | 'ACCOUNT' | 'LOGS'>('PROFILE');
    const [formData, setFormData] = useState({ ...user });

    // Listen for beforeLogout event to close modal automatically
    useEffect(() => {
        const handleBeforeLogout = () => {
            console.log('Closing edit user modal before logout...');
            onClose(); // Just close the modal
        };

        window.addEventListener('beforeLogout', handleBeforeLogout);
        return () => {
            window.removeEventListener('beforeLogout', handleBeforeLogout);
        };
    }, []);

    const handleSave = async () => {
        try {
            console.log('=== SAVE USER START ===');
            console.log('User ID:', user.id);
            console.log('Form Data:', formData);

            if (!supabaseAdmin) throw new Error("Admin client not initialized");

            const { error } = await supabaseAdmin
                .from('users')
                .update({
                    full_name: formData.full_name,
                    email: formData.email,
                    phone: formData.phone,
                    role: formData.role,
                    status: formData.status
                })
                .eq('id', user.id);

            if (error) throw error;
            console.log('Database update successful');

            toast.success('User updated successfully!');
            onRefresh();
            onClose();
        } catch (error: any) {
            console.error('=== SAVE USER ERROR ===');
            console.error('Error object:', error);
            toast.error(`Failed to update user: ${error.message || 'Unknown error'}`);
        }
    };

    const userLogs = logs.filter(l => l.details.includes(user.full_name) || l.details.includes(user.id) || l.actor_id === user.id).slice(0, 10);

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden h-[600px] flex flex-col">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-slate-300 flex items-center justify-center font-bold text-slate-600">{user.full_name.charAt(0)}</div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">{user.full_name}</h3>
                            <p className="text-xs text-slate-500">{user.role}</p>
                        </div>
                    </div>
                    <button onClick={onClose}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200">
                    <button onClick={() => setActiveTab('PROFILE')} className={`flex-1 py-3 text-sm font-medium border-b-2 ${activeTab === 'PROFILE' ? 'border-red-500 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Profile</button>
                    <button onClick={() => setActiveTab('ROLE')} className={`flex-1 py-3 text-sm font-medium border-b-2 ${activeTab === 'ROLE' ? 'border-red-500 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Role</button>
                    <button onClick={() => setActiveTab('ACCOUNT')} className={`flex-1 py-3 text-sm font-medium border-b-2 ${activeTab === 'ACCOUNT' ? 'border-red-500 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Account</button>
                    <button onClick={() => setActiveTab('LOGS')} className={`flex-1 py-3 text-sm font-medium border-b-2 ${activeTab === 'LOGS' ? 'border-red-500 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Activity</button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'PROFILE' && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                                <input type="text" className="w-full p-2 border rounded" value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                                <input type="email" className="w-full p-2 border rounded" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                                <input type="tel" className="w-full p-2 border rounded" value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                            </div>
                        </div>
                    )}

                    {activeTab === 'ROLE' && (
                        <div className="space-y-6">
                            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200 flex items-start space-x-3">
                                <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                                <div className="text-sm text-orange-800">
                                    <p className="font-bold">Warning</p>
                                    <p>Changing this user's role will immediately modify their access permissions and task visibility. Proceed with caution.</p>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Assigned Role</label>
                                <select
                                    className="w-full p-2 border border-slate-300 rounded"
                                    value={formData.role}
                                    onChange={e => setFormData({ ...formData, role: e.target.value as Role })}
                                >
                                    {Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                        </div>
                    )}

                    {activeTab === 'ACCOUNT' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                                <div>
                                    <h4 className="font-bold text-slate-800">Account Status</h4>
                                    <p className="text-sm text-slate-500">Enable or disable system access.</p>
                                </div>
                                <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                                    <input
                                        type="checkbox"
                                        name="toggle"
                                        id="toggle"
                                        checked={formData.status === UserStatus.ACTIVE}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.checked ? UserStatus.ACTIVE : UserStatus.INACTIVE })}
                                        className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                                        style={{ right: formData.status === UserStatus.ACTIVE ? 0 : 'auto', left: formData.status === UserStatus.ACTIVE ? 'auto' : 0 }}
                                    />
                                    <label htmlFor="toggle" className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${formData.status === UserStatus.ACTIVE ? 'bg-green-400' : 'bg-slate-300'}`}></label>
                                </div>
                            </div>

                            <button className="w-full flex items-center justify-center space-x-2 border border-slate-300 p-3 rounded-lg hover:bg-slate-50 text-slate-700">
                                <Key className="w-4 h-4" />
                                <span>Send Password Reset Email</span>
                            </button>

                            <div className="mt-4 p-4 border rounded bg-gray-50">
                                <p className="text-xs text-slate-500 uppercase font-bold mb-2">Login Info</p>
                                <p className="text-sm">Last Login: {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}</p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'LOGS' && (
                        <div className="space-y-4">
                            {userLogs.length > 0 ? (
                                userLogs.map(log => (
                                    <div key={log.id} className="border-b border-slate-100 pb-2">
                                        <p className="text-sm font-medium text-slate-800">{log.action}</p>
                                        <p className="text-xs text-slate-500">{new Date(log.timestamp).toLocaleString()}</p>
                                        <p className="text-xs text-slate-400">{log.details}</p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center text-slate-500 py-4">No recent activity.</p>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-slate-200 flex justify-end space-x-3 bg-slate-50">
                    <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded">Cancel</button>
                    {activeTab !== 'LOGS' && (
                        <button onClick={handleSave} className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-medium shadow-sm">
                            Save Changes
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserManagement;