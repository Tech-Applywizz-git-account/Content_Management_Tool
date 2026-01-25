import React, { useState, useEffect } from 'react';
import { Project, Role, WorkflowStage, TaskStatus, User } from '../../types';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { supabase } from '../../src/integrations/supabase/client';
import { format } from 'date-fns';
import { ArrowLeft, Calendar as CalendarIcon, Upload, Video, FileText, Film } from 'lucide-react';
import { db } from '../../services/supabaseDb';
import Popup from '../Popup';
import Layout from '../Layout';
import { getWorkflowState, getWorkflowStateForRole, canUserEdit, getLatestReworkRejectComment } from '../../services/workflowUtils';

const EditorProjectDetailPage: React.FC<{ user: { full_name: string; role: Role }; onLogout: () => void }> = ({ user, onLogout }) => {
    const { projectId } = useParams<{ projectId: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const location = useLocation();

    // Check if coming from CINE PROJECTS tab
    const fromView = searchParams.get('from') || 'MYWORK';
    const isFromCineTab = fromView === 'SCRIPTS';

    // Initialize state from navigation state if available (for immediate rendering)
    const initialProject = location.state?.project as Project | null;
    const [project, setProject] = useState<Project | null>(initialProject);
    const [loading, setLoading] = useState(!initialProject);
    const [error, setError] = useState<string | null>(null);

    const [deliveryDate, setDeliveryDate] = useState('');
    const [editedVideoLink, setEditedVideoLink] = useState('');

    // Popup state
    const [showPopup, setShowPopup] = useState(false);
    const [popupMessage, setPopupMessage] = useState('');
    const [stageName, setStageName] = useState('');
    const [popupDuration, setPopupDuration] = useState(5000);

    // State for sub-editors
    const [subEditors, setSubEditors] = useState<User[]>([]);
    const [selectedSubEditorId, setSelectedSubEditorId] = useState<string>('');

    // Load project directly from Supabase
    useEffect(() => {
        const loadProject = async () => {
            if (!projectId) {
                setError('No project ID provided');
                setLoading(false);
                return;
            }

            try {
                setError(null);

                // Fetch project directly from Supabase
                const { data, error } = await supabase
                    .from('projects')
                    .select('*')
                    .eq('id', projectId)
                    .single();

                if (error) {
                    console.error('Error fetching project:', error);
                    setError('Project not found');
                    return;
                }

                if (!data) {
                    setError('Project not found');
                    return;
                }

                const projectData: Project = {
                    id: data.id,
                    title: data.title,
                    channel: data.channel,
                    content_type: data.content_type,
                    current_stage: data.current_stage,
                    assigned_to_role: data.assigned_to_role,
                    assigned_to_user_id: data.assigned_to_user_id,
                    status: data.status,
                    priority: data.priority,
                    due_date: data.due_date,
                    created_by: data.created_by,
                    created_by_user_id: data.created_by_user_id,
                    created_by_name: data.created_by_name,
                    writer_id: data.writer_id,
                    writer_name: data.writer_name,
                    editor_name: data.editor_name,
                    designer_name: data.designer_name,
                    sub_editor_name: data.sub_editor_name,
                    created_at: data.created_at,
                    writer_submitted_at: data.writer_submitted_at,
                    cmo_approved_at: data.cmo_approved_at,
                    cmo_rework_at: data.cmo_rework_at,
                    ceo_approved_at: data.ceo_approved_at,
                    ceo_rework_at: data.ceo_rework_at,
                    cine_uploaded_at: data.cine_uploaded_at,
                    editor_uploaded_at: data.editor_uploaded_at,
                    sub_editor_uploaded_at: data.sub_editor_uploaded_at,
                    designer_uploaded_at: data.designer_uploaded_at,
                    edited_by_role: data.edited_by_role,
                    edited_by_user_id: data.edited_by_user_id,
                    edited_by_name: data.edited_by_name,
                    edited_at: data.edited_at,
                    shoot_date: data.shoot_date,
                    delivery_date: data.delivery_date,
                    post_scheduled_date: data.post_scheduled_date,
                    video_link: data.video_link,
                    edited_video_link: data.edited_video_link,
                    thumbnail_link: data.thumbnail_link,
                    creative_link: data.creative_link,
                    data: data.data || {},
                    history: data.history || [],
                    rework_target_role: data.rework_target_role,
                    rework_initiator_role: data.rework_initiator_role,
                    rework_initiator_stage: data.rework_initiator_stage,
                    first_review_opened_at: data.first_review_opened_at,
                    first_review_opened_by_role: data.first_review_opened_by_role,
                };

                setProject(projectData);
                setDeliveryDate(projectData.delivery_date || '');
                setEditedVideoLink(projectData.edited_video_link || '');

            } catch (err) {
                console.error('Error loading project:', err);
                setError('Failed to load project');
            } finally {
                setLoading(false);
            }
        };

        loadProject();
    }, [projectId]);

    // Fetch sub-editors when component mounts
    useEffect(() => {
        const fetchSubEditors = async () => {
            try {
                console.log('Fetching sub-editors...');
                const subEditorList = await db.users.getSubEditors();
                console.log('Fetched sub-editors:', subEditorList);
                setSubEditors(subEditorList);
            } catch (error) {
                console.error('Failed to fetch sub-editors:', error);
            }
        };

        fetchSubEditors();
    }, []);

    // Workflow state and permissions
    const workflowState = project ? getWorkflowStateForRole(project, user.role) : null;
    const isRework = workflowState?.isTargetedRework || workflowState?.isRework || false;
    const isRejected = workflowState?.isRejected || false;
    const canEdit = project ? canUserEdit(user.role, workflowState!, project.assigned_to_role) : false;
    const hasEditedVideo = !!project?.edited_video_link;

    // If there's an error or no project, show error message (no loading state)
    if (loading) {
        return (
            <Layout
                user={user}
                onLogout={onLogout}
                onOpenCreate={() => { }}
                activeView={fromView === 'MYWORK' ? 'mywork' : 'dashboard'}
            >
                <div className="flex-1 flex items-center justify-center min-h-[500px]">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-4 border-[#D946EF] border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-xl font-black text-slate-400 uppercase tracking-widest animate-pulse">Loading Project...</p>
                    </div>
                </div>
            </Layout>
        );
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
            const { data: { session } } = await supabase.auth.getSession();
            const currentUser = session?.user;

            if (!currentUser) {
                alert('User not authenticated');
                return;
            }

            await db.workflow.recordAction(
                project.id,
                project.current_stage,
                currentUser.id,
                currentUser.email || currentUser.id,
                'SET_DELIVERY_DATE',
                `Delivery date set to ${deliveryDate}`
            );

            const updatedProject = await db.projects.update(project.id, { delivery_date: deliveryDate });

            setProject(updatedProject);
            setPopupMessage(`Delivery date set for ${project.title} on ${deliveryDate}.`);
            setStageName('Video Editing');
            setPopupDuration(5000);
            setShowPopup(true);
        } catch (error) {
            console.error('Failed to set delivery date:', error);
            alert('❌ Failed to set delivery date. Please try again.');
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
            const { data: { session } } = await supabase.auth.getSession();
            const currentUser = session?.user;

            if (!currentUser) {
                alert('User not authenticated');
                return;
            }

            const actionType = isRework ? 'REWORK_EDIT_SUBMITTED' : 'EDITOR_VIDEO_UPLOADED';
            const comment = isRework
                ? `Rework edited video uploaded: ${editedVideoLink}`
                : `Edited video uploaded: ${editedVideoLink}`;

            await db.workflow.recordAction(
                project.id,
                project.current_stage,
                currentUser.id,
                currentUser.email || currentUser.id,
                actionType,
                comment
            );

            await db.projects.update(project.id, {
                edited_video_link: editedVideoLink,
                editor_uploaded_at: new Date().toISOString(),
                editor_name: currentUser?.user_metadata?.full_name || currentUser?.email || 'Unknown Editor',
                edited_by_role: 'EDITOR',
                edited_by_user_id: currentUser.id,
                edited_by_name: currentUser?.user_metadata?.full_name || currentUser?.email || 'Unknown Editor',
                edited_at: new Date().toISOString(),
                status: TaskStatus.WAITING_APPROVAL,
                data: {
                    ...project.data,
                    needs_sub_editor: false,
                    thumbnail_required: project.data?.thumbnail_required
                }
            });

            await db.advanceWorkflow(project.id, comment);

            const updatedProject = await db.getProjectById(project.id);
            setProject(updatedProject);

            const actualNextStageLabel = 'Next Stage';
            const popupMessageText = isRework
                ? `Rework edited video uploaded successfully for ${project.title}. Waiting for ${actualNextStageLabel}.`
                : `Edited video uploaded successfully for ${project.title}. Waiting for ${actualNextStageLabel}.`;

            setPopupMessage(popupMessageText);
            setStageName(actualNextStageLabel);
            setPopupDuration(isRework ? 10000 : 5000);
            setShowPopup(true);
        } catch (error) {
            console.error('Failed to upload edited video:', error);
            alert('❌ Failed to upload edited video. Please try again.');
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
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
                    {/* Script Content - Always shown */}
                    <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <FileText className="w-5 h-5" />
                            <h2 className="text-xl font-black uppercase">Script Content</h2>
                        </div>
                        <div className="bg-slate-50 border-2 border-slate-200 p-4 font-serif text-slate-900 leading-relaxed">
                            {project.data?.script_content ? (
                                <div dangerouslySetInnerHTML={{ __html: project.data.script_content }} />
                            ) : (
                                'No script content available'
                            )}
                        </div>
                    </div>

                    {/* Cinematographer Instructions - Always shown when data exists */}
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
                                <h2 className="text-xl font-black uppercase">Raw Video (from Cinematographer)</h2>
                            </div>
                            <div className="bg-blue-50 border-2 border-blue-400 p-4">
                                <p className="text-sm font-bold text-blue-800 mb-2">
                                    📹 Shoot Date: {project.shoot_date || 'Not specified'}
                                </p>
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
                    {!isFromCineTab && project.current_stage !== WorkflowStage.SUB_EDITOR_ASSIGNMENT && project.current_stage !== WorkflowStage.SUB_EDITOR_PROCESSING && (
                        <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <CalendarIcon className="w-5 h-5" />
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
                                            className="px-8 py-4 bg-[#FF4F4F] border-2 border-black text-white font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                                        >
                                            <CalendarIcon className="w-5 h-5 inline mr-2" />
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
                    {!isFromCineTab && (project.delivery_date || isRework) && (
                        <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Film className="w-5 h-5" />
                                <h2 className="text-xl font-black uppercase">
                                    {isRejected ? 'Rejected Edited Video Upload' : isRework ? 'Rework Edited Video Upload' : 'Edited Video Upload'}
                                </h2>
                            </div>

                            {hasEditedVideo && (
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

                            {(canEdit || !hasEditedVideo) && (
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

                            {hasEditedVideo && !isRework && (
                                <div className="bg-green-50 border-2 border-green-600 p-4 mt-4">
                                    <p className="text-sm font-bold uppercase text-green-800">✓ Edited Video Delivered</p>
                                    <p className="text-sm text-green-800 mt-1">→ Project has been moved to Designer for thumbnail creation</p>
                                    {project.editor_uploaded_at && (
                                        <div className="mt-3 pt-3 border-t border-green-300">
                                            <span className="text-xs font-bold uppercase text-green-700">Uploaded At</span>
                                            <p className="text-sm font-medium text-green-800">
                                                {format(new Date(project.editor_uploaded_at), 'MMM dd, yyyy h:mm a')}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Project Info - Only shown when NOT from CINE tab */}
                    {!isFromCineTab && (
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
                    )}
                </div>

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

export default EditorProjectDetailPage;