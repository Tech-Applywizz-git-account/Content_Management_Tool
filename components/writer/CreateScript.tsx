
import React, { useState, useEffect } from 'react';
import { Project, ProjectData, Channel, Role, ContentType, WorkflowStage, STAGE_LABELS } from '../../types';
import Popup from '../Popup';
import { db } from '../../services/supabaseDb';
import { supabase } from '../../src/integrations/supabase/client';
import { ArrowLeft, Save, Send, Image as ImageIcon, Link as LinkIcon, FileText } from 'lucide-react';

interface Props {
    project?: Project; // If editing existing draft
    onClose: () => void;
    onSuccess: () => void;
    creatorRole?: Role; // WRITER or CMO
}

const CreateScript: React.FC<Props> = ({ project, onClose, onSuccess, creatorRole }) => {
    const [formData, setFormData] = useState<ProjectData>(project?.data || {});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [reviewComment, setReviewComment] = useState<any>(null);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const currentUser = db.getCurrentUser();


    const [newProjectDetails, setNewProjectDetails] = useState({
        title: project?.title || '',
        channel: project?.channel || Channel.LINKEDIN,
        contentType: project?.content_type || ('VIDEO' as ContentType),
        dueDate: project?.due_date || new Date().toISOString().split('T')[0]
    });

    // Listen for beforeLogout event to save changes automatically
    useEffect(() => {
        const handleBeforeLogout = () => {
            console.log('Saving draft before logout...');
            handleSaveDraft();
        };

        window.addEventListener('beforeLogout', handleBeforeLogout);
        return () => {
            window.removeEventListener('beforeLogout', handleBeforeLogout);
        };
    }, [formData, newProjectDetails, project]);

    // Fetch reviewer comments for rejected projects
    useEffect(() => {
        const fetchReviewComment = async () => {
            if (project?.id && project.status === 'REJECTED') {
                try {
                    const { data, error } = await supabase
                        .from('workflow_history')
                        .select('actor_name, comment, timestamp')
                        .eq('project_id', project.id)
                        .eq('action', 'REJECTED')
                        .order('timestamp', { ascending: false })
                        .limit(1);

                    if (error) {
                        console.error('Error fetching review comment:', error);
                    } else if (data && data.length > 0) {
                        setReviewComment(data[0]);
                    }
                } catch (err) {
                    console.error('Error fetching review comment:', err);
                }
            }
        };

        fetchReviewComment();
    }, [project]);

    const handleSaveDraft = async () => {
        console.log('🚀 Starting save draft process');
        if (project) {
            console.log('Updating existing project data...');
            try {
                await db.updateProjectData(project.id, {
                    ...formData,
                    writer_id: currentUser?.id,
                    writer_name: currentUser?.full_name
                });
                console.log('✅ Project data updated successfully');
            } catch (error: any) {
                console.error('Failed to update project data:', error);
                // Don't show alert during auto-save on logout
                if (!window.location.href.includes('logout')) {
                    alert(`Failed to update project: ${error.message || 'Unknown error occurred'}`);
                }
            }
        } else {
            try {
                console.log('Creating new project...');
                const createdProject = await db.createProject(
                    newProjectDetails.title,
                    newProjectDetails.channel,
                    newProjectDetails.dueDate,
                    newProjectDetails.contentType
                );
                console.log('Created project with ID:', createdProject.id);
                await db.updateProjectData(createdProject.id, {
                    ...formData,
                    writer_id: currentUser?.id,
                    writer_name: currentUser?.full_name
                });
                console.log('✅ Project data saved successfully');
            } catch (error: any) {
                console.error('Failed to create project:', error);
                // Don't show alert during auto-save on logout
                if (!window.location.href.includes('logout')) {
                    alert(`Failed to save draft: ${error.message || 'Unknown error occurred'}`);
                }
            }
        }
        console.log('✅ Save draft completed');
        onSuccess('draft_saved'); // This will trigger a refresh in the parent component
    };

        // Popup state for submit
        const [showPopup, setShowPopup] = useState(false);
        const [popupMessage, setPopupMessage] = useState('');
        const [stageName, setStageName] = useState('');
        const [popupDuration, setPopupDuration] = useState<number>(5000);

        const handleSubmit = async () => {
  setIsSubmitting(true);
  console.log('🚀 Starting submit process');

  try {
    let realProjectId = project?.id;

    // 1️⃣ CREATE PROJECT FIRST (if new)
    if (!realProjectId) {
      const createdProject = await db.createProject(
        newProjectDetails.title,
        newProjectDetails.channel,
        newProjectDetails.dueDate,
        newProjectDetails.contentType
      );

      if (!createdProject?.id) {
        throw new Error('Project creation failed – no ID returned');
      }

      realProjectId = createdProject.id;
    }

    // 2️⃣ HARD SAFETY CHECK
    if (!realProjectId) {
      throw new Error('Cannot submit project without valid project ID');
    }

    // 3️⃣ SAVE SCRIPT + CREATOR INFO (ONCE)
    const creatorData = {
      ...formData,
    };
    
    if (creatorRole === Role.CMO) {
      // Store CMO information
      creatorData.cmo_id = currentUser.id;
      creatorData.cmo_name = currentUser.full_name;
    } else {
      // Default to Writer information
      creatorData.writer_id = currentUser.id;
      creatorData.writer_name = currentUser.full_name;
    }
    
    await db.updateProjectData(realProjectId, creatorData);

    // 4️⃣ SUBMIT WORKFLOW
    // If CMO is creating the script, submit directly to CEO (skip CMO review)
    if (creatorRole === Role.CMO) {
      await db.submitToFinalReview(realProjectId, Role.CEO);
      console.log('✅ Successfully submitted to CEO');
    } else {
      await db.submitToReview(realProjectId);
      console.log('✅ Successfully submitted to CMO');
    }

    // Show popup after successful DB operation
    let nextStageLabel, creatorLabel;
    if (creatorRole === Role.CMO) {
      nextStageLabel = STAGE_LABELS[WorkflowStage.SCRIPT_REVIEW_L2] || 'Script Review (CEO)';
      creatorLabel = 'CMO';
      setPopupMessage(`${creatorLabel} script submitted successfully. Waiting for ${nextStageLabel}.`);
    } else {
      nextStageLabel = STAGE_LABELS[WorkflowStage.SCRIPT_REVIEW_L1] || 'Script Review (CMO)';
      creatorLabel = 'Writer';
      setPopupMessage(`${creatorLabel} script submitted successfully. Waiting for ${nextStageLabel}.`);
    }
    
    setStageName(nextStageLabel);
    setPopupDuration(5000);
    setShowPopup(true);

    await onSuccess(); // refresh dashboard immediately
    
  } catch (err: any) {
    console.error('❌ Submit failed:', err);
    const errorMessage = creatorRole === Role.CMO ? 'Failed to submit to CEO' : 'Failed to submit to CMO';
    alert(err.message || errorMessage);
  } finally {
    setIsSubmitting(false);
  }
};

    

    return (
        <div className="fixed inset-0 bg-white z-50 flex flex-col animate-fade-in-up font-sans">
            {/* Header */}
            <header className="h-20 border-b-2 border-black flex items-center justify-between px-6 bg-white shadow-sm">
                <div className="flex items-center space-x-6">
                    <button onClick={onClose} className="p-3 border-2 border-transparent hover:border-black hover:bg-slate-100 rounded-full transition-all">
                        <ArrowLeft className="w-6 h-6 text-black" />
                    </button>
                    <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                        {project ? `Edit: ${project.title}` : 'New Script'}
                    </h1>
                </div>
                <div className="flex items-center space-x-4">
                    <button
                        onClick={handleSaveDraft}
                        className="px-6 py-3 border-2 border-black text-black font-black uppercase hover:bg-slate-100 transition-colors flex items-center shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] active:translate-y-[2px] active:shadow-none"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        Draft
                    </button>
                    <button
                        onClick={() => setShowConfirmation(true)}
                        disabled={isSubmitting}
                        className="px-6 py-3 bg-[#0085FF] border-2 border-black text-white font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center"
                    >
                        {isSubmitting ? 'Sending...' : creatorRole === Role.CMO ? 'Submit to CEO' : 'Submit to CMO'}
                        <Send className="w-4 h-4 ml-2" />
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto bg-slate-50 p-6 md:p-10">
                <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Left Col: Details */}
                    <div className="lg:col-span-1 space-y-6">
                        {!project && (
                            <div className="bg-white p-8 border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-6">
                                <h3 className="font-black uppercase text-lg text-slate-900">Project Info</h3>
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Title</label>
                                    <input
                                        type="text"
                                        value={newProjectDetails.title}
                                        onChange={e => setNewProjectDetails({ ...newProjectDetails, title: e.target.value })}
                                        className="w-full p-4 border-2 border-black bg-white focus:bg-yellow-50 focus:outline-none font-bold"
                                        placeholder="e.g. Q4 Updates"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Channel</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {Object.values(Channel).map(c => (
                                            <button
                                                key={c}
                                                onClick={() => setNewProjectDetails({ ...newProjectDetails, channel: c })}
                                                className={`p-2 text-[10px] font-black uppercase border-2 border-black ${newProjectDetails.channel === c ? 'bg-black text-white' : 'bg-white hover:bg-slate-50'}`}
                                            >
                                                {c}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Content Type</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => setNewProjectDetails({ ...newProjectDetails, contentType: 'VIDEO' })}
                                            className={`p-3 text-xs font-black uppercase border-2 border-black ${newProjectDetails.contentType === 'VIDEO' ? 'bg-[#0085FF] text-white' : 'bg-white hover:bg-slate-50'
                                                }`}
                                        >
                                            📹 Video
                                        </button>
                                        <button
                                            onClick={() => setNewProjectDetails({ ...newProjectDetails, contentType: 'CREATIVE_ONLY' })}
                                            className={`p-3 text-xs font-black uppercase border-2 border-black ${newProjectDetails.contentType === 'CREATIVE_ONLY' ? 'bg-[#D946EF] text-white' : 'bg-white hover:bg-slate-50'
                                                }`}
                                        >
                                            🎨 Creative Only
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="bg-white p-8 border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                            <h3 className="font-black uppercase text-lg text-slate-900 mb-4">Brief / Notes</h3>
                            <textarea
                                value={formData.brief || ''}
                                onChange={e => setFormData({ ...formData, brief: e.target.value })}
                                className="w-full p-4 border-2 border-black rounded-none text-sm min-h-[200px] focus:bg-yellow-50 focus:outline-none font-medium resize-none"
                                placeholder="What is the goal of this content?"
                            />
                        </div>
                        {/* REWORK COMMENTS (ONLY FOR REJECTED PROJECTS) */}
                        {project?.status === 'REJECTED' && (
                          <div className="bg-red-50 p-8 border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                            <h3 className="font-black uppercase text-lg text-red-700 mb-4">
                              Reviewer Comments
                            </h3>

                            {reviewComment ? (
                              <div className="space-y-2">
                                <p className="font-bold text-slate-900">
                                  {reviewComment.actor_name || 'Reviewer'}
                                  <span className="ml-2 text-xs uppercase text-red-600">
                                    (REWORK REQUIRED)
                                  </span>
                                </p>

                                <p className="text-slate-700 whitespace-pre-wrap">
                                  {reviewComment.comment}
                                </p>
                              </div>
                            ) : (
                              <p className="text-sm text-slate-500">
                                No comments provided by the reviewer.
                              </p>
                            )}
                          </div>
                        )}
                    </div>


                    {/* Right Col: Editor */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white p-8 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] min-h-[700px] flex flex-col">
                            <div className="border-b-2 border-black pb-4 mb-6 flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    <div className="w-3 h-3 rounded-full border-2 border-black bg-red-400"></div>
                                    <div className="w-3 h-3 rounded-full border-2 border-black bg-yellow-400"></div>
                                    <div className="w-3 h-3 rounded-full border-2 border-black bg-green-400"></div>
                                </div>
                                <span className="font-black uppercase text-xs text-slate-400">Rich Text Editor</span>
                            </div>

                            <textarea
                                value={formData.script_content || ''}
                                onChange={e => setFormData({ ...formData, script_content: e.target.value })}
                                className="flex-1 w-full p-2 outline-none text-lg leading-relaxed resize-none font-serif text-slate-900 placeholder:font-sans placeholder:text-slate-300"
                                placeholder="Start writing your script here..."
                            />
                        </div>
                    </div>
                </div>
            </div>
            {showPopup && (
                <Popup
                    message={popupMessage}
                    stageName={stageName}
                    onClose={() => setShowPopup(false)}
                    duration={popupDuration}
                />
            )}
            
            {/* Confirmation Popup */}
            {showConfirmation && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-8 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-md w-full mx-4">
                        <h3 className="text-2xl font-black uppercase mb-4">Confirm Submission</h3>
                        <p className="mb-6">Are you sure you want to submit this script?</p>
                        <div className="flex space-x-4">
                            <button
                                onClick={() => setShowConfirmation(false)}
                                className="flex-1 px-4 py-3 border-2 border-black text-black font-black uppercase hover:bg-slate-100 transition-colors"
                            >
                                No
                            </button>
                            <button
                                onClick={() => {
                                    setShowConfirmation(false);
                                    handleSubmit();
                                }}
                                className="flex-1 px-4 py-3 bg-[#0085FF] border-2 border-black text-white font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                            >
                                Yes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CreateScript;