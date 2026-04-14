import React, { useState } from 'react';
import { Project, Role, TaskStatus, WorkflowStage, STAGE_LABELS } from '../../types';
import { Clock, MessageSquare, Send, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { db } from '../../services/supabaseDb';
import ScriptDisplay from '../ScriptDisplay';
import Popup from '../Popup';

interface WriterCaptionsProps {
    user: { id: string; full_name: string; role: Role };
    projects: Project[];
    onRefresh: () => Promise<void>;
}

const WriterCaptions: React.FC<WriterCaptionsProps> = ({ user, projects, onRefresh }) => {
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [caption, setCaption] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [showPopup, setShowPopup] = useState(false);
    const [popupMessage, setPopupMessage] = useState('');
    const [stageName, setStageName] = useState('');

    // Filter projects that need captions:
    // 1. Created by this writer
    // 2. Beyond SCRIPT and SCRIPT_REVIEW_L1 stages
    // 3. Status is not DONE
    // 4. Captions field is empty
    const captionNeededProjects = projects.filter(p => 
        p.created_by_user_id === user.id &&
        !!p.cmo_approved_at &&
        p.status !== TaskStatus.DONE &&
        (!p.data?.captions || p.data.captions.trim() === '')
    ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const handleSaveCaption = async (projectId: string) => {
        if (!caption.trim()) {
            alert('Please enter a caption');
            return;
        }

        try {
            setIsSaving(true);
            await db.updateProjectData(projectId, { captions: caption });
            
            setPopupMessage('Caption saved successfully! It will now be visible in all review screens.');
            setStageName('Caption Added');
            setShowPopup(true);
            
            // Clear selection and refresh
            setSelectedProject(null);
            setCaption('');
            await onRefresh();
        } catch (error) {
            console.error('Failed to save caption:', error);
            alert('Failed to save caption. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    if (selectedProject) {
        return (
            <div className="space-y-6 animate-fade-in">
                <button
                    onClick={() => setSelectedProject(null)}
                    className="flex items-center text-sm font-black text-slate-700 hover:text-slate-900 py-2 px-4 bg-gray-100 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
                >
                    ← Back to List
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left: Project Script & Info */}
                    <div className="space-y-6">
                        <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <h2 className="text-2xl font-black uppercase mb-4">{selectedProject.title}</h2>
                            <div className="flex flex-wrap gap-2 mb-4">
                                <span className="px-2 py-1 text-[10px] font-black uppercase border-2 border-black bg-blue-100 text-blue-800">
                                    {STAGE_LABELS[selectedProject.current_stage]}
                                </span>
                                <span className={`px-2 py-1 text-[10px] font-black uppercase border-2 border-black ${
                                    selectedProject.channel === 'YOUTUBE' ? 'bg-[#FF4F4F] text-white' :
                                    selectedProject.channel === 'LINKEDIN' ? 'bg-[#0085FF] text-white' :
                                    'bg-black text-white'
                                }`}>
                                    {selectedProject.channel}
                                </span>
                            </div>
                            
                            <h3 className="text-sm font-bold text-slate-500 uppercase mb-2">Script Content</h3>
                            <div className="max-h-[500px] overflow-y-auto border-2 border-slate-100 p-4 bg-slate-50">
                                <ScriptDisplay 
                                    content={selectedProject.data?.script_content || selectedProject.data?.idea_description || ''} 
                                    showBox={false} 
                                />
                            </div>
                        </div>
                    </div>

                    {/* Right: Caption Input */}
                    <div className="space-y-6">
                        <div className="bg-yellow-50 p-8 border-2 border-dashed border-yellow-400 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] sticky top-24">
                            <div className="flex items-center space-x-2 mb-6">
                                <MessageSquare className="w-6 h-6 text-yellow-600" />
                                <h3 className="text-xl font-black uppercase text-yellow-900">Write Caption</h3>
                            </div>

                            <p className="text-sm font-bold text-yellow-800 uppercase italic mb-4">
                                Add a compelling caption, hashtags, and mentions for this post.
                            </p>

                            <textarea
                                value={caption}
                                onChange={(e) => setCaption(e.target.value)}
                                placeholder="Paste or type your caption here..."
                                className="w-full p-4 border-2 border-black text-base min-h-[300px] focus:bg-white focus:outline-none font-medium resize-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all bg-white/50"
                            />

                            <div className="mt-8 flex justify-end">
                                <button
                                    onClick={() => handleSaveCaption(selectedProject.id)}
                                    disabled={isSaving || !caption.trim()}
                                    className="flex items-center space-x-2 px-8 py-4 bg-black text-white font-black uppercase text-sm border-2 border-black shadow-[4px_4px_0px_0px_rgba(255,217,82,1)] hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-50"
                                >
                                    <Send className="w-4 h-4" />
                                    <span>{isSaving ? 'Saving...' : 'Submit Caption'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {showPopup && (
                    <Popup
                        message={popupMessage}
                        stageName={stageName}
                        onClose={() => setShowPopup(false)}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col gap-2">
                <h2 className="text-3xl font-black uppercase text-slate-900">Write Captions</h2>
                <p className="text-slate-500 font-bold uppercase text-sm">Action Items: {captionNeededProjects.length} Projects</p>
            </div>

            {captionNeededProjects.length === 0 ? (
                <div className="bg-slate-50 border-2 border-dashed border-slate-300 p-16 text-center">
                    <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                    <h3 className="text-2xl font-black uppercase text-slate-400">All Captions Completed!</h3>
                    <p className="text-slate-500 font-medium">Great job! You have no pending captions to write.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {captionNeededProjects.map(p => (
                        <div 
                            key={p.id}
                            onClick={() => {
                                setSelectedProject(p);
                                setCaption('');
                            }}
                            className="bg-white p-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer group"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <span className={`px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black ${
                                    p.channel === 'YOUTUBE' ? 'bg-[#FF4F4F] text-white' :
                                    p.channel === 'LINKEDIN' ? 'bg-[#0085FF] text-white' :
                                    'bg-black text-white'
                                }`}>
                                    {p.channel}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-black transition-colors">
                                    Click to Write
                                </span>
                            </div>
                            
                            <h4 className="font-black text-xl text-slate-900 mb-2 uppercase group-hover:text-[#D946EF] transition-colors line-clamp-2">
                                {p.title}
                            </h4>

                            <div className="flex items-center text-xs font-bold text-slate-500 uppercase mt-4 space-x-4">
                                <div className="flex items-center">
                                    <Clock className="w-3 h-3 mr-1" />
                                    {format(new Date(p.created_at), 'MMM dd')}
                                </div>
                                <div className="flex items-center text-blue-600 font-black">
                                    {STAGE_LABELS[p.current_stage]}
                                </div>
                            </div>
                            
                            <div className="mt-4 pt-4 border-t-2 border-slate-100 flex justify-end">
                                <button className="bg-black text-white px-4 py-2 text-xs font-black uppercase border-2 border-black group-hover:bg-[#D946EF] transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                    Write Now
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showPopup && (
                <Popup
                    message={popupMessage}
                    stageName={stageName}
                    onClose={() => setShowPopup(false)}
                />
            )}
        </div>
    );
};

export default WriterCaptions;
