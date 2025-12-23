import React, { useState, useEffect } from 'react';
import { Project, WorkflowStage, Role, STAGE_LABELS } from '../../types';
import { ArrowLeft, Calendar as CalendarIcon, Upload, Video, FileText, Film } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { db } from '../../services/supabaseDb';
import { supabase } from '../../src/integrations/supabase/client';
import Popup from '../Popup';

interface Props {
    project: Project;
    onBack: () => void;
    onUpdate: () => void;
}
const isReworkProject = (project: Project) =>
  project.history?.some(h =>
    h.action === 'REJECTED' ||
    h.action?.startsWith('REWORK_')
  );

const EditorProjectDetail: React.FC<Props> = ({ project, onBack, onUpdate }) => {
    // For rework projects, keep existing data but track new inputs
    const processedProject = {...project};
    
    const [deliveryDate, setDeliveryDate] = useState(processedProject.delivery_date || '');
    
    // Popup state
    const [showPopup, setShowPopup] = useState(false);
    const [popupMessage, setPopupMessage] = useState('');
    const [stageName, setStageName] = useState('');
    const [editedVideoLink, setEditedVideoLink] = useState(processedProject.edited_video_link || '');
    const isRework = isReworkProject(project);
const hasEditedVideo = !!project.edited_video_link;


    // Reset form fields when project changes
    useEffect(() => {
        // For rework projects, keep existing data
        const processedProject = {...project};
        setDeliveryDate(processedProject.delivery_date || '');
        setEditedVideoLink(processedProject.edited_video_link || '');
    }, [project]);

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
        
        try {
            // Get user session
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            
            if (!user) {
                alert('User not authenticated');
                return;
            }
            
            // Determine if this is a rework submission based on project status
        
            
            // Record the action in workflow history with appropriate action type
            const actionType = isRework ? 'REWORK_EDIT_SUBMITTED' : 'SUBMITTED';
            const comment = isRework 
                ? `Rework edited video uploaded: ${editedVideoLink}` 
                : `Edited video uploaded: ${editedVideoLink}`;
            
            await db.workflow.recordAction(
                project.id,
                WorkflowStage.THUMBNAIL_DESIGN, // stage
                user.id,
                user.email || user.id, // userName (using email or ID as fallback)
                actionType, // Use appropriate action value
                comment
            );
            
            // Update the project with the edited video link and move to THUMBNAIL_DESIGN stage
            // For rework, we reset the status to IN_PROGRESS
            await db.projects.update(project.id, { 
                edited_video_link: editedVideoLink,
                current_stage: WorkflowStage.THUMBNAIL_DESIGN,
                assigned_to_role: Role.DESIGNER,
                status: 'IN_PROGRESS' // Reset status from REJECTED to IN_PROGRESS
            });
            console.log(`${isRework ? 'Rework edited' : 'Edited'} video uploaded: ${editedVideoLink}`);
            
            // Show popup notification using STAGE_LABELS for the next stage
            const nextStage = STAGE_LABELS[WorkflowStage.THUMBNAIL_DESIGN] || 'Thumbnail Design';
            const popupMessageText = isRework
                ? `Rework edited video uploaded successfully for ${project.title}. Waiting for ${nextStage}.`
                : `Edited video uploaded successfully for ${project.title}. Waiting for ${nextStage}.`;
            
            setPopupMessage(popupMessageText);
            setStageName(nextStage);
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
                                Due: {formatDistanceToNow(new Date(project.due_date))} from now
                            </span>
                        </div>
                    </div>
                </div>
            </div>

           {/* Rework Information Box (Shown for all rework projects assigned to Editor) */}
{isRework && project.assigned_to_role === Role.EDITOR && project.history?.length > 0 && (
  <div className="bg-red-50 border-2 border-red-400 p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
    
    {/* Header */}
    <div className="flex items-center space-x-2 mb-4">
      <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
        <span className="text-white font-bold text-sm">!</span>
      </div>
      <h2 className="text-xl font-black uppercase text-red-800">
        Rework Required
      </h2>
    </div>

    <div className="space-y-4">

      {/* Reviewer Comment */}
      <div className="p-4 bg-white border-l-4 border-red-500">
        <h4 className="font-bold text-red-800 mb-2">Reviewer Comments</h4>
        <p className="text-red-700">
          {project.history[0]?.comment ||
            'No specific reason provided. Please review your submission and make necessary changes.'}
        </p>
        <p className="text-sm text-red-600 mt-2">
          Rejected by {project.history[0]?.actor_name || 'Reviewer'}
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
                {project.video_link && (
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

                {/* Script Reference */}
                <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <FileText className="w-5 h-5" />
                        <h2 className="text-xl font-black uppercase">Script Reference</h2>
                    </div>
                    <div className="bg-slate-50 border-2 border-slate-200 p-4 font-serif text-slate-900 leading-relaxed">
                        {project.data.script_content || 'No script content available'}
                    </div>
                </div>

                {/* Delivery Date Section */}
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
                            <p className="text-sm text-slate-500">
                                📅 This date will be visible on calendars for all team members
                            </p>
                        </div>
                    ) : (
                        <div className="bg-orange-50 border-2 border-orange-600 p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-bold uppercase text-orange-800 mb-1">✓ Delivery Scheduled</p>
                                    <p className="text-2xl font-black text-orange-900">{project.delivery_date}</p>
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

              {/* Edited Video Upload Section */}
{(project.delivery_date || isRework) && (
  <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
    <div className="flex items-center gap-2 mb-4">
      <Film className="w-5 h-5" />
      <h2 className="text-xl font-black uppercase">
        {isRework ? 'Rework Edited Video Upload' : 'Edited Video Upload'}
      </h2>
    </div>

    {/* Show previous edited video if exists */}
    {hasEditedVideo && (
      <div className="bg-gray-50 border-2 border-gray-400 p-4 mb-4">
        <p className="text-sm font-bold uppercase text-gray-700 mb-2">
          Previous Edited Video
        </p>
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

    {/* ALWAYS show input for REWORK */}
    {(isRework || !hasEditedVideo) && (
      <div className="space-y-4">
        <p className="text-slate-600 font-medium">
          {isRework
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
            {isRework ? 'Submit Rework Edit' : 'Upload'}
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
                                {formatDistanceToNow(new Date(project.created_at))} ago
                            </p>
                        </div>
                        <div>
                            <span className="font-bold text-slate-400 uppercase text-xs">Content Type</span>
                            <p className="font-bold text-slate-900 mt-1">{project.content_type}</p>
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

export default EditorProjectDetail;