import React from 'react';
import { Role } from '../../types';
import { Check, X, HelpCircle, Info } from 'lucide-react';

const PERMISSIONS = [
    {
        label: 'Create Projects',
        key: 'create',
        description: 'Allows the user to initiate new content workflows and set deadlines.'
    },
    {
        label: 'Approve Scripts',
        key: 'approve',
        description: 'Grants authority to sign off on content at critical review stages (CMO/CEO).'
    },
    {
        label: 'Start/Done Tasks',
        key: 'work',
        description: 'Enables marking operational tasks (Scripting, Editing, Design) as In Progress or Done.'
    },
    {
        label: 'Publish Live',
        key: 'publish',
        description: 'Permission to set the final status of a project to Published/Live.'
    },
    {
        label: 'Assign Work',
        key: 'assign',
        description: 'Ability to override system assignments and re-assign tasks to specific team members.'
    },
];

// Simplified matrix based on the spec
const MATRIX: Record<Role, Record<string, boolean>> = {
    [Role.ADMIN]: { create: false, approve: false, work: false, publish: false, assign: true },
    [Role.WRITER]: { create: true, approve: false, work: true, publish: false, assign: false },
    [Role.CINE]: { create: false, approve: false, work: true, publish: false, assign: false },
    [Role.EDITOR]: { create: false, approve: false, work: true, publish: false, assign: false },
    [Role.DESIGNER]: { create: false, approve: false, work: true, publish: false, assign: false },
    [Role.CMO]: { create: false, approve: true, work: false, publish: false, assign: true },
    [Role.CEO]: { create: false, approve: true, work: false, publish: false, assign: true },
    [Role.OPS]: { create: false, approve: false, work: true, publish: true, assign: false },
    [Role.OBSERVER]: { create: false, approve: false, work: false, publish: false, assign: false }, // View-only role
};

const RolesMatrix: React.FC = () => {
    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Roles & Permissions</h1>
                    <p className="text-slate-500 mt-1">Read-only view of system access levels. Contact system architect for changes.</p>
                </div>
                <div className="bg-slate-100 px-3 py-1 rounded text-xs font-medium text-slate-500">
                    System Version 1.1
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-10 py-8 text-left text-xs font-bold text-slate-600 uppercase tracking-wider w-64">Role</th>
                                {PERMISSIONS.map(p => (
                                    <th key={p.key} className="px-10 py-8 text-center text-xs font-bold text-slate-600 uppercase tracking-wider relative group cursor-help">
                                        <div className="flex items-center justify-center space-x-1">
                                            <span>{p.label}</span>
                                            <Info className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                        {/* Tooltip */}
                                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3 hidden group-hover:block w-56 bg-slate-800 text-white text-[12px] font-medium leading-relaxed rounded-lg p-4 z-10 shadow-xl pointer-events-none normal-case text-left">
                                            {p.description}
                                            {/* Tooltip Arrow */}
                                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-800"></div>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {Object.values(Role).map((role, idx) => (
                                <tr
                                    key={role}
                                    className={`transition-colors hover:bg-blue-50/50 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'}`}
                                >
                                    <td className="px-10 py-8 font-semibold text-sm text-slate-900 flex items-center">
                                        <span className={`w-2.5 h-2.5 rounded-full mr-4 ${MATRIX[role].approve ? 'bg-purple-500 shadow-sm shadow-purple-200' : MATRIX[role].publish ? 'bg-green-500 shadow-sm shadow-green-200' : 'bg-slate-300'}`}></span>
                                        {role}
                                    </td>
                                    {PERMISSIONS.map(p => {
                                        const hasPerm = MATRIX[role]?.[p.key] || false;
                                        return (
                                            <td key={p.key} className="px-10 py-8 text-center">
                                                {hasPerm ? (
                                                    <div className="flex justify-center">
                                                        <div className="bg-green-100 text-green-700 p-2 rounded-lg shadow-sm">
                                                            <Check className="w-5 h-5" />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-center">
                                                        <div className="p-2">
                                                            <X className="w-5 h-5 text-slate-200" />
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-lg p-5 flex items-start space-x-3">
                <HelpCircle className="w-5 h-5 text-blue-500 mt-0.5" />
                <div className="text-sm text-blue-800">
                    <p className="font-bold">Why is this read-only?</p>
                    <p className="mt-1 leading-relaxed text-blue-700/80">The role matrix is hard-coded into the workflow engine to ensure stability and data integrity. Changing a role's core permissions requires a code deployment.</p>
                </div>
            </div>
        </div>
    );
};

export default RolesMatrix;