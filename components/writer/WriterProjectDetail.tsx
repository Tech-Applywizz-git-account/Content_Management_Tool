import React, { useEffect, useState } from 'react';
import { Project, Role, STAGE_LABELS, UserStatus, WorkflowStage, User as PublicUser } from '../../types';
import { ArrowLeft, Clock, User as UserIcon, FileText, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../src/integrations/supabase/client';
import { getWorkflowState, isInfluencerVideo } from '../../services/workflowUtils';
import { stripHtmlTags, decodeHtmlEntities } from '../../utils/htmlDecoder';
import Popup from '../Popup';
import Timeline from '../Timeline';
import ScriptDisplay from '../ScriptDisplay';
import { db } from '../../services/supabaseDb';

interface Props {
    project: Project;
    onBack: () => void;
    showWorkflowStatus?: boolean;
}

const WriterProjectDetail: React.FC<Props> = ({ project, onBack, showWorkflowStatus = true }) => {
    const [publicUser, setPublicUser] = useState<PublicUser | null>(null);
    const [userError, setUserError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    interface WorkflowHistoryEntry {
        action: string;
        comment: string;
        actor_name: string;
        timestamp: string;
        actor_id?: string;
    }

    const [comments, setComments] = useState<WorkflowHistoryEntry[]>([]);
    const [previousScript, setPreviousScript] = useState<string | null>(null);
    const [previousAssets, setPreviousAssets] = useState<{
        video_link?: string | null;
        edited_video_link?: string | null;
        thumbnail_link?: string | null;
        creative_link?: string | null;
    } | null>(null);
    const [rejectionReason, setRejectionReason] = useState<string | null>(null);
    const [returnType, setReturnType] = useState<'rework' | 'reject' | null>(null);
    const [writerAlreadyActed, setWriterAlreadyActed] = useState(false);
    const [videoLink, setVideoLink] = useState('');
    const [caption] = useState(project.data?.captions || '');

    // Popup state
    const [showPopup, setShowPopup] = useState(false);
    const [popupMessage, setPopupMessage] = useState('');
    const [stageName, setStageName] = useState('');
    const [popupDuration, setPopupDuration] = useState(5000); // 5 seconds

    useEffect(() => {
        const fetchData = async () => {
            // Fetch all workflow history events
            const { data: commentsData, error: commentsError } = await supabase
                .from('workflow_history')
                .select(`
                    action,
                    comment,
                    actor_name,
                    actor_id,
                    timestamp,
                    stage,
                    actor_role
                `)
                .eq('project_id', project.id)
                .order('timestamp', { ascending: false });

            if (commentsError) {
                console.error('Error fetching comments:', commentsError);
                setComments([]);
            } else {
                // Deduplicate all events based on unique combinations of action, actor_id, actor_name, comment and timestamp
                const uniqueComments = Array.from(
                    new Map(
                        commentsData.map(item => [
                            `${item.action}-${item.actor_id || ''}-${item.actor_name}-${item.comment || ''}-${item.timestamp}`,
                            item
                        ])
                    ).values()
                ) as WorkflowHistoryEntry[];

                // Show all unique events regardless of status
                setComments(uniqueComments);

                // Get current user session to check if this writer has already acted
                const { data: { session } } = await supabase.auth.getSession();
                const user = session?.user;

                // Check if current writer has already approved or rejected this project
                const currentUserAction = uniqueComments?.find(comment =>
                    comment.actor_id === (publicUser?.id || user?.id) &&
                    (comment.action === 'APPROVED' || comment.action === 'REJECTED')
                );

                setWriterAlreadyActed(!!currentUserAction);
            }

            // Use the new workflow state logic to determine the latest action
            const workflowState = getWorkflowState(project);

            // Determine return type based on the latest action
            // Determine return type based on the latest action and current status
            if (workflowState.isRejected) {
                setReturnType('reject');
            } else if (workflowState.isRework) {
                setReturnType('rework');
            } else {
                setReturnType(null); // Reset if it's no longer in a rework/reject state
            }

            // Fetch the most recent workflow history entry
            const { data: historyData, error: historyError } = await supabase
                .from('workflow_history')
                .select('script_content, video_link, edited_video_link, thumbnail_link, creative_link, action, comment, timestamp, actor_name, metadata')
                .eq('project_id', project.id)
                .order('timestamp', { ascending: false })
                .limit(50);

            if (historyError) {
                console.error('Error fetching workflow history:', historyError);
                return;
            }

            if (historyData && historyData.length > 0) {
                const lastRework = historyData.find(h => ['REWORK', 'REJECTED'].includes(h.action));
                const reworkSubmission = historyData.find(h => h.action.startsWith('REWORK_') && h.metadata);

                if (lastRework || reworkSubmission) {
                    const meta = reworkSubmission?.metadata;

                    const getLastHistoryItem = (historyStrOrArray: any) => {
                        if (!historyStrOrArray) return null;
                        if (Array.isArray(historyStrOrArray)) return historyStrOrArray[historyStrOrArray.length - 1];
                        try {
                            const parsed = typeof historyStrOrArray === 'string' ? JSON.parse(historyStrOrArray) : historyStrOrArray;
                            if (Array.isArray(parsed)) return parsed[parsed.length - 1];
                        } catch (e) { return null; }
                        return null;
                    };

                    setPreviousAssets({
                        video_link: meta?.reworked_by_role === Role.CINE ? meta.before_link : (lastRework?.video_link || getLastHistoryItem(project.cine_video_links_history)),
                        edited_video_link: (meta?.reworked_by_role === Role.EDITOR || meta?.reworked_by_role === Role.SUB_EDITOR) ? meta.before_link : (lastRework?.edited_video_link || getLastHistoryItem(project.editor_video_links_history) || getLastHistoryItem(project.sub_editor_video_links_history)),
                        thumbnail_link: meta?.reworked_by_role === Role.DESIGNER ? meta.before_link : (lastRework?.thumbnail_link || getLastHistoryItem(project.designer_video_links_history)),
                        creative_link: meta?.reworked_by_role === Role.DESIGNER ? meta.before_link : (lastRework?.creative_link || getLastHistoryItem(project.designer_video_links_history))
                    });
                }

                const scriptEntry = historyData.find(h => h.script_content);
                if (scriptEntry) {
                    setPreviousScript(scriptEntry.script_content);
                }

                if (project.rejected_reason) {
                    setRejectionReason(project.rejected_reason);
                }
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
                    } else {
                        console.error('Error fetching public user:', pError);
                        setUserError('User profile not found in database.');
                    }
                }
            } catch (err) {
                console.error('Failed to load user:', err);
            }
        };

        loadUser();
        fetchData();
    }, [project.id, project.status, project.rejected_reason, publicUser?.id]);

    useEffect(() => {
        // No longer updating local caption state from project prop as input is removed
    }, [project.id]);



    const isRejected = getWorkflowState(project).isRejected;

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
                            project.channel === 'INSTAGRAM' ? 'bg-[#D946EF] text-white' :
                                'bg-black text-white'
                        }`}>
                        {project.channel}
                    </span>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto">
                <div className="max-w-5xl mx-auto p-8 space-y-8">

                    {showWorkflowStatus && (
                        <div className="bg-gradient-to-br from-blue-50 to-white p-8 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                            <div className="flex items-start justify-between mb-6">
                                <div>
                                    <h2 className="text-2xl font-black uppercase text-slate-900 mb-2">Current Status</h2>
                                    <p className="text-sm font-bold text-slate-500 uppercase">Submitted {format(new Date(project.created_at), 'MMM dd, yyyy h:mm a')}</p>
                                </div>
                                <div className={`${isRejected ? 'bg-red-600' : 'bg-blue-600'} text-white px-4 py-2 border-2 border-black font-black uppercase text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`}>
                                    {isRejected ? (returnType === 'reject' ? 'Project Rejected' : 'Rework Required') :
                                        (project.status === 'WAITING_APPROVAL' ? 'Waiting Approval' : 'In Review')}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-white p-6 border-2 border-black">
                                    <div className="flex items-center space-x-2 mb-2">
                                        <UserIcon className="w-5 h-5 text-blue-600" />
                                        <span className="text-xs font-bold uppercase text-slate-500">Current Reviewer</span>
                                    </div>
                                    <p className="font-black text-lg uppercase">
                                        {project.assigned_to_role === Role.CMO ?
                                            (project.current_stage === WorkflowStage.FINAL_REVIEW_CMO ? 'Final Review (CMO)' : 'Script Review (CMO)') :
                                            project.assigned_to_role === Role.CEO ?
                                                (project.current_stage === WorkflowStage.FINAL_REVIEW_CEO ? 'Final Review (CEO)' : 'Script Review (CEO)') :
                                                STAGE_LABELS[project.current_stage]}
                                    </p>
                                </div>

                                <div className="bg-white p-6 border-2 border-black">
                                    <div className="flex items-center space-x-2 mb-2">
                                        <Clock className="w-5 h-5 text-blue-600" />
                                        <span className="text-xs font-bold uppercase text-slate-500">Stage</span>
                                    </div>
                                    <p className="font-black text-lg uppercase">{STAGE_LABELS[project.current_stage]}</p>
                                </div>

                                <div className="bg-white p-6 border-2 border-black">
                                    <div className="flex items-center space-x-2 mb-2">
                                        <FileText className="w-5 h-5 text-blue-600" />
                                        <span className="text-xs font-bold uppercase text-slate-500">Status</span>
                                    </div>
                                    <p className="font-black text-lg uppercase">
                                        {isRejected ? (returnType === 'reject' ? 'Project Rejected' : 'Rework Required') :
                                            (getWorkflowState(project).isRework ? 'Rework' : project.status.replace(/_/g, ' '))}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-6">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold uppercase text-slate-500">Workflow Progress</span>
                                    <span className="text-xs font-bold uppercase text-slate-900">
                                        {project.assigned_to_role === Role.CMO ? 'Level 1 Review' :
                                            project.assigned_to_role === Role.CEO ? 'Level 2 Review' : 'Processing'}
                                    </span>
                                </div>
                                <div className="w-full bg-slate-200 h-3 border-2 border-black overflow-hidden">
                                    <div
                                        className="bg-blue-600 h-full transition-all duration-500"
                                        style={{ width: project.assigned_to_role === Role.CEO ? '75%' : '50%' }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {(project.data?.cine_comments || project.data?.cine_to_writer_feedback) && (
                        <div className="bg-blue-50 p-6 border-2 border-blue-400 space-y-4">
                            <div className="flex items-center space-x-2">
                                <MessageSquare className="w-5 h-5 text-blue-600" />
                                <h3 className="text-lg font-black uppercase text-blue-900">Cinematographer Notes</h3>
                            </div>
                            <div className="bg-white p-4 border-2 border-blue-300">
                                <p className="text-blue-800 whitespace-pre-line text-lg font-medium italic">
                                    {project.data?.cine_to_writer_feedback || project.data?.cine_comments}
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="bg-slate-50 p-8 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <h3 className="text-xl font-black uppercase mb-6 text-slate-900">
                            {project.data?.source === 'IDEA_PROJECT' ? 'Idea Description' : 'Script Content'}
                        </h3>

                        {isRejected && previousScript ? (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="flex flex-col">
                                    <h4 className="font-black text-slate-900 uppercase mb-4 text-center">
                                        {project.data?.source === 'IDEA_PROJECT' ? 'Previous Idea' : 'Previous Script'}
                                    </h4>
                                    <ScriptDisplay content={previousScript} caption={project.data?.captions} showBox={true} />
                                </div>

                                <div className="flex flex-col">
                                    <h4 className="font-black text-slate-900 uppercase mb-4 text-center">
                                        {project.data?.source === 'IDEA_PROJECT' ? 'Updated Idea' : 'Updated Script'}
                                    </h4>
                                    <ScriptDisplay
                                        content={project.data?.source === 'IDEA_PROJECT'
                                            ? project.data.idea_description || ''
                                            : project.data?.script_content || ''}
                                        caption={caption}
                                        showBox={true}
                                    />
                                </div>
                            </div>
                        ) : (
                            <ScriptDisplay
                                content={project.data?.source === 'IDEA_PROJECT'
                                    ? project.data.idea_description || ''
                                    : project.data?.script_content || ''}
                                caption={caption}
                            />
                        )}
                    </div>



                    <div className="bg-white p-8 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <h3 className="text-xl font-black uppercase mb-6 text-slate-900">Project Details</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {project.data.brief && (
                                <div>
                                    <span className="text-xs font-bold uppercase text-slate-500 block mb-2">Brief</span>
                                    <p className="text-slate-700 font-medium">{project.data.brief}</p>
                                </div>
                            )}
                            {project.data.keywords && (
                                <div>
                                    <span className="text-xs font-bold uppercase text-slate-500 block mb-2">Keywords</span>
                                    <p className="text-slate-700 font-medium">{project.data.keywords}</p>
                                </div>
                            )}
                            {project.brand && (
                                <div>
                                    <span className="text-xs font-bold uppercase text-slate-500 block mb-2">Brand</span>
                                    <p className="font-black uppercase text-[#0085FF]">
                                        {project.brand.replace(/_/g, ' ')}
                                    </p>
                                </div>
                            )}
                            {project.data.niche && (
                                <div>
                                    <span className="text-xs font-bold uppercase text-slate-500 block mb-2">Niche</span>
                                    <p className="text-slate-700 font-medium uppercase">
                                        {project.data.niche === 'PROBLEM_SOLVING' ? 'Problem Solving'
                                            : project.data.niche === 'SOCIAL_PROOF' ? 'Social Proof'
                                                : project.data.niche === 'LEAD_MAGNET' ? 'Lead Magnet'
                                                    : project.data.niche === 'CAPTION_BASED' ? 'Caption Based'
                                                        : project.data.niche === 'OTHER' && project.data.niche_other
                                                            ? project.data.niche_other
                                                            : project.data.niche}
                                    </p>
                                </div>
                            )}
                            {project.data?.influencer_name && (
                                <div>
                                    <span className="text-xs font-bold uppercase text-slate-500 block mb-2">Influencer Name</span>
                                    <p className="text-slate-700 font-medium">{project.data.influencer_name}</p>
                                </div>
                            )}
                            {project.data?.referral_link && (
                                <div>
                                    <span className="text-xs font-bold uppercase text-slate-500 block mb-2">Referral Link</span>
                                    <a href={project.data.referral_link} target="_blank" rel="noreferrer" className="text-blue-600 font-medium hover:underline">View Link</a>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white p-8 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <Timeline project={{ ...project, history: comments }} />

                        <div className="flex items-start space-x-4 mt-8 pt-6 border-t-2 border-dashed border-slate-300">
                            <div className={`w-3 h-3 border-2 border-black rounded-full mt-2 ${isRejected ? 'bg-red-600' : 'bg-slate-300 animate-pulse'}`}></div>
                            <div className="flex-1 pl-6">
                                <span className="text-xs font-bold uppercase text-slate-500">Current</span>
                                <p className="font-black text-slate-900 uppercase mt-1">
                                    {isRejected ? (returnType === 'reject' ? 'Project Rejected' : 'Rework Required') :
                                        project.assigned_to_role === Role.CMO ? 'With CMO' :
                                            project.assigned_to_role === Role.CEO ? 'With CEO' : 'In Process'}
                                </p>
                                <p className="text-sm text-slate-600 mt-2">
                                    {isRejected ? 'Awaiting resubmission with changes' : 'Awaiting review decision'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {(project.current_stage === 'MULTI_WRITER_APPROVAL' || project.current_stage === 'WRITER_VIDEO_APPROVAL') && (
                        <div className="bg-orange-50 p-6 border-2 border-orange-400 mb-6">
                            <h3 className="text-lg font-black uppercase text-orange-900 mb-4">
                                {project.current_stage === 'MULTI_WRITER_APPROVAL' ? 'Multi-Writer Approval' : 'Video Approval'}
                            </h3>
                            <div className="space-y-4">
                                {project.edited_video_link && (
                                    <div className="bg-white p-4 border-2 border-orange-300">
                                        <div className="flex justify-between items-center mb-2">
                                            <h4 className="font-bold text-orange-800">Edited Video</h4>
                                            {previousAssets?.edited_video_link && (
                                                <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-orange-200 border border-orange-400">Reworked Version</span>
                                            )}
                                        </div>
                                        <a
                                            href={project.edited_video_link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 underline break-all font-medium"
                                        >
                                            {project.edited_video_link}
                                        </a>

                                        {previousAssets?.edited_video_link && (
                                            <div className="mt-4 pt-4 border-t border-dashed border-orange-200">
                                                <div className="flex justify-between items-center mb-2">
                                                    <h4 className="text-xs font-bold text-slate-500 uppercase italic">Previous Version (Before Rework)</h4>
                                                </div>
                                                <a
                                                    href={previousAssets.edited_video_link}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-slate-500 underline break-all text-sm opacity-70"
                                                >
                                                    {previousAssets.edited_video_link}
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {project.thumbnail_link && (
                                    <div className="bg-white p-4 border-2 border-orange-300">
                                        <div className="flex justify-between items-center mb-2">
                                            <h4 className="font-bold text-orange-800">Thumbnail</h4>
                                            {previousAssets?.thumbnail_link && (
                                                <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-orange-200 border border-orange-400">Reworked Version</span>
                                            )}
                                        </div>
                                        <a
                                            href={project.thumbnail_link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 underline break-all font-medium"
                                        >
                                            {project.thumbnail_link}
                                        </a>

                                        {previousAssets?.thumbnail_link && (
                                            <div className="mt-4 pt-4 border-t border-dashed border-orange-200">
                                                <div className="flex justify-between items-center mb-2">
                                                    <h4 className="text-xs font-bold text-slate-500 uppercase italic">Previous Version (Before Rework)</h4>
                                                </div>
                                                <a
                                                    href={previousAssets.thumbnail_link}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-slate-500 underline break-all text-sm opacity-70"
                                                >
                                                    {previousAssets.thumbnail_link}
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Script Information */}
                                {(project.data?.script_content || project.data?.script_reference_link) && (
                                    <div className="bg-white p-4 border-2 border-orange-300">
                                        <div className="flex justify-between items-center mb-2">
                                            <h4 className="font-bold text-orange-800">Script Information</h4>
                                        </div>
                                        {project.data?.script_content && (
                                            <div className="mb-3">
                                                <p className="text-xs font-bold text-slate-600 uppercase mb-1">Script Content:</p>
                                                <p className="text-slate-900 text-sm whitespace-pre-wrap break-words">{project.data.script_content}</p>
                                            </div>
                                        )}
                                        {project.data?.script_reference_link && (
                                            <div>
                                                <p className="text-xs font-bold text-slate-600 uppercase mb-1">Script Reference Link:</p>
                                                <a
                                                    href={project.data.script_reference_link}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-600 underline break-all text-sm"
                                                >
                                                    {project.data.script_reference_link}
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {!writerAlreadyActed ? (
                                    <div className="flex space-x-4 pt-4">
                                        <button
                                            onClick={async () => {
                                                if (!publicUser?.id) {
                                                    alert('User profile not loaded. Please refresh and try again.');
                                                    return;
                                                }
                                                try {
                                                    setIsSubmitting(true);
                                                    await db.advanceWorkflow(project.id, 'Writer approved the final video');
                                                    setPopupMessage('Video approved successfully! The project has been sent to the ops team.');
                                                    setStageName('Ops Scheduling');
                                                    setPopupDuration(5000);
                                                    setShowPopup(true);
                                                    setTimeout(() => onBack(), 5500);
                                                } catch (error) {
                                                    console.error('Failed to approve video:', error);
                                                    setPopupMessage('Failed to approve video. Please try again.');
                                                    setStageName('Error');
                                                    setPopupDuration(5000);
                                                    setShowPopup(true);
                                                } finally {
                                                    setIsSubmitting(false);
                                                }
                                            }}
                                            disabled={isSubmitting}
                                            className="px-6 py-3 bg-green-600 text-white font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] transition-all disabled:opacity-50"
                                        >
                                            {isSubmitting ? 'Approving...' : 'Approve Video'}
                                        </button>
                                        <button
                                            onClick={async () => {
                                                if (!publicUser?.id) {
                                                    alert('User profile not loaded. Please refresh and try again.');
                                                    return;
                                                }
                                                try {
                                                    setIsSubmitting(true);
                                                    await db.rejectTask(project.id, WorkflowStage.VIDEO_EDITING, 'Writer rejected the video - needs rework');
                                                    setPopupMessage('Video rejected. Sent back to editor for rework.');
                                                    setStageName('Video Editing');
                                                    setPopupDuration(5000);
                                                    setShowPopup(true);
                                                    setTimeout(() => onBack(), 5500);
                                                } catch (error) {
                                                    console.error('Failed to reject video:', error);
                                                    setPopupMessage('Failed to reject video. Please try again.');
                                                    setStageName('Error');
                                                    setPopupDuration(5000);
                                                    setShowPopup(true);
                                                } finally {
                                                    setIsSubmitting(false);
                                                }
                                            }}
                                            disabled={isSubmitting}
                                            className="px-6 py-3 bg-red-600 text-white font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] transition-all disabled:opacity-50"
                                        >
                                            {isSubmitting ? 'Rejecting...' : 'Reject Video'}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="pt-4">
                                        <div className="bg-green-100 p-6 border-2 border-green-400 mb-4">
                                            <h3 className="font-black text-green-800 mb-2">Action Already Taken</h3>
                                            <p className="text-green-700">
                                                You have already acted on this project.
                                                No further action is required from you.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {project.current_stage === WorkflowStage.WRITER_REVISION && (
                        <div className="bg-blue-50 p-8 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <h3 className="text-xl font-black uppercase mb-6 text-slate-900 font-bold Greenland-900">Upload {isInfluencerVideo(project) ? 'Influencer' : 'Shoot'} Video</h3>
                            <p className="text-sm font-bold text-slate-500 uppercase mb-4">You have already acted on the script. Please upload the {isInfluencerVideo(project) ? 'influencer' : 'shoot'} video link for the editor to process.</p>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-black text-slate-400 uppercase mb-1 block">{isInfluencerVideo(project) ? 'Influencer' : 'Shoot'} Video Link (Google Drive / S3 / Direct)</label>
                                    <input
                                        type="text"
                                        value={videoLink}
                                        onChange={(e) => setVideoLink(e.target.value)}
                                        placeholder={`Enter the ${isInfluencerVideo(project) ? 'influencer' : 'shoot'} video link here`}
                                        className="w-full p-3 border-2 border-black focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                                    />
                                </div>
                                <button
                                    onClick={async () => {
                                        if (!videoLink.trim()) {
                                            alert('Please provide a video link');
                                            return;
                                        }
                                        try {
                                            setIsSubmitting(true);
                                            // Update project with video link and then advance
                                            await db.projects.update(project.id, { video_link: videoLink });
                                            await db.advanceWorkflow(project.id, `Writer uploaded video: ${videoLink}`);

                                            setPopupMessage(`${isInfluencerVideo(project) ? 'Influencer' : 'Shoot'} video uploaded and project sent for final CMO review!`);
                                            setStageName('Final Review (CMO)');
                                            setPopupDuration(5000);
                                            setShowPopup(true);
                                            setTimeout(() => onBack(), 5500);
                                        } catch (error) {
                                            console.error('Failed to upload video and advance:', error);
                                            setPopupMessage('Failed to upload video. Please try again.');
                                            setStageName('Error');
                                            setShowPopup(true);
                                        } finally {
                                            setIsSubmitting(false);
                                        }
                                    }}
                                    disabled={isSubmitting}
                                    className="px-6 py-3 bg-blue-600 text-white font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] transition-all disabled:opacity-50"
                                >
                                    {isSubmitting ? 'Submitting...' : 'Upload Video & Advance'}
                                </button>
                            </div>
                        </div>
                    )}

                    <div className={`p-6 ${(isRejected || project.status === 'REWORK') ? 'bg-red-50 border-2 border-red-400' : 'bg-yellow-50 border-2 border-yellow-400'}`}>
                        <p className={`text-sm font-bold ${(isRejected || project.status === 'REWORK') ? 'text-red-900' : 'text-yellow-900'}`}>
                            <strong className="uppercase">Note:</strong>
                            {isRejected || project.status === 'REWORK'
                                ? returnType === 'reject'
                                    ? 'This project has been rejected. The rejection reason is displayed above. You can make changes and resubmit for review.'
                                    : project.data?.source === 'IDEA_PROJECT'
                                        ? 'This idea has been sent for rework. The rework comments are displayed above. You can make changes and resubmit for review.'
                                        : 'This project has been sent for rework. The reviewer comments are displayed above. You can make changes and resubmit for review.'
                                : project.current_stage === 'MULTI_WRITER_APPROVAL'
                                    ? 'This content requires approval from multiple writers. Your approval contributes to the multi-writer approval process.'
                                    : project.current_stage === 'WRITER_VIDEO_APPROVAL'
                                        ? 'This video has been completed by the editor/designer. Please review and approve or reject.'
                                        : 'You will be notified once the review is complete. If changes are requested, the project will return to your Drafts/Rework section.'}
                        </p>
                    </div>
                </div>
            </div>

            {showPopup && (
                <Popup
                    message={popupMessage}
                    stageName={stageName}
                    onClose={() => {
                        setShowPopup(false);
                        onBack();
                    }}
                    duration={popupDuration}
                />
            )}
        </div>
    );
};

export default WriterProjectDetail;
