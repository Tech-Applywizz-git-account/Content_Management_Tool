import React, { useEffect, useState } from 'react';
import { Project, Role, STAGE_LABELS, UserStatus, WorkflowStage } from '../../types';
import { ArrowLeft, Clock, User, FileText, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../src/integrations/supabase/client';
import { getWorkflowState, getWorkflowStateForRole } from '../../services/workflowUtils';
import Popup from '../Popup';

interface Props {
    project: Project;
    userRole: Role;
    onBack: () => void;
}

const WriterProjectDetail: React.FC<Props> = ({ project, userRole, onBack }) => {
    const [comments, setComments] = useState<any[]>([]);
    const [previousScript, setPreviousScript] = useState<string | null>(null);
    const [rejectionReason, setRejectionReason] = useState<string | null>(null);
    const [returnType, setReturnType] = useState<'rework' | 'reject' | null>(null);
    const [writerAlreadyActed, setWriterAlreadyActed] = useState(false);

    // Popup state
    const [showPopup, setShowPopup] = useState(false);
    const [popupMessage, setPopupMessage] = useState('');
    const [stageName, setStageName] = useState('');
    const [popupDuration, setPopupDuration] = useState(5000); // 5 seconds

    useEffect(() => {
        const fetchData = async () => {
            // Fetch comments
            const { data: commentsData, error: commentsError } = await supabase
                .from('workflow_history')
                .select(`
                    action,
                    comment,
                    actor_name,
                    timestamp
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

                // Check if current writer has already approved or rejected this project
                const currentUserAction = commentsData?.find(comment =>
                    comment.actor_id === user?.id &&
                    (comment.action === 'APPROVED' || comment.action === 'REJECTED')
                );

                setWriterAlreadyActed(!!currentUserAction);
            }

            // Use the new workflow state logic to determine the latest action
            const workflowState = getWorkflowState(project);

            // Determine return type based on the latest action
            if (workflowState.isRejected) {
                setReturnType('reject');
            } else if (workflowState.isRework) {
                setReturnType('rework');
            }

            // Fetch the most recent workflow history entry to get script content
            const { data: historyData, error: historyError } = await supabase
                .from('workflow_history')
                .select('script_content, action, comment, timestamp, actor_name, to_role')
                .eq('project_id', project.id)
                .order('timestamp', { ascending: false })
                .limit(1);

            if (historyError) {
                console.error('Error fetching workflow history:', historyError);
            } else if (historyData && historyData.length > 0) {
                // Fetch previous script version based on the latest action
                let scriptAction = workflowState.isRework ? 'REWORK' : 'REJECTED';
                const { data: scriptData, error: scriptError } = await supabase
                    .from('workflow_history')
                    .select('script_content, comment, actor_name, to_role')
                    .eq('project_id', project.id)
                    .eq('action', scriptAction)
                    .order('timestamp', { ascending: false })
                    .limit(1);

                if (scriptError) {
                    // Handle case where script_content column doesn't exist yet
                    if (scriptError.code === '42703') {
                        console.warn(`script_content column not found in workflow_history table. This is expected if the migration hasn't been applied yet.`);
                    } else {
                        console.error('Error fetching previous script:', scriptError);
                    }
                } else if (scriptData && scriptData.length > 0) {
                    // Check if the rework/reject action is targeted to the current user's role
                    const reworkEntry = scriptData[0];
                    if (reworkEntry.to_role === userRole) {
                        // Only set previous script and rejection reason if it's targeted to current user
                        if (reworkEntry.script_content) {
                            setPreviousScript(reworkEntry.script_content);
                        }
                        // Use the comment from workflow history instead of project.rejected_reason
                        if (reworkEntry.comment) {
                            setRejectionReason(reworkEntry.comment);
                        }
                    }
                } else {
                    // Fallback to the script content from the latest history entry
                    if (historyData && historyData.length > 0 && historyData[0].script_content) {
                        setPreviousScript(historyData[0].script_content);
                    }
                }
            }
        };

        fetchData();
    }, [project.id, project.status]);

    // Use the new workflow state logic with role context
    const workflowState = getWorkflowStateForRole(project, userRole);
    const isRework = workflowState.isRework;
    const isTargetedRework = workflowState.isTargetedRework;
    const isRejected = workflowState.isRejected;
    const rejectionComment = comments.find(comment => comment.action === 'REJECTED' || comment.action === 'REWORK');

    return (
        <div className="min-h-screen bg-white font-sans flex flex-col animate-fade-in">
            <header className="h-20 border-b-2 border-black flex items-center justify-between px-6 sticky top-0 bg-white z-20 shadow-[0px_4px_0px_0px_rgba(0,0,0,0.05)]">
                <div className="flex items-center space-x-6">
                    <button
                        onClick={onBack}
                        className="p-3 border-2 border-transparent hover:border-black hover:bg-slate-100 rounded-full transition-all"
                    >
                        <ArrowLeft className="w-6 h-6 text-black" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                            {project.data?.source === 'IDEA_PROJECT' ? 'Idea Details: ' : 'Project Details: '}
                            {project.title}
                        </h1>
                        
                        <div className="flex items-center space-x-2 mt-2">
                            {project.data?.source === 'IDEA_PROJECT' && (
                                <span className="px-2 py-0.5 text-xs font-black uppercase border-2 border-black bg-purple-100 text-purple-900">
                                    {project.data?.script_content ? 'IDEA-TO-SCRIPT' : 'IDEA'}
                                </span>
                            )}
                            <span className={`px-2 py-0.5 text-xs font-black uppercase border-2 border-black text-white ${project.channel === 'YOUTUBE' ? 'bg-[#FF4F4F]' :
                                project.channel === 'LINKEDIN' ? 'bg-[#0085FF]' :
                                    'bg-[#D946EF]'
                                }`}>
                                {project.channel}
                            </span>
                            <span className="text-xs font-bold uppercase text-slate-500">
                                Stage: {STAGE_LABELS[project.current_stage]}
                            </span>
                            <span
                                className={`px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black ${project.priority === 'HIGH'
                                    ? 'bg-red-500 text-white'
                                    : project.priority === 'NORMAL'
                                        ? 'bg-yellow-500 text-black'
                                        : 'bg-green-500 text-white'
                                    }`}>
                                {project.priority}
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex-1 flex flex-col md:flex-row max-w-[1920px] mx-auto w-full">
                {/* LEFT COLUMN: Content (70%) */}
                <div className="flex-1 p-6 md:p-12 space-y-10 overflow-y-auto bg-slate-50">

                    {/* Info Block */}
                    <div className="bg-white border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-1">Priority</label>
                            <div className={`font-bold uppercase ${project.priority === 'HIGH' ? 'text-red-600' : 'text-slate-900'}`}>
                                {project.priority}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-1">Status</label>
                            <div className="font-bold text-slate-900 uppercase">
                                {project.status}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-1">Type</label>
                            <div className="font-bold text-slate-900 uppercase">
                                {project.data?.source === 'IDEA_PROJECT' ? 'Idea' : 'Script'}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-1">Assigned To</label>
                            <div className="font-bold text-slate-900 uppercase">
                                {project.assigned_to_role}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-1">Content Type</label>
                            <div className="font-bold text-slate-900 uppercase">
                                {project.content_type}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-1">Created</label>
                            <div className="font-bold text-slate-900 uppercase">
                                {format(new Date(project.created_at), 'MMM dd, yyyy')}
                            </div>
                        </div>
                    </div>

                    {/* Brief Content */}
                    {project.data?.brief && (
                        <section className="space-y-4">
                            <h3 className="text-2xl font-black text-slate-900 uppercase">Brief / Notes</h3>
                            <div className="border-2 border-black bg-white p-8 min-h-[100px] whitespace-pre-wrap text-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                {project.data.brief}
                            </div>
                        </section>
                    )}

                    {/* Content */}
                    <div className="space-y-4">
                        <h3 className="text-2xl font-black text-slate-900 uppercase">
                            {project.data?.source === 'IDEA_PROJECT' ? 'Idea Description' : 'Script Content'}
                        </h3>

                        {isRejected && previousScript ? (
                            // Show both old and new content side by side for rework projects
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Previous Content */}
                                <div className="bg-white border-2 border-slate-300 p-6">
                                    <h4 className="font-black text-slate-900 uppercase mb-4 text-center">
                                        {project.data?.source === 'IDEA_PROJECT' ? 'Previous Idea' : 'Previous Script'}
                                    </h4>
                                    <div className="font-serif text-lg leading-relaxed text-slate-800 whitespace-pre-wrap bg-slate-50 p-4 border-2 border-slate-200 max-h-96 overflow-y-auto">
                                        {(() => {
                                            const decodeHtmlEntities = (html) => {
                                                const txt = document.createElement('textarea');
                                                txt.innerHTML = html;
                                                return txt.value;
                                            };
                                            const decodedContent = decodeHtmlEntities(previousScript);
                                            return <div dangerouslySetInnerHTML={{ __html: decodedContent }} />;
                                        })()}
                                    </div>
                                </div>

                                {/* Current Content */}
                                <div className="bg-white border-2 border-black p-6">
                                    <h4 className="font-black text-slate-900 uppercase mb-4 text-center">
                                        {project.data?.source === 'IDEA_PROJECT' ? 'Updated Idea' : 'Updated Script'}
                                    </h4>
                                    <div className="font-serif text-lg leading-relaxed text-slate-800 whitespace-pre-wrap bg-white p-4 border-2 border-black max-h-96 overflow-y-auto">
                                        {project.data?.source === 'IDEA_PROJECT'
                                            ? project.data.idea_description ? (() => {
                                                const decodeHtmlEntities = (html) => {
                                                    const txt = document.createElement('textarea');
                                                    txt.innerHTML = html;
                                                    return txt.value;
                                                };
                                                let decodedContent = decodeHtmlEntities(project.data.idea_description);
                                                return <div dangerouslySetInnerHTML={{ __html: decodedContent }} />;
                                              })() : 'No idea description available'
                                            : project.data.script_content ? (() => {
                                                const decodeHtmlEntities = (html) => {
                                                    const txt = document.createElement('textarea');
                                                    txt.innerHTML = html;
                                                    return txt.value;
                                                };
                                                let decodedContent = decodeHtmlEntities(project.data.script_content);
                                                return <div dangerouslySetInnerHTML={{ __html: decodedContent }} />;
                                              })() : 'No content available'}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            // Show single content for non-rework projects
                            <div className="prose prose-slate max-w-none">
                                <div className="font-serif text-lg leading-relaxed text-slate-800 whitespace-pre-wrap bg-white p-8 min-h-[300px] border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                    {project.data?.source === 'IDEA_PROJECT'
                                        ? project.data.idea_description ? (() => {
                                            const decodeHtmlEntities = (html) => {
                                                const txt = document.createElement('textarea');
                                                txt.innerHTML = html;
                                                return txt.value;
                                            };
                                            let decodedContent = decodeHtmlEntities(project.data.idea_description);
                                            return <div dangerouslySetInnerHTML={{ __html: decodedContent }} />;
                                          })() : 'No idea description available'
                                        : project.data.script_content ? (() => {
                                            const decodeHtmlEntities = (html) => {
                                                const txt = document.createElement('textarea');
                                                txt.innerHTML = html;
                                                return txt.value;
                                            };
                                            let decodedContent = decodeHtmlEntities(project.data.script_content);
                                            return <div dangerouslySetInnerHTML={{ __html: decodedContent }} />;
                                          })() : 'No content available'}
                                </div>
                            </div>
                        )}
                    </div>
                    {/* Content */}
                    <div className="bg-slate-50 p-8 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <h3 className="text-xl font-black uppercase mb-6 text-slate-900">
                            {project.data?.source === 'IDEA_PROJECT' ? 'Idea Description' : 'Script Content'}
                        </h3>

                        {isRejected && previousScript ? (
                            // Show both old and new content side by side for rework projects
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Previous Content */}
                                <div className="bg-white border-2 border-slate-300 p-6">
                                    <h4 className="font-black text-slate-900 uppercase mb-4 text-center">
                                        {project.data?.source === 'IDEA_PROJECT' ? 'Previous Idea' : 'Previous Script'}
                                    </h4>
                                    <div className="font-serif text-lg leading-relaxed text-slate-800 whitespace-pre-wrap bg-slate-50 p-4 border-2 border-slate-200 max-h-96 overflow-y-auto">
                                        {(() => {
                                            const decodeHtmlEntities = (html) => {
                                                const txt = document.createElement('textarea');
                                                txt.innerHTML = html;
                                                return txt.value;
                                            };
                                            const decodedContent = decodeHtmlEntities(previousScript);
                                            return <div dangerouslySetInnerHTML={{ __html: decodedContent }} />;
                                        })()}
                                    </div>
                                </div>

                                {/* Current Content */}
                                <div className="bg-white border-2 border-slate-300 p-6">
                                    <h4 className="font-black text-slate-900 uppercase mb-4 text-center">
                                        {project.data?.source === 'IDEA_PROJECT' ? 'Updated Idea' : 'Updated Script'}
                                    </h4>
                                    <div className="font-serif text-lg leading-relaxed text-slate-800 whitespace-pre-wrap bg-slate-50 p-4 border-2 border-slate-200 max-h-96 overflow-y-auto">
                                        {project.data?.source === 'IDEA_PROJECT'
                                            ? project.data.idea_description ? (() => {
                                                const decodeHtmlEntities = (html) => {
                                                    const txt = document.createElement('textarea');
                                                    txt.innerHTML = html;
                                                    return txt.value;
                                                };
                                                let decodedContent = decodeHtmlEntities(project.data.idea_description);
                                                return <div dangerouslySetInnerHTML={{ __html: decodedContent }} />;
                                              })() : 'No idea description available'
                                            : project.data.script_content ? (() => {
                                                const decodeHtmlEntities = (html) => {
                                                    const txt = document.createElement('textarea');
                                                    txt.innerHTML = html;
                                                    return txt.value;
                                                };
                                                let decodedContent = decodeHtmlEntities(project.data.script_content);
                                                return <div dangerouslySetInnerHTML={{ __html: decodedContent }} />;
                                              })() : 'No content available'}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            // Show single content for non-rework projects
                            <div className="prose prose-slate max-w-none">
                                <div className="font-serif text-lg leading-relaxed text-slate-800 whitespace-pre-wrap bg-white p-6 border-2 border-slate-200">
                                    {project.data?.source === 'IDEA_PROJECT'
                                        ? project.data.idea_description ? (() => {
                                            const decodeHtmlEntities = (html) => {
                                                const txt = document.createElement('textarea');
                                                txt.innerHTML = html;
                                                return txt.value;
                                            };
                                            let decodedContent = decodeHtmlEntities(project.data.idea_description);
                                            return <div dangerouslySetInnerHTML={{ __html: decodedContent }} />;
                                          })() : 'No idea description available'
                                        : project.data.script_content ? (() => {
                                            const decodeHtmlEntities = (html) => {
                                                const txt = document.createElement('textarea');
                                                txt.innerHTML = html;
                                                return txt.value;
                                            };
                                            let decodedContent = decodeHtmlEntities(project.data.script_content);
                                            return <div dangerouslySetInnerHTML={{ __html: decodedContent }} />;
                                          })() : 'No content available'}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Cinematographer Notes for Writer */}
                    {(project.data?.cine_notes_for_writer || project.data?.cine_comments) && (
                        <div className="bg-blue-50 p-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <div className="flex items-center space-x-2 mb-4">
                                <MessageSquare className="w-5 h-5 text-blue-600" />
                                <h3 className="text-xl font-black uppercase text-blue-900">Notes from Cinematographer</h3>
                            </div>
                            <div className="bg-white p-4 border-2 border-blue-300">
                                <p className="text-slate-800 whitespace-pre-wrap font-medium">{project.data.cine_notes_for_writer || project.data.cine_comments}</p>
                            </div>
                        </div>
                    )}

                    {/* Cinematographer Instructions */}
                    {(project.data?.actor_details || project.data?.location_details || project.data?.lighting_details || project.data?.camera_angles) && (
                        <div className="bg-green-50 p-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <div className="flex items-center space-x-2 mb-4">
                                <FileText className="w-5 h-5 text-green-600" />
                                <h3 className="text-xl font-black uppercase text-green-900">Cinematographer Instructions</h3>
                            </div>
                            <div className="bg-white p-4 border-2 border-green-300 space-y-4">
                                {project.data?.actor_details && (
                                    <div>
                                        <p className="text-xs font-bold text-green-700 uppercase mb-1">Actor Details</p>
                                        <p className="text-slate-800 whitespace-pre-wrap font-medium">{project.data.actor_details}</p>
                                    </div>
                                )}
                                {project.data?.location_details && (
                                    <div>
                                        <p className="text-xs font-bold text-green-700 uppercase mb-1">Location Details</p>
                                        <p className="text-slate-800 whitespace-pre-wrap font-medium">{project.data.location_details}</p>
                                    </div>
                                )}
                                {project.data?.lighting_details && (
                                    <div>
                                        <p className="text-xs font-bold text-green-700 uppercase mb-1">Lighting Details</p>
                                        <p className="text-slate-800 whitespace-pre-wrap font-medium">{project.data.lighting_details}</p>
                                    </div>
                                )}
                                {project.data?.camera_angles && (
                                    <div>
                                        <p className="text-xs font-bold text-green-700 uppercase mb-1">Camera Angles</p>
                                        <p className="text-slate-800 whitespace-pre-wrap font-medium">{project.data.camera_angles}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Comments Section */}
                    {(comments.length > 0 || isRejected || rejectionReason) && (
                        <div className="bg-white p-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <div className="flex items-center space-x-2 mb-4">
                                <MessageSquare className="w-5 h-5" />
                                <h3 className="text-xl font-black uppercase text-slate-900">
                                    {isRejected || project.status === 'REWORK' ? 'Rework Comments' : project.data?.source === 'IDEA_PROJECT' ? 'Reviewer Comments' : 'Reviewer Comments'}
                                </h3>
                            </div>

                            {/* Show rejection reason prominently for rework projects */}
                            {(isRejected || project.status === 'REWORK') && rejectionReason && (
                                <div className="mb-6 p-4 bg-red-50 border-2 border-red-500 shadow-sm">
                                    <h4 className="font-black text-red-800 mb-2 text-lg uppercase">
                                        {project.data?.source === 'IDEA_PROJECT' ? 'Idea Rework Comments' : 'Rework Comments'}
                                    </h4>
                                    <p className="text-red-700 whitespace-pre-wrap text-base font-medium">
                                        {rejectionReason}
                                    </p>
                                    <p className="text-sm text-red-600 mt-2 font-bold">
                                        {project.data?.source === 'IDEA_PROJECT'
                                            ? `Rework requested by: ${rejectionComment?.actor_name || 'Reviewer'}`
                                            : `Rework requested by: ${rejectionComment?.actor_name || 'Reviewer'}`}
                                        {rejectionComment?.timestamp && ` at ${format(new Date(rejectionComment.timestamp), 'MMM dd, yyyy h:mm a')}`}
                                    </p>
                                </div>
                            )}

                            {comments.length > 0 && (
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
                            )}
                        </div>
                    )}

                    {/* Comments Section */}
                    {(comments.length > 0 || isRejected || rejectionReason) && (
                        <div className="bg-white p-8 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <div className="flex items-center space-x-2 mb-6">
                                <MessageSquare className="w-6 h-6" />
                                <h3 className="text-xl font-black uppercase text-slate-900">
                                    {isRejected || project.status === 'REWORK' ? 'Rework Comments' : project.data?.source === 'IDEA_PROJECT' ? 'Reviewer Comments' : 'Reviewer Comments'}
                                </h3>
                            </div>

                            {/* Show rejection reason prominently for rework projects */}
                            {(isRejected || project.status === 'REWORK') && rejectionReason && (
                                <div className="mb-6 p-4 bg-red-50 border-2 border-red-500 shadow-sm">
                                    <h4 className="font-black text-red-800 mb-2 text-lg uppercase">
                                        {project.data?.source === 'IDEA_PROJECT' ? 'Idea Rework Comments' : 'Rework Comments'}
                                    </h4>
                                    <p className="text-red-700 whitespace-pre-wrap text-base font-medium">
                                        {rejectionReason}
                                    </p>
                                    <p className="text-sm text-red-600 mt-2 font-bold">
                                        {project.data?.source === 'IDEA_PROJECT'
                                            ? `Rework requested by: ${rejectionComment?.actor_name || 'Reviewer'}`
                                            : `Rework requested by: ${rejectionComment?.actor_name || 'Reviewer'}`}
                                        {rejectionComment?.timestamp && ` at ${format(new Date(rejectionComment.timestamp), 'MMM dd, yyyy h:mm a')}`}
                                    </p>
                                </div>
                            )}

                            {comments.length > 0 && (
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
                            )}
                        </div>
                    )}



                    {/* Multi-Writer Approval Section - Show if project is in multi-writer approval stage */}
                    {(project.current_stage === 'MULTI_WRITER_APPROVAL' || project.current_stage === 'WRITER_VIDEO_APPROVAL') && (
                        <div className="bg-orange-50 p-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <h3 className="text-lg font-black uppercase text-orange-900 mb-4">
                                {project.current_stage === 'MULTI_WRITER_APPROVAL' ? 'Multi-Writer Approval' : 'Video Approval'}
                            </h3>
                            <div className="space-y-4">
                                {project.edited_video_link && (
                                    <div className="bg-white p-4 border-2 border-orange-300">
                                        <h4 className="font-bold text-orange-800 mb-2">Edited Video</h4>
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
                                {project.thumbnail_link && (
                                    <div className="bg-white p-4 border-2 border-orange-300">
                                        <h4 className="font-bold text-orange-800 mb-2">Thumbnail</h4>
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
                                {!writerAlreadyActed ? (
                                    <div className="flex space-x-4 pt-4">
                                        <button
                                            onClick={async () => {
                                                try {
                                                    // Get user session
                                                    const { data: { session } } = await supabase.auth.getSession();
                                                    const user = session?.user;

                                                    if (!user) {
                                                        alert('User not authenticated');
                                                        return;
                                                    }

                                                    // Use the centralized db service to approve the project
                                                    const { db } = await import('../../services/supabaseDb');
                                                    // Set the current user in the db service with proper User interface
                                                    db.setCurrentUser({
                                                        id: user.id,
                                                        email: user.email || '',
                                                        full_name: user.user_metadata?.full_name || user.email || 'Unknown User',
                                                        role: Role.WRITER,
                                                        status: UserStatus.ACTIVE
                                                    });

                                                    // Call the workflow approve function instead of advanceWorkflow
                                                    await db.workflow.approve(
                                                        project.id,
                                                        user.id,
                                                        user.user_metadata?.full_name || user.email || 'Unknown User',
                                                        Role.WRITER,
                                                        WorkflowStage.MULTI_WRITER_APPROVAL, // ignored internally
                                                        Role.WRITER,
                                                        'Writer approved the final video'
                                                    );

                                                    // Show success popup
                                                    setPopupMessage('Video approved successfully! The project has been sent to the ops team.');
                                                    setStageName('Ops Scheduling');
                                                    setPopupDuration(5000);
                                                    setShowPopup(true);

                                                    // Navigate back after popup duration + small buffer
                                                    setTimeout(() => {
                                                        onBack(); // Navigate back to previous page
                                                    }, 5500); // 5 seconds popup + 500ms buffer
                                                } catch (error) {
                                                    console.error('Failed to approve video:', error);
                                                    // Show error popup
                                                    setPopupMessage('Failed to approve video. Please try again.');
                                                    setStageName('Error');
                                                    setPopupDuration(5000);
                                                    setShowPopup(true);
                                                }
                                            }}
                                            className="px-6 py-3 bg-green-600 text-white font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] transition-all"
                                        >
                                            Approve Video
                                        </button>
                                        <button
                                            onClick={async () => {
                                                try {
                                                    // Get user session
                                                    const { data: { session } } = await supabase.auth.getSession();
                                                    const user = session?.user;

                                                    if (!user) {
                                                        alert('User not authenticated');
                                                        return;
                                                    }

                                                    // Prompt for rework comments
                                                    const reworkComment = prompt('Enter rework comments for the editor:', 'Please rework the video');
                                                    if (reworkComment === null) return; // User cancelled

                                                    // Use the centralized db service to reject the project
                                                    const { db } = await import('../../services/supabaseDb');
                                                    // Set the current user in the db service with proper User interface
                                                    db.setCurrentUser({
                                                        id: user.id,
                                                        email: user.email || '',
                                                        full_name: user.user_metadata?.full_name || user.email || 'Unknown User',
                                                        role: Role.WRITER,
                                                        status: UserStatus.ACTIVE
                                                    });

                                                    // Call the workflow reject function to send project back to editor with comments
                                                    await db.rejectTask(project.id, WorkflowStage.VIDEO_EDITING, reworkComment);

                                                    // Show rejection popup
                                                    setPopupMessage('Video rejected. Sent back to editor for rework.');
                                                    setStageName('Video Editing');
                                                    setPopupDuration(5000);
                                                    setShowPopup(true);

                                                    // Navigate back after popup duration + small buffer
                                                    setTimeout(() => {
                                                        onBack(); // Navigate back to previous page
                                                    }, 5500); // 5 seconds popup + 500ms buffer
                                                } catch (error) {
                                                    console.error('Failed to reject video:', error);
                                                    // Show error popup
                                                    setPopupMessage('Failed to reject video. Please try again.');
                                                    setStageName('Error');
                                                    setPopupDuration(5000);
                                                    setShowPopup(true);
                                                }
                                            }}
                                            className="px-6 py-3 bg-red-600 text-white font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] transition-all"
                                        >
                                            Reject Video
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

                    {/* Info Note */}
                    <div className={`p-6 ${(isRejected || project.status === 'REWORK') ? 'bg-red-50 border-2 border-black' : 'bg-yellow-50 border-2 border-black'} shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`}>
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

                {/* RIGHT COLUMN: Project Status Panel (30%) - Information only */}
                <div className="w-full md:w-[450px] bg-white border-l-2 border-black p-8 shadow-[-10px_0px_20px_rgba(0,0,0,0.05)] sticky bottom-0 md:top-20 md:h-[calc(100vh-80px)] overflow-y-auto z-10">
                    <h2 className="text-2xl font-black text-slate-900 uppercase mb-8 border-b-4 border-black pb-2 inline-block">Project Status</h2>

                    <div className="space-y-6">
                        <div className="p-6 border-2 border-black bg-white">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-black text-lg uppercase text-slate-900">Current Stage</div>
                                    <div className="text-xs font-bold uppercase text-slate-600">
                                        {STAGE_LABELS[project.current_stage]}
                                    </div>
                                </div>
                            </div>
                            <div className="mt-2 text-xs font-bold text-slate-500 uppercase">
                                Stage set: {format(new Date(project.created_at), 'MMM dd, yyyy h:mm a')}
                            </div>
                        </div>

                        <div className="p-6 border-2 border-black bg-white">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-black text-lg uppercase text-slate-900">Assigned To</div>
                                    <div className="text-xs font-bold uppercase text-slate-600">
                                        {project.assigned_to_role}
                                    </div>
                                </div>
                            </div>
                            <div className="mt-2 text-xs font-bold text-slate-500 uppercase">
                                Role assigned: {format(new Date(project.created_at), 'MMM dd, yyyy h:mm a')}
                            </div>
                        </div>

                        <div className="p-6 border-2 border-black bg-white">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-black text-lg uppercase text-slate-900">Status</div>
                                    <div className="text-xs font-bold uppercase text-slate-600">
                                        {project.status}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-2 border-black bg-white">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-black text-lg uppercase text-slate-900">Created</div>
                                    <div className="text-xs font-bold uppercase text-slate-600">
                                        {format(new Date(project.created_at), 'MMM dd, yyyy h:mm a')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Popup */}
            {showPopup && (
                <Popup
                    message={popupMessage}
                    stageName={stageName}
                    onClose={() => {
                        setShowPopup(false);
                        // Navigate back when popup is manually closed
                        onBack();
                    }}
                    duration={popupDuration}
                />
            )}
        </div>
    );
};

export default WriterProjectDetail;
