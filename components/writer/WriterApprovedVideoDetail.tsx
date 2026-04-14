import React from 'react';
import { Project, Role, STAGE_LABELS, WorkflowStage } from '../../types';
import { ArrowLeft, Clock, User as UserIcon, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { getWorkflowState } from '../../services/workflowUtils';
import ScriptDisplay from '../ScriptDisplay';

interface Props {
    project: Project;
    onBack: () => void;
}

const WriterApprovedVideoDetail: React.FC<Props> = ({ project, onBack }) => {
    const isRejected = getWorkflowState(project).isRejected;
    const returnType = isRejected ? 'reject' : 'rework'; // Just simplified for display

    return (
        <div className="min-h-screen bg-white font-sans flex flex-col animate-fade-in">
            <header className="h-16 border-b-2 border-black flex items-center justify-between px-6 sticky top-0 bg-white/95 backdrop-blur z-20 shadow-[0_4px_0px_0px_rgba(0,0,0,0.1)]">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 border-2 border-transparent hover:border-black"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-xl font-black uppercase text-slate-900">{project.title}</h1>
                    <span className={`px-3 py-1 text-xs font-black uppercase border-2 border-black ${project.channel === 'YOUTUBE' ? 'bg-[#FF4F4F] text-white' :
                        project.channel === 'LINKEDIN' ? 'bg-[#0085FF] text-white' :
                            project.channel === 'JOBBOARD' ? 'bg-[#F59E0B] text-white' :
                                project.channel === 'LEAD_MAGNET' ? 'bg-[#10B981] text-white' :
                                    project.channel === 'INSTAGRAM' ? 'bg-[#D946EF] text-white' :
                                        'bg-black text-white'
                        }`}>
                        {project.channel}
                    </span>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto">
                <div className="max-w-5xl mx-auto p-8 space-y-8">

                    {/* Project Details */}
                    <div className="bg-white p-8 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                        <h2 className="text-2xl font-black uppercase text-slate-900 mb-6">Project Details</h2>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="font-bold text-slate-400 uppercase text-xs">Content Type</span>
                                <p className="font-bold text-slate-900 mt-1">{project.content_type}</p>
                            </div>
                            {project.channel && (
                                <div>
                                    <span className="font-bold text-slate-400 uppercase text-xs">Channel</span>
                                    <p className="font-bold text-slate-900 mt-1">{project.channel}</p>
                                </div>
                            )}
                            {project.data?.influencer_name && (
                                <div>
                                    <span className="font-bold text-slate-400 uppercase text-xs">Influencer Name</span>
                                    <p className="font-bold text-slate-900 mt-1">{project.data.influencer_name}</p>
                                </div>
                            )}
                            <div>
                                <span className="font-bold text-slate-400 uppercase text-xs">Created</span>
                                <p className="font-bold text-slate-900 mt-1">
                                    {format(new Date(project.created_at), 'MMM dd, yyyy h:mm a')}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-8 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                        <h2 className="text-2xl font-black uppercase text-slate-900 mb-6">Script Content</h2>
                        {project.data?.script_content ? (
                            <ScriptDisplay content={project.data.script_content} caption={project.data.captions} />
                        ) : (
                            <div className="p-4 bg-yellow-50 text-yellow-800 border-2 border-yellow-400 font-bold uppercase">
                                No script content available
                            </div>
                        )}
                    </div>

                    {/* Edited Video Section */}
                    <div className="bg-white p-8 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                        <h2 className="text-2xl font-black uppercase text-slate-900 mb-6">Editor Video</h2>
                        {project.edited_video_link ? (
                            <div className="bg-slate-50 p-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                <div className="flex items-start space-x-4">
                                    <div className="flex-1">
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Current Edited Video Link</label>
                                        <a href={project.edited_video_link} target="_blank" rel="noopener noreferrer" className="text-[#0085FF] font-bold hover:underline mb-2 block truncate">
                                            {project.edited_video_link}
                                        </a>
                                        {/* Auto-embed if it's a known URL format */}
                                        {project.edited_video_link.includes('youtube.com/watch') || project.edited_video_link.includes('youtu.be/') ? (
                                            <div className="aspect-video w-full border-2 border-black mt-4 bg-slate-100">
                                                <iframe
                                                    src={`https://www.youtube.com/embed/${project.edited_video_link.includes('v=') ? project.edited_video_link.split('v=')[1]?.split('&')[0] : project.edited_video_link.split('/').pop()}`}
                                                    className="w-full h-full"
                                                    allowFullScreen
                                                    title="Edited Video Preview"
                                                ></iframe>
                                            </div>
                                        ) : project.edited_video_link.match(/\.(mp4|webm|ogg)$/i) ? (
                                            <div className="aspect-video w-full border-2 border-black mt-4 bg-slate-900">
                                                <video
                                                    src={project.edited_video_link}
                                                    controls
                                                    className="w-full h-full object-contain"
                                                />
                                            </div>
                                        ) : (
                                            <div className="mt-4 p-4 bg-yellow-50 border-2 border-yellow-400 text-yellow-800 text-sm font-bold uppercase flex items-center">
                                                <span>Cannot auto-preview this link. Please click the link above to view.</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 bg-yellow-50 text-yellow-800 border-2 border-yellow-400 font-bold uppercase">
                                No edited video link provided
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};

export default WriterApprovedVideoDetail;
