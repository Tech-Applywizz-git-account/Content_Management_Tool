import React, { useEffect, useState } from 'react';
import { Project, Role, TaskStatus, WorkflowStage } from '../../types';
import { Clock, FileText, CheckCircle, Edit3, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../src/integrations/supabase/client';
import { db } from '../../services/supabaseDb';

interface Props {
    project: Project;
    onBack: () => void;
}

const CmoProjectDetails: React.FC<Props> = ({ project, onBack }) => {
    const [reviewComments, setReviewComments] = useState<any[]>([]);

    useEffect(() => {
        const fetchComments = async () => {
            // Fetch all workflow history for CMO (Broad visibility)
            const { data: historyData, error: historyError } = await supabase
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
                .order('timestamp', { ascending: false });

            if (historyError) {
                console.error('Error fetching comments:', historyError);
                return;
            }

            // Robust Deduplication Logic
            // 1. Filter out exact duplicates based on action, actor, comment, and time (down to minute)
            // This handles cases where multiple events are fired within the same minute or due to race conditions

            const uniqueCommentsMap = new Map();

            historyData.forEach(item => {
                // Create a key that ignores seconds/milliseconds to group near-simultaneous events
                // ISO String: YYYY-MM-DDTHH:mm:ss.sssZ -> substring(0, 16) gets YYYY-MM-DDTHH:mm
                const timeKey = item.timestamp ? new Date(item.timestamp).toISOString().substring(0, 16) : 'unknown';
                const key = `${item.action}-${item.actor_id || item.actor_name}-${item.comment || ''}-${timeKey}`;

                if (!uniqueCommentsMap.has(key)) {
                    uniqueCommentsMap.set(key, item);
                }
            });

            const uniqueComments = Array.from(uniqueCommentsMap.values());

            setReviewComments(uniqueComments || []);
        };

        fetchComments();
    }, [project.id]);

    return (
        <div className="space-y-6 animate-fade-in p-8 bg-slate-50 min-h-screen">
            {/* Back button */}
            <button
                onClick={onBack}
                className="flex items-center text-sm font-black text-slate-700 hover:text-slate-900 py-2 px-4 bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
            >
                ← Back to Overview
            </button>

            <div className="space-y-6 max-w-5xl mx-auto">
                {/* Basic Info Section */}
                <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <h2 className="text-2xl font-black uppercase mb-4">Project Details</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Title</h3>
                            <p className="font-medium bg-slate-50 p-2">{project.title}</p>
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Channel</h3>
                            <p className="font-medium bg-slate-50 p-2">{project.channel}</p>
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Writer</h3>
                            <p className="font-medium bg-slate-50 p-2">
                                {project.writer_name || '—'}
                            </p>
                        </div>
                        {project.data?.source !== 'IDEA_PROJECT' && (
                            <div>
                                <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Editor</h3>
                                <p className="font-medium bg-slate-50 p-2">
                                    {project.editor_name || project.sub_editor_name || project.data?.editor_name || project.data?.sub_editor_name || '—'}
                                </p>
                            </div>
                        )}
                        <div>
                            <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Status</h3>
                            <p className="font-medium bg-slate-50 p-2">{project.status}</p>
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Current Stage</h3>
                            <p className="font-medium bg-slate-50 p-2">{project.current_stage ? project.current_stage.replace(/_/g, ' ') : 'N/A'}</p>
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Priority</h3>
                            <span className={`inline-block px-2 py-1 text-xs font-black uppercase border-2 border-black ${project.priority === 'HIGH'
                                ? 'bg-red-500 text-white'
                                : project.priority === 'NORMAL'
                                    ? 'bg-yellow-500 text-black'
                                    : 'bg-green-500 text-white'
                                }`}>
                                {project.priority}
                            </span>
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Assigned To</h3>
                            <p className="font-medium bg-slate-50 p-2">{project.assigned_to_role || 'Unassigned'}</p>
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Created At</h3>
                            <p className="font-medium bg-slate-50 p-2">{new Date(project.created_at).toLocaleString()}</p>
                        </div>
                    </div>
                </div>

                {/* Script Content Section */}
                {(project.data?.script_content || project.data?.idea_description) && (
                    <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <h3 className="text-lg font-black uppercase mb-4">
                            {project.data?.source === 'IDEA_PROJECT' ? 'Idea Description' : 'Script Content'}
                        </h3>
                        <div className="max-h-96 overflow-y-auto border-2 border-gray-200 p-6 bg-gray-50">
                            {project.data?.script_content || project.data?.idea_description ? (
                                <div
                                    className="whitespace-pre-wrap font-sans text-base leading-relaxed"
                                    dangerouslySetInnerHTML={{
                                        __html: (() => {
                                            let content = project.data?.script_content || project.data?.idea_description || 'No content available';
                                            if (content !== 'No content available') {
                                                // Decode HTML entities to properly display the content
                                                content = content
                                                    .replace(/&lt;/g, '<')
                                                    .replace(/&gt;/g, '>')
                                                    .replace(/&amp;/g, '&')
                                                    .replace(/&quot;/g, '"')
                                                    .replace(/&#39;/g, "'")
                                                    .replace(/&nbsp;/g, ' ');
                                            }
                                            return content;
                                        })()
                                    }}
                                />
                            ) : (
                                <pre className="whitespace-pre-wrap font-sans text-sm">
                                    No content available
                                </pre>
                            )}

                            {/* Show cinematographer comments if available */}
                            {project.data?.cine_comments && (
                                <div className="mt-4 pt-4 border-t border-slate-200">
                                    <p className="text-xs font-bold text-blue-700 uppercase mb-1">Cinematographer Note:</p>
                                    <p className="text-sm text-slate-600 whitespace-pre-wrap bg-blue-50 p-3 rounded">{project.data.cine_comments}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Workflow Status Section */}
                <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <h3 className="text-lg font-black uppercase mb-4">Workflow Status</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <h4 className="text-sm font-bold text-slate-500 uppercase mb-1">Current Stage</h4>
                            <p className="font-medium bg-slate-50 p-2">{project.current_stage ? project.current_stage.replace(/_/g, ' ') : 'N/A'}</p>
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-slate-500 uppercase mb-1">Status</h4>
                            <span className={`inline-block px-2 py-1 text-xs font-black uppercase border-2 border-black ${project.status === 'DONE'
                                ? 'bg-green-500 text-white'
                                : project.status === 'WAITING_APPROVAL'
                                    ? 'bg-yellow-500 text-black'
                                    : 'bg-blue-500 text-white'
                                }`}>
                                {project.status}
                            </span>
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-slate-500 uppercase mb-1">Rework Indicator</h4>
                            <p className="font-medium bg-slate-50 p-2">
                                {project.history?.some(h => h.action === 'REJECTED' || h.action.startsWith('REWORK')) ? 'Yes' : 'No'}
                            </p>
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-slate-500 uppercase mb-1">Project Type</h4>
                            <span className="inline-block px-2 py-1 text-xs font-black uppercase border-2 border-black bg-purple-100 text-purple-900">
                                {project.data?.source === 'IDEA_PROJECT' ? (project.data?.script_content ? 'IDEA-TO-SCRIPT' : 'IDEA') : 'SCRIPT'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Comments and Feedback Section */}
                <div className="border-2 border-black p-6 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <h3 className="text-xl font-black uppercase mb-6 border-b-2 border-black pb-3 text-slate-900">
                        Project Comments & Feedback
                    </h3>

                    {/* Display current project dates if they exist */}
                    {(project?.shoot_date || project?.delivery_date || project?.post_scheduled_date) && (
                        <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {project?.shoot_date && (
                                    <div className="flex items-center">
                                        <span className="mr-2 font-bold text-slate-700">📅 Shoot Date:</span>
                                        <span className="font-bold text-green-600">{format(new Date(project.shoot_date), 'dd-MM-yyyy')}</span>
                                    </div>
                                )}
                                {project?.delivery_date && (
                                    <div className="flex items-center">
                                        <span className="mr-2 font-bold text-slate-700">📦 Delivery Date:</span>
                                        <span className="font-bold text-blue-600">{format(new Date(project.delivery_date), 'dd-MM-yyyy')}</span>
                                    </div>
                                )}
                                {project?.post_scheduled_date && (
                                    <div className="flex items-center">
                                        <span className="mr-2 font-bold text-slate-700">🗓️ Post Date:</span>
                                        <span className="font-bold text-purple-600">{format(new Date(project.post_scheduled_date), 'dd-MM-yyyy')}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Display comments */}
                    {reviewComments.length > 0 ? (
                        <div className="space-y-6 bg-white border-2 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            {reviewComments.map((comment, index) => {
                                // Determine the description based on stage and action
                                let description = `${comment.action} in ${comment.stage}`;

                                switch (comment.stage) {
                                    case 'SCRIPT':
                                        if (comment.action === 'SUBMITTED') {
                                            description = 'Project submitted by writer';
                                        }
                                        break;
                                    case 'SCRIPT_REVIEW_L1':
                                        if (comment.action === 'APPROVED') {
                                            description = 'Project approved by CMO';
                                        } else if (comment.action === 'REWORK') {
                                            description = 'CMO requested rework';
                                        }
                                        break;
                                    case 'FINAL_REVIEW_CMO':
                                        if (comment.action === 'APPROVED') {
                                            description = 'Project approved by CMO';
                                        } else if (comment.action === 'REWORK') {
                                            description = 'CMO requested rework';
                                        }
                                        break;
                                    case 'FINAL_REVIEW_CEO':
                                        if (comment.action === 'APPROVED') {
                                            description = 'Project approved by CEO';
                                        } else if (comment.action === 'REWORK') {
                                            description = 'CEO requested rework';
                                        }
                                        break;
                                    case 'MULTI_WRITER_APPROVAL':
                                        if (comment.action === 'APPROVED') {
                                            description = 'Writer approved the final video';
                                        } else if (comment.action === 'SUBMITTED') {
                                            description = 'All writers have approved - Project advanced to CMO for final review';
                                        }
                                        break;
                                    default:
                                        if (comment.action === 'SET_SHOOT_DATE') {
                                            description = 'Shoot date set';
                                        } else if (comment.action === 'SET_DELIVERY_DATE') {
                                            description = 'Delivery date set';
                                        } else {
                                            description = `${comment.action} in ${comment.stage}`;
                                        }
                                }

                                return (
                                    <div key={`${comment.stage}-${comment.action}-${comment.timestamp}-${comment.actor_id}`} className={`border-l-4 pl-4 py-2 ${comment.action === 'APPROVED' ? 'border-green-500' : comment.action === 'REWORK' ? 'border-yellow-500' : 'border-red-500'}`}>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-bold text-slate-900">{comment.actor_name}</p>
                                                <p className="text-sm text-slate-600">{format(new Date(comment.timestamp), 'MMM dd, yyyy h:mm a')}</p>
                                            </div>
                                            <span className={`px-2 py-1 text-xs font-bold uppercase ${comment.action === 'APPROVED' ? 'bg-green-100 text-green-800' : comment.action === 'REWORK' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                                                {comment.action}
                                            </span>
                                        </div>
                                        <p className="mt-2 text-slate-700">{comment.comment || description}</p>
                                        {comment.action === 'SET_SHOOT_DATE' && (
                                            <div className="mt-2 text-sm text-slate-600 font-bold">
                                                📅 Shoot Date: <span className="text-green-600">{comment.comment}</span>
                                            </div>
                                        )}
                                        {comment.action === 'SET_DELIVERY_DATE' && (
                                            <div className="mt-2 text-sm text-slate-600 font-bold">
                                                📅 Delivery Date: <span className="text-blue-600">{comment.comment}</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <div className="text-gray-400 mb-2">
                                <CheckCircle className="h-12 w-12 mx-auto opacity-50" />
                            </div>
                            <p className="text-gray-500 italic font-medium">Comments and feedback will appear here as they are added</p>
                            <p className="text-sm text-gray-400 mt-1">No comments or feedback recorded yet</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default CmoProjectDetails;