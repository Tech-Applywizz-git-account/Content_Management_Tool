import React from 'react';
import { Project, Role, WorkflowStage, STAGE_LABELS, Channel } from '../../types';
import { format } from 'date-fns';
import { ArrowLeft, Video, Image as ImageIcon } from 'lucide-react';
import Timeline from '../Timeline';

interface Props {
    project?: Project;
    onBack: () => void;
}

const OpsCeoApprovedView: React.FC<Props> = ({ project, onBack }) => {
    // Helper to get formatted date
    const formatDate = (dateString?: string) => {
        return dateString ? format(new Date(dateString), 'MMM dd, yyyy h:mm a') : '—';
    };

    const isVideo = project?.channel === Channel.YOUTUBE || 
        project?.channel === Channel.INSTAGRAM || 
        project?.channel === Channel.JOBBOARD || 
        project?.channel === Channel.LEAD_MAGNET ||
        project?.content_type === 'APPLYWIZZ_USA_JOBS';

    // Helpers for timestamps
    const getMostRecentTimestampForStage = (currentStage: WorkflowStage): string => {
        if (!project?.history || project.history.length === 0) return formatDate(project?.created_at);
        const stageHistory = project.history
            .filter(h => h.stage === currentStage)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return stageHistory.length > 0 ? formatDate(stageHistory[0].timestamp) : formatDate(project?.created_at);
    };

    const getRoleForStage = (stage: WorkflowStage): string => {
        const stageToRoleMap: Record<WorkflowStage, Role> = {
            [WorkflowStage.SCRIPT]: Role.WRITER,
            [WorkflowStage.SCRIPT_REVIEW_L1]: Role.CMO,
            [WorkflowStage.SCRIPT_REVIEW_L2]: Role.CEO,
            [WorkflowStage.CINEMATOGRAPHY]: Role.CINE,
            [WorkflowStage.VIDEO_EDITING]: Role.EDITOR,
            [WorkflowStage.SUB_EDITOR_ASSIGNMENT]: Role.EDITOR,
            [WorkflowStage.SUB_EDITOR_PROCESSING]: Role.SUB_EDITOR,
            [WorkflowStage.THUMBNAIL_DESIGN]: Role.DESIGNER,
            [WorkflowStage.CREATIVE_DESIGN]: Role.DESIGNER,
            [WorkflowStage.FINAL_REVIEW_CMO]: Role.CMO,
            [WorkflowStage.FINAL_REVIEW_CEO]: Role.CEO,
            [WorkflowStage.WRITER_VIDEO_APPROVAL]: Role.WRITER,
            [WorkflowStage.MULTI_WRITER_APPROVAL]: Role.WRITER,
            [WorkflowStage.POST_WRITER_REVIEW]: Role.CMO,
            [WorkflowStage.OPS_SCHEDULING]: Role.OPS,
            [WorkflowStage.POSTED]: Role.OPS,
            [WorkflowStage.REWORK]: Role.WRITER,
            [WorkflowStage.WRITER_REVISION]: Role.WRITER
        };
        return stageToRoleMap[stage] || 'UNKNOWN';
    };

    const getMostRecentTimestampForRole = (currentRole: Role): string => {
        if (!project?.history || project.history.length === 0) return formatDate(project?.created_at);

        if (currentRole === Role.CMO && project?.current_stage === WorkflowStage.FINAL_REVIEW_CMO) {
            const finalReviewHistory = project.history
                .filter(h => h.stage === WorkflowStage.FINAL_REVIEW_CMO)
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            if (finalReviewHistory.length > 0) return formatDate(finalReviewHistory[0].timestamp);
        }

        const allStages = Object.values(WorkflowStage);
        const roleStages = allStages.filter(stage => getRoleForStage(stage) === currentRole);
        const roleHistory = project.history
            .filter(h => roleStages.includes(h.stage))
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        return roleHistory.length > 0 ? formatDate(roleHistory[0].timestamp) : formatDate(project?.created_at);
    };

    if (!project) {
        return (
            <div className="min-h-screen bg-white font-sans flex flex-col items-center justify-center">
                <div className="text-center">
                    <div className="text-xl font-black text-slate-900 uppercase mb-4">Loading Project...</div>
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white font-sans flex flex-col">
            {/* Header matching CmoReviewScreen style */}
            <header className="h-20 border-b-2 border-black flex items-center justify-between px-6 sticky top-0 bg-white z-20 shadow-[0px_4px_0px_0px_rgba(0,0,0,0.05)]">
                <div className="flex items-center space-x-6">
                    <button onClick={onBack} className="p-3 border-2 border-transparent hover:border-black hover:bg-slate-100 rounded-full transition-all">
                        <ArrowLeft className="w-6 h-6 text-black" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                            {project.title}
                        </h1>

                        <div className="flex items-center space-x-2 mt-2">
                            <span className={`px-2 py-0.5 text-xs font-black uppercase border-2 border-black text-white ${project?.channel === Channel.YOUTUBE ? 'bg-[#FF4F4F]' :
                                project?.channel === Channel.LINKEDIN ? 'bg-[#0085FF]' :
                                    project?.channel === Channel.INSTAGRAM ? 'bg-[#D946EF]' :
                                        'bg-black'
                                }`}>
                                {project?.channel || '—'}
                            </span>
                            <span
                                className={`px-2 py-0.5 text-xs font-black uppercase border-2 border-black ${project?.priority === 'HIGH'
                                    ? 'bg-red-500 text-white'
                                    : project?.priority === 'NORMAL'
                                        ? 'bg-yellow-500 text-black'
                                        : 'bg-green-500 text-white'
                                    }`}
                            >
                                {project?.priority || '—'}
                            </span>
                            <span className="text-xs font-bold uppercase text-slate-500">
                                Stage: {STAGE_LABELS[project?.current_stage as WorkflowStage] || '—'}
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex-1 flex flex-col md:flex-row w-full">
                {/* LEFT COLUMN: Content (70%) */}
                <div className="flex-1 p-6 md:p-12 space-y-10 overflow-y-auto bg-slate-50">
                    {/* Info Block - Matching CmoReviewScreen Grid Structure */}
                    <div className="bg-white border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-1">Creator</label>
                            <div className="font-bold text-slate-900 uppercase">
                                {project.writer_name || project.created_by_name || '—'}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-1">Priority</label>
                            <div className={`font-bold uppercase ${project?.priority === 'HIGH' ? 'text-red-600' : 'text-slate-900'}`}>
                                {project?.priority || '—'}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-1">Status</label>
                            <div className="font-bold text-slate-900 uppercase">
                                {project?.status || '—'}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-1">Type</label>
                            <div className="font-bold text-slate-900 uppercase">
                                {project?.data?.source === 'DESIGNER_INITIATED' ? 'Creative' : project?.data?.source === 'IDEA_PROJECT' && !project?.data?.script_content ? 'Idea' : 'Standard'}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-1">Content Type</label>
                            <div className="font-bold text-slate-900 uppercase">
                                {project?.content_type || '—'}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-1">Thumbnail Required</label>
                            <div className="font-bold text-slate-900 uppercase">
                                {project?.data?.thumbnail_required === undefined ? '—' : project?.data?.thumbnail_required ? 'Yes' : 'No'}
                            </div>
                        </div>
                        {project?.data?.thumbnail_notes && (
                            <div className="md:col-span-2">
                                <label className="block text-xs font-black text-slate-400 uppercase mb-1">Thumbnail Notes</label>
                                <div className="font-bold text-slate-900 max-h-12 overflow-y-auto">
                                    {project?.data?.thumbnail_notes}
                                </div>
                            </div>
                        )}
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-1">Niche</label>
                            <div className="font-bold text-slate-900 uppercase">
                                {project?.data?.niche
                                    ? project?.data?.niche === 'PROBLEM_SOLVING' ? 'Problem Solving'
                                        : project?.data?.niche === 'SOCIAL_PROOF' ? 'Social Proof'
                                            : project?.data?.niche === 'LEAD_MAGNET' ? 'Lead Magnet'
                                                : project?.data?.niche === 'OTHER' && project?.data?.niche_other
                                                    ? project?.data?.niche_other
                                                    : project?.data?.niche
                                    : '—'}
                            </div>
                        </div>
                        {project?.data?.influencer_name && (
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase mb-1">Influencer</label>
                                <div className="font-bold text-slate-900 uppercase">
                                    {project.data.influencer_name}
                                </div>
                            </div>
                        )}
                        {project?.data?.referral_link && (
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase mb-1">Referral Link</label>
                                <div className="font-bold text-slate-900 uppercase">
                                    <a href={project.data.referral_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">View Link</a>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Brief Content */}
                    {project?.data?.brief && (
                        <section className="space-y-4">
                            <h3 className="text-2xl font-black text-slate-900 uppercase">Brief / Notes</h3>
                            <div className="border-2 border-black bg-white p-8 min-h-[100px] whitespace-pre-wrap text-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                {project?.data?.brief || 'No brief available'}
                            </div>
                        </section>
                    )}

                    {/* References from Writer */}
                    {project?.data?.thumbnail_reference_link && (
                        <section className="space-y-4 pt-6 border-t-4 border-black">
                            <h3 className="text-2xl font-black text-slate-900 uppercase">Writer's Thumbnail Reference</h3>
                            <div className="border-2 border-black bg-white p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold uppercase text-slate-500 mb-2">Reference Thumbnail Link</p>
                                        <a
                                            href={project?.data?.thumbnail_reference_link || ''}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:underline break-all font-medium"
                                        >
                                            {project?.data?.thumbnail_reference_link}
                                        </a>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500 mt-2 italic">This is the thumbnail provided by the writer for reference</p>
                            </div>
                        </section>
                    )}

                    {project?.data?.script_reference_link && (
                        <section className="space-y-4 pt-6 border-t-4 border-black">
                            <h3 className="text-2xl font-black text-slate-900 uppercase">Writer's Script Reference</h3>
                            <div className="border-2 border-black bg-white p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold uppercase text-slate-500 mb-2">Reference Script Link</p>
                                        <a
                                            href={project?.data?.script_reference_link || ''}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:underline break-all font-medium"
                                        >
                                            {project?.data?.script_reference_link}
                                        </a>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500 mt-2 italic">This is the script provided by the writer for reference</p>
                            </div>
                        </section>
                    )}

                    {/* Script/Content Viewer */}
                    <section className="space-y-4">
                        <h3 className="text-2xl font-black text-slate-900 uppercase">
                            {project?.data?.source === 'DESIGNER_INITIATED' ? 'Creative Link & Message' : project?.data?.source === 'IDEA_PROJECT' && !project?.data?.script_content ? 'Idea Description' : 'Script & Message'}
                        </h3>
                        <div className="border-2 border-black bg-white p-8 min-h-[300px] whitespace-pre-wrap font-serif text-lg leading-relaxed text-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            {project?.data?.source === 'DESIGNER_INITIATED'
                                ? project?.data?.creative_link || 'No creative link available.'
                                : project?.data?.source === 'IDEA_PROJECT' && !project?.data?.script_content
                                    ? project?.data?.idea_description
                                    : project?.data?.script_content
                                        ? <div dangerouslySetInnerHTML={{
                                            __html: project?.data?.script_content || 'No content available'
                                                .replace(/&lt;/g, '<')
                                                .replace(/&gt;/g, '>')
                                                .replace(/&amp;/g, '&')
                                        }} />
                                        : 'No content available.'}
                        </div>
                    </section>

                    {/* Timeline */}
                    <div className="pt-6 border-t-4 border-black">
                        <Timeline project={project} />
                    </div>

                    {/* Assets Section */}
                    {(project?.video_link || project?.edited_video_link || project?.thumbnail_link || project?.data?.creative_link) && (
                        <section className="space-y-4 pt-6 border-t-4 border-black">
                            <h3 className="text-2xl font-black text-slate-900 uppercase">Production Assets</h3>
                            <div className="grid grid-cols-3 gap-6">
                                {/* Raw Video Asset */}
                                {isVideo && project.video_link && (
                                    <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                        <div className="aspect-video bg-black flex items-center justify-center text-white border-b-2 border-black">
                                            <Video className="w-16 h-16 opacity-50" />
                                        </div>
                                        <div className="p-4 flex justify-between items-center bg-white">
                                            <div>
                                                <p className="font-black text-slate-900 text-sm uppercase">{['JOBBOARD', 'LEAD_MAGNET', 'APPLYWIZZ_USA_JOBS'].includes(project.content_type) ? 'Shoot Video' : 'Shoot Video'}</p>
                                            </div>
                                            <a href={project?.video_link || ''} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm font-black uppercase">View</a>
                                        </div>
                                    </div>
                                )}
                                {/* Edited Video Asset */}
                                {isVideo && project.edited_video_link && (
                                    <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                        <div className="aspect-video bg-black flex items-center justify-center text-white border-b-2 border-black">
                                            <Video className="w-16 h-16 opacity-50" />
                                        </div>
                                        <div className="p-4 flex justify-between items-center bg-white">
                                            <div>
                                                <p className="font-black text-slate-900 text-sm uppercase">Edited Video</p>
                                            </div>
                                            <a href={project?.edited_video_link || ''} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm font-black uppercase">View</a>
                                        </div>
                                    </div>
                                )}
                                {/* Thumbnail */}
                                {project?.thumbnail_link && (
                                    <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                        <div className="aspect-video bg-slate-100 flex items-center justify-center text-slate-300 border-b-2 border-black">
                                            <ImageIcon className="w-16 h-16" />
                                        </div>
                                        <div className="p-4 flex justify-between items-center bg-white">
                                            <div>
                                                <p className="font-black text-slate-900 text-sm uppercase">Thumbnail</p>
                                            </div>
                                            <a href={project?.thumbnail_link || ''} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm font-black uppercase">View</a>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>
                    )}
                </div>

                {/* RIGHT COLUMN: Project Status Panel (30%) */}
                <div className="w-full md:w-[450px] bg-white border-l-2 border-black p-8 shadow-[-10px_0px_20px_rgba(0,0,0,0.05)] sticky bottom-0 md:top-20 md:h-[calc(100vh-80px)] overflow-y-auto z-10">
                    <h2 className="text-2xl font-black text-slate-900 uppercase mb-8 border-b-4 border-black pb-2 inline-block">Project Status</h2>
                    <div className="space-y-6">
                        <div className="p-6 border-2 border-black bg-white">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-black text-lg uppercase text-slate-900">Current Stage</div>
                                    <div className="text-xs font-bold uppercase text-slate-600">
                                        {STAGE_LABELS[project?.current_stage as WorkflowStage] || '—'}
                                    </div>
                                </div>
                            </div>
                            <div className="mt-2 text-xs font-bold text-slate-500 uppercase">
                                Stage set: {getMostRecentTimestampForStage(project?.current_stage as WorkflowStage)}
                            </div>
                        </div>

                        <div className="p-6 border-2 border-black bg-white">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-black text-lg uppercase text-slate-900">Assigned To</div>
                                    <div className="text-xs font-bold uppercase text-slate-600">
                                        {project?.assigned_to_role || '—'}
                                    </div>
                                </div>
                            </div>
                            <div className="mt-2 text-xs font-bold text-slate-500 uppercase">
                                Role assigned: {getMostRecentTimestampForRole(project?.assigned_to_role as Role)}
                            </div>
                        </div>

                        <div className="p-6 border-2 border-black bg-white">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-black text-lg uppercase text-slate-900">Status</div>
                                    <div className="text-xs font-bold uppercase text-slate-600">
                                        {project?.status || '—'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-2 border-black bg-white">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-black text-lg uppercase text-slate-900">Created</div>
                                    <div className="text-xs font-bold uppercase text-slate-600">
                                        {formatDate(project?.created_at)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OpsCeoApprovedView;
