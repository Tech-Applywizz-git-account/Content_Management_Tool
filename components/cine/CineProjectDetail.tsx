import React, { useState, useEffect } from 'react';
import { Project, WorkflowStage, Role, STAGE_LABELS } from '../../types';
import { ArrowLeft, Calendar as CalendarIcon, Upload, Video, FileText } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { db } from '../../services/supabaseDb';
import { supabase } from '../../src/integrations/supabase/client';
import Popup from '../Popup';

interface Props {
    project: Project;
    onBack: () => void;
    onUpdate: () => void;
}

const CineProjectDetail: React.FC<Props> = ({ project: initialProject, onBack, onUpdate }) => {
     // For rework projects, keep existing data but track new inputs
     const processedProject = {...initialProject};
     
     const [localProject, setLocalProject] = useState<Project>(processedProject);

     
  const [shootDate, setShootDate] = useState(processedProject.shoot_date || '');

  const [videoLink, setVideoLink] = useState(processedProject.video_link || '');
    

    
    // Popup state
    const [showPopup, setShowPopup] = useState(false);
    const [popupMessage, setPopupMessage] = useState('');
    const [stageName, setStageName] = useState('');

    // Reset form fields when project changes
    useEffect(() => {
        const processedProject = {...initialProject};
        setShootDate(processedProject.shoot_date || '');
        setVideoLink(processedProject.video_link || '');
        setLocalProject(processedProject);
    }, [initialProject]);

    const handleSetShootDate = async () => {
        if (!shootDate) {
            alert('Please select a date');
            return;
        }
        
        try {
            // Get user session
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            
            console.log('User session data:', session);
            
            if (!user) {
                alert('User not authenticated');
                return;
            }
            
            // Validate project data
            if (!localProject.id) {
                alert('Invalid project data: Missing project ID');
                return;
            }
            
            if (!localProject.current_stage) {
                alert('Invalid project data: Missing current stage');
                return;
            }
            
            console.log('Project data:', localProject);
            
            // Record the action in workflow history before updating the project
            console.log('About to record workflow history with:', {
                projectId: localProject.id,
                fromStage: localProject.current_stage,
                toStage: localProject.current_stage,
                userId: user.id,
                action: 'SUBMITTED',
                comment: `Shoot date set to ${shootDate}`
            });
            
            // Log the actual values being passed
            console.log('Actual values:');
            console.log('  project.id:', localProject.id);
            console.log('  project.current_stage:', localProject.current_stage);
            console.log('  user.id:', user.id);
            console.log('  shootDate:', shootDate);
            
            await db.workflow.recordAction(
                localProject.id,
                localProject.current_stage, // stage
                user.id,
                user.email || user.id, // userName (using email or ID as fallback)
                'SUBMITTED', // Use allowed action value
                `Shoot date set to ${shootDate}`
            );
            
            // Update the project with the shoot date but keep it in CINEMATOGRAPHY stage
            // The stage only changes when the video is uploaded
            await db.projects.update(localProject.id, { 
                shoot_date: shootDate
            });
            setLocalProject(prev => ({
  ...prev,
  shoot_date: shootDate
}));
            console.log(`Shoot date set: ${shootDate}`);
            
            // Show popup notification (use STAGE_LABELS and include calendar visibility)
            const stageLabel = STAGE_LABELS[WorkflowStage.CINEMATOGRAPHY] || 'Cinematography';
            setPopupMessage(`Shoot scheduled for ${localProject.title} on ${shootDate}.`);
            setStageName(stageLabel);
            setShowPopup(true);
        } catch (error) {
            console.error('Failed to set shoot date:', error);
            // Show more detailed error information
            if (error instanceof Error) {
                alert(`❌ Failed to set shoot date: ${error.message}\n\nPlease try again.`);
            } else {
                alert('❌ Failed to set shoot date. Please try again.');
            }
        }
    };

    const handleUploadVideo = async () => {
        if (!videoLink) {
            alert('Please enter a video link');
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
            const isRework = localProject.status === 'REJECTED';
            
            // Record the action in workflow history before updating the project
            const actionType = isRework ? 'REWORK_VIDEO_SUBMITTED' : 'SUBMITTED';
            const comment = isRework 
                ? `Rework video uploaded: ${videoLink}` 
                : `Raw video uploaded: ${videoLink}`;
            
            console.log('About to record workflow history with:', {
                projectId: localProject.id,
                fromStage: localProject.current_stage,
                toStage: WorkflowStage.VIDEO_EDITING,
                userId: user.id,
                action: actionType,
                comment: comment
            });
            
            await db.workflow.recordAction(
                localProject.id,
                WorkflowStage.VIDEO_EDITING, // stage
                user.id,
                user.email || user.id, // userName (using email or ID as fallback)
                actionType, // Use appropriate action value
                comment
            );
            
            // Update the project with the video link and move to VIDEO_EDITING stage
            // For rework, we reset the status to IN_PROGRESS
            await db.projects.update(localProject.id, { 
                video_link: videoLink,
                current_stage: WorkflowStage.VIDEO_EDITING,
                assigned_to_role: Role.EDITOR,
                status: 'IN_PROGRESS' // Reset status from REJECTED to IN_PROGRESS
            });

            // ✅ Update local state ONLY after success
            setLocalProject(prev => ({
                ...prev,
                video_link: videoLink,
                current_stage: WorkflowStage.VIDEO_EDITING,
                assigned_to_role: Role.EDITOR,
                status: 'IN_PROGRESS'
            }));

            
            // Show popup notification using STAGE_LABELS for the next stage
            const nextStageLabel = STAGE_LABELS[WorkflowStage.VIDEO_EDITING] || 'Video Editing';
            const popupMessageText = isRework
                ? `Rework video uploaded for "${localProject.title}". The project has moved to ${nextStageLabel}.`
                : `Raw video uploaded for "${localProject.title}". The project has moved to ${nextStageLabel}.`;
            
            setPopupMessage(popupMessageText);

            setStageName(nextStageLabel);
            setShowPopup(true);
        } catch (error) {
            console.error('Failed to upload video:', error);
            // Show more detailed error information
            if (error instanceof Error) {
                alert(`❌ Failed to upload video: ${error.message}\n\nPlease try again.`);
            } else {
                alert('❌ Failed to upload video. Please try again.');
            }
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
                                Due: {formatDistanceToNow(new Date(localProject.due_date))} from now
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Rework Information Box (Only shown for rejected projects assigned to Cine) */}
            {localProject.status === 'REJECTED' && localProject.assigned_to_role === Role.CINE && localProject.history && localProject.history.length > 0 && (
                <div className="bg-red-50 border-2 border-red-400 p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                    <div className="flex items-center space-x-2 mb-4">
                        <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                            <span className="text-white font-bold text-sm">!</span>
                        </div>
                        <h2 className="text-xl font-black uppercase text-red-800">Rework Required</h2>
                    </div>
                    <div className="space-y-4">
                        <div className="p-4 bg-white border-l-4 border-red-500">
                            <h4 className="font-bold text-red-800 mb-2">Reviewer Comments</h4>
                            <p className="text-red-700">
                                {localProject.history[0].comment || 'No specific reason provided. Please review your submission and make necessary changes.'}
                            </p>
                            <p className="text-sm text-red-600 mt-2">
                                Rejected by {localProject.history[0].actor_name || 'Reviewer'}
                            </p>
                        </div>
                        
                        {/* Existing Data Display */}
                        <div className="bg-white border-2 border-gray-300 p-4">
                            <h4 className="font-bold text-gray-800 mb-3">Existing Project Data</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {localProject.shoot_date && (
                                    <div>
                                        <span className="text-sm font-bold text-gray-600 block mb-1">Current Shoot Date</span>
                                        <p className="font-medium">{localProject.shoot_date}</p>
                                    </div>
                                )}
                                {localProject.video_link && (
                                    <div>
                                        <span className="text-sm font-bold text-gray-600 block mb-1">Current Video Link</span>
                                        <a 
                                            href={localProject.video_link} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:underline break-all"
                                        >
                                            {localProject.video_link}
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className="bg-red-100 border-2 border-red-200 p-3">
                            <p className="text-sm text-red-800 font-bold">
                                Please update the shoot date and/or video link below. Both old and new data will be visible for comparison.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Content */}
            <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
                {/* Script Content */}
                <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <FileText className="w-5 h-5" />
                        <h2 className="text-xl font-black uppercase">Script</h2>
                    </div>
                    <div className="bg-slate-50 border-2 border-slate-200 p-4 font-serif text-slate-900 leading-relaxed">
                        {localProject.data.script_content || 'No script content available'}
                    </div>
                </div>

                {/* Shoot Scheduling Section */}
                <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <CalendarIcon className="w-5 h-5" />
                        <h2 className="text-xl font-black uppercase">Shoot Schedule</h2>
                    </div>

                    {!localProject.shoot_date ? (
                        <div className="space-y-4">
                            <p className="text-slate-600 font-medium">Schedule a shoot date for this project</p>
                            <div className="flex gap-3">
                                <input
                                    type="date"
                                    value={shootDate}
                                    onChange={(e) => setShootDate(e.target.value)}
                                    min={new Date().toISOString().split('T')[0]}
                                    className="flex-1 p-4 border-2 border-black text-lg font-bold focus:bg-yellow-50 focus:outline-none"
                                />
                                <button
                                    onClick={handleSetShootDate}
                                    className="px-8 py-4 bg-[#4ADE80] border-2 border-black text-black font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                                >
                                    <CalendarIcon className="w-5 h-5 inline mr-2" />
                                    Set Shoot Date
                                </button>
                            </div>
                            <p className="text-sm text-slate-500">
                                📅 This date will be visible on calendars for Writer, CEO, CMO, and Operations
                            </p>
                        </div>
                    ) : (
                        <div className="bg-green-50 border-2 border-green-600 p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-bold uppercase text-green-800 mb-1">✓ Shoot Scheduled</p>
                                    <p className="text-2xl font-black text-green-900">{localProject.shoot_date}</p>
                                </div>
                               <button
  onClick={() => {
    setShootDate('');
    setLocalProject(prev => ({
      ...prev,
      shoot_date: null
    }));
  }}
  className="px-4 py-2 border-2 border-green-700 text-green-800 font-bold text-sm uppercase hover:bg-green-100 transition-colors"
>
  Reschedule
</button>

                            </div>
                        </div>
                    )}
                </div>

                {/* Video Upload Section */}
                {localProject.shoot_date && (
                    <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Upload className="w-5 h-5" />
                            <h2 className="text-xl font-black uppercase">Video Upload</h2>
                        </div>

                        {localProject.status === 'REJECTED' ? (
                            <div className="space-y-4">
                                {/* Show existing video link as read-only */}
                                {localProject.video_link && (
                                    <div className="bg-blue-50 border-2 border-blue-600 p-4">
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                <Video className="w-5 h-5 text-blue-800" />
                                                <p className="text-sm font-bold uppercase text-blue-800">Previous Video Link</p>
                                            </div>
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
                                
                                {/* Input for new video link */}
                                <div className="space-y-4">
                                    <p className="text-slate-600 font-medium">Upload the new video link for rework</p>
                                    <div className="flex gap-3">
                                        <input
                                            type="url"
                                            value={videoLink}
                                            onChange={(e) => setVideoLink(e.target.value)}
                                            placeholder="https://drive.google.com/file/d/... or https://vimeo.com/..."
                                            className="flex-1 p-4 border-2 border-black text-lg font-medium focus:bg-yellow-50 focus:outline-none"
                                        />
                                        <button
                                            onClick={handleUploadVideo}
                                            className="px-8 py-4 bg-[#0085FF] border-2 border-black text-white font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                                        >
                                            <Upload className="w-5 h-5 inline mr-2" />
                                            Submit Rework Video
                                        </button>
                                    </div>
                                    <p className="text-sm text-slate-500">
                                        🎬 Once uploaded, the Editor will be automatically notified
                                    </p>
                                </div>
                            </div>
                        ) : !localProject.video_link ? (
                            <div className="space-y-4">
                                <p className="text-slate-600 font-medium">Upload the video link after shooting</p>
                                <div className="flex gap-3">
                                    <input
                                        type="url"
                                        value={videoLink}
                                        onChange={(e) => setVideoLink(e.target.value)}
                                        placeholder="https://drive.google.com/file/d/... or https://vimeo.com/..."
                                        className="flex-1 p-4 border-2 border-black text-lg font-medium focus:bg-yellow-50 focus:outline-none"
                                    />
                                    <button
                                        onClick={handleUploadVideo}
                                        className="px-8 py-4 bg-[#0085FF] border-2 border-black text-white font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                                    >
                                        <Upload className="w-5 h-5 inline mr-2" />
                                        Upload Video
                                    </button>
                                </div>
                                <p className="text-sm text-slate-500">
                                    🎬 Once uploaded, the Editor will be automatically notified
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
                                        href={localProject.video_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block p-3 bg-white border-2 border-blue-400 text-blue-600 font-medium hover:bg-blue-50 transition-colors break-all"
                                    >
                                        {localProject.video_link}
                                    </a>
                                    <p className="text-sm text-blue-800 font-medium">
                                        → Project has been moved to Editor for video editing
                                    </p>
                                </div>
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
                                {formatDistanceToNow(new Date(localProject.created_at))} ago
                            </p>
                        </div>
                        <div>
                            <span className="font-bold text-slate-400 uppercase text-xs">Content Type</span>
                            <p className="font-bold text-slate-900 mt-1">{localProject.content_type}</p>
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

export default CineProjectDetail;