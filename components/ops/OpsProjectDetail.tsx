import React, { useState, useEffect } from 'react';
import { Project, TaskStatus, WorkflowStage, STAGE_LABELS, Role, User } from '../../types';
import { format } from 'date-fns';
import { ArrowLeft, Calendar, Link as LinkIcon, Video, Image, FileText, Upload, CheckCircle, Eye, Clock, ExternalLink, Play, EyeOff, AlertTriangle } from 'lucide-react';
import { db } from '../../services/supabaseDb';
import ScriptDisplay from '../ScriptDisplay';
import { supabase } from '../../src/integrations/supabase/client';
import { decodeHtmlEntities } from '../../utils/htmlDecoder';
import Popup from '../Popup';
import ApprovalStatusIndicator from '../ApprovalStatusIndicator';
import Timeline from '../Timeline';
import { isInfluencerVideo } from '../../services/workflowUtils';

interface Props {
    project: Project;
    onBack: () => void;
    onUpdate: () => void;
}

const OpsProjectDetail: React.FC<Props> = ({ project, onBack, onUpdate }) => {
    const [publicUser, setPublicUser] = useState<User | null>(null);
    const [userError, setUserError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [postDate, setPostDate] = useState(project.post_scheduled_date || '');
    const [liveUrl, setLiveUrl] = useState(project.data?.live_url || '');
    const [caption, setCaption] = useState(project.data?.captions || '');

    // Popup state
    const [showPopup, setShowPopup] = useState(false);
    const [popupMessage, setPopupMessage] = useState('');
    const [stageName, setStageName] = useState('');

    // Listen for beforeLogout event to close detail view automatically
    useEffect(() => {
        const handleBeforeLogout = () => {
            console.log('Closing ops project detail before logout...');
            onBack(); // Just close the detail view
        };

        window.addEventListener('beforeLogout', handleBeforeLogout);

        // Load public user profile on mount
        // Requirement: Fetch public.users record ONCE using the logged-in user's email
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
                        setPublicUser(pUser as User);
                    } else {
                        console.error('Error fetching public user:', pError);
                        setUserError('User profile not found in database. Please contact support.');
                    }
                }
            } catch (err) {
                console.error('Failed to load user:', err);
            }
        };
        loadUser();

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
            // HARD GUARD: Prevent submission if publicUser.id is missing
            if (!publicUser?.id) {
                alert('User profile not loaded. Please refresh and try again.');
                return;
            }

            setIsSubmitting(true);

            // Record action in history
            await db.workflow.recordAction(
                project.id,
                project.current_stage,
                publicUser.id,
                publicUser.full_name || publicUser.email || publicUser.id,
                'OPS_SCHEDULED',
                `Post scheduled for ${postDate}`
            );

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
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddLiveUrl = async () => {
        console.log('Adding live URL:', liveUrl);
        if (!liveUrl) {
            alert('Please enter a live URL');
            return;
        }

        try {
            // HARD GUARD: Prevent submission if publicUser.id is missing
            if (!publicUser?.id) {
                alert('User profile not loaded. Please refresh and try again.');
                return;
            }

            setIsSubmitting(true);

            // Record action in history
            await db.workflow.recordAction(
                project.id,
                project.current_stage,
                publicUser.id,
                publicUser.full_name || publicUser.email || publicUser.id,
                'OPS_POSTED',
                `Project posted with live URL: ${liveUrl}`
            );

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

    const isVideo = project.content_type === 'VIDEO' || isInfluencerVideo(project);
    const isPosted = project.data?.live_url || project.status === 'DONE';

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <header className="border-b-2 border-black flex items-center justify-between px-6 py-4 bg-white shadow-[0px_4px_0px_0px_rgba(0,0,0,0.1)]">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={onBack}
                        className="p-2 border-2 border-transparent hover:border-black hover:bg-slate-100 rounded-full transition-all flex items-center justify-center"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`px-3 py-1 text-xs font-black uppercase border-2 border-black text-white ${project.channel === 'YOUTUBE' ? 'bg-[#FF4F4F]' :
                                project.channel === 'LINKEDIN' ? 'bg-[#0085FF]' :
                                    project.channel === 'INSTAGRAM' ? 'bg-[#D946EF]' :
                                        'bg-black'
                                }`}>
                                {project.channel}
                            </span>
                            <span className="text-xs font-bold uppercase text-slate-500">
                                {isVideo ? '🎬 VIDEO' : '🎨 CREATIVE'}
                            </span>
                            {isPosted && (
                                <span className="px-2 py-1 text-xs font-black uppercase border-2 border-black bg-green-100 text-green-800 flex items-center gap-1">
                                    <CheckCircle size={12} />
                                    POSTED
                                </span>
                            )}
                            {!isPosted && project.post_scheduled_date && (
                                <span className="px-2 py-1 text-xs font-black uppercase border-2 border-black bg-blue-100 text-blue-800 flex items-center gap-1">
                                    <Calendar size={12} />
                                    SCHEDULED
                                </span>
                            )}
                            {!isPosted && !project.post_scheduled_date && (
                                <span className="px-2 py-1 text-xs font-black uppercase border-2 border-black bg-amber-100 text-amber-800 flex items-center gap-1">
                                    <Clock size={12} />
                                    READY
                                </span>
                            )}
                        </div>
                        <h1 className="text-xl font-black uppercase text-slate-900 max-w-3xl truncate" title={project.title}>{project.title}</h1>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Content Preview */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Project Info */}
                    <div className="border-2 border-black p-6 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]">
                        <div className="flex items-center gap-2 mb-3">
                            <FileText size={16} className="text-slate-700" />
                            <h3 className="font-black uppercase text-sm text-slate-700">Project Info</h3>
                        </div>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-slate-600">Priority:</span>
                                <span className={`font-bold ${project.priority === 'HIGH' ? 'text-red-600' : 'text-slate-900'}`}>
                                    {project.priority}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-600">Status:</span>
                                <span className={`font-bold ${isPosted ? 'text-green-600' : 'text-amber-600'}`}>
                                    {isPosted ? 'POSTED' : project.post_scheduled_date ? 'SCHEDULED' : 'READY'}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-600">Content Type:</span>
                                <span className="font-bold text-slate-900">
                                    {project.content_type}
                                </span>
                            </div>
                             {project.brand && (
                                <div className="flex justify-between">
                                    <span className="text-slate-600">Brand:</span>
                                    <span className="font-black text-[#0085FF] uppercase">
                                        {project.brand.replace(/_/g, ' ')}
                                    </span>
                                </div>
                            )}
                            {project.data?.niche && (
                                <div className="flex justify-between">
                                    <span className="text-slate-600">Niche:</span>
                                    <span className="font-bold text-slate-900 uppercase">
                                        {project.data.niche === 'PROBLEM_SOLVING' ? 'Problem Solving'
                                            : project.data.niche === 'SOCIAL_PROOF' ? 'Social Proof'
                                                : project.data.niche === 'LEAD_MAGNET' ? 'Lead Magnet'
                                                    : project.data.niche === 'CAPTION_BASED' ? 'Caption Based'
                                                        : project.data.niche === 'OTHER' && project.data.niche_other
                                                            ? project.data.niche_other
                                                            : project.data.niche}
                                    </span>
                                </div>
                            )}
                            <div className="flex justify-between mt-2 pt-2 border-t border-slate-300">
                                <span className="text-slate-600">Writer:</span>
                                <span className="font-bold text-slate-900">{project.writer_name || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-600">Editor:</span>
                                <span className="font-bold text-slate-900">{project.editor_name || 'N/A'}</span>
                            </div>
                            {project.data?.influencer_name && (
                                <div className="flex justify-between">
                                    <span className="text-slate-600">Influencer:</span>
                                    <span className="font-bold text-slate-900">{project.data.influencer_name}</span>
                                </div>
                            )}
                            {project.data?.referral_link && (
                                <div className="flex justify-between">
                                    <span className="text-slate-600">Referral Link:</span>
                                    <a href={project.data.referral_link} target="_blank" rel="noreferrer" className="font-bold text-blue-600 hover:underline">View Link</a>
                                </div>
                            )}
                        </div>
                    </div>
                    {/* Final Content */}
                    <div className="border-2 border-black p-6 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]">
                        <div className="flex items-center gap-2 mb-4">
                            <Eye size={24} className="text-slate-700" />
                            <h2 className="text-xl font-black uppercase text-slate-900">Final Content</h2>
                        </div>

                        {isVideo ? (
                            <div className="space-y-4">
                                {/* Raw Video */}
                                {project.video_link && (
                                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Video size={16} className="text-slate-700" />
                                            <label className="text-sm font-bold text-slate-700">{['JOBBOARD', 'LEAD_MAGNET', 'APPLYWIZZ_USA_JOBS'].includes(project.content_type) ? 'Shoot Video' : 'Shoot Video'}:</label>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <a
                                                href={project.video_link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 underline text-sm truncate flex-1 flex items-center gap-2"
                                            >
                                                <ExternalLink size={14} />
                                                {project.video_link}
                                            </a>
                                        </div>
                                    </div>
                                )}
                                {/* Edited Video */}
                                {project.edited_video_link && (
                                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Play size={16} className="text-blue-600" />
                                            <label className="text-sm font-bold text-slate-700">Edited Video:</label>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <a
                                                href={project.edited_video_link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 underline text-sm truncate flex-1 flex items-center gap-2"
                                            >
                                                <ExternalLink size={14} />
                                                {project.edited_video_link}
                                            </a>
                                        </div>
                                    </div>
                                )}

                                {/* Thumbnail */}
                                {project.thumbnail_link && (
                                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Image size={16} className="text-green-600" />
                                            <label className="text-sm font-bold text-slate-700">Thumbnail:</label>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <a
                                                href={project.thumbnail_link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 underline text-sm truncate flex-1 flex items-center gap-2"
                                            >
                                                <ExternalLink size={14} />
                                                {project.thumbnail_link}
                                            </a>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* Creative */
                            project.creative_link && (
                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Image size={16} className="text-purple-600" />
                                        <label className="text-sm font-bold text-slate-700">Creative Design:</label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <a
                                            href={project.creative_link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 underline text-sm truncate flex-1 flex items-center gap-2"
                                        >
                                            <ExternalLink size={14} />
                                            {project.creative_link}
                                        </a>
                                    </div>
                                </div>
                            )
                        )}

                        {!project.edited_video_link && !project.thumbnail_link && !project.creative_link && (
                            <div className="text-center py-8 text-slate-500">
                                <EyeOff size={48} className="mx-auto mb-2 text-slate-300" />
                                <p>No content assets available yet</p>
                            </div>
                        )}
                    </div>

                    {/* Script/Caption */}
                    {project.data?.script_content && (
                        <div className="border-2 border-black p-6 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]">
                            <div className="flex items-center gap-2 mb-4">
                                <FileText size={24} className="text-slate-700" />
                                <h2 className="text-xl font-black uppercase text-slate-900">Script / Caption</h2>
                            </div>
                            <ScriptDisplay 
                                content={project.data.script_content} 
                                caption={project.data?.captions}
                                showBox={false} 
                            />
                        </div>
                    )}
                </div>

                {/* Right Column - Approval Status and Actions */}
                <div className="space-y-6">
                    {/* Approval Status Indicator */}
                    <div className="border-2 border-black p-6 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]">
                        <div className="flex items-center gap-2 mb-4">
                            <AlertTriangle size={24} className="text-slate-700" />
                            <h2 className="text-xl font-black uppercase text-slate-900">Approval Status</h2>
                        </div>
                        <ApprovalStatusIndicator project={project} />
                    </div>

                    {/* Scheduling Actions */}
                    <div className="space-y-6">
                        {/* Schedule Post - Show during final review or scheduling stage */}
                        {!isPosted && (
                            [WorkflowStage.POST_WRITER_REVIEW, WorkflowStage.FINAL_REVIEW_CMO, WorkflowStage.FINAL_REVIEW_CEO, WorkflowStage.OPS_SCHEDULING].includes(project.current_stage)
                        ) && (
                            <div className="border-2 border-black p-6 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] relative overflow-hidden">
                                {/* Visual Lock if not approved yet */}
                                {!project.ceo_approved_at && (
                                    <div className="absolute inset-0 bg-slate-50/70 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center p-6 text-center">
                                        <Clock size={40} className="text-amber-500 mb-2 animate-pulse" />
                                        <h3 className="text-lg font-black uppercase text-slate-800">Pending Approvals</h3>
                                        <p className="text-sm font-bold text-slate-600 max-w-[200px]">
                                            Scheduling will be available after CMO & CEO provided final approval.
                                        </p>
                                    </div>
                                )}

                                <div className="flex items-center gap-2 mb-4">
                                    <Calendar size={24} className="text-slate-700" />
                                    <h2 className="text-xl font-black uppercase text-slate-900">
                                        Schedule Post
                                    </h2>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">
                                            Post Scheduled Date:
                                        </label>
                                        <input
                                            type="date"
                                            value={postDate}
                                            onChange={(e) => setPostDate(e.target.value)}
                                            className="w-full px-4 py-3 border-2 border-black font-mono rounded"
                                        />
                                    </div>

                                    <button
                                        onClick={handleSetPostDate}
                                        disabled={!postDate || !project.ceo_approved_at}
                                        className="w-full bg-blue-500 text-white py-3 font-bold border-2 border-black 
                                                 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed
                                                 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all rounded"
                                    >
                                        {project.post_scheduled_date ? 'UPDATE SCHEDULE' : 'SET SCHEDULE'}
                                    </button>

                                    {project.post_scheduled_date && (
                                        <div className="p-3 bg-blue-50 border-2 border-blue-500 text-blue-800 rounded">
                                            <p className="text-sm font-bold">
                                                ✓ Scheduled for {format(new Date(project.post_scheduled_date), 'MMM dd, yyyy, EEEE')}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Add Live URL (after posting) */}
                        {project.post_scheduled_date && !isPosted && (
                             [WorkflowStage.POST_WRITER_REVIEW, WorkflowStage.FINAL_REVIEW_CMO, WorkflowStage.FINAL_REVIEW_CEO, WorkflowStage.OPS_SCHEDULING].includes(project.current_stage)
                        ) && (
                            <div className="border-2 border-black p-6 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] relative overflow-hidden">
                                {/* Visual Lock if not approved yet */}
                                {!project.ceo_approved_at && (
                                    <div className="absolute inset-0 bg-slate-50/70 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center p-6 text-center">
                                        <Clock size={40} className="text-amber-500 mb-2 animate-pulse" />
                                        <h3 className="text-lg font-black uppercase text-slate-800">Pending Approvals</h3>
                                        <p className="text-sm font-bold text-slate-600 max-w-[200px]">
                                            Posting will be available after CMO & CEO provided final approval.
                                        </p>
                                    </div>
                                )}

                                <div className="flex items-center gap-2 mb-4">
                                    <LinkIcon size={24} className="text-slate-700" />
                                    <h2 className="text-xl font-black uppercase text-slate-900">
                                        Mark as Posted
                                    </h2>
                                </div>

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
                                            className="w-full px-4 py-3 border-2 border-black font-mono rounded"
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
                                            className="w-full px-4 py-3 border-2 border-black font-mono h-24 rounded"
                                        />
                                    </div>

                                    <button
                                        onClick={handleAddLiveUrl}
                                        disabled={!liveUrl || !project.ceo_approved_at}
                                        className="w-full bg-green-500 text-white py-3 font-bold border-2 border-black 
                                                 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed
                                                 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all
                                                 flex items-center justify-center gap-2 rounded"
                                    >
                                        <CheckCircle size={20} />
                                        MARK AS POSTED
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Posted Confirmation */}
                        {isPosted && (
                            <div className="border-2 border-green-500 p-6 bg-green-50 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]">
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
                                    <div className="flex items-center gap-2 p-3 bg-white border border-green-300 rounded">
                                        <LinkIcon size={16} className="text-green-600" />
                                        <a
                                            href={project.data.live_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 underline text-sm truncate flex items-center gap-1"
                                        >
                                            <ExternalLink size={12} />
                                            View Post
                                        </a>
                                    </div>
                                )}
                            </div>
                        )}


                    </div>
                </div>
            </div>

            {/* Timeline */}
            <div className="border-t-2 border-black pt-6">
                <Timeline project={project} />
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
