import React, { useState, useEffect } from 'react';
import { Project, Role, TaskStatus, WorkflowStage } from '../../types';
import { db } from '../../services/supabaseDb';
import { supabase } from '../../src/integrations/supabase/client';
import { format } from 'date-fns';
import { ArrowLeft, Calendar, Upload, Video, FileText, Clock } from 'lucide-react';
import { getWorkflowState, canUserEdit } from '../../services/workflowUtils';

interface Props {
  project: Project;
  userRole: Role;
  onBack: () => void;
  onUpdate: () => void;
  onLogout?: () => void;
}

const SubEditorProjectDetail: React.FC<Props> = ({ project: initialProject, userRole, onBack, onUpdate, onLogout }) => {
  const [localProject, setLocalProject] = useState<Project>(initialProject);
  const [deliveryDate, setDeliveryDate] = useState(initialProject.delivery_date || '');
  const [editedVideoLink, setEditedVideoLink] = useState(initialProject.edited_video_link || '');
  const [loading, setLoading] = useState(false);

  // Use the new workflow state logic
  const workflowState = getWorkflowState(localProject);
  const isRework = workflowState.isRework;
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
        'SUB_EDITOR_DELIVERY_DATE',
        `Delivery date set to ${deliveryDate}`
      );

      // Update the project with the delivery date
      await db.projects.update(localProject.id, {
        delivery_date: deliveryDate,
        current_stage: WorkflowStage.SUB_EDITOR_PROCESSING,
        assigned_to_role: Role.SUB_EDITOR,
        status: TaskStatus.IN_PROGRESS
      });

      // Update local state
      setLocalProject(prev => ({
        ...prev,
        delivery_date: deliveryDate,
        current_stage: WorkflowStage.SUB_EDITOR_PROCESSING,
        assigned_to_role: Role.SUB_EDITOR,
        status: TaskStatus.IN_PROGRESS
      }));

      console.log(`Delivery date set: ${deliveryDate}`);
      alert('Delivery date updated successfully');
      onUpdate();
    } catch (error) {
      console.error('Failed to set delivery date:', error);
      alert('❌ Failed to set delivery date. Please try again.');
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
        user.email || user.id, // userName (using email or ID as fallback)
        actionType, // Use appropriate action value
        comment
      );

      // Update the project with the edited video link and advance the workflow
      await db.projects.update(localProject.id, {
        edited_video_link: editedVideoLink,
        status: TaskStatus.DONE,
        data: { ...localProject.data, needs_sub_editor: false, thumbnail_required: localProject.data?.thumbnail_required } // Mark that sub-editor work is complete
      });

      // Update project data to persist any changes made during this session
      // Include edited_video_link in the update so timestamp logic can detect the upload
      await db.updateProjectData(localProject.id, {
        ...localProject.data,
        edited_video_link: editedVideoLink,
        needs_sub_editor: false,
        thumbnail_required: localProject.data?.thumbnail_required
      });

      // Advance workflow to next stage based on project settings using the helper logic
      await db.advanceWorkflow(localProject.id, comment);

      // Update local state
      setLocalProject(prev => ({
        ...prev,
        edited_video_link: editedVideoLink,
        status: TaskStatus.DONE
      }));

      console.log(`${isRework ? 'Rework edited' : 'Edited'} video uploaded: ${editedVideoLink}`);
      alert('Video uploaded successfully!');
      onUpdate();
    } catch (error) {
      console.error('Failed to upload edited video:', error);
      alert('❌ Failed to upload edited video. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
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
          <button
            onClick={onLogout}
            className="px-4 py-2 bg-red-500 text-white font-black uppercase border-2 border-black hover:bg-red-600 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
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
              <span className="font-bold text-slate-400 uppercase text-xs">Current Stage</span>
              <p className="font-bold text-slate-900 mt-1">{localProject.current_stage?.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <span className="font-bold text-slate-400 uppercase text-xs">Assigned To</span>
              <p className="font-bold text-slate-900 mt-1">{localProject.assigned_to_role}</p>
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
          </div>
        </div>

        {/* Script Content */}
        {localProject.data?.script_content && (
          <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5" />
              <h2 className="text-xl font-black uppercase">Script</h2>
            </div>
            <div className="bg-slate-50 border-2 border-slate-200 p-4 font-serif text-slate-900 leading-relaxed">
              {localProject.data.script_content}
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

        {/* Delivery Date Section - Only show if project is assigned to Sub-Editor */}
        {localProject.assigned_to_role === Role.SUB_EDITOR && (
          <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5" />
              <h2 className="text-xl font-black uppercase">Delivery Schedule</h2>
            </div>

            {!localProject.delivery_date ? (
              <div className="space-y-4">
                <p className="text-slate-600 font-medium">Set a delivery date for this project</p>
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
                    className="px-8 py-4 bg-[#4ADE80] border-2 border-black text-black font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Calendar className="w-5 h-5 inline mr-2" />
                    {loading ? 'Setting...' : 'Set Delivery Date'}
                  </button>
                </div>
                <p className="text-sm text-slate-500">
                  📅 This date will be visible to the Writer and other stakeholders
                </p>
              </div>
            ) : (
              <div className="bg-green-50 border-2 border-green-600 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold uppercase text-green-800 mb-1">✓ Delivery Scheduled</p>
                    <p className="text-2xl font-black text-green-900">{localProject.delivery_date}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Video Upload Section - Only show if project is assigned to Sub-Editor */}
        {localProject.assigned_to_role === Role.SUB_EDITOR && (
          <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
            <div className="flex items-center gap-2 mb-4">
              <Upload className="w-5 h-5" />
              <h2 className="text-xl font-black uppercase">Video Upload</h2>
            </div>

            {(canEdit) ? (
              <div className="space-y-4">
                {/* Show existing video link as reference */}
                {localProject.edited_video_link && (
                  <div className="bg-blue-50 border-2 border-blue-600 p-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Video className="w-5 h-5 text-blue-800" />
                        <p className="text-sm font-bold uppercase text-blue-800">Previous Video Link</p>
                      </div>
                      <a
                        href={localProject.edited_video_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-3 bg-white border-2 border-blue-400 text-blue-600 font-medium hover:bg-blue-50 transition-colors break-all"
                      >
                        {localProject.edited_video_link}
                      </a>
                    </div>
                  </div>
                )}

                {/* Input for new video link */}
                <div className="space-y-4">
                  <p className="text-slate-600 font-medium">
                    {isRejected ? 'Upload the new video link for rejected project' :
                      isRework ? 'Upload the new video link for rework' :
                        'Upload the edited video link after editing'}
                  </p>
                  <div className="flex gap-3">
                    <input
                      type="url"
                      value={editedVideoLink}
                      onChange={(e) => setEditedVideoLink(e.target.value)}
                      placeholder="https://drive.google.com/file/d/... or https://vimeo.com/..."
                      className="flex-1 p-4 border-2 border-black text-lg font-medium focus:bg-yellow-50 focus:outline-none"
                    />
                    <button
                      onClick={handleUploadEditedVideo}
                      disabled={loading}
                      className="px-8 py-4 bg-[#0085FF] border-2 border-black text-white font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Upload className="w-5 h-5 inline mr-2" />
                      {loading ? 'Uploading...' : (isRejected ? 'Submit Rejected Video' : isRework ? 'Submit Rework Video' : 'Upload Video')}
                    </button>
                  </div>
                  <p className="text-sm text-slate-500">
                    🎬 Once uploaded, the next responsible person will be automatically notified
                  </p>
                </div>
              </div>
            ) : !localProject.edited_video_link ? (
              <div className="space-y-4">
                <p className="text-slate-600 font-medium">Upload the edited video link after completing editing</p>
                <div className="flex gap-3">
                  <input
                    type="url"
                    value={editedVideoLink}
                    onChange={(e) => setEditedVideoLink(e.target.value)}
                    placeholder="https://drive.google.com/file/d/... or https://vimeo.com/..."
                    className="flex-1 p-4 border-2 border-black text-lg font-medium focus:bg-yellow-50 focus:outline-none"
                  />
                  <button
                    onClick={handleUploadEditedVideo}
                    disabled={loading}
                    className="px-8 py-4 bg-[#0085FF] border-2 border-black text-white font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Upload className="w-5 h-5 inline mr-2" />
                    Upload Video
                  </button>
                </div>
                <p className="text-sm text-slate-500">
                  🎬 Once uploaded, the next responsible person will be automatically notified
                </p>
              </div>
            ) : (
              <div className="bg-blue-50 border-2 border-blue-600 p-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Video className="w-5 h-5 text-blue-800" />
                    <p className="text-sm font-bold uppercase text-blue-800">✓ Video Uploaded</p>
                  </div>
                  <a
                    href={localProject.edited_video_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 bg-white border-2 border-blue-400 text-blue-600 font-medium hover:bg-blue-50 transition-colors break-all"
                  >
                    {localProject.edited_video_link}
                  </a>
                  <p className="text-sm text-blue-800 font-medium">
                    → Project has been moved to the next stage
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SubEditorProjectDetail;