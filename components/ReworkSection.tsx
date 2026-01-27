import React from 'react';
import { Project } from '../types';
import { isActiveRework, getCanonicalReworkComment } from '../services/workflowUtils';
import { AlertCircle } from 'lucide-react';

interface ReworkSectionProps {
    project: Project;
    userRole: string;
}

const ReworkSection: React.FC<ReworkSectionProps> = ({ project, userRole }) => {
    const isRework = isActiveRework(project, userRole);
    const reworkDetails = getCanonicalReworkComment(project);

    // authorative rule: ONLY show if isActiveRework is true
    if (!isRework) return null;

    return (
        <div className="bg-red-50 border-2 border-red-400 p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] mb-8 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-600 rounded-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    <AlertCircle className="text-white w-6 h-6" />
                </div>
                <h3 className="text-2xl font-black uppercase text-red-600 tracking-tighter">
                    Rework Required
                </h3>
            </div>

            <div className="bg-white border-2 border-black p-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-red-600"></div>
                <h4 className="font-black text-red-800 mb-2 uppercase text-xs tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>
                    Reviewer Feedback
                    {reworkDetails?.from_role && (
                        <span className="ml-auto text-[9px] bg-red-200 text-red-900 px-2 py-0.5 rounded">
                            FROM: {reworkDetails.from_role}
                        </span>
                    )}
                </h4>
                <p className="text-red-700 font-bold leading-relaxed">
                    {reworkDetails?.comment || 'No specific reason provided. Please review your submission and make necessary changes.'}
                </p>
                <div className="mt-4 pt-3 border-t border-red-100 flex justify-between items-center">
                    <p className="text-[10px] text-red-400 font-black uppercase tracking-widest">
                        Source: {reworkDetails?.actor_name || 'Workflow System'}
                        {reworkDetails?.from_role && ` (${reworkDetails.from_role})`}
                    </p>
                    <span className="bg-red-600 text-white text-[10px] font-black px-2 py-0.5 uppercase tracking-tighter">
                        Active Rework
                    </span>
                </div>
            </div>
        </div>
    );
};

export default ReworkSection;
