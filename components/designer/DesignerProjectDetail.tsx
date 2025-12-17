import React, { useState } from 'react';
import { Project, WorkflowStage, Role, STAGE_LABELS } from '../../types';
import { ArrowLeft, Calendar as CalendarIcon, Upload, Video, FileText, FileImage, Palette } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { db } from '../../services/supabaseDb';
import { supabase } from '../../src/integrations/supabase/client';
import Popup from '../Popup';

interface Props {
    project: Project;
    onBack: () => void;
    onUpdate: () => void;
}

const DesignerProjectDetail: React.FC<Props> = ({ project, onBack, onUpdate }) => {
    const [deliveryDate, setDeliveryDate] = useState(project.delivery_date || '');
    
    // Popup state
    const [showPopup, setShowPopup] = useState(false);
    const [popupMessage, setPopupMessage] = useState('');
    const [stageName, setStageName] = useState('');
    const [thumbnailLink, setThumbnailLink] = useState(project.thumbnail_link || '');
    const [creativeLink, setCreativeLink] = useState(project.creative_link || '');

    const isVideo = project.content_type === 'VIDEO';

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
            
            // Update the project with the delivery date but keep it in current stage
            // The stage only changes when the file is uploaded
            await db.projects.update(project.id, { delivery_date: deliveryDate });
            console.log(`Delivery date set: ${deliveryDate}`);
            
            // Show popup notification (include calendar visibility and derive stage label)
            const stageLabel = isVideo ? STAGE_LABELS[WorkflowStage.THUMBNAIL_DESIGN] : STAGE_LABELS[WorkflowStage.CREATIVE_DESIGN];
            setPopupMessage(`Delivery date set for ${project.title} on ${deliveryDate}. This date will be visible on calendars for all team members.`);
            setStageName(stageLabel || (isVideo ? 'Thumbnail Design' : 'Creative Design'));
            setShowPopup(true);
        } catch (error) {
            console.error('Failed to set delivery date:', error);
            alert('❌ Failed to set delivery date. Please try again.');
        }
    };

    const handleUploadFile = async () => {
        const link = isVideo ? thumbnailLink : creativeLink;
        if (!link) {
            alert(`Please enter the ${isVideo ? 'thumbnail' : 'creative'} link`);
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
                WorkflowStage.FINAL_REVIEW_CMO, // stage
                user.id,
                user.email || user.id, // userName (using email or ID as fallback)
                'SUBMITTED', // Use allowed action value
                `${isVideo ? 'Thumbnail' : 'Creative'} uploaded: ${link}`
            );
            
            // Update the project with the file link and move to FINAL_REVIEW_CMO stage
            const updates: Partial<Project> = {
                current_stage: WorkflowStage.FINAL_REVIEW_CMO,
                assigned_to_role: Role.CMO
            };
            
            if (isVideo) {
                updates.thumbnail_link = link;
            } else {
                updates.creative_link = link;
            }
            
            await db.projects.update(project.id, updates);
            
            console.log(`${isVideo ? 'Thumbnail' : 'Creative'} uploaded: ${link}`);
            
            // Show popup notification using STAGE_LABELS for the next stage
            const nextLabel = STAGE_LABELS[WorkflowStage.FINAL_REVIEW_CMO] || 'CMO Final Review';
            setPopupMessage(`${isVideo ? 'Thumbnail' : 'Creative'} uploaded successfully for ${project.title}. Waiting for ${nextLabel}.`);
            setStageName(nextLabel);
            setShowPopup(true);
        } catch (error) {
            console.error(`Failed to upload ${isVideo ? 'thumbnail' : 'creative'}:`, error);
            alert(`❌ Failed to upload ${isVideo ? 'thumbnail' : 'creative'}. Please try again.`);
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
                            <span
                                className={`px-2 py-1 text-[10px] font-black uppercase border-2 border-black ${isVideo ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                                    }`}
                            >
                                {isVideo ? '🎬 Thumbnail Task' : '🎨 Creative Task'}
                            </span>
                            <span className="text-sm text-slate-500 font-bold">
                                Due: {formatDistanceToNow(new Date(project.due_date))} from now
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
                {/* Edited Video (for thumbnail tasks) */}
                {isVideo && project.edited_video_link && (
                    <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Video className="w-5 h-5" />
                            <h2 className="text-xl font-black uppercase">Edited Video (from Editor)</h2>
                        </div>
                        <div className="bg-blue-50 border-2 border-blue-400 p-4">
                            <p className="text-sm font-bold text-blue-800 mb-2">
                                🎬 Create a thumbnail for this video
                            </p>
                            <a
                                href={project.edited_video_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block p-3 bg-white border-2 border-blue-400 text-blue-600 font-medium hover:bg-blue-50 transition-colors break-all"
                            >
                                {project.edited_video_link}
                            </a>
                        </div>
                    </div>
                )}

                {/* Script Reference */}
                <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <FileText className="w-5 h-5" />
                        <h2 className="text-xl font-black uppercase">
                            {isVideo ? 'Script Reference' : 'Content Brief'}
                        </h2>
                    </div>
                    <div className="bg-slate-50 border-2 border-slate-200 p-4 font-serif text-slate-900 leading-relaxed">
                        {project.data.script_content || 'No content available'}
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
                            <p className="text-slate-600 font-medium">
                                Set when you'll deliver the {isVideo ? 'thumbnail' : 'creative'}
                            </p>
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
                                    className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 border-2 border-black text-white font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
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
                        <div className="bg-purple-50 border-2 border-purple-600 p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-bold uppercase text-purple-800 mb-1">✓ Delivery Scheduled</p>
                                    <p className="text-2xl font-black text-purple-900">{project.delivery_date}</p>
                                </div>
                                <button
                                    onClick={() => setDeliveryDate('')}
                                    className="px-4 py-2 border-2 border-purple-700 text-purple-800 font-bold text-sm uppercase hover:bg-purple-100 transition-colors"
                                >
                                    Reschedule
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Upload Section */}
                {project.delivery_date && (
                    <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
                        <div className="flex items-center gap-2 mb-4">
                            {isVideo ? <FileImage className="w-5 h-5" /> : <Palette className="w-5 h-5" />}
                            <h2 className="text-xl font-black uppercase">
                                {isVideo ? 'Thumbnail Upload' : 'Creative Upload'}
                            </h2>
                        </div>

                        {!(isVideo ? project.thumbnail_link : project.creative_link) ? (
                            <div className="space-y-4">
                                <p className="text-slate-600 font-medium">
                                    Upload the {isVideo ? 'thumbnail image' : 'creative file'} link
                                </p>
                                <div className="flex gap-3">
                                    <input
                                        type="url"
                                        value={isVideo ? thumbnailLink : creativeLink}
                                        onChange={(e) => (isVideo ? setThumbnailLink : setCreativeLink)(e.target.value)}
                                        placeholder={`https://drive.google.com/${isVideo ? 'thumbnail' : 'creative'}.${isVideo ? 'jpg' : 'pdf'}`}
                                        className="flex-1 p-4 border-2 border-black text-lg font-medium focus:bg-yellow-50 focus:outline-none"
                                    />
                                    <button
                                        onClick={handleUploadFile}
                                        className="px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 border-2 border-black text-white font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                                    >
                                        <Upload className="w-5 h-5 inline mr-2" />
                                        Upload
                                    </button>
                                </div>
                                <p className="text-sm text-slate-500">
                                    ✨ Once uploaded, CMO will be automatically notified for final review
                                </p>
                            </div>
                        ) : (
                            <div className="bg-green-50 border-2 border-green-600 p-4">
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        {isVideo ? <FileImage className="w-5 h-5 text-green-800" /> : <Palette className="w-5 h-5 text-green-800" />}
                                        <p className="text-sm font-bold uppercase text-green-800">
                                            ✓ {isVideo ? 'Thumbnail' : 'Creative'} Delivered
                                        </p>
                                    </div>
                                    <a
                                        href={isVideo ? project.thumbnail_link : project.creative_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block p-3 bg-white border-2 border-green-400 text-green-600 font-medium hover:bg-green-50 transition-colors break-all"
                                    >
                                        {isVideo ? project.thumbnail_link : project.creative_link}
                                    </a>
                                    <p className="text-sm text-green-800 font-medium">
                                        → Project has been moved to CMO for final review
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

export default DesignerProjectDetail;