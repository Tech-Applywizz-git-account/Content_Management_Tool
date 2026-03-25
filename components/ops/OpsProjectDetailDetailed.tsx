import React, { useState, useEffect } from 'react';
import { Project, TaskStatus, WorkflowStage, STAGE_LABELS, Role } from '../../types';
import { format } from 'date-fns';
import { ArrowLeft, Calendar, Link as LinkIcon, Video, Image, FileText, Upload, CheckCircle, User, Eye } from 'lucide-react';
import { db } from '../../services/supabaseDb';
import { supabase } from '../../src/integrations/supabase/client';
import Popup from '../Popup';
import Timeline from '../Timeline';
import { decodeHtmlEntities } from '../../utils/htmlDecoder';

interface Props {
    project: Project;
    onBack: () => void;
    onUpdate: () => void;
    hideCreatorInfo?: boolean;
    hideProjectMeta?: boolean;
}

const OpsProjectDetailDetailed: React.FC<Props> = ({ project, onBack, onUpdate, hideCreatorInfo, hideProjectMeta }) => {
    const [showPopup, setShowPopup] = useState(false);
    const [popupMessage, setPopupMessage] = useState('');
    const [stageName, setStageName] = useState('');

    // Listen for beforeLogout event to close detail view automatically
    useEffect(() => {
        const handleBeforeLogout = () => {
            console.log('Closing ops project detail before logout...');
            onBack();
        };

        window.addEventListener('beforeLogout', handleBeforeLogout);
        return () => {
            window.removeEventListener('beforeLogout', handleBeforeLogout);
        };
    }, []);

    const isVideo = project.content_type === 'VIDEO' || project.content_type === 'APPLYWIZZ_USA_JOBS';
    const isPosted = project.data?.live_url || project.status === 'DONE';

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={onBack}
                    className="p-2 border-2 border-black hover:bg-slate-100"
                >
                    <ArrowLeft size={24} />
                </button>
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 text-xs font-bold border-2 border-black ${project.channel === 'LINKEDIN' ? 'bg-blue-100 text-blue-800' :
                            project.channel === 'YOUTUBE' ? 'bg-red-100 text-red-800' :
                                'bg-purple-100 text-purple-800'
                            }`}>
                            {project.channel}
                        </span>
                        <span className="text-sm text-slate-600">
                            {isVideo ? '🎬 VIDEO' : '🎨 CREATIVE'}
                        </span>
                        <span className={`px-2 py-0.5 text-xs font-bold border-2 border-black ${project.priority === 'HIGH' ? 'bg-red-500 text-white' :
                            project.priority === 'NORMAL' ? 'bg-yellow-500 text-black' :
                                'bg-green-500 text-white'
                            }`}>
                            {project.priority}
                        </span>
                    </div>
                    <h1 className="text-3xl font-black uppercase text-slate-900">{project.title}</h1>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Project Details and Content */}
                <div className="space-y-6">
                    {/* Project Information */}
                    <div className="border-2 border-black p-6 bg-white">
                        <h2 className="text-xl font-black uppercase mb-4 text-slate-900 flex items-center gap-2">
                            <FileText size={20} className="text-blue-600" />
                            Project Information
                        </h2>

                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="font-bold text-slate-500">Current Stage:</span>
                                <span className="font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded">
                                    {project.current_stage?.replace(/_/g, ' ') || 'Unknown'}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-bold text-slate-500">Assigned To:</span>
                                <span className="font-bold text-slate-900">{project.assigned_to_role}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-bold text-slate-500">Status:</span>
                                <span className={`font-bold px-2 py-1 rounded ${project.status === 'DONE' ? 'bg-green-100 text-green-800' :
                                    project.status === 'WAITING_APPROVAL' ? 'bg-amber-100 text-amber-800' :
                                        project.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                                            'bg-slate-100 text-slate-800'
                                    }`}>
                                    {project.status}
                                </span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-slate-200">
                                <span className="font-bold text-slate-500">Brand:</span>
                                <span className="font-black text-[#0085FF] uppercase">{project.brand?.replace(/_/g, ' ') || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-bold text-slate-500">Niche:</span>
                                <span className="font-bold text-slate-900 uppercase">
                                    {project.data?.niche === 'PROBLEM_SOLVING' ? 'Problem Solving'
                                        : project.data?.niche === 'SOCIAL_PROOF' ? 'Social Proof'
                                            : project.data?.niche === 'LEAD_MAGNET' ? 'Lead Magnet'
                                                : project.data?.niche === 'CAPTION_BASED' ? 'Caption Based'
                                                    : project.data?.niche === 'OTHER' && project.data?.niche_other
                                                        ? project.data?.niche_other
                                                        : project.data?.niche || 'N/A'}
                                </span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-slate-200">
                                <span className="font-bold text-slate-500">Writer:</span>
                                <span className="font-bold text-slate-900">{project.writer_name || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-bold text-slate-500">Editor:</span>
                                <span className="font-bold text-slate-900">{project.editor_name || 'N/A'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Script/Caption Content */}
                    {project.data?.script_content && (
                        <div className="border-2 border-black p-6 bg-white">
                            <h2 className="text-xl font-black uppercase mb-4 text-slate-900 flex items-center gap-2">
                                <FileText size={20} className="text-green-600" />
                                Script / Caption
                            </h2>
                            <div className="p-4 bg-slate-50 border border-slate-300 rounded max-h-60 overflow-y-auto overflow-x-auto">
                                {project.data.script_content ? (
                                    <div dangerouslySetInnerHTML={{ __html: decodeHtmlEntities(project.data.script_content) }} />
                                ) : <p className="text-slate-700 whitespace-pre-wrap">No content available</p>}
                            </div>
                        </div>
                    )}


                </div>



                {/* Right Column - Media Content */}
                <div className="space-y-6">
                    {/* Final Content Preview */}
                    <div className="border-2 border-black p-6 bg-white">
                        <h2 className="text-xl font-black uppercase mb-4 text-slate-900 flex items-center gap-2">
                            <Eye size={20} className="text-red-600" />
                            Final Content Preview
                        </h2>

                        {isVideo ? (
                            <>
                                {/* Raw Video */}
                                {project.video_link && (
                                    <div className="space-y-2 mb-4">
                                        <label className="block text-sm font-bold text-slate-700">{['JOBBOARD', 'LEAD_MAGNET', 'APPLYWIZZ_USA_JOBS'].includes(project.content_type) ? 'Shoot Video' : 'Shoot Video'}:</label>
                                        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-300">
                                            <Video size={20} className="text-blue-600" />
                                            <a
                                                href={project.video_link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 underline text-sm truncate"
                                            >
                                                {project.video_link}
                                            </a>
                                        </div>
                                    </div>
                                )}

                                {/* Edited Video */}
                                {project.edited_video_link && (
                                    <div className="space-y-2 mb-4">
                                        <label className="block text-sm font-bold text-slate-700">Edited Video:</label>
                                        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-300">
                                            <Video size={20} className="text-green-600" />
                                            <a
                                                href={project.edited_video_link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-green-600 underline text-sm truncate"
                                            >
                                                {project.edited_video_link}
                                            </a>
                                        </div>
                                    </div>
                                )}

                                {/* Thumbnail */}
                                {project.thumbnail_link && (
                                    <div className="space-y-2">
                                        <label className="block text-sm font-bold text-slate-700">Thumbnail:</label>
                                        <div className="flex items-center gap-2 p-3 bg-purple-50 border border-purple-300">
                                            <Image size={20} className="text-purple-600" />
                                            <a
                                                href={project.thumbnail_link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-purple-600 underline text-sm truncate"
                                            >
                                                {project.thumbnail_link}
                                            </a>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            /* Creative Content */
                            project.creative_link && (
                                <div className="space-y-2">
                                    <label className="block text-sm font-bold text-slate-700">Creative Design:</label>
                                    <div className="flex items-center gap-2 p-3 bg-purple-50 border border-purple-300">
                                        <Image size={20} className="text-purple-600" />
                                        <a
                                            href={project.creative_link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-purple-600 underline text-sm truncate"
                                        >
                                            {project.creative_link}
                                        </a>
                                    </div>
                                </div>
                            )
                        )}
                    </div>

                    {/* Project Status */}
                    <div className="border-2 border-black p-6 bg-slate-50">
                        <h3 className="font-black uppercase text-sm text-slate-700 mb-3">Project Status</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-slate-600">Priority:</span>
                                <span className={`font-bold ${project.priority === 'HIGH' ? 'text-red-600' : 'text-slate-900'}`}>
                                    {project.priority}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-600">Due Date:</span>
                                <span className="font-bold text-slate-900">
                                    {format(new Date(project.due_date), 'MMM dd, yyyy')}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-600">Status:</span>
                                <span className={`font-bold ${isPosted ? 'text-green-600' : 'text-amber-600'}`}>
                                    {isPosted ? 'POSTED' : project.post_scheduled_date ? 'SCHEDULED' : 'READY'}
                                </span>
                            </div>
                            {project.post_scheduled_date && (
                                <div className="flex justify-between">
                                    <span className="text-slate-600">Scheduled:</span>
                                    <span className="font-bold text-blue-600">
                                        {format(new Date(project.post_scheduled_date), 'MMM dd, yyyy')}
                                    </span>
                                </div>
                            )}
                            {project.data?.live_url && (
                                <div className="flex justify-between">
                                    <span className="text-slate-600">Live URL:</span>
                                    <a
                                        href={project.data.live_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-bold text-green-600 underline truncate max-w-32"
                                    >
                                        View Post
                                    </a>
                                </div>
                            )}
                        </div>
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

export default OpsProjectDetailDetailed;