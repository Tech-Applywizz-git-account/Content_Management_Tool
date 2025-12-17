import React from 'react';
import { User, SystemLog, Role, UserStatus } from '../../types';
import { Users, ShieldCheck, Activity, UserPlus, Clock } from 'lucide-react';

interface Props {
    users: User[];
    logs: SystemLog[];
    onNavigate: (view: any) => void;
}

const AdminDashboard: React.FC<Props> = ({ users, logs, onNavigate }) => {
    console.log('AdminDashboard received props:', { users, logs });
    console.log('AdminDashboard users length:', users?.length);
    console.log('AdminDashboard logs length:', logs?.length);
    
    // Check if users or logs are undefined/null
    if (!users) {
        console.warn('AdminDashboard: users prop is undefined/null');
        return <div>Loading users data...</div>;
    }
    if (!logs) {
        console.warn('AdminDashboard: logs prop is undefined/null');
        return <div>Loading logs data...</div>;
    }
    
    const activeUsers = users.filter(u => u.status === UserStatus.ACTIVE).length;
    const inactiveUsers = users.length - activeUsers;

    const roleCounts = users.reduce((acc, user) => {
        acc[user.role] = (acc[user.role] || 0) + 1;
        return acc;
    }, {} as Record<Role, number>);

    return (
        <div className="space-y-6 p-6">
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded shadow cursor-pointer" onClick={() => onNavigate('USERS')}>
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm text-gray-500">Total Users</p>
                            <h3 className="text-3xl font-bold mt-2">{users.length}</h3>
                        </div>
                        <Users className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="mt-2 flex space-x-2 text-sm">
                        <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded">{activeUsers} Active</span>
                        <span className="text-gray-600">{inactiveUsers} Inactive</span>
                    </div>
                </div>

                <div className="bg-white p-4 rounded shadow cursor-pointer" onClick={() => onNavigate('ROLES')}>
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm text-gray-500">Roles Defined</p>
                            <h3 className="text-3xl font-bold mt-2">{Object.keys(Role).length}</h3>
                        </div>
                        <ShieldCheck className="w-6 h-6 text-purple-600" />
                    </div>
                    <p className="mt-2 text-sm text-gray-500">Fixed System Roles</p>
                </div>

                <div className="bg-white p-4 rounded shadow cursor-pointer" onClick={() => onNavigate('LOGS')}>
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm text-gray-500">System Logs</p>
                            <h3 className="text-3xl font-bold mt-2">{logs.length}</h3>
                        </div>
                        <Activity className="w-6 h-6 text-amber-600" />
                    </div>
                    <p className="mt-2 text-sm text-gray-500">Recorded Events</p>
                </div>

                <div className="bg-white p-4 rounded shadow">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm text-gray-500">System Status</p>
                            <h3 className="text-3xl font-bold text-green-600 mt-2">Healthy</h3>
                        </div>
                        <Activity className="w-6 h-6 text-green-600" />
                    </div>
                    <p className="mt-2 text-sm text-gray-500">v1.1 Stable</p>
                </div>
            </div>

            {/* Role Distribution */}
            <div className="bg-white p-4 rounded shadow mt-6">
                <h3 className="text-lg font-bold mb-3">Roles Summary</h3>
                <div className="space-y-2">
                    {Object.entries(roleCounts).map(([role, count]) => (
                        <div key={role} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded">
                            <span className="text-sm font-medium text-gray-600">{role}</span>
                            <span className="text-sm font-bold bg-gray-100 px-2 py-1 rounded-md">{count}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white p-4 rounded shadow mt-6">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-bold">Recent Admin Activity</h3>
                    <button onClick={() => onNavigate('LOGS')} className="text-sm text-red-600 hover:underline">View All</button>
                </div>
                <div className="space-y-2">
                    {logs.slice(0, 5).map(log => (
                        <div key={log.id} className="flex items-center space-x-2">
                            <Clock className="w-4 h-4 text-gray-500" />
                            <div>
                                <p className="text-sm">
                                    <span className="font-medium">{log.user_name}</span> {log.action.toLowerCase().replace('_', ' ')}
                                </p>
                                <p className="text-xs text-gray-400">{new Date(log.timestamp).toLocaleString()}</p>
                                {log.details && <p className="text-xs text-gray-500 italic">{log.details}</p>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;