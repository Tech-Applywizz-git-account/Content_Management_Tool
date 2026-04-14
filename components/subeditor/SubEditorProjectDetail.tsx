import React, { useState, useEffect } from 'react';
import { Project, Role, TaskStatus, WorkflowStage, STAGE_LABELS, UserStatus, User } from '../../types';
import { db } from '../../services/supabaseDb';
import { supabase } from '../../src/integrations/supabase/client';
import { format } from 'date-fns';
import { ArrowLeft, Calendar, Upload, Video, FileText, Clock, Film } from 'lucide-react';
import { getWorkflowStateForRole, canUserEdit, getLatestReworkRejectComment, isInfluencerVideo } from '../../services/workflowUtils';
import ReworkSection from '../ReworkSection';
import Popup from '../Popup';

interface Props {
  project: Project;
  userRole: Role;
  fromView?: 'MYWORK' | 'SCRIPTS' | null;
  onBack: () => void;
  onUpdate: () => void;
  onLogout?: () => void;
  onNavigateToView?: (view: string) => void;
}

const SubEditorProjectDetail: React.FC<Props> = ({ project: initialProject, userRole, onBack, onUpdate, onLogout, onNavigateToView, fromView }) => {
  const [publicUser, setPublicUser] = useState<User | null>(null);
  const [userError, setUserError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeView, setActiveView] = React.useState('project-detail'); // Track the current view
  const [localProject, setLocalProject] = useState<Project>(initialProject);
  const [deliveryDate, setDeliveryDate] = useState(initialProject.delivery_date || '');
  const [editedVideoLink, setEditedVideoLink] = useState(initialProject.edited_video_link || '');
  const [loading, setLoading] = useState(false);
  const [isEditingVideo, setIsEditingVideo] = useState(false);

  // Popup state
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');
  const [stageName, setStageName] = useState('');
  const [popupDuration, setPopupDuration] = useState(5000); // Default 5 seconds

  // Use canonical rework condition
  const isRework = getWorkflowStateForRole(localProject, userRole).isRework;
  // Maintain isRejected if needed for specific UI states, but isActiveRework is the primary driver
  const isRejected = localProject.status === TaskStatus.REJECTED && localProject.assigned_to_role === userRole;

  // Determine if current user can edit based on role and workflow state
  const canEdit = canUserEdit(userRole, getWorkflowStateForRole(localProject, userRole), localProject.assigned_to_role, localProject.current_stage) || isRework;

  // Reset form fields when project changes
  useEffect(() => {
    setDeliveryDate(initialProject.delivery_date || '');
    setEditedVideoLink(initialProject.edited_video_link || '');
    setLocalProject(initialProject);

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
  }, [initialProject]);

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

      setIsSubmitting(true);
      setLoading(true);

      // Record the action in workflow history
      await db.workflow.recordAction(
        localProject.id,
        localProject.current_stage!,
        publicUser.id,
        publicUser.full_name || publicUser.email || publicUser.id,
        'SUB_EDITOR_SET_DELIVERY_DATE',
        `Delivery date set to ${deliveryDate}`
      );

      // Update the project with the delivery date
      const updatedProject = await db.projects.update(localProject.id, {
        delivery_date: deliveryDate,
        current_stage: WorkflowStage.SUB_EDITOR_PROCESSING,
        assigned_to_role: Role.SUB_EDITOR,
        status: TaskStatus.IN_PROGRESS
      });

      // Update local state
      setLocalProject(updatedProject);

      console.log(`Delivery date set: ${deliveryDate}`);

      // Show popup notification
      const stageLabel = STAGE_LABELS[WorkflowStage.SUB_EDITOR_PROCESSING] || 'Sub-Editor Processing';
      setPopupMessage(`Delivery date set for ${localProject.title} on ${deliveryDate}.`);
      setStageName(stageLabel);
      setPopupDuration(5000); // 5 seconds
      setShowPopup(true);

      onUpdate();
    } catch (error) {
      console.error('Failed to set delivery date:', error);
      alert('❌ Failed to set delivery date. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRescheduleDelivery = async () => {
    try {
      // HARD GUARD: Prevent submission if publicUser.id is missing
      if (!publicUser?.id) {
        alert('User profile not loaded. Please refresh and try again.');
        return;
      }

      setIsSubmitting(true);
      setLoading(true);

      // Record the action in workflow history
      await db.workflow.recordAction(
        localProject.id,
        localProject.current_stage!,
        publicUser.id,
        publicUser.full_name || publicUser.email || publicUser.id,
        'SUB_EDITOR_RESCHEDULE_DELIVERY',
        `Delivery date cleared by ${publicUser.full_name || publicUser.email || publicUser.id}`
      );

      // Update the project to clear the delivery date
      const updatedProject = await db.projects.update(localProject.id, {
        delivery_date: null,
        current_stage: WorkflowStage.SUB_EDITOR_PROCESSING,
        assigned_to_role: Role.SUB_EDITOR,
        status: TaskStatus.IN_PROGRESS
      });

      // Update local state
      setLocalProject(updatedProject);
      setDeliveryDate(''); // Clear the local delivery date state

      console.log('Delivery date cleared for rescheduling');

      // Show popup notification
      const stageLabel = STAGE_LABELS[WorkflowStage.SUB_EDITOR_PROCESSING] || 'Sub-Editor Processing';
      setPopupMessage(`Delivery date cleared for ${localProject.title}. Ready for rescheduling.`);
      setStageName(stageLabel);
      setPopupDuration(5000); // 5 seconds
      setShowPopup(true);

      onUpdate();
    } catch (error) {
      console.error('Failed to clear delivery date:', error);
      alert('❌ Failed to clear delivery date. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadEditedVideo = async () => {
    if (!editedVideoLink) {
      alert('Please enter the edited video link');
      return;
    }

    // Check if user has permission to edit
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

      setIsSubmitting(true);
      setLoading(true);

      // Record the action in workflow history with appropriate action type
      const actionType = isRework ? 'REWORK_EDIT_SUBMITTED' : 'SUB_EDITOR_VIDEO_UPLOADED';
      const comment = isRework
        ? `Rework edited video uploaded: ${editedVideoLink}`
        : `Edited video uploaded: ${editedVideoLink}`;

      // Determine the correct to_role based on thumbnail_required
      const nextRole = localProject.data?.thumbnail_required === true ? 'DESIGNER' : 'WRITER';

      await db.workflow.recordAction(
        localProject.id,
        localProject.current_stage!, // Record action at current stage
        publicUser.id,
        publicUser.full_name || publicUser.email || publicUser.id, // UserName
        actionType, // Use appropriate action value
        comment,
        Role.SUB_EDITOR, // actor_role
        Role.SUB_EDITOR, // from_role
        nextRole // to_role - Designer if thumbnail required, Writer (for multi-writer approval) if not
      );

      // Update the project with the edited video link and preserve who actually edited the video
      // Don't update assigned_to_role here since advanceWorkflow will handle proper role assignment based on thumbnail_required
      // projects.update now handles history preservation automatically
      await db.projects.update(localProject.id, {
        edited_video_link: editedVideoLink,
        editor_uploaded_at: new Date().toISOString(), // Store timestamp for audit trail
        sub_editor_name: publicUser.full_name || publicUser.email || 'Unknown Sub-Editor', // Store sub-editor name
        edited_by_role: 'SUB_EDITOR', // Track who actually edited
        edited_by_user_id: publicUser.id, // Track the specific user
        edited_by_name: publicUser.full_name || publicUser.email || 'Unknown Sub-Editor', // Track the name
        edited_at: new Date().toISOString(), // Track when edited
        status: TaskStatus.WAITING_APPROVAL, // Set appropriate status
        data: {
          ...localProject.data, // Preserve all existing data
          needs_sub_editor: false,
          thumbnail_required: localProject.data?.thumbnail_required
        } // Mark that sub-editor work is complete
      });

      // Update project data to persist any changes made during this session
      // Include edited_video_link in the update so timestamp logic can detect the upload
      await db.updateProjectData(localProject.id, {
        edited_video_link: editedVideoLink,
        needs_sub_editor: false,
        thumbnail_required: localProject.data?.thumbnail_required
      });

      // Use advanceWorkflow to properly determine the next stage based on thumbnail_required
      await db.advanceWorkflow(localProject.id, comment);

      // Get updated project to update local state
      const updatedProject = await db.getProjectById(localProject.id);
      setLocalProject(updatedProject);

      console.log(`${isRework ? 'Rework edited' : 'Edited'} video uploaded: ${editedVideoLink}`);

      // Show success popup notification immediately after DB update succeeds
      // Get the actual next stage from the updated project
      const actualNextStage = updatedProject.current_stage;
      const updatedNextStageLabel = STAGE_LABELS[actualNextStage] || actualNextStage.replace(/_/g, ' ');

      const popupMessageText = isRework
        ? `Rework edited video uploaded successfully for ${localProject.title}. Waiting for ${updatedNextStageLabel}.`
        : `Edited video uploaded successfully for ${localProject.title}. Waiting for ${updatedNextStageLabel}.`;

      setPopupMessage(popupMessageText);
      setStageName(updatedNextStageLabel);
      // For rework scenarios, use longer duration to ensure visibility
      setPopupDuration(isRework ? 10000 : 5000); // 10 seconds for rework, 5 for regular
      setShowPopup(true);

      // The project has already been updated to MULTI_WRITER_APPROVAL stage, 
      // so no further workflow advancement is needed here.
      // The MULTI_WRITER_APPROVAL stage is handled by the writers themselves.

      // Get updated project to update UI
      const postWorkflowProject = await db.getProjectById(localProject.id);
      setLocalProject(postWorkflowProject);

      // Find users to notify based on the next assigned role
      if (postWorkflowProject?.assigned_to_role) {
        const { data: nextUsers } = await supabase
          .from('users')
          .select('id')
          .eq('role', postWorkflowProject.assigned_to_role)
          .eq('status', 'ACTIVE');

        if (nextUsers && nextUsers.length > 0) {
          // Send notification to all users of the assigned role
          for (const nextUser of nextUsers) {
            try {
              // Use type assertion to access the notifications service
              const dbWithNotifications = db as any;
              await dbWithNotifications.notifications.create(
                nextUser.id,
                localProject.id,
                'ASSET_UPLOADED',
                'New Edited Video Available',
                `${publicUser.full_name || 'Sub-Editor'} has uploaded an edited video for: ${localProject.title}. Please review and proceed with ${STAGE_LABELS[postWorkflowProject.current_stage] || postWorkflowProject.current_stage.replace(/_/g, ' ')}.`
              );
            } catch (notificationError) {
              console.error('Failed to send notification:', notificationError);
              // Continue with the process even if notification fails
            }
          }
        }
      }

      onUpdate();
    } catch (error) {
      console.error('Failed to upload edited video:', error);
      alert('❌ Failed to upload edited video. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-white font-sans text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-72 bg-white border-r-2 border-black shadow-[4px_0px_0px_0px_rgba(0,0,0,0.05)] z-10">
        <div className="p-8 border-b-2 border-black bg-white">
          <h1 className="text-4xl font-black uppercase tracking-tighter text-[#D946EF] drop-shadow-[2px_2px_0px_rgba(0,0,0,1)] leading-none">
            ApplyWizz
          </h1>
          <p className="text-xs font-bold uppercase tracking-widest mt-2 text-slate-900">Workflow System</p>
        </div>

        <div className="flex-1 px-6 py-8 space-y-6 overflow-y-auto">
          <div className="space-y-3">
            {/* Dashboard Link */}
            <button
              onClick={() => {
                onNavigateToView?.('dashboard');
                setActiveView('dashboard');
              }}
              className={`w-full flex items-center space-x-3 px-4 py-4 border-2 border-black font-black uppercase transition-transform hover:-translate-y-1 hover:-translate-x-1 ${activeView === 'dashboard'
                ? 'bg-[#D946EF] text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                : 'bg-white text-black hover:bg-slate-50'
                }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" /></svg>
              <span>Dashboard</span>
            </button>

            {/* My Work */}
            <button
              onClick={() => {
                onNavigateToView?.('mywork');
                setActiveView('mywork');
              }}
              className={`w-full flex items-center space-x-3 px-4 py-4 border-2 font-bold uppercase transition-all ${activeView === 'mywork'
                ? 'bg-[#D946EF] text-black border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                : 'bg-white text-black border-transparent hover:border-black hover:bg-slate-50'
                }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M12 22s7-4 7-10V5l-7-3-7 3v7c0 6 7 10 7 10" /></svg>
              <span>My Work</span>
            </button>

            {/* Calendar */}
            <button
              onClick={() => {
                onNavigateToView?.('calendar');
                setActiveView('calendar');
              }}
              className={`w-full flex items-center space-x-3 px-4 py-4 border-2 font-bold uppercase transition-all ${activeView === 'calendar'
                ? 'bg-[#D946EF] text-black border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                : 'bg-white text-black border-transparent hover:border-black hover:bg-slate-50'
                }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>
              <span>Calendar</span>
            </button>
          </div>
        </div>

        {/* User Footer */}
        <div className="p-6 border-t-2 border-black bg-slate-50">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-[#4ADE80] border-2 border-black rounded-full flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M12 22s7-4 7-10V5l-7-3-7 3v7c0 6 7 10 7 10" /></svg>
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-black uppercase truncate">Sub-Editor</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center space-x-2 p-3 bg-[#FF4F4F] text-white border-2 border-black font-bold uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-[4px] active:translate-x-[4px] transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          {/* Project Header */}
          <div className="bg-white border-2 border-black sticky top-0 z-10 mb-6">
            <div className="px-6 py-4 flex items-center gap-4">
              <button
                onClick={onBack}
                className="p-2 border-2 border-black hover:bg-slate-100 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-black uppercase text-slate-900">{localProject.title}</h1>
                    <div className="flex items-center gap-3 mt-1">
                      <span
                        className={`px-2 py-1 text-[10px] font-black uppercase border-2 border-black ${localProject.channel === 'YOUTUBE'
                          ? 'bg-[#FF4F4F] text-white'
                          : localProject.channel === 'LINKEDIN'
                            ? 'bg-[#0085FF] text-white'
                            : localProject.channel === 'INSTAGRAM'
                              ? 'bg-[#D946EF] text-white'
                              : 'bg-black text-white'
                          }`}
                      >
                        {localProject.channel}
                      </span>

                      <span
                        className={`px-2 py-1 text-[10px] font-black uppercase border-2 border-black ${localProject.priority === 'HIGH'
                          ? 'bg-red-500 text-white'
                          : localProject.priority === 'NORMAL'
                            ? 'bg-yellow-500 text-black'
                            : 'bg-green-500 text-white'
                          }`}
                      >
                        {localProject.priority}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Current Progress</span>
                    <div className="flex items-center gap-2">
                       <span className="px-3 py-1 bg-black text-white text-xs font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(217,70,239,1)]">
                         {localProject.current_stage ? localProject.current_stage.replace(/_/g, ' ') : 'N/A'}
                       </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* New Project Progress Bar */}
          <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6 mb-8 overflow-hidden">
             <div className="flex items-center gap-2 mb-6">
                <Clock className="w-5 h-5" />
                <h2 className="text-xl font-black uppercase text-slate-900">Workflow Progress</h2>
             </div>
             <div className="relative pt-4 pb-8">
               {/* Progress Line */}
               <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-200 -translate-y-[1.4rem]"></div>
               <div className="flex justify-between relative">
                 {[
                   { id: 'STRATEGY', label: 'Script', stages: [WorkflowStage.SCRIPT, WorkflowStage.SCRIPT_REVIEW_L1, WorkflowStage.SCRIPT_REVIEW_L2] },
                   { id: 'PRODUCTION', label: 'Shoot', stages: [WorkflowStage.CINEMATOGRAPHY] },
                   { id: 'EDITING', label: 'Sub-Editing', stages: [WorkflowStage.SUB_EDITOR_ASSIGNMENT, WorkflowStage.SUB_EDITOR_PROCESSING] },
                   { id: 'REVIEW', label: 'Review', stages: [WorkflowStage.MULTI_WRITER_APPROVAL, WorkflowStage.WRITER_VIDEO_APPROVAL, WorkflowStage.POST_WRITER_REVIEW, WorkflowStage.FINAL_REVIEW_CMO, WorkflowStage.FINAL_REVIEW_CEO] },
                   { id: 'POSTING', label: 'Posted', stages: [WorkflowStage.OPS_SCHEDULING, WorkflowStage.POSTED] }
                 ].map((step, idx) => {
                   const isActive = step.stages.includes(localProject.current_stage as WorkflowStage);
                   const isPast = !isActive && idx < [
                     { id: 'STRATEGY', label: 'Script', stages: [WorkflowStage.SCRIPT, WorkflowStage.SCRIPT_REVIEW_L1, WorkflowStage.SCRIPT_REVIEW_L2] },
                     { id: 'PRODUCTION', label: 'Shoot', stages: [WorkflowStage.CINEMATOGRAPHY] },
                     { id: 'EDITING', label: 'Sub-Editing', stages: [WorkflowStage.SUB_EDITOR_ASSIGNMENT, WorkflowStage.SUB_EDITOR_PROCESSING] },
                     { id: 'REVIEW', label: 'Review', stages: [WorkflowStage.MULTI_WRITER_APPROVAL, WorkflowStage.WRITER_VIDEO_APPROVAL, WorkflowStage.POST_WRITER_REVIEW, WorkflowStage.FINAL_REVIEW_CMO, WorkflowStage.FINAL_REVIEW_CEO] },
                     { id: 'POSTING', label: 'Posted', stages: [WorkflowStage.OPS_SCHEDULING, WorkflowStage.POSTED] }
                   ].findIndex(s => s.stages.includes(localProject.current_stage as WorkflowStage));

                   return (
                     <div key={step.id} className="flex flex-col items-center flex-1">
                        <div className={`w-8 h-8 flex items-center justify-center border-2 border-black z-10 transition-colors ${
                          isActive ? 'bg-[#D946EF] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 
                          isPast ? 'bg-black text-white' : 'bg-white'
                        }`}>
                          {isPast ? '✓' : idx + 1}
                        </div>
                        <span className={`mt-2 text-[10px] font-black uppercase text-center ${isActive ? 'text-[#D946EF]' : 'text-slate-500'}`}>
                          {step.label}
                        </span>
                     </div>
                   );
                 })}
               </div>
             </div>
          </div>

          {/* Rework Information Section */}
          {(isRework || isRejected) && (
            <ReworkSection project={localProject} userRole={userRole} />
          )}

          {/* Raw Video from Cinematographer */}
          {
            localProject.video_link && (fromView !== 'SCRIPTS') && (
              <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Video className="w-5 h-5" />
                  <h2 className="text-xl font-black uppercase">
                    {isInfluencerVideo(localProject) ? 'Influencer Video' : 'Shoot Video'}
                  </h2>
                </div>
                <div className="bg-blue-50 border-2 border-blue-400 p-4">
                  {!isInfluencerVideo(localProject) && (
                    <p className="text-sm font-bold text-blue-800 mb-2">
                      📹 Shoot Date: {localProject.shoot_date || 'Not specified'}
                    </p>
                  )}
                  <a
                    href={localProject.video_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 bg-white border-2 border-blue-400 text-blue-600 font-medium hover:bg-blue-50 transition-colors break-all"
                  >
                    {localProject.video_link}
                  </a>
                </div>
              </div>
            )
          }

          {/* Script Reference */}
          <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5" />
              <h2 className="text-xl font-black uppercase">Script Reference</h2>
            </div>
            <div className="bg-slate-50 border-2 border-slate-200 p-4 font-serif text-slate-900 leading-relaxed">
              {localProject.data?.script_content ? (
                <div
                  dangerouslySetInnerHTML={{
                    __html: localProject.data.script_content
                  }}
                />
              ) : (
                'No script content available'
              )}
            </div>
          </div>

          {/* Cinematographer Instructions - Show when project has cinematographer data */}
          {
            (localProject.current_stage === WorkflowStage.CINEMATOGRAPHY || localProject.data?.cine_comments || localProject.data?.actor || localProject.data?.location || localProject.data?.lighting || localProject.data?.angles) && (
              <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-5 h-5" />
                  <h2 className="text-xl font-black uppercase">Cinematographer Instructions</h2>
                </div>
                <div className="space-y-4">
                  {/* Writer's name */}
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 uppercase">Writer</label>
                    <p className="p-2 border-2 border-black font-medium bg-slate-50">
                      {localProject.data?.writer_name || 'Writer name not available'}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 uppercase">Actor Details</label>
                      <p className="p-2 border-2 border-black font-medium bg-slate-50">
                        {localProject.data?.actor ?? 'Not specified'}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 uppercase">Location Details</label>
                      <p className="p-2 border-2 border-black font-medium bg-slate-50">
                        {localProject.data?.location ?? 'Not specified'}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 uppercase">Lighting Details</label>
                      <p className="p-2 border-2 border-black font-medium bg-slate-50">
                        {localProject.data?.lighting ?? 'Not specified'}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 uppercase">Camera Angles</label>
                      <p className="p-2 border-2 border-black font-medium bg-slate-50">
                        {localProject.data?.angles ?? 'Not specified'}
                      </p>
                    </div>
                  </div>

                  {/* Cinematographer Comments */}
                  {localProject.data?.cine_comments && (
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 uppercase">Cinematographer Notes</label>
                      <div className="bg-slate-50 border-2 border-slate-200 p-4 font-serif text-slate-900 leading-relaxed">
                        <p>{localProject.data.cine_comments}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          }

          {/* Delivery Date Section */}
          {
            fromView !== 'SCRIPTS' && (localProject.delivery_date || localProject.assigned_to_role === Role.SUB_EDITOR || localProject.sub_editor_uploaded_at) && (
              <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-5 h-5" />
                  <h2 className="text-xl font-black uppercase">Delivery Date</h2>
                </div>

                {!localProject.delivery_date ? (
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
                        disabled={loading}
                        className="px-8 py-4 bg-[#FF4F4F] border-2 border-black text-white font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Calendar className="w-5 h-5 inline mr-2" />
                        {isInfluencerVideo(localProject) ? 'Influencer Video' : 'Shoot Video'} Ready
                      </button>
                    </div>
                    <p className="text-sm text-slate-500">
                      📅 This date will be visible on calendars for all team members
                    </p>
                  </div>
                ) : (
                  <div className="bg-orange-50 border-2 border-orange-600 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold uppercase text-orange-800 mb-1">✓ Delivery Scheduled</p>
                        <p className="text-2xl font-black text-orange-900">{localProject.delivery_date}</p>
                      </div>
                      <div className="px-4 py-2 border-2 border-orange-700 text-orange-800 font-bold text-sm uppercase bg-orange-200">
                        Locked
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          }

          {/* Edited Video Upload Section */}
          {
            fromView !== 'SCRIPTS' && (localProject.delivery_date || isRework || localProject.edited_video_link || localProject.assigned_to_role === Role.SUB_EDITOR || localProject.sub_editor_uploaded_at) && (
              <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Film className="w-5 h-5" />
                  <h2 className="text-xl font-black uppercase">
                    {isRejected
                      ? 'Rejected Edited Video Upload'
                      : isRework
                        ? 'Rework Edited Video Upload'
                        : 'Edited Video'}
                  </h2>
                </div>

                {/* Show previous edited video if exists and it's a rework */}
                {isRework && localProject.edited_video_link && (
                  <div className="bg-blue-50 border-2 border-blue-600 p-4 mb-4">
                    <p className="text-sm font-bold uppercase text-blue-800 mb-2">
                      Previous Submission
                    </p>
                    <a
                      href={localProject.edited_video_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block break-all text-blue-600 underline"
                    >
                      {localProject.edited_video_link}
                    </a>
                  </div>
                )}

                {/* Show input if user has edit permissions OR is in rework OR specifically clicked EDIT */}
                {(isRework || canEdit || !localProject.edited_video_link || isEditingVideo) && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-slate-600 font-medium">
                        {isRework ? 'Upload New Version (Rework)' : isEditingVideo ? 'Update Video Link' : 'Upload Edited Video Link'}
                      </p>
                      {(isRework || isEditingVideo) && (
                        <div className="flex gap-2">
                           {isEditingVideo && !isRework && (
                             <button 
                               onClick={() => setIsEditingVideo(false)}
                               className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase border border-slate-300 hover:bg-slate-200"
                             >
                               Cancel
                             </button>
                           )}
                           <span className="px-2 py-1 bg-red-100 text-red-700 text-[10px] font-bold uppercase border border-red-200">
                             Edit Mode Active
                           </span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3">
                      <input
                        type="url"
                        value={editedVideoLink}
                        onChange={(e) => setEditedVideoLink(e.target.value)}
                        placeholder="https://drive.google.com/file/d/..."
                        className="flex-1 p-4 border-2 border-black text-lg focus:bg-yellow-50 focus:outline-none"
                      />
                      <button
                        onClick={async () => {
                           await handleUploadEditedVideo();
                           setIsEditingVideo(false);
                        }}
                        className="px-8 py-4 bg-[#0085FF] border-2 border-black text-white font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                      >
                        <Upload className="w-5 h-5 inline mr-2" />
                        {isRejected ? 'Submit Rejected Edit' : isRework ? 'Submit Rework Edit' : isEditingVideo ? 'Update Video' : 'Upload'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Delivered state ONLY for non-rework (Show EDIT button if not DONE) */}
                {localProject.edited_video_link && !isRework && !isEditingVideo && (
                  <div className="bg-green-50 border-2 border-green-600 p-4 mt-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-bold uppercase text-green-800">
                          ✓ Edited Video Delivered
                        </p>
                        <p className="text-sm text-green-800 mt-1">
                          → Project has been moved to {
                            localProject.assigned_to_role === 'DESIGNER' ? 'Designer for thumbnail creation' :
                              localProject.assigned_to_role === 'CMO' ? 'CMO for review' :
                                localProject.assigned_to_role === 'CEO' ? 'CEO for review' :
                                  localProject.assigned_to_role === 'WRITER' ? 'Writer for approval' :
                                    (localProject.assigned_to_role ? localProject.assigned_to_role.replace('_', ' ') : 'the next stage')
                          }
                        </p>
                      </div>
                      {localProject.status !== TaskStatus.DONE && (
                        <button 
                          onClick={() => setIsEditingVideo(true)}
                          className="px-3 py-1 bg-white border-2 border-black text-black text-[10px] font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
                        >
                          Edit Link
                        </button>
                      )}
                    </div>
                    {/* Show upload timestamp */}
                    {localProject.sub_editor_uploaded_at && (
                      <div className="mt-3 pt-3 border-t border-green-300">
                        <span className="text-xs font-bold uppercase text-green-700">Uploaded At</span>
                        <p className="text-sm font-medium text-green-800">
                          {format(new Date(localProject.sub_editor_uploaded_at), 'MMM dd, yyyy h:mm a')}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          }

          {/* Project Info */}
          {
            fromView !== 'SCRIPTS' && (
              <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
                <h2 className="text-xl font-black uppercase mb-4">Project Details</h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-bold text-slate-400 uppercase text-xs">Status</span>
                    <p className="font-bold text-slate-900 mt-1">{localProject.status}</p>
                  </div>
                  <div>
                    <span className="font-bold text-slate-400 uppercase text-xs">Priority</span>
                    <p className="font-bold text-slate-900 mt-1">{localProject.priority}</p>
                  </div>
                  <div>
                    <span className="font-bold text-slate-400 uppercase text-xs">Created</span>
                    <p className="font-bold text-slate-900 mt-1">
                      {format(new Date(localProject.created_at), 'MMM dd, yyyy h:mm a')}
                    </p>
                  </div>
                  <div>
                    <span className="font-bold text-slate-400 uppercase text-xs">Content Type</span>
                    <p className="font-bold text-slate-900 mt-1">{localProject.content_type}</p>
                  </div>
                  {localProject.brand && (
                    <div className="col-span-2 border-t border-slate-100 pt-3">
                      <span className="font-bold text-slate-400 uppercase text-xs">Brand</span>
                      <p className="font-black text-[#0085FF] mt-1 uppercase">
                        {localProject.brand.replace(/_/g, ' ')}
                      </p>
                    </div>
                  )}
                  {localProject.data?.niche && (
                    <div className="col-span-2 border-t border-slate-100 pt-3">
                      <span className="font-bold text-slate-400 uppercase text-xs">Niche</span>
                      <p className="font-bold text-slate-900 mt-1 uppercase">
                        {localProject.data.niche === 'PROBLEM_SOLVING' ? 'Problem Solving'
                          : localProject.data.niche === 'SOCIAL_PROOF' ? 'Social Proof'
                            : localProject.data.niche === 'LEAD_MAGNET' ? 'Lead Magnet'
                              : localProject.data.niche === 'CAPTION_BASED' ? 'Caption Based'
                                : localProject.data.niche === 'OTHER' && localProject.data.niche_other
                                  ? localProject.data.niche_other
                                  : localProject.data.niche}
                      </p>
                    </div>
                  )}
                  {localProject.data?.influencer_name && (
                    <div className="col-span-1 border-t border-slate-100 pt-3">
                      <span className="font-bold text-slate-400 uppercase text-xs">Influencer</span>
                      <p className="font-bold text-slate-900 mt-1 uppercase">
                        {localProject.data.influencer_name}
                      </p>
                    </div>
                  )}
                  {localProject.data?.referral_link && (
                    <div className="col-span-1 border-t border-slate-100 pt-3">
                      <span className="font-bold text-slate-400 uppercase text-xs">Referral Link</span>
                      <p className="font-bold text-slate-900 mt-1">
                        <a href={localProject.data.referral_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline uppercase">
                          View Link
                        </a>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )
          }
        </div >
      </main >
      <div className="fixed inset-0 pointer-events-none z-50">
        {showPopup && (
          <Popup
            message={popupMessage}
            stageName={stageName}
            duration={popupDuration}
            onClose={() => {
              setShowPopup(false);
              onUpdate();
            }}
          />
        )}
      </div>
    </div >
  );
};

export default SubEditorProjectDetail;