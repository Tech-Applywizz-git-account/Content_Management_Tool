import React, { useState } from 'react';
import { Project, WorkflowStage, STAGE_LABELS, Role, User as PublicUser } from '../../types';
import { ArrowLeft, Clock, User as UserIcon, FileText, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../src/integrations/supabase/client';
import { getWorkflowState } from '../../services/workflowUtils';
import { decodeHtmlEntities } from '../../utils/htmlDecoder';
import { db } from '../../services/supabaseDb';
import { UserStatus } from '../../types';
import Popup from '../Popup';
import WriterProjectDetail from './WriterProjectDetail';

interface Props {
    projects: Project[];
    onBack: () => void;
    refreshProjects: () => void;
}

const WriterVideoApproval: React.FC<Props> = ({ projects, onBack, refreshProjects }) => {
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);

    if (selectedProject) {
        if (selectedProject.current_stage === WorkflowStage.WRITER_REVISION) {
            return (
                <div className="animate-fade-in">
                    <WriterProjectDetail
                        project={selectedProject}
                        onBack={() => {
                            setSelectedProject(null);
                            refreshProjects();
                        }}
                    />
                </div>
            );
        }
        return (
            <VideoApprovalDetail
                project={selectedProject}
                onBack={() => setSelectedProject(null)}
                onApprove={() => {
                    refreshProjects();   // Fetch latest data from Supabase
                    setSelectedProject(null);
                }}
            />
        );
    }

    return (
        <div className="min-h-screen bg-white font-sans flex flex-col animate-fade-in">
            <header className="h-16 border-b-2 border-black flex items-center justify-between px-6 sticky top-0 bg-white/95 backdrop-blur z-20 shadow-[0_4px_0px_0px_rgba(0,0,0,0.1)]">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 border-2 border-transparent hover:border-black"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-xl font-black uppercase text-slate-900">Video Approval</h1>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto">
                <div className="max-w-5xl mx-auto p-8 space-y-8">
                    <div className="bg-gradient-to-br from-orange-50 to-white p-8 border-2 border-orange-400 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                        <h2 className="text-2xl font-black uppercase text-orange-900 mb-4">Videos Needing Approval</h2>
                        <p className="text-sm font-bold text-orange-700 mb-6">
                            Select a project to review and approve the completed video content
                        </p>

                        {projects.length === 0 ? (
                            <div className="bg-orange-100 p-8 border-2 border-orange-300 rounded-lg text-center">
                                <p className="text-lg font-bold text-orange-800">No videos require approval</p>
                                <p className="text-orange-600 mt-2">All completed videos have been approved</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {projects.map(project => (
                                    <div
                                        key={project.id}
                                        onClick={() => setSelectedProject(project)}
                                        className="bg-white p-6 border-2 border-orange-400 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all cursor-pointer"
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
                                            <span className={`px-2 py-1 text-[10px] font-black uppercase border-2 border-black ${project.current_stage === WorkflowStage.WRITER_REVISION ? 'bg-blue-600 text-white' : 'bg-orange-100 text-orange-800 border-orange-300'}`}>
                                                {project.current_stage === WorkflowStage.WRITER_REVISION ? 'Upload Video' : 'Needs Approval'}
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

                                        </div>

                                        <div className="mt-4 pt-4 border-t-2 border-slate-100">
                                            <button className={`w-full text-white px-4 py-2 text-xs font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${project.current_stage === WorkflowStage.WRITER_REVISION ? 'bg-blue-600' : 'bg-orange-500'}`}>
                                                {project.current_stage === WorkflowStage.WRITER_REVISION ? 'Open Project Detail' : 'Review & Approve'}
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

// Video Approval Detail Component
interface VideoApprovalDetailProps {
    project: Project;
    onBack: () => void;
    onApprove: () => void;
}

const VideoApprovalDetail: React.FC<VideoApprovalDetailProps> = ({ project, onBack, onApprove }) => {
    const [comments, setComments] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [reworkComment, setReworkComment] = useState('');
    const [selectedRoleForRework, setSelectedRoleForRework] = useState('');
    const [hasBeenRejected, setHasBeenRejected] = useState(false);
    const [writerAlreadyActed, setWriterAlreadyActed] = useState(false);
    const [publicUser, setPublicUser] = useState<PublicUser | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Popup state
    const [showPopup, setShowPopup] = useState(false);
    const [popupMessage, setPopupMessage] = useState('');
    const [stageName, setStageName] = useState('');
    const [popupDuration, setPopupDuration] = useState(5000); // 5 seconds

    React.useEffect(() => {
        const fetchData = async () => {
            // Fetch comments
            const { data: commentsData, error: commentsError } = await supabase
                .from('workflow_history')
                .select(`
                    action,
                    comment,
                    actor_name,
                    actor_id,
                    timestamp,
                    stage
                `)
                .eq('project_id', project.id)
                .in('action', ['APPROVED', 'REJECTED', 'REWORK'])
                .order('timestamp', { ascending: false });

            if (commentsError) {
                console.error('Error fetching comments:', commentsError);
            } else {
                setComments(commentsData || []);

                // Get current user session to check if this writer has already acted
                const { data: { session } } = await supabase.auth.getSession();
                const user = session?.user;

                // Check if current writer has already approved or rejected this project IN THE CURRENT STAGE
                // This prevents old approvals (like for raw video) from blocking new approvals (like for edited video)
                const currentUserAction = commentsData?.find(comment =>
                    comment.actor_id === (publicUser?.id || user?.id) &&
                    (comment.action === 'APPROVED' || comment.action === 'REJECTED') &&
                    comment.stage === project.current_stage
                );

                setWriterAlreadyActed(!!currentUserAction);

                // Check if any writer has already rejected this project
                const hasRejection = commentsData?.some(comment =>
                    comment.action === 'REJECTED'
                );
                setHasBeenRejected(!!hasRejection);
            }
        };

        const loadUser = async () => {
            try {
                const { data: { user: authUser } } = await supabase.auth.getUser();
                if (authUser?.email) {
                    const { data: pUser, error: pError } = await supabase
                        .from('users')
                        .select('*')
                        .eq('email', authUser.email)
                        .single();

                    if (!pError && pUser) {
                        setPublicUser(pUser as PublicUser);
                    }
                }
            } catch (err) {
                console.error('Failed to load user:', err);
            }
        };

        loadUser();
        fetchData();
    }, [project.id, publicUser?.id]);

    const handleApprove = async () => {
        if (!publicUser?.id) {
            alert('User profile not loaded. Please refresh and try again.');
            return;
        }

        try {
            setLoading(true);
            setIsSubmitting(true);
            setError(null);

            // Get the current approval status before approving
            const { data: currentApprovals, error: approvalsError } = await supabase
                .from('workflow_history')
                .select('actor_id, actor_name')
                .eq('project_id', project.id)
                .eq('stage', project.current_stage)
                .eq('action', 'APPROVED');

            const currentApprovedCount = currentApprovals?.length || 0;

            // For MULTI_WRITER_APPROVAL (direct video upload flow), only 2 writers are required.
            // For WRITER_VIDEO_APPROVAL (regular flow), count all active writers.
            let totalWriters: number;
            if (project.current_stage === WorkflowStage.MULTI_WRITER_APPROVAL || project.data?.source === 'EDITOR_DIRECT_UPLOAD') {
                totalWriters = 2; // Only Varshini & Kishore required for direct upload flow
            } else {
                const { data: allWriters } = await supabase
                    .from('users')
                    .select('id')
                    .eq('role', Role.WRITER)
                    .eq('status', 'ACTIVE');
                totalWriters = allWriters?.length || 0;
            }

            const newApprovedCount = currentApprovedCount + 1;

            // Determine the next stage automatically
            const nextStageInfo = db.helpers.getNextStage(
                project.current_stage,
                project.content_type,
                'APPROVED',
                project.data
            );

            // Call the workflow approve function with correctly calculated next stage/role
            await db.workflow.approve(
                project.id,
                publicUser.id,
                publicUser.full_name || publicUser.email || 'Unknown User',
                Role.WRITER,
                nextStageInfo.stage,
                nextStageInfo.role,
                'Writer approved the final video'
            );

            // Determine popup message based on approval progress
            let popupMsg, stageMsgName;
            const actualNextStageLabel = STAGE_LABELS[nextStageInfo.stage] || 'Next Stage';

            if (project.current_stage === WorkflowStage.WRITER_VIDEO_APPROVAL) {
                // Single writer approval
                popupMsg = `You approved the video. The project has been sent to ${actualNextStageLabel}.`;
                stageMsgName = actualNextStageLabel;
            } else if (newApprovedCount >= totalWriters) {
                // Both required writers have approved, moving to next stage
                popupMsg = `You approved the video. Both writers have now approved. The project has been sent to ${actualNextStageLabel}.`;
                stageMsgName = actualNextStageLabel;
            } else {
                // Still need the other writer's approval
                popupMsg = `You approved the video. ${newApprovedCount} of ${totalWriters} writers have approved so far. Waiting for the other writer.`;
                stageMsgName = 'Waiting for Other Writer';
            }

            // Show success popup
            setPopupMessage(popupMsg);
            setStageName(stageMsgName);
            setPopupDuration(5000);
            setShowPopup(true);

            // Navigate back after popup duration + small buffer
            setTimeout(() => {
                onApprove(); // Navigate back to project list
            }, 5500); // 5 seconds popup + 500ms buffer
        } catch (err: any) {
            console.error('Failed to approve video:', err);
            setPopupMessage('Failed to approve video. Please try again.');
            setStageName('Error');
            setPopupDuration(5000);
            setShowPopup(true);
        } finally {
            setLoading(false);
            setIsSubmitting(false);
        }
    };

    const handleReject = async (reworkComment: string, roleForRework?: string) => {
        if (!publicUser?.id) {
            alert('User profile not loaded. Please refresh and try again.');
            return;
        }

        try {
            setLoading(true);
            setIsSubmitting(true);
            setError(null);

            // Determine the stage to return the project to based on the selected role
            let targetStage;
            if (roleForRework === 'CINE') {
                targetStage = WorkflowStage.CINEMATOGRAPHY;
            } else if (roleForRework === 'EDITOR') {
                targetStage = WorkflowStage.VIDEO_EDITING;
            } else if (roleForRework === 'DESIGNER') {
                targetStage = WorkflowStage.THUMBNAIL_DESIGN;
            } else {
                // Default to editor if no specific role is selected
                targetStage = WorkflowStage.VIDEO_EDITING;
            }

            // Call the workflow reject function to send project back to the selected role
            await db.rejectTask(project.id, targetStage, reworkComment || 'Writer rejected the video - needs rework');

            // Update the project to ensure it's not assigned to the writer anymore
            await db.updateProjectData(project.id, {
                assigned_to_role: roleForRework,
                assigned_to_user_id: null  // Clear specific user assignment
            });

            // Show rejection popup
            setPopupMessage(`Video rejected. Sent back to ${roleForRework || 'Editor'} for rework.`);
            setStageName(STAGE_LABELS[targetStage] || 'Rework');
            setPopupDuration(5000);
            setShowPopup(true);

            // Navigate back after popup duration + small buffer
            setTimeout(() => {
                onApprove(); // Navigate back to project list
            }, 5500); // 5 seconds popup + 500ms buffer
        } catch (err: any) {
            console.error('Failed to reject video:', err);
            setPopupMessage('Failed to reject video. Please try again.');
            setStageName('Error');
            setPopupDuration(5000);
            setShowPopup(true);
        } finally {
            setLoading(false);
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-white font-sans flex flex-col animate-fade-in">
            <header className="h-16 border-b-2 border-black flex items-center justify-between px-6 sticky top-0 bg-white/95 backdrop-blur z-20 shadow-[0_4px_0px_0px_rgba(0,0,0,0.1)]">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 border-2 border-transparent hover:border-black"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-xl font-black uppercase text-slate-900">{project.title}</h1>
                    <span className={`px-3 py-1 text-xs font-black uppercase border-2 border-black ${project.channel === 'YOUTUBE' ? 'bg-[#FF4F4F] text-white' :
                        project.channel === 'LINKEDIN' ? 'bg-[#0085FF] text-white' :
                            'bg-[#D946EF] text-white'
                        }`}>
                        {project.channel}
                    </span>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto">
                <div className="max-w-5xl mx-auto p-8 space-y-8">

                    {/* Current Status Card */}
                    <div className="bg-gradient-to-br from-orange-50 to-white p-8 border-2 border-orange-400 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                        <div className="flex items-start justify-between mb-6">
                            <div>
                                <h2 className="text-2xl font-black uppercase text-orange-900 mb-2">Video Approval</h2>
                                <p className="text-sm font-bold text-orange-700 uppercase">Project submitted {format(new Date(project.created_at), 'MMM dd, yyyy h:mm a')}</p>
                            </div>
                            <div className={`bg-orange-600 text-white px-4 py-2 border-2 border-black font-black uppercase text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`}>
                                Needs Approval
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white p-6 border-2 border-black">
                                <div className="flex items-center space-x-2 mb-2">
                                    <UserIcon className="w-5 h-5 text-orange-600" />
                                    <span className="text-xs font-bold uppercase text-slate-500">Current Stage</span>
                                </div>
                                <p className="font-black text-lg uppercase">{STAGE_LABELS[project.current_stage]}</p>
                            </div>

                            <div className="bg-white p-6 border-2 border-black">
                                <div className="flex items-center space-x-2 mb-2">
                                    <Clock className="w-5 h-5 text-orange-600" />
                                    <span className="text-xs font-bold uppercase text-slate-500">Assigned To</span>
                                </div>
                                <p className="font-black text-lg uppercase">Writer (You)</p>
                            </div>

                            <div className="bg-white p-6 border-2 border-black">
                                <div className="flex items-center space-x-2 mb-2">
                                    <FileText className="w-5 h-5 text-orange-600" />
                                    <span className="text-xs font-bold uppercase text-slate-500">Status</span>
                                </div>
                                <p className="font-black text-lg uppercase">AWAITING APPROVAL</p>
                            </div>
                        </div>
                    </div>

                    {/* Script Content */}
                    <div className="bg-white p-8 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <div className="flex items-center gap-2 mb-6">
                            <FileText className="w-6 h-6" />
                            <h3 className="text-xl font-black uppercase text-slate-900">Script Content</h3>
                        </div>
                        <div className="bg-slate-50 border-2 border-slate-200 p-6 font-serif text-slate-900 leading-relaxed max-h-96 overflow-y-auto overflow-x-auto">
                            {project.data.script_content ? (
                                <div dangerouslySetInnerHTML={{ __html: decodeHtmlEntities(project.data.script_content) }} />
                            ) : (
                                <p className="text-slate-500 italic">No script content available</p>
                            )}
                        </div>
                    </div>

                    {/* Video Content */}
                    <div className="bg-slate-50 p-8 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <h3 className="text-xl font-black uppercase mb-6 text-slate-900">Video Content</h3>

                        <div className="space-y-6">
                            {project.video_link && (
                                <div className="bg-white p-6 border-2 border-slate-300">
                                    <h4 className="font-black text-lg text-slate-900 mb-4">{['JOBBOARD', 'LEAD_MAGNET'].includes(project.content_type) ? 'Influencer Video' : 'Shoot Video'}</h4>
                                    <a
                                        href={project.video_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 underline break-all"
                                    >
                                        {project.video_link}
                                    </a>
                                </div>
                            )}

                            {project.edited_video_link && (
                                <div className="bg-white p-6 border-2 border-slate-300">
                                    <h4 className="font-black text-lg text-slate-900 mb-4">
                                        Edited Video
                                    </h4>
                                    <a
                                        href={project.edited_video_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 underline break-all"
                                    >
                                        {project.edited_video_link}
                                    </a>
                                </div>
                            )}

                            {/* Fallback: show data.video_link if edited_video_link column is empty (older direct-upload projects) */}
                            {!project.edited_video_link && project.data?.video_link && (
                                <div className="bg-white p-6 border-2 border-blue-400">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-blue-600 text-white border border-blue-800">Direct Upload</span>
                                        <h4 className="font-black text-lg text-slate-900">Edited Video</h4>
                                    </div>
                                    <a
                                        href={project.data.video_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 underline break-all font-medium"
                                    >
                                        {project.data.video_link}
                                    </a>
                                </div>
                            )}

                            {project.thumbnail_link && (
                                <div className="bg-white p-6 border-2 border-slate-300">
                                    <h4 className="font-black text-lg text-slate-900 mb-4">Thumbnail (from Designer)</h4>
                                    <a
                                        href={project.thumbnail_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 underline break-all"
                                    >
                                        {project.thumbnail_link}
                                    </a>
                                </div>
                            )}

                            {(!project.video_link && !project.edited_video_link && !project.data?.video_link && !project.thumbnail_link) && (
                                <div className="bg-yellow-50 p-6 border-2 border-yellow-400 text-center">
                                    <p className="font-bold text-yellow-800">No assets have been uploaded yet</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="bg-white p-8 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        {hasBeenRejected ? (
                            <div className="bg-red-100 p-6 border-2 border-red-400 mb-4">
                                <h3 className="font-black text-red-800 mb-2">Project Already Rejected</h3>
                                <p className="text-red-700">
                                    Another writer has already rejected this project. No further actions can be taken.
                                </p>
                            </div>
                        ) : writerAlreadyActed ? (
                            <div className="bg-green-100 p-6 border-2 border-green-400 mb-4">
                                <h3 className="font-black text-green-800 mb-2">Action Already Taken</h3>
                                <p className="text-green-700">
                                    You have already acted on this project.
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col sm:flex-row gap-4">
                                <button
                                    onClick={handleApprove}
                                    disabled={loading}
                                    className="flex-1 px-6 py-4 bg-green-600 text-white font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? 'Processing...' : 'Approve Video'}
                                </button>
                                <button
                                    onClick={() => setShowRejectModal(true)}
                                    disabled={loading}
                                    className="flex-1 px-6 py-4 bg-red-600 text-white font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? 'Processing...' : 'Reject Video'}
                                </button>
                            </div>
                        )}

                        {error && (
                            <div className="mt-4 p-4 bg-red-100 border-2 border-red-400 text-red-800">
                                Error: {error}
                            </div>
                        )}
                    </div>

                    {/* Comments Section */}
                    {comments.length > 0 && (
                        <div className="bg-white p-8 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <div className="flex items-center space-x-2 mb-6">
                                <MessageSquare className="w-6 h-6" />
                                <h3 className="text-xl font-black uppercase text-slate-900">Comments & Feedback</h3>
                            </div>

                            <div className="space-y-6">
                                {comments.map((comment, index) => (
                                    <div key={index} className={`border-l-4 pl-4 py-2 ${comment.action === 'APPROVED' ? 'border-green-500' : 'border-red-500'}`}>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-bold text-slate-900">{comment.actor_name}</p>
                                                <p className="text-sm text-slate-600">{format(new Date(comment.timestamp), 'MMM dd, yyyy h:mm a')}</p>
                                            </div>
                                            <span className={`px-2 py-1 text-xs font-bold uppercase ${comment.action === 'APPROVED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                {comment.action}
                                            </span>
                                        </div>
                                        <p className="mt-2 text-slate-700">{comment.comment}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Info Note */}
                    <div className="p-6 bg-yellow-50 border-2 border-yellow-400">
                        <p className="text-sm font-bold text-yellow-900">
                            <strong className="uppercase">Note:</strong> This video has been completed by the editor/designer. Please review and approve or reject.
                        </p>
                    </div>

                    {/* Reject Modal */}
                    {showRejectModal && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                            <div className="bg-white border-2 border-black rounded shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] max-w-md w-full max-h-[90vh] overflow-y-auto">
                                <div className="p-6">
                                    <h3 className="text-xl font-black uppercase mb-4 text-slate-900">Send Back for Rework</h3>

                                    <div className="mb-4">
                                        <label className="block text-sm font-bold mb-2 text-slate-700">
                                            Select role for rework:
                                        </label>
                                        <select
                                            value={selectedRoleForRework}
                                            onChange={(e) => setSelectedRoleForRework(e.target.value)}
                                            className="w-full p-3 border-2 border-black text-sm focus:bg-yellow-50 focus:outline-none"
                                        >
                                            <option value="">Select a role...</option>
                                            <option value="CINE">Cinematographer</option>
                                            <option value="EDITOR">Editor</option>
                                            <option value="DESIGNER">Designer</option>
                                        </select>
                                    </div>

                                    <div className="mb-4">
                                        <label className="block text-sm font-bold mb-2 text-slate-700">
                                            Reason for rejection (required):
                                        </label>
                                        <textarea
                                            value={reworkComment}
                                            onChange={(e) => setReworkComment(e.target.value)}
                                            placeholder="Enter feedback..."
                                            className="w-full p-3 border-2 border-black text-sm focus:bg-yellow-50 focus:outline-none h-32 resize-none"
                                        />
                                    </div>

                                    <div className="flex justify-end space-x-3 pt-4">
                                        <button
                                            onClick={() => setShowRejectModal(false)}
                                            className="px-4 py-2 border-2 border-black text-black font-bold uppercase hover:bg-slate-100"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (reworkComment.trim() && selectedRoleForRework.trim()) {
                                                    handleReject(reworkComment.trim(), selectedRoleForRework);
                                                    setShowRejectModal(false);
                                                }
                                            }}
                                            disabled={!reworkComment.trim() || !selectedRoleForRework.trim()}
                                            className="px-4 py-2 bg-red-600 text-white font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] disabled:opacity-50"
                                        >
                                            Submit Rework
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {showPopup && (
                <Popup
                    message={popupMessage}
                    stageName={stageName}
                    onClose={() => {
                        setShowPopup(false);
                        onApprove();
                    }}
                    duration={popupDuration}
                />
            )}
        </div>
    );
};

export default WriterVideoApproval;