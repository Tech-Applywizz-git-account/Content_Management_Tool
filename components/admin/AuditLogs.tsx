import React, { useState } from 'react';
import { SystemLog } from '../../types';
import { Search, Download, Filter } from 'lucide-react';

interface Props {
  logs: SystemLog[];
}

const AuditLogs: React.FC<Props> = ({ logs }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = logs.filter(log => 
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.actor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.details.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
             <h1 className="text-2xl font-bold text-slate-900">Audit Logs</h1>
             <button className="flex items-center text-slate-600 hover:text-slate-900 bg-white border border-slate-300 px-3 py-2 rounded-lg text-sm font-medium">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
             </button>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex gap-4">
             <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                <input 
                    type="text" 
                    placeholder="Search logs by actor, action, or details..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                />
            </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                        <th className="px-6 py-3 font-medium text-slate-500">Timestamp</th>
                        <th className="px-6 py-3 font-medium text-slate-500">Actor</th>
                        <th className="px-6 py-3 font-medium text-slate-500">Role</th>
                        <th className="px-6 py-3 font-medium text-slate-500">Event</th>
                        <th className="px-6 py-3 font-medium text-slate-500">Details</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {filteredLogs.map(log => (
                        <tr key={log.id} className="hover:bg-slate-50">
                            <td className="px-6 py-3 text-slate-500 whitespace-nowrap">
                                {new Date(log.timestamp).toLocaleString()}
                            </td>
                            <td className="px-6 py-3 font-medium text-slate-900">
                                {log.actor_name}
                            </td>
                            <td className="px-6 py-3 text-slate-500">
                                {log.actor_role}
                            </td>
                            <td className="px-6 py-3">
                                <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-mono">
                                    {log.action}
                                </span>
                            </td>
                            <td className="px-6 py-3 text-slate-600">
                                {log.details}
                            </td>
                        </tr>
                    ))}
                    {filteredLogs.length === 0 && (
                        <tr>
                            <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                                No logs found.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    </div>
  );
};

export default AuditLogs;