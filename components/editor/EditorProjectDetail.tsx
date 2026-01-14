import React, { useState, useEffect } from 'react';
import { Project, WorkflowStage, Role, STAGE_LABELS, TaskStatus, User } from '../../types';
import { ArrowLeft, Calendar as CalendarIcon, Upload, Video, FileText, Film } from 'lucide-react';
import { format } from 'date-fns';
import { db } from '../../services/supabaseDb';
import { supabase } from '../../src/integrations/supabase/client';
import Popup from '../Popup';
import { getWorkflowState, canUserEdit, getLatestReworkRejectComment } from '../../services/workflowUtils';

interface Props {
    project: Project;
    userRole: Role;
    onBack: () => void;
    onUpdate: () => void;
}
const isReworkProject = (project: Project) =>
  project.history?.some(h =>
    h.action?.startsWith('REWORK_')
  );

const EditorProjectDetail: React.FC<Props> = ({ project, userRole, onBack, onUpdate }) => {
    // For rework projects, keep existing data but track new inputs
    const processedProject = {...project};
    
    // Local state to manage project data updates
    const [localProject, setLocalProject] = useState<Project>(project);
    const [deliveryDate, setDeliveryDate] = useState(processedProject.delivery_date || '');
    
    // Popup state
    const [showPopup, setShowPopup] = useState(false);
    const [popupMessage, setPopupMessage] = useState('');
    const [stageName, setStageName] = useState('');
    const [popupDuration, setPopupDuration] = useState(5000); // Default 5 seconds
    const [editedVideoLink, setEditedVideoLink] = useState(processedProject.edited_video_link || '');
    // Use the new workflow state logic
    const workflowState = getWorkflowState(project);
    const isRework = workflowState.isRework;
    const isRejected = workflowState.isRejected;
    
    // Determine if current user can edit based on role and workflow state
    const canEdit = canUserEdit(userRole, workflowState, project.assigned_to_role);
    
    const hasEditedVideo = !!localProject.edited_video_link;

    // State for sub-editors
    const [subEditors, setSubEditors] = useState<User[]>([]);
    const [selectedSubEditorId, setSelectedSubEditorId] = useState<string>('');

    // Sync local state with prop when it changes
    useEffect(() => {
        setLocalProject(project);
        // For rework projects, keep existing data
        const processedProject = {...project};
        setDeliveryDate(processedProject.delivery_date || '');
        setEditedVideoLink(processedProject.edited_video_link || '');
    }, [project]);
    
    // Fetch sub-editors when component mounts
    useEffect(() => {
        const fetchSubEditors = async () => {
            try {
                const subEditorList = await db.users.getSubEditors();
                setSubEditors(subEditorList);
                
                // No more direct DOM manipulation - the options will be rendered in JSX
                console.log('Fetched sub-editors:', subEditorList);  // Debug log to verify data flow
            } catch (error) {
                console.error('Failed to fetch sub-editors:', error);
            }
        };
        
        fetchSubEditors();
    }, []);

    const handleSetDeliveryDate = async () => {
        if (!deliveryDate) {
            alert('Please select a delivery date');
            return;
        }
        
        try {
            // Get user session
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            
            if (!user) {
                alert('User not authenticated');
                return;
            }
            
            // Record the action in workflow history
            await db.workflow.recordAction(
                project.id,
                project.current_stage, // stage
                user.id,
                user.email || user.id, // userName (using email or ID as fallback)
                'SUBMITTED', // Use allowed action value
                `Delivery date set to ${deliveryDate}`
            );
            
            // Update the project with the delivery date but keep it in VIDEO_EDITING stage
            // The stage only changes when the edited video is uploaded
            await db.projects.update(project.id, { delivery_date: deliveryDate });
            console.log(`Delivery date set: ${deliveryDate}`);
            
            // Show popup notification (include calendar visibility and derive stage label)
            const stageLabel = STAGE_LABELS[WorkflowStage.VIDEO_EDITING] || 'Video Editing';
            setPopupMessage(`Delivery date set for ${project.title} on ${deliveryDate}. `);
            setStageName(stageLabel);
            // For rework scenarios, use longer duration to ensure visibility
            setPopupDuration(isRework ? 10000 : 5000); // 10 seconds for rework, 5 for regular
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
        
        // Check if user has permission to edit
        if (!canEdit) {
            alert('You do not have permission to edit this project');
            return;
        }
        
        try {
            // Get user session
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            
            if (!user) {
                alert('User not authenticated');
                return;
            }
            
            // Record the action in workflow history with appropriate action type
            const actionType = isRework ? 'REWORK_EDIT_SUBMITTED' : 'SUBMITTED';
            const comment = isRework 
                ? `Rework edited video uploaded: ${editedVideoLink}` 
                : `Edited video uploaded: ${editedVideoLink}`;
            
            await db.workflow.recordAction(
                project.id,
                project.current_stage, // Record action at current stage
                user.id,
                user.email || user.id, // userName (using email or ID as fallback)
                actionType, // Use appropriate action value
                comment
            );
            
            // Update the project with the edited video link and advance the workflow
            // This will properly check thumbnail_required and route to correct stage
            await db.projects.update(project.id, { 
                edited_video_link: editedVideoLink,
                editor_uploaded_at: new Date().toISOString(), // ✅ REQUIRED
                status: TaskStatus.WAITING_APPROVAL,
                data: {
                    ...project.data,
                    needs_sub_editor: false,
                    thumbnail_required: project.data?.thumbnail_required
                }
            });
            // Update project data to persist any changes made during this session
            // Include edited_video_link in the update so timestamp logic can detect the upload
            
            
            // Advance workflow to next stage based on project settings
            await db.advanceWorkflow(project.id, comment);
            
            console.log(`${isRework ? 'Rework edited' : 'Edited'} video uploaded: ${editedVideoLink}`);
            
            // Get updated project to determine who to notify and update local state
            const updatedProject = await db.getProjectById(project.id);
            
            // Update local state with fresh data
            setLocalProject(updatedProject);
            
            // Find users to notify based on the next assigned role
            if (updatedProject?.assigned_to_role) {
                const { data: nextUsers } = await supabase
                    .from('users')
                    .select('id')
                    .eq('role', updatedProject.assigned_to_role)
                    .eq('status', 'ACTIVE');
                
                if (nextUsers && nextUsers.length > 0) {
                    // Send notification to all users of the assigned role
                    for (const nextUser of nextUsers) {
                        try {
                            // Use type assertion to access the notifications service
                            const dbWithNotifications = db as any;
                            await dbWithNotifications.notifications.create(
                                nextUser.id,
                                project.id,
                                'ASSET_UPLOADED',
                                'New Edited Video Available',
                                `${user?.user_metadata?.full_name || 'Editor'} has uploaded an edited video for: ${project.title}. Please review and proceed with ${STAGE_LABELS[updatedProject.current_stage] || updatedProject.current_stage.replace(/_/g, ' ')}.`
                            );
                        } catch (notificationError) {
                            console.error('Failed to send notification:', notificationError);
                            // Continue with the process even if notification fails
                        }
                    }
                }
            }
            
            // Show popup notification using STAGE_LABELS for the actual next stage
            const actualNextStageLabel = STAGE_LABELS[updatedProject?.current_stage || WorkflowStage.THUMBNAIL_DESIGN] || (updatedProject?.current_stage || 'Next Stage').replace(/_/g, ' ');
            const popupMessageText = isRework
                ? `Rework edited video uploaded successfully for ${project.title}. Waiting for ${actualNextStageLabel}.`
                : `Edited video uploaded successfully for ${project.title}. Waiting for ${actualNextStageLabel}.`;
            
            setPopupMessage(popupMessageText);
            setStageName(actualNextStageLabel);
            // For rework scenarios, use longer duration to ensure visibility
            setPopupDuration(isRework ? 10000 : 5000); // 10 seconds for rework, 5 for regular
            setShowPopup(true);
        } catch (error) {
            console.error('Failed to upload edited video:', error);
            alert('❌ Failed to upload edited video. Please try again.');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 animate-fade-in">
            {/* Header */}
            <div className="bg-white border-b-2 border-black sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 border-2 border-black hover:bg-slate-100 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-2xl font-black uppercase text-slate-900">{project.title}</h1>
                        <div className="flex items-center gap-3 mt-1">
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
                            <span className="text-sm text-slate-500 font-bold">
                                Due: {format(new Date(project.due_date), 'MMM dd, yyyy h:mm a')}
                            </span>
                            <span
                                className={`px-2 py-1 text-[10px] font-black uppercase border-2 border-black ${project.priority === 'HIGH'
                                        ? 'bg-red-500 text-white'
                                        : project.priority === 'NORMAL'
                                            ? 'bg-yellow-500 text-black'
                                            : 'bg-green-500 text-white'
                                    }`}
                            >
                                {project.priority}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

           {/* Rework Information Box (Shown for all rework projects assigned to Editor) */}
{(isRework || isRejected) && project.history?.length > 0 && (
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
          {getLatestReworkRejectComment(project)?.comment ||
            'No specific reason provided. Please review your submission and make necessary changes.'}
        </p>
        <p className="text-sm text-red-600 mt-2">
          {isRejected ? 'Rejected by' : 'Feedback from'} {getLatestReworkRejectComment(project)?.actor_name || 'Reviewer'}
        </p>
      </div>

      {/* Existing Project Data (READ-ONLY) */}
      <div className="bg-white border-2 border-gray-300 p-4">
        <h4 className="font-bold text-gray-800 mb-3">
          Existing Project Data
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {(project.delivery_date || isRework) && (

            <div>
              <span className="text-sm font-bold text-gray-600 block mb-1">
                Current Delivery Date
              </span>
              <p className="font-medium">{project.delivery_date}</p>
            </div>
          )}

          {project.edited_video_link && (
            <div>
              <span className="text-sm font-bold text-gray-600 block mb-1">
                Previous Edited Video
              </span>
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

          {project.video_link && (
            <div>
              <span className="text-sm font-bold text-gray-600 block mb-1">
                Raw Video Link
              </span>
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

          {project.shoot_date && (
            <div>
              <span className="text-sm font-bold text-gray-600 block mb-1">
                Shoot Date
              </span>
              <p className="font-medium">{project.shoot_date}</p>
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

            {/* Content */}
            <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
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
                        {localProject.data?.script_content || 'No script content available'}
                    </div>
                </div>
                


                {/* Delivery Date Section - Only show if project is not assigned to sub-editor */}
                {localProject.current_stage !== WorkflowStage.SUB_EDITOR_ASSIGNMENT && localProject.current_stage !== WorkflowStage.SUB_EDITOR_PROCESSING && (
                <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <CalendarIcon className="w-5 h-5" />
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
                                    className="px-8 py-4 bg-[#FF4F4F] border-2 border-black text-white font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                                >
                                    <CalendarIcon className="w-5 h-5 inline mr-2" />
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
                                <button
                                    onClick={() => setDeliveryDate('')}
                                    className="px-4 py-2 border-2 border-orange-700 text-orange-800 font-bold text-sm uppercase hover:bg-orange-100 transition-colors"
                                >
                                    Reschedule
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                )}

                {/* Status information when project is with sub-editor */}
                {localProject.current_stage === WorkflowStage.SUB_EDITOR_ASSIGNMENT || localProject.current_stage === WorkflowStage.SUB_EDITOR_PROCESSING ? (
                    <div className="bg-blue-50 border-2 border-blue-400 p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                        <div className="flex items-center gap-2 mb-4">
                            <Film className="w-5 h-5" />
                            <h2 className="text-xl font-black uppercase">Project Status</h2>
                        </div>
                        <div className="space-y-4">
                            <p className="text-slate-600 font-medium">
                                This project has been assigned to a sub-editor for video editing.
                            </p>
                            
                            <div className="bg-white border-2 border-blue-300 p-4">
                                <p className="text-sm font-bold uppercase text-blue-800 mb-1">Current Stage</p>
                                <p className="text-lg font-bold text-blue-900">{STAGE_LABELS[localProject.current_stage]}</p>
                            </div>
                            
                            <div className="bg-white border-2 border-blue-300 p-4">
                                <p className="text-sm font-bold uppercase text-blue-800 mb-1">Assigned To</p>
                                <p className="text-lg font-bold text-blue-900">Sub-Editor</p>
                            </div>
                            
                            <p className="text-sm text-slate-500 italic">
                                The editor can monitor the project status but cannot set delivery date or make changes until the sub-editor completes their work.
                            </p>
                        </div>
                    </div>
                ) : localProject.assigned_to_role === Role.EDITOR && localProject.current_stage === WorkflowStage.VIDEO_EDITING ? (
                    <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Film className="w-5 h-5" />
                            <h2 className="text-xl font-black uppercase">Assign to Sub-Editor</h2>
                        </div>
                        <div className="space-y-4">
                            <p className="text-slate-600 font-medium">
                                Select and assign this project to a sub-editor for video editing
                            </p>
                            
                            {/* Fetch and display sub-editors */}
                            <div className="mb-4">
                                <label className="block text-sm font-bold mb-2">Select Sub-Editor:</label>
                                <select 
                                    id="subEditorSelect"
                                    className="w-full p-3 border-2 border-black text-lg focus:bg-yellow-50 focus:outline-none"
                                    value={selectedSubEditorId}
                                    onChange={(e) => setSelectedSubEditorId(e.target.value)}
                                >
                                    <option value="" disabled>Select a sub-editor</option>
                                    {subEditors.map((subEditor) => (
                                        <option key={subEditor.id} value={subEditor.id}>
                                            {subEditor.full_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            
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
                                        
                                        // Use the selected sub-editor ID from React state
                                        if (!selectedSubEditorId) {
                                            alert('Please select a sub-editor');
                                            return;
                                        }
                                        
                                        // Fetch the selected sub-editor details
                                        const selectedSubEditor = await db.users.getById(selectedSubEditorId);
                                        
                                        // Record the action in workflow history
                                        await db.workflow.recordAction(
                                            localProject.id,
                                            localProject.current_stage, // stage
                                            user.id,
                                            user.email || user.id, // userName (using email or ID as fallback)
                                            'SUBMITTED', // Use allowed action value
                                            `Project assigned to sub-editor: ${selectedSubEditor.full_name}`
                                        );
                                        
                                        // Update the project to assign to sub-editor
                                        await db.projects.update(localProject.id, { 
                                            assigned_to_role: Role.SUB_EDITOR,
                                            assigned_to_user_id: selectedSubEditorId, // Assign to specific sub-editor
                                            status: TaskStatus.WAITING_APPROVAL,
                                            data: { ...localProject.data, needs_sub_editor: true } // Mark that sub-editor is needed
                                        });
                                        
                                        // Advance workflow to next stage based on project settings
                                        await db.advanceWorkflow(localProject.id, `Project assigned to sub-editor: ${selectedSubEditor.full_name}`);
                                        
                                        console.log(`Project assigned to sub-editor: ${selectedSubEditor.full_name}`);
                                        
                                        // Show popup notification
                                        setPopupMessage(`Project ${localProject.title} assigned to sub-editor: ${selectedSubEditor.full_name}.`);
                                        setStageName(STAGE_LABELS[WorkflowStage.SUB_EDITOR_ASSIGNMENT]);
                                        setPopupDuration(5000);
                                        setShowPopup(true);
                                        
                                        // Update the parent component
                                        onUpdate();
                                    } catch (error) {
                                        console.error('Failed to assign project to sub-editor:', error);
                                        alert('❌ Failed to assign project to sub-editor. Please try again.');
                                    }
                                }}
                                className="px-8 py-4 bg-[#8B5CF6] border-2 border-black text-white font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                            >
                                Assign to Selected Sub-Editor
                            </button>
                            <p className="text-sm text-slate-500">
                                📋 This will move the project to the sub-editor assignment stage
                            </p>
                        </div>
                    </div>
                ) : null}

              {/* Edited Video Upload Section */}
{(localProject.delivery_date || isRework) && (
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
    {hasEditedVideo && (
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
    {(canEdit || !hasEditedVideo) && (
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
    {hasEditedVideo && !isRework && (
      <div className="bg-green-50 border-2 border-green-600 p-4 mt-4">
        <p className="text-sm font-bold uppercase text-green-800">
          ✓ Edited Video Delivered
        </p>
        <p className="text-sm text-green-800 mt-1">
          → Project has been moved to Designer for thumbnail creation
        </p>
        {/* Show upload timestamp */}
        {localProject.editor_uploaded_at && (
          <div className="mt-3 pt-3 border-t border-green-300">
            <span className="text-xs font-bold uppercase text-green-700">Uploaded At</span>
            <p className="text-sm font-medium text-green-800">
              {format(new Date(localProject.editor_uploaded_at), 'MMM dd, yyyy h:mm a')}
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
    );
};

export default EditorProjectDetail;