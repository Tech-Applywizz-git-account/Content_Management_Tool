import React, { useState } from 'react';
import { Project, WorkflowStage, TaskStatus } from '../../types';
import { Video, Clock, Search } from 'lucide-react';
import { format } from 'date-fns';
import { isInfluencerVideo } from '../../services/workflowUtils';

interface Props {
    user: any;
    projects: Project[];
    onSelectProject: (project: Project) => void;
}

const WriterApprovedVideos: React.FC<Props> = ({ user, projects, onSelectProject }) => {
    const [searchTerm, setSearchTerm] = useState('');

    // Filter for JOBBOARD and LEAD_MAGNET projects that have passed video approval or are in POSTED
    const approvedProjects = projects.filter(p => {
        if (!isInfluencerVideo(p)) return false;

        // Project has passed the editor stage and is now available for the writer (or beyond)
        const isPostEditor = [
            WorkflowStage.WRITER_VIDEO_APPROVAL,
            WorkflowStage.MULTI_WRITER_APPROVAL,
            WorkflowStage.WRITER_REVISION,
            WorkflowStage.FINAL_REVIEW_CMO,
            WorkflowStage.FINAL_REVIEW_CEO,
            WorkflowStage.POSTED
        ].includes(p.current_stage);

        // Or it has explicitly been approved in history
        const hasApproved = p.history?.some(
            h => h.stage === WorkflowStage.WRITER_VIDEO_APPROVAL && h.action === 'APPROVED'
        );

        return isPostEditor || hasApproved || p.status === TaskStatus.DONE;
    });

    const filteredProjects = approvedProjects.filter(p =>
        p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.channel?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.data?.influencer_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b-2 border-black pb-4 mb-6">
                <div>
                    <h2 className="text-3xl font-black uppercase text-slate-900 drop-shadow-[2px_2px_0px_rgba(0,0,0,0.1)]">Approved Shoot Videos</h2>
                    <p className="text-slate-600 font-bold mt-1">Videos you have approved for Job Board and Lead Magnet</p>
                </div>
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search videos..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border-2 border-black font-bold focus:outline-none focus:ring-2 focus:ring-[#0085FF] focus:border-transparent text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase placeholder:normal-case"
                    />
                </div>
            </div>

            {filteredProjects.length === 0 ? (
                <div className="bg-slate-50 border-2 border-dashed border-slate-300 p-12 text-center rounded">
                    <Video className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-xl font-black text-slate-500 uppercase">No approved videos found</h3>
                    <p className="text-slate-400 font-bold mt-2">You haven't approved any shoot videos yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredProjects.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(p => (
                        <div
                            key={p.id}
                            onClick={() => onSelectProject(p)}
                            className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer flex flex-col h-full"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <span className={`px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black ${isInfluencerVideo(p) ? 'bg-[#F59E0B] text-white' : 'bg-[#10B981] text-white'
                                    }`}>
                                    {p.brand?.replace(/_/g, ' ') || p.content_type?.replace(/_/g, ' ')}
                                </span>
                                {p.data?.influencer_name && (
                                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 border-2 border-black uppercase">
                                        {p.data.influencer_name}
                                    </span>
                                )}
                            </div>

                            <h3 className="font-black text-lg text-slate-900 mb-2 uppercase line-clamp-2" title={p.title}>{p.title}</h3>

                            <div className="mt-auto pt-4 border-t-2 border-slate-100 flex items-center justify-between">
                                <span className={`px-2 py-1 text-xs font-black uppercase border-2 border-black ${
                                    [WorkflowStage.WRITER_VIDEO_APPROVAL, WorkflowStage.MULTI_WRITER_APPROVAL].includes(p.current_stage) 
                                      ? 'bg-orange-100 text-orange-800 border-orange-400' 
                                      : p.current_stage === WorkflowStage.WRITER_REVISION 
                                        ? 'bg-blue-100 text-blue-800 border-blue-400'
                                        : 'bg-green-100 text-green-800 border-green-400'
                                }`}>
                                    {[WorkflowStage.WRITER_VIDEO_APPROVAL, WorkflowStage.MULTI_WRITER_APPROVAL].includes(p.current_stage) 
                                      ? 'Awaiting Approval' 
                                      : p.current_stage === WorkflowStage.WRITER_REVISION 
                                        ? 'Ready for Upload' 
                                        : 'Approved'}
                                </span>
                                <div className="flex items-center text-xs font-bold text-slate-500 uppercase">
                                    <Clock className="w-3 h-3 mr-1" />
                                    {format(new Date(p.created_at), 'MMM dd')}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default WriterApprovedVideos;
