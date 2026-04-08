import React from 'react';
import { Project, WorkflowStage, Channel, STAGE_LABELS } from '../../types';
import { ArrowLeft, Clock, User as UserIcon, CheckCircle, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
    projects: Project[];
    onBack: () => void;
    onSelectProject: (project: Project, fromCeoApproved?: boolean) => void;
}

const PACeoApprovedScripts: React.FC<Props> = ({ projects, onBack, onSelectProject }) => {
    // Filter projects that are CEO approved AND have is_pa_brand=true
    const ceoApprovedPaBrands = projects.filter(p => 
        p.ceo_approved_at && 
        p.data?.is_pa_brand === true
    ).sort((a, b) => new Date(b.ceo_approved_at!).getTime() - new Date(a.ceo_approved_at!).getTime());

    return (
        <div className="min-h-screen bg-white font-sans flex flex-col animate-fade-in pb-20">
            <header className="h-16 border-b-2 border-black flex items-center justify-between px-6 sticky top-0 bg-white/95 backdrop-blur z-20 shadow-[0_4px_0px_0px_rgba(0,0,0,0.1)]">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 border-2 border-transparent hover:border-black"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-xl font-black uppercase text-slate-900">CEO Approved Scripts</h1>
                </div>
                <div className="flex items-center space-x-2">
                    <span className="px-3 py-1 bg-green-500 text-white text-xs font-black uppercase border-2 border-black">
                        {ceoApprovedPaBrands.length} Scripts
                    </span>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto">
                <div className="max-w-7xl mx-auto p-8 space-y-8">
                    <div className="bg-gradient-to-br from-green-50 to-white p-8 border-2 border-green-400 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                        <h2 className="text-2xl font-black uppercase mb-4 text-green-900 flex items-center gap-3">
                            <CheckCircle className="w-8 h-8 text-green-600" />
                            CEO Approved Brand Scripts
                        </h2>
                        <p className="text-sm font-bold mb-6 text-green-700">
                            Scripts written by writers for PA brands that have been approved by the CEO
                        </p>

                        {ceoApprovedPaBrands.length === 0 ? (
                            <div className="p-12 border-2 border-dashed border-green-300 text-center bg-green-50/50">
                                <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                                <p className="text-lg font-bold text-green-800">
                                    No CEO approved scripts yet
                                </p>
                                <p className="text-green-600 mt-2 text-sm">
                                    Scripts from PA brands will appear here once approved by the CEO
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {ceoApprovedPaBrands.map(project => (
                                    <div
                                        key={project.id}
                                        onClick={() => {
                                            console.log('CEO Approved project clicked:', project.id);
                                            onSelectProject(project, true);
                                        }}
                                        className="bg-white p-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all cursor-pointer group"
                                    >
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            <span className={`px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black ${
                                                project.channel === Channel.YOUTUBE ? 'bg-[#FF4F4F] text-white' :
                                                project.channel === Channel.LINKEDIN ? 'bg-[#0085FF] text-white' :
                                                project.channel === Channel.INSTAGRAM ? 'bg-[#D946EF] text-white' :
                                                'bg-black text-white'
                                            }`}>
                                                {project.channel}
                                            </span>
                                            <span className="px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black bg-green-500 text-white">
                                                CEO Approved
                                            </span>
                                            {project.priority === 'HIGH' && (
                                                <span className="px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black bg-red-500 text-white">
                                                    HIGH
                                                </span>
                                            )}
                                        </div>

                                        <h3 className="font-black text-lg text-slate-900 uppercase mb-3 leading-tight group-hover:text-[#0085FF] transition-colors">
                                            {project.title}
                                        </h3>

                                        <div className="space-y-2 mb-4">
                                            {project.brand && (
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="font-bold text-slate-400 uppercase">Brand</span>
                                                    <span className="font-bold text-[#0085FF] uppercase">{project.brand}</span>
                                                </div>
                                            )}
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="font-bold text-slate-400 uppercase flex items-center gap-1">
                                                    <UserIcon className="w-3 h-3" /> Writer
                                                </span>
                                                <span className="font-bold text-slate-900">{project.writer_name || project.created_by_name || 'System'}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="font-bold text-slate-400 uppercase flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" /> CEO Approved
                                                </span>
                                                <span className="font-bold text-slate-900">
                                                    {format(new Date(project.ceo_approved_at!), 'MMM dd, yyyy')}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="font-bold text-slate-400 uppercase flex items-center gap-1">
                                                    <Clock className="w-3 h-3" /> Time
                                                </span>
                                                <span className="font-bold text-slate-900">
                                                    {format(new Date(project.ceo_approved_at!), 'h:mm a')}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="pt-4 border-t-2 border-slate-100">
                                            <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">
                                                Current Stage: {STAGE_LABELS[project.current_stage]}
                                            </div>
                                            <button className="w-full text-white px-4 py-2 text-xs font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] bg-green-600 hover:bg-green-700 transition-colors">
                                                View Details
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PACeoApprovedScripts;
