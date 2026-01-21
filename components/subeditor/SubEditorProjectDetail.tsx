import React, { useState, useEffect } from 'react';
import { Project, Role, TaskStatus, WorkflowStage, STAGE_LABELS } from '../../types';
import { db } from '../../services/supabaseDb';
import { supabase } from '../../src/integrations/supabase/client';
import { format } from 'date-fns';
import { ArrowLeft, Calendar, Upload, Video, FileText, Clock, Film } from 'lucide-react';
import { getWorkflowState, getWorkflowStateForRole, canUserEdit, getLatestReworkRejectComment } from '../../services/workflowUtils';
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

const SubEditorProjectDetail: React.FC<Props> = ({ project: initialProject, userRole, onBack, onUpdate, onLogout, onNavigateToView }) => {
  const [activeView, setActiveView] = React.useState('project-detail'); // Track the current view
  const [localProject, setLocalProject] = useState<Project>(initialProject);
  const [deliveryDate, setDeliveryDate] = useState(initialProject.delivery_date || '');
  const [editedVideoLink, setEditedVideoLink] = useState(initialProject.edited_video_link || '');
  const [loading, setLoading] = useState(false);

  // Popup state
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');
  const [stageName, setStageName] = useState('');
  const [popupDuration, setPopupDuration] = useState(5000); // Default 5 seconds

  // Use the new workflow state logic with role context
  const workflowState = getWorkflowStateForRole(localProject, userRole);
  const isRework = workflowState.isTargetedRework || workflowState.isRework;
  const isRejected = workflowState.isRejected;

  // Determine if current user can edit based on role and workflow state
  const canEdit = canUserEdit(userRole, workflowState, localProject.assigned_to_role);

  // Reset form fields when project changes
  useEffect(() => {
    setDeliveryDate(initialProject.delivery_date || '');
    setEditedVideoLink(initialProject.edited_video_link || '');
    setLocalProject(initialProject);
  }, [initialProject]);

  const handleSetDeliveryDate = async () => {
    if (!deliveryDate) {
      alert('Please select a delivery date');
      return;
    }

    try {
      setLoading(true);

      // Get user session
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;

      if (!user) {
        alert('User not authenticated');
        return;
      }

      // Record the action in workflow history
      await db.workflow.recordAction(
        localProject.id,
        localProject.current_stage!,
        user.id,
        user.email || user.id,
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
      setLoading(true);

      // Get user session
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;

      if (!user) {
        alert('User not authenticated');
        return;
      }

      // Record the action in workflow history
      await db.workflow.recordAction(
        localProject.id,
        localProject.current_stage!,
        user.id,
        user.email || user.id,
        'SUB_EDITOR_RESCHEDULE_DELIVERY',
        `Delivery date cleared by ${user.email || user.id}`
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
      setLoading(true);

      // Get user session
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;

      if (!user) {
        alert('User not authenticated');
        return;
      }

      // Record the action in workflow history with appropriate action type
      const actionType = isRework ? 'REWORK_EDIT_SUBMITTED' : 'SUB_EDITOR_VIDEO_UPLOADED';
      const comment = isRework
        ? `Rework edited video uploaded: ${editedVideoLink}`
        : `Edited video uploaded: ${editedVideoLink}`;

      await db.workflow.recordAction(
        localProject.id,
        localProject.current_stage!, // Record action at current stage
        user.id,
        user.email || user.id, // UserName (using email or ID as fallback)
        actionType, // Use appropriate action value
        comment
      );

      // Update the project with the edited video link and advance the workflow
      // Determine if thumbnail is required to set appropriate status and stage
      const thumbnailIsRequired = localProject.data?.thumbnail_required !== false;
      const nextStatus = thumbnailIsRequired ? TaskStatus.WAITING_APPROVAL : TaskStatus.WAITING_APPROVAL; // Both routes require waiting for approval
      const nextStage = thumbnailIsRequired ? WorkflowStage.THUMBNAIL_DESIGN : WorkflowStage.MULTI_WRITER_APPROVAL;
      
      await db.projects.update(localProject.id, {
        edited_video_link: editedVideoLink,
        editor_uploaded_at: new Date().toISOString(), // Store timestamp for audit trail (as per requirement)
        sub_editor_name: user?.user_metadata?.full_name || user?.email || 'Unknown Sub-Editor', // Store sub-editor name in direct column
        status: nextStatus, // Set appropriate status based on next step
        current_stage: nextStage, // Set the next stage so advanceWorkflow knows where to go
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

      // Get updated project to update local state
      const updatedProject = await db.getProjectById(localProject.id);
      setLocalProject(updatedProject);

      console.log(`${isRework ? 'Rework edited' : 'Edited'} video uploaded: ${editedVideoLink}`);
      
      // Show success popup notification immediately after DB update succeeds
      // Determine the next stage based on thumbnail requirement
      const updatedNeedsThumbnail = updatedProject?.data?.thumbnail_required !== false;
      const updatedNextStage = updatedNeedsThumbnail ? WorkflowStage.THUMBNAIL_DESIGN : WorkflowStage.MULTI_WRITER_APPROVAL;
      const updatedNextStageLabel = STAGE_LABELS[updatedNextStage];
      
      const popupMessageText = isRework
          ? `Rework edited video uploaded successfully for ${localProject.title}. Waiting for ${updatedNextStageLabel}.`
          : `Edited video uploaded successfully for ${localProject.title}. Waiting for ${updatedNextStageLabel}.`;

      setPopupMessage(popupMessageText);
      setStageName(updatedNextStageLabel);
      // For rework scenarios, use longer duration to ensure visibility
      setPopupDuration(isRework ? 10000 : 5000); // 10 seconds for rework, 5 for regular
      setShowPopup(true);
      
      // Decouple workflow advancement and notifications from the main upload flow
      // Handle these side effects separately so that upload success is shown regardless
      try {
        // Advance workflow to next stage based on project settings using the helper logic
        await db.advanceWorkflow(localProject.id, comment);

        // Get updated project to determine who to notify
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
                  `${user?.user_metadata?.full_name || 'Sub-Editor'} has uploaded an edited video for: ${localProject.title}. Please review and proceed with ${STAGE_LABELS[postWorkflowProject.current_stage] || postWorkflowProject.current_stage.replace(/_/g, ' ')}.`
                );
              } catch (notificationError) {
                console.error('Failed to send notification:', notificationError);
                // Continue with the process even if notification fails
              }
            }
          }
        }
      } catch (workflowError) {
        console.error('Workflow advancement or notification failed (this does not affect upload success):', workflowError);
        // Don't show error to user since the video was uploaded successfully
        // The workflow and notifications are side effects that shouldn't impact the main upload flow
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
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
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
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M12 22s7-4 7-10V5l-7-3-7 3v7c0 6 7 10 7 10"/></svg>
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
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
              <span>Calendar</span>
            </button>
          </div>
        </div>

        {/* User Footer */}
        <div className="p-6 border-t-2 border-black bg-slate-50">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-[#4ADE80] border-2 border-black rounded-full flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M12 22s7-4 7-10V5l-7-3-7 3v7c0 6 7 10 7 10"/></svg>
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-black uppercase truncate">Sub-Editor</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center space-x-2 p-3 bg-[#FF4F4F] text-white border-2 border-black font-bold uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-[4px] active:translate-x-[4px] transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
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
                <h1 className="text-2xl font-black uppercase text-slate-900">{localProject.title}</h1>
                <div className="flex items-center gap-3 mt-1">
                  <span
                    className={`px-2 py-1 text-[10px] font-black uppercase border-2 border-black ${localProject.channel === 'YOUTUBE'
                        ? 'bg-[#FF4F4F] text-white'
                        : localProject.channel === 'LINKEDIN'
                          ? 'bg-[#0085FF] text-white'
                          : 'bg-[#D946EF] text-white'
                      }`}
                  >
                    {localProject.channel}
                  </span>
                  <span className="text-sm text-slate-500 font-bold">
                    Due: {format(new Date(localProject.due_date), 'MMM dd, yyyy h:mm a')}
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
            </div>
          </div>

        {/* Rework Information Box (Shown for all rework projects assigned to Sub-Editor) */}
        {(isRework || isRejected) && localProject.assigned_to_role === Role.SUB_EDITOR && localProject.history && localProject.history.length > 0 && (
          <div className="bg-red-50 border-2 border-red-400 p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">

            {/* Header */}
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">!</span>
              </div>
              <div>
                <h2 className="text-xl font-black uppercase text-red-800">
                  {isRejected ? 'Project Rejected' : 'Rework Required'}
                </h2>
                <p className="text-sm font-bold text-red-600">
                  {isRejected ? '(Limited editing capabilities)' : '(Full editing capabilities)'}
                </p>
              </div>
            </div>

            <div className="space-y-4">

              {/* Reviewer Comment */}
              <div className="p-4 bg-white border-l-4 border-red-500">
                <h4 className="font-bold text-red-800 mb-2">Reviewer Comments</h4>
                <p className="text-red-700">
                  {getLatestReworkRejectComment(localProject, userRole)?.comment ||
                    'No specific reason provided. Please review your submission and make necessary changes.'}
                </p>
                <p className="text-sm text-red-600 mt-2">
                  {isRejected ? 'Rejected by' : 'Feedback from'} {getLatestReworkRejectComment(localProject, userRole)?.actor_name || 'Reviewer'}
                </p>
              </div>

              {/* Existing Project Data (READ-ONLY) */}
              <div className="bg-white border-2 border-gray-300 p-4">
                <h4 className="font-bold text-gray-800 mb-3">
                  Existing Project Data
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {(localProject.delivery_date || isRework) && (

                    <div>
                      <span className="text-sm font-bold text-gray-600 block mb-1">
                        Current Delivery Date
                      </span>
                      <p className="font-medium">{localProject.delivery_date}</p>
                    </div>
                  )}

                  {localProject.edited_video_link && (
                    <div>
                      <span className="text-sm font-bold text-gray-600 block mb-1">
                        Previous Edited Video
                      </span>
                      <a
                        href={localProject.edited_video_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline break-all"
                      >
                        {localProject.edited_video_link}
                      </a>
                    </div>
                  )}

                  {localProject.video_link && (
                    <div>
                      <span className="text-sm font-bold text-gray-600 block mb-1">
                        Raw Video Link
                      </span>
                      <a
                        href={localProject.video_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline break-all"
                      >
                        {localProject.video_link}
                      </a>
                    </div>
                  )}

                  {localProject.shoot_date && (
                    <div>
                      <span className="text-sm font-bold text-gray-600 block mb-1">
                        Shoot Date
                      </span>
                      <p className="font-medium">{localProject.shoot_date}</p>
                    </div>
                  )}

                </div>
              </div>

              {/* Instruction */}
              <div className="bg-red-100 border-2 border-red-200 p-3">
                <p className="text-sm text-red-800 font-bold">
                  Please review the feedback above and submit a new edited video in the section below.
                </p>
              </div>

            </div>
          </div>
        )}

          {/* Raw Video from Cinematographer */}
          {localProject.video_link && (
            <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
              <div className="flex items-center gap-2 mb-4">
                <Video className="w-5 h-5" />
                <h2 className="text-xl font-black uppercase">Raw Video (from Cinematographer)</h2>
              </div>
              <div className="bg-blue-50 border-2 border-blue-400 p-4">
                <p className="text-sm font-bold text-blue-800 mb-2">
                  📹 Shoot Date: {localProject.shoot_date || 'Not specified'}
                </p>
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
          )}

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

          {/* Delivery Date Section */}
          {(localProject.delivery_date || localProject.assigned_to_role === Role.SUB_EDITOR || localProject.sub_editor_uploaded_at) && (
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
                      Set Delivery Date
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
          )}

          {/* Edited Video Upload Section */}
          {(localProject.delivery_date || isRework || localProject.edited_video_link || localProject.assigned_to_role === Role.SUB_EDITOR || localProject.sub_editor_uploaded_at) && (
            <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
              <div className="flex items-center gap-2 mb-4">
                <Film className="w-5 h-5" />
                <h2 className="text-xl font-black uppercase">
                  {isRejected
                    ? 'Rejected Edited Video Upload'
                    : isRework
                      ? 'Rework Edited Video Upload'
                      : 'Edited Video Upload'}
                </h2>
              </div>

              {/* Show previous edited video if exists */}
              {localProject.edited_video_link && (
                <div className="bg-gray-50 border-2 border-gray-400 p-4 mb-4">
                  <p className="text-sm font-bold uppercase text-gray-700 mb-2">
                    Previous Edited Video
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

              {/* Show input if user has edit permissions */}
              {(canEdit || !localProject.edited_video_link) && (
                <div className="space-y-4">
                  <p className="text-slate-600 font-medium">
                    {isRejected
                      ? 'Upload new edited video link for rejected project'
                      : isRework
                        ? 'Upload new edited video link for rework'
                        : 'Upload final edited video link'}
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

              {/* Delivered state ONLY for non-rework */}
              {localProject.edited_video_link && !isRework && (
                <div className="bg-green-50 border-2 border-green-600 p-4 mt-4">
                  <p className="text-sm font-bold uppercase text-green-800">
                    ✓ Edited Video Delivered
                  </p>
                  <p className="text-sm text-green-800 mt-1">
                    → Project has been moved to Designer for thumbnail creation
                  </p>
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
          )}

          {/* Project Info */}
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
              {localProject.data?.niche && (
                <div className="col-span-2">
                  <span className="font-bold text-slate-400 uppercase text-xs">Niche</span>
                  <p className="font-bold text-slate-900 mt-1 uppercase">
                    {localProject.data.niche === 'PROBLEM_SOLVING' ? 'Problem Solving'
                      : localProject.data.niche === 'SOCIAL_PROOF' ? 'Social Proof'
                        : localProject.data.niche === 'LEAD_MAGNET' ? 'Lead Magnet'
                          : localProject.data.niche === 'OTHER' && localProject.data.niche_other
                            ? localProject.data.niche_other
                            : localProject.data.niche}
                  </p>
                </div>
              )}
            </div>
          </div>
      </div>
    </main>
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
    </div>
  );
};

export default SubEditorProjectDetail;