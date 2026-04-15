import React, { useState, useEffect } from 'react';
import { Project, Role, WorkflowStage, TaskStatus, User } from '../../types';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { supabase } from '../../src/integrations/supabase/client';
import { format } from 'date-fns';
import { ArrowLeft, Calendar, Upload, Video, FileText, Clock, Film, Link } from 'lucide-react';
import { db } from '../../services/supabaseDb';
import Popup from '../Popup';
import Layout from '../Layout';
import { getWorkflowState, getWorkflowStateForRole, canUserEdit, getLatestReworkRejectComment, isInfluencerVideo } from '../../services/workflowUtils';

const SubEditorProjectDetailPage: React.FC<{
    user: User;
    onLogout: () => void;
    projects?: Project[];
}> = ({ user, onLogout, projects = [] }) => {
    const [publicUser, setPublicUser] = useState<User | null>(null);
    const [userError, setUserError] = useState<string | null>(null);
    const { projectId } = useParams<{ projectId: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const location = useLocation();

    // Check if coming from CINE PROJECTS tab
    const fromView = searchParams.get('from') || 'MYWORK';
    const isFromCineTab = fromView === 'SCRIPTS';

    // Instant UI: Find project in cache first
    const cachedProject = projects.find(p => p.id === projectId) || location.state?.project as Project;
    const [project, setProject] = useState<Project | null>(cachedProject || null);
    const [loading, setLoading] = useState(!cachedProject);
    const [error, setError] = useState<string | null>(null);

    const [deliveryDate, setDeliveryDate] = useState('');
    const [editedVideoLink, setEditedVideoLink] = useState('');
    const [loadingAction, setLoadingAction] = useState(false);

    // Popup state
    const [showPopup, setShowPopup] = useState(false);
    const [popupMessage, setPopupMessage] = useState('');
    const [stageName, setStageName] = useState('');
    const [popupDuration, setPopupDuration] = useState(5000);

    // Load project directly from Supabase
    useEffect(() => {
        const loadProject = async () => {
            if (!projectId) {
                setError('No project ID provided');
                setLoading(false);
                return;
            }

            try {
                // Background fetch - don't show spinner if we have cached data
                const { data, error } = await supabase
                    .from('projects')
                    .select('*, workflow_history(*)')
                    .eq('id', projectId)
                    .single();

                if (error) {
                    console.error('Error fetching project:', error);
                    if (!project) setError('Project not found');
                    return;
                }

                if (!data) {
                    if (!project) setError('Project not found');
                    return;
                }

                // Map workflow_history to history property expected by Timeline
                const projectData: Project = {
                    ...data,
                    history: data.workflow_history || []
                } as Project;

                setProject(projectData);
                setDeliveryDate(projectData.delivery_date || '');
                setEditedVideoLink(projectData.edited_video_link || '');

            } catch (err) {
                console.error('Error loading project:', err);
                if (!project) setError('Failed to load project');
            } finally {
                setLoading(false);
            }
        };

        loadProject();
    }, [projectId]);

    // Load public user profile on mount
    // Requirement: Fetch public.users record ONCE using the logged-in user's email
    useEffect(() => {
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
    }, []);

    // Workflow state and permissions
    const workflowState = project ? getWorkflowStateForRole(project, user.role) : null;
    const isRework = workflowState?.isTargetedRework || workflowState?.isRework || false;
    const isRejected = workflowState?.isRejected || false;
    const canEdit = project ? canUserEdit(user.role, workflowState!, project.assigned_to_role, project.current_stage) : false;

    // If there's an error or no project, show error message (no loading state)
    // Only block if we have NO data AND we're still loading
    if (loading && !project) {
        return null; // Instant UI
    }

    // If there's an error or no project, show error message
    if (error || !project) {
        return (
            <Layout
                user={user}
                onLogout={onLogout}
                onOpenCreate={() => { }}
                activeView={fromView === 'MYWORK' ? 'mywork' : 'dashboard'}
            >
                <div className="flex-1 flex items-center justify-center min-h-[500px]">
                    <div className="text-center max-w-md">
                        <h1 className="text-2xl font-black text-slate-900 mb-4">Project Not Found</h1>
                        <p className="text-slate-600 mb-6">{error || 'The requested project could not be found.'}</p>
                        <button
                            onClick={() => navigate(-1)}
                            className="bg-[#D946EF] border-2 border-black px-6 py-3 text-white font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                        >
                            Back
                        </button>
                    </div>
                </div>
            </Layout>
        );
    }

    const handleSetDeliveryDate = async () => {
        if (!deliveryDate) {
            alert('Please select a delivery date');
            return;
        }

        try {
            // HARD GUARD: Prevent submission if publicUser.id is missing
            if (!publicUser?.id) {
                alert('User profile not loaded. Please refresh and try again.');
                return;
            }

            setLoadingAction(true);

            await db.workflow.recordAction(
                project.id,
                project.current_stage!,
                publicUser.id,
                publicUser.email || publicUser.id,
                'SUB_EDITOR_SET_DELIVERY_DATE',
                `Delivery date set to ${deliveryDate}`
            );

            const updatedProject = await db.projects.update(project.id, {
                delivery_date: deliveryDate,
                current_stage: WorkflowStage.SUB_EDITOR_PROCESSING,
                assigned_to_role: Role.SUB_EDITOR,
                status: TaskStatus.IN_PROGRESS
            });

            setProject(updatedProject);

            const stageLabel = 'Sub-Editor Processing';
            setPopupMessage(`Delivery date set for ${project.title} on ${deliveryDate}.`);
            setStageName(stageLabel);
            setPopupDuration(5000);
            setShowPopup(true);

        } catch (error) {
            console.error('Failed to set delivery date:', error);
            alert('❌ Failed to set delivery date. Please try again.');
        } finally {
            setLoadingAction(false);
        }
    };

    const handleUploadEditedVideo = async () => {
        if (!editedVideoLink) {
            alert('Please enter the edited video link');
            return;
        }

        if (!canEdit) {
            alert('You do not have permission to edit this project');
            return;
        }

        try {
            // HARD GUARD: Prevent submission if publicUser.id is missing
            if (!publicUser?.id) {
                alert('User profile not loaded. Please refresh and try again.');
                return;
            }

            setLoadingAction(true);

            const actionType = isRework ? 'REWORK_EDIT_SUBMITTED' : 'SUB_EDITOR_VIDEO_UPLOADED';
            const comment = isRework
                ? `Rework edited video uploaded: ${editedVideoLink}`
                : `Edited video uploaded: ${editedVideoLink}`;

            const nextRole = project.data?.thumbnail_required === true ? 'DESIGNER' : 'WRITER';

            await db.workflow.recordAction(
                project.id,
                project.current_stage!,
                publicUser.id,
                publicUser.full_name || publicUser.email || publicUser.id,
                actionType,
                comment,
                Role.SUB_EDITOR,
                Role.SUB_EDITOR,
                nextRole
            );

            await db.projects.update(project.id, {
                edited_video_link: editedVideoLink,
                editor_uploaded_at: new Date().toISOString(),
                sub_editor_name: publicUser.full_name || publicUser?.email || 'Unknown Sub-Editor',
                edited_by_role: 'SUB_EDITOR',
                edited_by_user_id: publicUser.id,
                edited_by_name: publicUser.full_name || publicUser?.email || 'Unknown Sub-Editor',
                edited_at: new Date().toISOString(),
                status: TaskStatus.WAITING_APPROVAL,
                data: {
                    ...project.data,
                    needs_sub_editor: false,
                    thumbnail_required: project.data?.thumbnail_required
                }
            });

            await db.updateProjectData(project.id, {
                edited_video_link: editedVideoLink,
                needs_sub_editor: false,
                thumbnail_required: project.data?.thumbnail_required
            });

            await db.advanceWorkflow(project.id, comment);

            const updatedProject = await db.getProjectById(project.id);
            setProject(updatedProject);

            const actualNextStage = updatedProject.current_stage;
            const updatedNextStageLabel = 'Next Stage';

            const popupMessageText = isRework
                ? `Rework edited video uploaded successfully for ${project.title}. Waiting for ${updatedNextStageLabel}.`
                : `Edited video uploaded successfully for ${project.title}. Waiting for ${updatedNextStageLabel}.`;

            setPopupMessage(popupMessageText);
            setStageName(updatedNextStageLabel);
            setPopupDuration(isRework ? 10000 : 5000);
            setShowPopup(true);

        } catch (error) {
            console.error('Failed to upload edited video:', error);
            alert('❌ Failed to upload edited video. Please try again.');
        } finally {
            setLoadingAction(false);
        }
    };

    return (
        <Layout
            user={user}
            onLogout={onLogout}
            onOpenCreate={() => { }}
            activeView={fromView === 'MYWORK' ? 'mywork' : 'dashboard'}
        >
            <div className="max-w-6xl mx-auto">
                {/* Project Header */}
                <div className="bg-white border-2 border-black sticky top-0 z-10 mb-6">
                    <div className="px-6 py-4 flex items-center gap-4">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 border-2 border-black hover:bg-slate-100 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="flex-1">
                            <h1 className="text-2xl font-black uppercase text-slate-900">{project.title}</h1>
                            {!isFromCineTab && (
                                <div className="flex items-center gap-3 mt-1">
                                    <span
                                        className={`px-2 py-1 text-[10px] font-black uppercase border-2 border-black ${project.channel === 'YOUTUBE' ? 'bg-[#FF4F4F] text-white' :
                                            project.channel === 'LINKEDIN' ? 'bg-[#0085FF] text-white' :
                                                'bg-[#D946EF] text-white'
                                            }`}
                                    >
                                        {project.channel}
                                    </span>
                                    <span
                                        className={`px-2 py-1 text-[10px] font-black uppercase border-2 border-black ${project.priority === 'HIGH' ? 'bg-red-500 text-white' :
                                            project.priority === 'NORMAL' ? 'bg-yellow-500 text-black' :
                                                'bg-green-500 text-white'
                                            }`}
                                    >
                                        {project.priority}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Rework Information Box - Only shown when NOT from CINE tab */}
                {!isFromCineTab && (isRework || isRejected) && project.history && project.history.length > 0 && (
                    <div className="bg-red-50 border-2 border-red-400 p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] mb-6">
                        <div className="flex items-center space-x-2 mb-4">
                            <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                                <span className="text-white font-bold text-sm">!</span>
                            </div>
                            <div>
                                <h2 className="text-xl font-black uppercase text-red-800">
                                    {isRejected ? 'Project Rejected' : 'Rework Required'}
                                </h2>
                                <p className="text-sm font-bold text-red-600">
                                    {isRejected ? '(Limited editing capabilities)' : '(Feedback from previous stages)'}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="p-4 bg-white border-l-4 border-red-500">
                                <h4 className="font-bold text-red-800 mb-2">Reviewer Comments</h4>
                                <p className="text-red-700">
                                    {getLatestReworkRejectComment(project, user.role)?.comment ||
                                        'No specific reason provided. Please review the feedback and make necessary changes.'}
                                </p>
                                <p className="text-sm text-red-600 mt-2">
                                    {isRejected ? 'Rejected by' : 'Feedback from'} {getLatestReworkRejectComment(project, user.role)?.actor_name || 'Reviewer'}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Script & Reference Section */}
                <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <FileText className="w-5 h-5" />
                        <h2 className="text-xl font-black uppercase">
                            {project.data?.source === 'IDEA_PROJECT' ? 'Idea & Reference' : 'Script & Reference'}
                        </h2>
                    </div>

                    {/* Script/Idea Content */}
                    <div className="bg-slate-50 border-2 border-slate-200 p-4 font-serif text-slate-900 leading-relaxed mb-6">
                        {project.data?.source === 'IDEA_PROJECT' ? (
                            <div>
                                <h3 className="text-xs font-black uppercase text-slate-400 mb-2">Idea Description</h3>
                                <div className="font-sans font-medium">{project.data.idea_description || 'No idea description available'}</div>
                            </div>
                        ) : project.data?.script_content ? (
                            <div dangerouslySetInnerHTML={{ __html: project.data.script_content }} />
                        ) : (
                            'No script content available'
                        )}
                    </div>

                    {/* Reference Links */}
                    {(project.data?.script_reference_link || project.data?.referral_link) && (
                        <div className="pt-6 border-t-2 border-dashed border-slate-200 space-y-4">
                            {project.data?.script_reference_link && (
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <Link className="w-4 h-4 text-slate-400" />
                                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Script Reference</span>
                                    </div>
                                    <a
                                        href={project.data.script_reference_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:underline font-medium break-all text-sm"
                                    >
                                        {project.data.script_reference_link}
                                    </a>
                                </div>
                            )}

                            {project.data?.referral_link && (
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <Link className="w-4 h-4 text-slate-400" />
                                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Referral Link</span>
                                    </div>
                                    <a
                                        href={project.data.referral_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:underline font-medium break-all text-sm"
                                    >
                                        {project.data.referral_link}
                                    </a>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Cinematographer Instructions */}
                {(project.current_stage === WorkflowStage.CINEMATOGRAPHY ||
                    project.data?.cine_comments ||
                    project.data?.actor ||
                    project.data?.location ||
                    project.data?.lighting ||
                    project.data?.angles) && (
                        <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <FileText className="w-5 h-5" />
                                <h2 className="text-xl font-black uppercase">Cinematographer Instructions</h2>
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 uppercase">Writer</label>
                                    <p className="p-2 border-2 border-black font-medium bg-slate-50">
                                        {project.data?.writer_name || 'Writer name not available'}
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700 uppercase">Actor Details</label>
                                        <p className="p-2 border-2 border-black font-medium bg-slate-50">
                                            {project.data?.actor ?? 'Not specified'}
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700 uppercase">Location Details</label>
                                        <p className="p-2 border-2 border-black font-medium bg-slate-50">
                                            {project.data?.location ?? 'Not specified'}
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700 uppercase">Lighting Details</label>
                                        <p className="p-2 border-2 border-black font-medium bg-slate-50">
                                            {project.data?.lighting ?? 'Not specified'}
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700 uppercase">Camera Angles</label>
                                        <p className="p-2 border-2 border-black font-medium bg-slate-50">
                                            {project.data?.angles ?? 'Not specified'}
                                        </p>
                                    </div>
                                </div>

                                {project.data?.cine_comments && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700 uppercase">Cinematographer Notes</label>
                                        <div className="bg-slate-50 border-2 border-slate-200 p-4 font-serif text-slate-900 leading-relaxed">
                                            <p>{project.data.cine_comments}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                {/* Raw Video from Cinematographer - Only shown when NOT from CINE tab */}
                {!isFromCineTab && project.video_link && (
                    <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Video className="w-5 h-5" />
                            <h2 className="text-xl font-black uppercase">
                                {isInfluencerVideo(project) ? 'Influencer Video' : 'Shoot Video'}
                            </h2>
                        </div>
                        <div className="bg-blue-50 border-2 border-blue-400 p-4">
                            {!isInfluencerVideo(project) && (
                                <p className="text-sm font-bold text-blue-800 mb-2">
                                    📹 Shoot Date: {project.shoot_date || 'Not specified'}
                                </p>
                            )}
                            <a
                                href={project.video_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block p-3 bg-white border-2 border-blue-400 text-blue-600 font-medium hover:bg-blue-50 transition-colors break-all"
                            >
                                {project.video_link}
                            </a>
                        </div>
                    </div>
                )}

                {/* Delivery Date Section - Only shown when NOT from CINE tab */}
                {!isFromCineTab && (project.delivery_date || project.assigned_to_role === Role.SUB_EDITOR || project.sub_editor_uploaded_at) && (
                    <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Calendar className="w-5 h-5" />
                            <h2 className="text-xl font-black uppercase">Delivery Date</h2>
                        </div>

                        {!project.delivery_date ? (
                            <div className="space-y-4">
                                <p className="text-slate-600 font-medium">Set when you'll deliver the edited video</p>
                                <div className="flex gap-3">
                                    <input
                                        type="date"
                                        value={deliveryDate}
                                        onChange={(e) => setDeliveryDate(e.target.value)}
                                        min={new Date().toISOString().split('T')[0]}
                                        className="flex-1 p-4 border-2 border-black text-lg font-bold focus:bg-yellow-50 focus:outline-none"
                                    />
                                    <button
                                        onClick={handleSetDeliveryDate}
                                        disabled={loadingAction}
                                        className="px-8 py-4 bg-[#FF4F4F] border-2 border-black text-white font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Calendar className="w-5 h-5 inline mr-2" />
                                        Set Delivery Date
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-orange-50 border-2 border-orange-600 p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-bold uppercase text-orange-800 mb-1">✓ Delivery Scheduled</p>
                                        <p className="text-2xl font-black text-orange-900">{project.delivery_date}</p>
                                    </div>
                                    <div className="px-4 py-2 border-2 border-orange-700 text-orange-800 font-bold text-sm uppercase bg-orange-200">
                                        Locked
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Edited Video Upload Section - Only shown when NOT from CINE tab */}
                {!isFromCineTab && (project.delivery_date || isRework || project.edited_video_link || project.assigned_to_role === Role.SUB_EDITOR || project.sub_editor_uploaded_at) && (
                    <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Film className="w-5 h-5" />
                            <h2 className="text-xl font-black uppercase">
                                {isRejected ? 'Rejected Edited Video Upload' : isRework ? 'Rework Edited Video Upload' : 'Edited Video'}
                            </h2>
                        </div>

                        {project.edited_video_link && (
                            <div className="bg-gray-50 border-2 border-gray-400 p-4 mb-4">
                                <p className="text-sm font-bold uppercase text-gray-700 mb-2">Previous Edited Video</p>
                                <a
                                    href={project.edited_video_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block break-all text-blue-600 underline"
                                >
                                    {project.edited_video_link}
                                </a>
                            </div>
                        )}

                        {(canEdit || !project.edited_video_link) && (
                            <div className="space-y-4">
                                <p className="text-slate-600 font-medium">
                                    {isRejected ? 'Upload new edited video link for rejected project' : isRework ? 'Upload new edited video link for rework' : 'Upload final edited video link'}
                                </p>

                                <div className="flex gap-3">
                                    <input
                                        type="url"
                                        value={editedVideoLink}
                                        onChange={(e) => setEditedVideoLink(e.target.value)}
                                        placeholder="https://drive.google.com/file/d/..."
                                        className="flex-1 p-4 border-2 border-black text-lg focus:bg-yellow-50 focus:outline-none"
                                    />
                                    <button
                                        onClick={handleUploadEditedVideo}
                                        className="px-8 py-4 bg-[#0085FF] border-2 border-black text-white font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                                    >
                                        <Upload className="w-5 h-5 inline mr-2" />
                                        {isRejected ? 'Submit Rejected Edit' : isRework ? 'Submit Rework Edit' : 'Upload'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {project.edited_video_link && !isRework && (
                            <div className="bg-green-50 border-2 border-green-600 p-4 mt-4">
                                <p className="text-sm font-bold uppercase text-green-800">✓ Edited Video Delivered</p>
                                <p className="text-sm text-green-800 mt-1">→ Project has been moved to {
                                    project.assigned_to_role === 'DESIGNER' ? 'Designer for thumbnail creation' :
                                        project.assigned_to_role === 'CMO' ? 'CMO for review' :
                                            project.assigned_to_role === 'CEO' ? 'CEO for review' :
                                                project.assigned_to_role === 'WRITER' ? 'Writer for approval' :
                                                    (project.assigned_to_role ? project.assigned_to_role.replace('_', ' ') : 'the next stage')
                                }</p>
                                {project.sub_editor_uploaded_at && (
                                    <div className="mt-3 pt-3 border-t border-green-300">
                                        <span className="text-xs font-bold uppercase text-green-700">Uploaded At</span>
                                        <p className="text-sm font-medium text-green-800">
                                            {format(new Date(project.sub_editor_uploaded_at), 'MMM dd, yyyy h:mm a')}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Project Info */}
                <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
                    <h2 className="text-xl font-black uppercase mb-4">Project Details</h2>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="font-bold text-slate-400 uppercase text-xs">Status</span>
                            <p className="font-bold text-slate-900 mt-1">{project.status}</p>
                        </div>
                        <div>
                            <span className="font-bold text-slate-400 uppercase text-xs">Priority</span>
                            <p className="font-bold text-slate-900 mt-1">{project.priority}</p>
                        </div>
                        <div>
                            <span className="font-bold text-slate-400 uppercase text-xs">Created</span>
                            <p className="font-bold text-slate-900 mt-1">
                                {format(new Date(project.created_at), 'MMM dd, yyyy h:mm a')}
                            </p>
                        </div>
                        <div>
                            <span className="font-bold text-slate-400 uppercase text-xs">Content Type</span>
                            <p className="font-bold text-slate-900 mt-1">{project.content_type}</p>
                        </div>
                        {project.data?.niche && (
                            <div className="col-span-2">
                                <span className="font-bold text-slate-400 uppercase text-xs">Niche</span>
                                <p className="font-bold text-slate-900 mt-1 uppercase">
                                    {project.data.niche === 'PROBLEM_SOLVING' ? 'Problem Solving'
                                        : project.data.niche === 'SOCIAL_PROOF' ? 'Social Proof'
                                            : project.data.niche === 'LEAD_MAGNET' ? 'Lead Magnet'
                                                : project.data.niche === 'OTHER' && project.data.niche_other
                                                    ? project.data.niche_other
                                                    : project.data.niche}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>


            <div className="fixed inset-0 pointer-events-none z-50">
                {showPopup && (
                    <Popup
                        message={popupMessage}
                        stageName={stageName}
                        duration={popupDuration}
                        onClose={() => {
                            setShowPopup(false);
                            navigate(-1);
                        }}
                    />
                )}
            </div>
        </Layout>
    );
};

export default SubEditorProjectDetailPage;