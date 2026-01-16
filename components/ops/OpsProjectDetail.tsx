import React, { useState, useEffect } from 'react';
import { Project, TaskStatus, WorkflowStage, STAGE_LABELS, Role } from '../../types';
import { format } from 'date-fns';
import { ArrowLeft, Calendar, Link as LinkIcon, Video, Image, FileText, Upload, CheckCircle } from 'lucide-react';
import { db } from '../../services/supabaseDb';
import { supabase } from '../../src/integrations/supabase/client';
import Popup from '../Popup';
import Timeline from '../Timeline';
import ApprovalStatusIndicator from '../ApprovalStatusIndicator';

interface Props {
    project: Project;
    onBack: () => void;
    onUpdate: () => void;
}

const OpsProjectDetail: React.FC<Props> = ({ project, onBack, onUpdate }) => {
    const [postDate, setPostDate] = useState(project.post_scheduled_date || '');
    const [liveUrl, setLiveUrl] = useState(project.data?.live_url || '');
    const [caption, setCaption] = useState(project.data?.captions || '');
    const [users, setUsers] = useState<any[]>([]);

    // Popup state
    const [showPopup, setShowPopup] = useState(false);
    const [popupMessage, setPopupMessage] = useState('');
    const [stageName, setStageName] = useState('');

    // Fetch users for timeline
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const usersData = await db.getUsers();
                setUsers(usersData);
            } catch (error) {
                console.error('Failed to fetch users:', error);
            }
        };

        fetchUsers();
    }, []);

    // Listen for beforeLogout event to close detail view automatically
    useEffect(() => {
        const handleBeforeLogout = () => {
            console.log('Closing ops project detail before logout...');
            onBack(); // Just close the detail view
        };

        window.addEventListener('beforeLogout', handleBeforeLogout);
        return () => {
            window.removeEventListener('beforeLogout', handleBeforeLogout);
        };
    }, []);

    const handleSetPostDate = async () => {
        console.log('Setting post date:', postDate);
        if (!postDate) {
            alert('Please select a post date');
            return;
        }

        try {
            // Record action in history
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                await db.workflow.recordAction(
                    project.id,
                    project.current_stage,
                    session.user.id,
                    session.user.user_metadata?.full_name || session.user.email || 'OPS',
                    'OPS_SCHEDULED',
                    `Post scheduled for ${postDate}`
                );
            }

            // Update the project with the post scheduled date in Supabase
            await db.projects.update(project.id, { post_scheduled_date: postDate });
            console.log(`Post scheduled date set: ${postDate}`);
            // Show popup including calendar visibility
            const stageLabel = STAGE_LABELS[WorkflowStage.OPS_SCHEDULING] || 'Scheduling';
            setPopupMessage(`Post scheduled for ${project.title} on ${format(new Date(postDate), 'MMM dd, yyyy')}. This date will be visible on calendars for Writer, CEO, CMO, and Operations.`);
            setStageName(stageLabel);
            setShowPopup(true);
        } catch (error) {
            console.error('Failed to set post date:', error);
            alert('❌ Failed to set post date. Please try again.');
        }
    };

    const handleAddLiveUrl = async () => {
        console.log('Adding live URL:', liveUrl);
        if (!liveUrl) {
            alert('Please enter a live URL');
            return;
        }

        try {
            // Record action in history
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                await db.workflow.recordAction(
                    project.id,
                    project.current_stage,
                    session.user.id,
                    session.user.user_metadata?.full_name || session.user.email || 'OPS',
                    'OPS_POSTED',
                    `Project posted with live URL: ${liveUrl}`
                );
            }

            // Update the project with the live URL and mark as POSTED
            await db.projects.updateData(project.id, {
                live_url: liveUrl,
                captions: caption  // Save the caption along with the live URL
            });
            await db.projects.update(project.id, { status: TaskStatus.DONE });
            console.log(`Live URL added: ${liveUrl}`);

            // Show popup notification using STAGE_LABELS.POSTED
            const postedLabel = STAGE_LABELS[WorkflowStage.POSTED] || 'Posted';
            setPopupMessage(`Live URL added: ${liveUrl}. Project marked as POSTED.`);
            setStageName(postedLabel);
            setShowPopup(true);

        } catch (error) {
            console.error('Failed to add live URL:', error);
            alert('❌ Failed to add live URL. Please try again.');
        }
    };

    const isVideo = project.content_type === 'VIDEO';
    const isPosted = project.data?.live_url || project.status === 'DONE';

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={onBack}
                    className="p-2 border-2 border-black hover:bg-slate-100"
                >
                    <ArrowLeft size={24} />
                </button>
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 text-xs font-bold border-2 border-black ${project.channel === 'LINKEDIN' ? 'bg-blue-100 text-blue-800' :
                            project.channel === 'YOUTUBE' ? 'bg-red-100 text-red-800' :
                                'bg-purple-100 text-purple-800'
                            }`}>
                            {project.channel}
                        </span>
                        <span className="text-sm text-slate-600">
                            {isVideo ? '🎬 VIDEO' : '🎨 CREATIVE'}
                        </span>
                    </div>
                    <h1 className="text-3xl font-black uppercase text-slate-900">{project.title}</h1>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Content Preview */}
                <div className="space-y-6">
                    {/* Final Content */}
                    <div className="border-2 border-black p-6 bg-white">
                        <h2 className="text-xl font-black uppercase mb-4 text-slate-900">Final Content</h2>

                        {isVideo ? (
                            <>
                                {/* Edited Video */}
                                {project.edited_video_link && (
                                    <div className="space-y-2 mb-4">
                                        <label className="block text-sm font-bold text-slate-700">Edited Video:</label>
                                        <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-300">
                                            <Video size={20} className="text-blue-600" />
                                            <a
                                                href={project.edited_video_link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 underline text-sm truncate"
                                            >
                                                {project.edited_video_link}
                                            </a>
                                        </div>
                                    </div>
                                )}

                                {/* Thumbnail */}
                                {project.thumbnail_link && (
                                    <div className="space-y-2">
                                        <label className="block text-sm font-bold text-slate-700">Thumbnail:</label>
                                        <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-300">
                                            <Image size={20} className="text-green-600" />
                                            <a
                                                href={project.thumbnail_link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 underline text-sm truncate"
                                            >
                                                {project.thumbnail_link}
                                            </a>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            /* Creative */
                            project.creative_link && (
                                <div className="space-y-2">
                                    <label className="block text-sm font-bold text-slate-700">Creative Design:</label>
                                    <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-300">
                                        <Image size={20} className="text-purple-600" />
                                        <a
                                            href={project.creative_link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 underline text-sm truncate"
                                        >
                                            {project.creative_link}
                                        </a>
                                    </div>
                                </div>
                            )
                        )}
                    </div>

                    {/* Script/Caption */}
                    {project.data?.script_content && (
                        <div className="border-2 border-black p-6 bg-white">
                            <h2 className="text-xl font-black uppercase mb-4 text-slate-900">Script / Caption</h2>
                            <div className="p-4 bg-slate-50 border border-slate-300 rounded">
                                <p className="text-slate-700 whitespace-pre-wrap">{project.data.script_content}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Middle Column - Approval Status and Timeline */}
                <div className="space-y-6">
                    {/* Approval Status Indicator */}
                    <ApprovalStatusIndicator project={project} />


                </div>

                {/* Right Column - Scheduling Actions */}
                <div className="space-y-6">
                    {/* Schedule Post - Show only after CMO and CEO final review have approved */}
                    {!isPosted && project.current_stage === WorkflowStage.OPS_SCHEDULING && (
                        <div className="border-2 border-black p-6 bg-white">
                            <h2 className="text-xl font-black uppercase mb-4 text-slate-900">
                                📅 Schedule Post
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">
                                        Post Scheduled Date:
                                    </label>
                                    <input
                                        type="date"
                                        value={postDate}
                                        onChange={(e) => setPostDate(e.target.value)}
                                        className="w-full px-4 py-3 border-2 border-black font-mono"
                                    />
                                </div>

                                <button
                                    onClick={handleSetPostDate}
                                    disabled={!postDate}
                                    className="w-full bg-blue-500 text-white py-3 font-bold border-2 border-black 
                                             hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed
                                             shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                                >
                                    {project.post_scheduled_date ? 'UPDATE SCHEDULE' : 'SET SCHEDULE'}
                                </button>

                                {project.post_scheduled_date && (
                                    <div className="p-3 bg-blue-50 border-2 border-blue-500 text-blue-800">
                                        <p className="text-sm font-bold">
                                            ✓ Scheduled for {format(new Date(project.post_scheduled_date), 'MMM dd, yyyy, EEEE')}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Add Live URL (after posting) */}
                    {project.post_scheduled_date && !isPosted && project.current_stage === WorkflowStage.OPS_SCHEDULING && (
                        <div className="border-2 border-black p-6 bg-white">
                            <h2 className="text-xl font-black uppercase mb-4 text-slate-900">
                                🔗 Mark as Posted
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">
                                        Live URL:
                                    </label>
                                    <input
                                        type="url"
                                        value={liveUrl}
                                        onChange={(e) => setLiveUrl(e.target.value)}
                                        placeholder="https://linkedin.com/posts/..."
                                        className="w-full px-4 py-3 border-2 border-black font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">
                                        Caption / Description:
                                    </label>
                                    <textarea
                                        value={caption}
                                        onChange={(e) => setCaption(e.target.value)}
                                        placeholder="Enter caption or description for the post..."
                                        className="w-full px-4 py-3 border-2 border-black font-mono h-24"
                                    />
                                </div>

                                <button
                                    onClick={handleAddLiveUrl}
                                    disabled={!liveUrl}
                                    className="w-full bg-green-500 text-white py-3 font-bold border-2 border-black 
                                             hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed
                                             shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all
                                             flex items-center justify-center gap-2"
                                >
                                    <CheckCircle size={20} />
                                    MARK AS POSTED
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Posted Confirmation */}
                    {isPosted && (
                        <div className="border-2 border-green-500 p-6 bg-green-50">
                            <div className="flex items-center gap-3 mb-4">
                                <CheckCircle size={32} className="text-green-600" />
                                <h2 className="text-xl font-black uppercase text-green-800">
                                    Content Posted ✅
                                </h2>
                            </div>

                            {project.post_scheduled_date && (
                                <p className="text-sm text-green-700 mb-2">
                                    Posted on: {format(new Date(project.post_scheduled_date), 'MMM dd, yyyy')}
                                </p>
                            )}

                            {project.data?.live_url && (
                                <div className="flex items-center gap-2 p-3 bg-white border border-green-300">
                                    <LinkIcon size={16} className="text-green-600" />
                                    <a
                                        href={project.data.live_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 underline text-sm truncate"
                                    >
                                        {project.data.live_url}
                                    </a>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Project Info */}
                    <div className="border-2 border-black p-6 bg-slate-50">
                        <h3 className="font-black uppercase text-sm text-slate-700 mb-3">Project Info</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-slate-600">Priority:</span>
                                <span className={`font-bold ${project.priority === 'HIGH' ? 'text-red-600' : 'text-slate-900'}`}>
                                    {project.priority}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-600">Due Date:</span>
                                <span className="font-bold text-slate-900">
                                    {format(new Date(project.due_date), 'MMM dd, yyyy')}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-600">Status:</span>
                                <span className={`font-bold ${isPosted ? 'text-green-600' : 'text-amber-600'}`}>
                                    {isPosted ? 'POSTED' : project.post_scheduled_date ? 'SCHEDULED' : 'READY'}
                                </span>
                            </div>
                            {project.data?.niche && (
                                <div className="flex justify-between mt-2">
                                    <span className="text-slate-600">Niche:</span>
                                    <span className="font-bold text-slate-900 uppercase">
                                        {project.data.niche === 'PROBLEM_SOLVING' ? 'Problem Solving'
                                            : project.data.niche === 'SOCIAL_PROOF' ? 'Social Proof'
                                                : project.data.niche === 'LEAD_MAGNET' ? 'Lead Magnet'
                                                    : project.data.niche === 'OTHER' && project.data.niche_other
                                                        ? project.data.niche_other
                                                        : project.data.niche}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {showPopup && (
                <Popup
                    message={popupMessage}
                    stageName={stageName}
                    onClose={() => {
                        setShowPopup(false);
                        onUpdate();
                    }}
                />
            )}
        </div>
    );
};

export default OpsProjectDetail;
