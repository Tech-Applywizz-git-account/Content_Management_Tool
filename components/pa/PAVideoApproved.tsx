import React, { useState } from 'react';
import { Project, WorkflowStage, STAGE_LABELS } from '../../types';
import { ArrowLeft, Clock, User as UserIcon, FileText, Video, ExternalLink, AlertCircle, X, Loader2, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { db } from '../../services/supabaseDb';
import { toast } from 'sonner';

interface Props {
    projects: Project[];
    onBack: () => void;
    onSelectProject: (project: Project) => void;
}

const PAVideoApproved: React.FC<Props> = ({ projects, onBack, onSelectProject }) => {
    const [selectedProjectForProof, setSelectedProjectForProof] = useState<Project | null>(null);
    const [isProofModalOpen, setIsProofModalOpen] = useState(false);
    const [postScheduledDate, setPostScheduledDate] = useState('');
    const [postingProofLink, setPostingProofLink] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleOpenProofModal = (e: React.MouseEvent, project: Project) => {
        e.stopPropagation();
        setSelectedProjectForProof(project);
        setPostScheduledDate(project.post_scheduled_date || '');
        setPostingProofLink(project.data?.posting_proof_link || '');
        setIsProofModalOpen(true);
    };

    const handleUpdateProof = async () => {
        if (!selectedProjectForProof) return;
        setIsSaving(true);
        try {
            await db.projects.update(selectedProjectForProof.id, {
                post_scheduled_date: postScheduledDate,
                data: {
                    ...(selectedProjectForProof.data || {}),
                    posting_proof_link: postingProofLink
                }
            });
            toast.success('Project details updated');
            setIsProofModalOpen(false);
            // Optionally trigger a data refresh here if needed
        } catch (error) {
            toast.error('Failed to update project');
        } finally {
            setIsSaving(false);
        }
    };

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
                    <h1 className="text-xl font-black uppercase text-slate-900">Video Approved</h1>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto">
                <div className="max-w-5xl mx-auto p-8 space-y-8">
                    <div className="bg-gradient-to-br p-8 border-2 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] from-orange-50 to-white border-orange-400">
                        <h2 className="text-2xl font-black uppercase mb-4 text-orange-900">
                            Approved Videos
                        </h2>
                        <p className="text-sm font-bold mb-6 text-orange-700">
                            View projects that have received final approval
                        </p>

                        {projects.length === 0 ? (
                            <div className="p-8 border-2 border-dashed rounded-lg text-center bg-orange-50 border-orange-300">
                                <p className="text-lg font-bold text-orange-800">
                                    No approved videos
                                </p>
                                <p className="text-orange-600 mt-2">
                                    No videos have reached the approved stage yet
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {projects.map(project => (
                                    <div
                                        key={project.id}
                                        onClick={() => onSelectProject(project)}
                                        className="bg-white p-6 border-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all cursor-pointer border-orange-400"
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <span
                                                className={`px-2 py-1 text-[10px] font-black uppercase border-2 border-black ${project.channel === 'YOUTUBE'
                                                    ? 'bg-[#FF4F4F] text-white'
                                                    : project.channel === 'LINKEDIN'
                                                        ? 'bg-[#0085FF] text-white'
                                                        : 'bg-[#D946EF] text-white'
                                                    }`}
                                            >
                                                {project.channel}
                                            </span>
                                            <span className="px-2 py-1 text-[10px] font-black uppercase border-2 border-black bg-green-100 text-green-800 border-green-300">
                                                Approved
                                            </span>
                                        </div>

                                        <h3 className="font-black text-lg text-slate-900 uppercase mb-2">{project.title}</h3>

                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="font-bold text-slate-400 uppercase text-xs">Stage</span>
                                                <span className="font-bold text-slate-900">{STAGE_LABELS[project.current_stage]}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="font-bold text-slate-400 uppercase text-xs">Created</span>
                                                <span className="font-bold text-slate-900">
                                                    {format(new Date(project.created_at), 'MMM dd, yyyy')}
                                                </span>
                                            </div>
                                            {project.post_scheduled_date && (
                                                <div className="flex justify-between py-1 bg-amber-50 px-2 -mx-2">
                                                    <span className="font-bold text-amber-700 uppercase text-xs">Scheduled</span>
                                                    <span className="font-black text-amber-900">
                                                        {format(new Date(project.post_scheduled_date), 'MMM dd, yyyy')}
                                                    </span>
                                                </div>
                                            )}
                                            {project.data?.posting_proof_link && (
                                                <div className="flex justify-between py-1 bg-emerald-50 px-2 -mx-2">
                                                    <span className="font-bold text-emerald-700 uppercase text-xs">Posted</span>
                                                    <a 
                                                        href={project.data.posting_proof_link} 
                                                        target="_blank" 
                                                        rel="noreferrer"
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="font-black text-emerald-900 flex items-center gap-1 hover:underline"
                                                    >
                                                        Live Link <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-4 pt-4 border-t-2 border-slate-100">
                                            {(() => {
                                                const now = new Date();
                                                now.setHours(0, 0, 0, 0);
                                                const scheduledDate = project.post_scheduled_date ? new Date(project.post_scheduled_date) : null;
                                                if (scheduledDate) scheduledDate.setHours(0, 0, 0, 0);
                                                
                                                const isDatePassed = scheduledDate ? now >= scheduledDate : false;
                                                const hasProof = !!project.data?.posting_proof_link;
                                                const isOverdue = isDatePassed && !hasProof;

                                                if (isOverdue) {
                                                    return (
                                                        <div className="space-y-3">
                                                            <div className="flex items-center gap-2 text-red-600 animate-bounce">
                                                                <AlertCircle className="w-4 h-4" />
                                                                <span className="text-[10px] font-black uppercase">Post Overdue!</span>
                                                            </div>
                                                            <button 
                                                                onClick={(e) => handleOpenProofModal(e, project)}
                                                                className="w-full text-white px-4 py-3 text-xs font-black uppercase border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-amber-500 hover:bg-amber-600 transition-all active:shadow-none translate-y-[-2px] active:translate-y-0"
                                                            >
                                                                Add Proof Now
                                                            </button>
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <button 
                                                        onClick={(e) => handleOpenProofModal(e, project)}
                                                        className="w-full text-white px-4 py-2 text-xs font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] bg-green-500 hover:bg-green-600 transition-colors"
                                                    >
                                                        Set Schedule / Proof
                                                    </button>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Proof of Posting Modal */}
            {isProofModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-fade-in">
                    <div className="bg-white border-[3px] border-black p-8 max-w-md w-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative animate-scale-in">
                        <button 
                            onClick={() => setIsProofModalOpen(false)}
                            className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full transition-colors"
                        >
                            <X className="w-6 h-6 text-slate-400" />
                        </button>
                        
                        <h3 className="text-2xl font-black uppercase mb-2 tracking-tight text-slate-900 pr-8">POSTING DETAILS</h3>
                        <p className="text-xs font-bold text-slate-400 uppercase mb-6">{selectedProjectForProof?.title}</p>
                        
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Scheduled Posting Date</label>
                                <div className="relative">
                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="date"
                                        value={postScheduledDate}
                                        onChange={(e) => setPostScheduledDate(e.target.value)}
                                        className="w-full bg-white border-2 border-black pl-12 pr-4 py-4 font-black text-sm text-slate-900 focus:outline-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Proof of Posting (Live Link)</label>
                                <div className="relative">
                                    <ExternalLink className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="url"
                                        value={postingProofLink}
                                        onChange={(e) => setPostingProofLink(e.target.value)}
                                        className="w-full bg-white border-2 border-black pl-12 pr-4 py-4 font-black text-sm text-slate-900 focus:outline-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
                                        placeholder="https://..."
                                    />
                                </div>
                                <p className="text-[9px] font-bold text-slate-400 italic mt-1 uppercase">* Paste the link once the video is live on social media</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-8">
                                <button 
                                    onClick={() => setIsProofModalOpen(false)} 
                                    className="py-4 border-2 border-black bg-white text-black font-black uppercase text-sm tracking-widest hover:bg-slate-50 transition-all active:translate-y-[2px]"
                                >
                                    CANCEL
                                </button>
                                <button 
                                    onClick={handleUpdateProof} 
                                    disabled={isSaving}
                                    className="py-4 border-2 border-black bg-black text-white font-black uppercase text-sm tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2 active:translate-y-[2px]"
                                >
                                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'SAVE CHANGES'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PAVideoApproved;
