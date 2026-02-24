import React, { useState, useEffect } from 'react';
import { Channel, Project, ContentType, TaskStatus, WorkflowStage, Role, User } from '../../types';
import { db } from '../../services/supabaseDb';
import { supabase } from '../../src/integrations/supabase/client';
import { ArrowLeft, Send } from 'lucide-react';
import Popup from '../Popup';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  project?: Project;
}

const CreateIdeaProject: React.FC<Props> = ({ onClose, onSuccess, project }) => {
  const [publicUser, setPublicUser] = useState<User | null>(null);
  const [userError, setUserError] = useState<string | null>(null);

  const isRework = project?.status === 'REWORK';

  // Load public user profile on mount
  // Requirement: Fetch public.users record ONCE using the logged-in user's email
  useEffect(() => {
    const loadUser = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser?.email) {
          const { data: pUser, error: pError } = await supabase
            .from('users')
            .select('*')
            .eq('email', authUser.email)
            .single();

          if (!pError && pUser) {
            setPublicUser(pUser as User);
          } else {
            console.error('Error fetching public user:', pError);
            setUserError('User profile not found in database. Please contact support.');
          }
        }
      } catch (err) {
        console.error('Failed to load user:', err);
      }
    };
    loadUser();
  }, []);


  // Initialize form state from project data when editing
  useEffect(() => {
    if (project) {
      setTitle(project.title || '');
      setChannel(project.channel || Channel.LINKEDIN);
      setContentType(project.content_type || 'CREATIVE_ONLY');

      // Parse project data if it's a string
      let parsedData = project.data;
      if (typeof project.data === 'string') {
        try {
          parsedData = JSON.parse(project.data);
        } catch {
          parsedData = {};
        }
      }

      // Set description from idea_description or brief
      setDescription(parsedData?.idea_description || parsedData?.brief || '');

      // Set thumbnail reference link if it exists
      setThumbnailReferenceLink(parsedData?.thumbnail_reference_link || '');


    }
  }, [project]);

  const [title, setTitle] = useState('');
  const [channel, setChannel] = useState<Channel>(Channel.LINKEDIN);
  const [contentType, setContentType] = useState<ContentType>('CREATIVE_ONLY');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'HIGH' | 'NORMAL' | 'LOW'>('NORMAL');
  const [thumbnailReferenceLink, setThumbnailReferenceLink] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');
  const [stageName, setStageName] = useState('');

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      alert('Title and Description are required');
      return;
    }

    // Validate channel and content type combination
    if (channel === Channel.LINKEDIN && contentType === 'VIDEO') {
      alert('LinkedIn does not support video content. Please select a different channel or change content type to Creative Only.');
      return;
    }

    // HARD GUARD: Prevent submission if publicUser.id is missing
    if (!publicUser?.id) {
      alert('User profile not loaded. Please refresh and try again.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (project) {
        // Update existing project data
        await db.updateProjectData(project.id, {
          idea_description: description,
          brief: description,
          thumbnail_reference_link: thumbnailReferenceLink,
        });

        // Update project metadata
        await db.projects.update(project.id, {
          title,
          channel,
          content_type: contentType,
        });

        // If this is a rework project, route it back to the reviewer who requested rework
        if (project.status === 'REWORK') {
          // Fetch workflow history to determine who sent for rework
          const { data: history, error: historyError } = await supabase
            .from('workflow_history')
            .select('actor_id, action, comment, timestamp')
            .eq('project_id', project.id)
            .order('timestamp', { ascending: false });

          if (!historyError && history && history.length > 0) {
            // Find the most recent REWORK action
            const reworkHistory = history.find(h => h.action === 'REWORK');

            if (reworkHistory) {
              // Get the actor's role to determine where to send it back
              const { data: reworkUser, error: userError } = await supabase
                .from('users')
                .select('role')
                .eq('id', reworkHistory.actor_id)
                .single();

              if (!userError && reworkUser) {
                let targetStage: WorkflowStage, targetRole: Role;


                // ✅ Route based on WHO sent for rework, not current user role
                if (reworkUser && reworkUser.role === 'CEO') {
                  // If CEO sent for rework, go directly back to CEO
                  targetStage = WorkflowStage.FINAL_REVIEW_CEO;
                  targetRole = 'CEO' as Role;
                } else {
                  // Otherwise (CMO or others), go to CMO
                  targetStage = WorkflowStage.FINAL_REVIEW_CMO;
                  targetRole = 'CMO' as Role;
                }

                // Update the project to send it back to the appropriate reviewer
                await db.projects.update(project.id, {
                  current_stage: targetStage as WorkflowStage,
                  assigned_to_role: targetRole as Role,
                  status: TaskStatus.WAITING_APPROVAL
                });

                // Add workflow history entry for resubmission
                await db.workflow.recordAction(
                  project.id,
                  targetStage as WorkflowStage,
                  publicUser.id,
                  publicUser.full_name,
                  'SUBMITTED',
                  'Idea resubmitted after rework',
                  undefined,
                  Role.WRITER, // fromRole
                  targetRole as Role, // toRole
                  publicUser.role as Role // actorRole
                );

                setPopupMessage(`Idea project "${title}" resubmitted successfully. Waiting for ${(targetStage as string).includes('CEO') ? 'CEO' : 'CMO'} review.`);
                setStageName((targetStage as string).includes('CEO') ? 'Final Review (CEO)' : 'Final Review (CMO)');
              }
            }
          } else {
            // If we can't determine who sent for rework, use advanceWorkflow
            await db.advanceWorkflow(project.id, 'Idea resubmitted after rework');
            setPopupMessage(`Idea project "${title}" resubmitted successfully. Waiting for review.`);
            setStageName('Idea Resubmitted');
          }
        } else {
          setPopupMessage(`Idea project "${title}" updated successfully.`);
          setStageName('Idea Updated');
        }

        setShowPopup(true);

        setTimeout(() => {
          onSuccess();
        }, 1500);
      } else {
        // Create a new idea project that starts at the FINAL_REVIEW_CMO stage
        const createdProject = await db.createIdeaProject(
          title,
          channel,
          contentType,
          description,
          priority
        );

        // Update the project data to include the thumbnail reference link
        await db.updateProjectData(createdProject.id, {
          thumbnail_reference_link: thumbnailReferenceLink,
        });

        setPopupMessage(`Idea project "${title}" created successfully. Waiting for CMO review.`);
        setStageName('Final Review (CMO)');
        setShowPopup(true);

        setTimeout(() => {
          onSuccess();
        }, 1500);
      }
    } catch (error) {
      console.error('Failed to process idea project:', error);
      alert(project ? 'Failed to update idea project' : 'Failed to create idea project');
      setIsSubmitting(false);
    }
  };



  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col animate-fade-in-up font-sans">
      {/* Header */}
      <header className="min-h-[4.5rem] md:h-20 border-b-2 border-black flex items-center justify-between px-3 md:px-6 bg-white shadow-sm gap-2">
        <div className="flex items-center space-x-2 md:space-x-6 overflow-hidden">
          <button onClick={onClose} className="p-2 md:p-3 border-2 border-transparent hover:border-black hover:bg-slate-100 rounded-full transition-all flex-shrink-0">
            <ArrowLeft className="w-5 h-5 md:w-6 md:h-6 text-black" />
          </button>
          <h1 className="text-base md:text-2xl font-black text-slate-900 uppercase tracking-tight truncate">
            {project ? 'Edit Idea' : 'Create Idea'}
          </h1>
        </div>
        <div className="flex items-center space-x-2 md:space-x-4 flex-shrink-0">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !title.trim() || !description.trim()}
            className={`px-3 md:px-6 py-2 md:py-3 border-2 border-black font-black uppercase text-xs md:text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] md:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center ${(isSubmitting || !title.trim() || !description.trim()) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-[#D946EF] text-white'}`}
          >
            <span className="inline">
              {isSubmitting ? '...' : (
                <>
                  <span className="hidden sm:inline">
                    {project?.data?.source === 'IDEA_PROJECT' && project.current_stage === 'FINAL_REVIEW_CEO' ? 'Submit as Script' : 'Submit to CMO'}
                  </span>
                  <span className="sm:hidden">
                    Submit
                  </span>
                </>
              )}
            </span>
            <Send className="w-4 h-4 ml-1 md:ml-2" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-10">
        <div className="max-w-4xl mx-auto space-y-6">
          {isRework && (
            <div className="p-4 bg-red-50 border-l-4 border-red-500">
              <h4 className="font-black text-red-800 uppercase text-xs md:text-sm mb-2">
                Rework Comments
              </h4>
              <p className="text-red-700 text-sm md:text-base whitespace-pre-wrap">
                {(() => {
                  // Get the rework comment from workflow history instead of project.rejected_reason
                  const reworkHistory = project.history?.find(h => h.action === 'REWORK');
                  return reworkHistory?.comment || 'No specific reason provided.';
                })()}
              </p>
            </div>
          )}
          <div className="bg-white p-5 md:p-8 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-4 md:space-y-6">
            <h3 className="font-black uppercase text-base md:text-lg text-slate-900 border-b-2 border-slate-100 pb-2">Idea Details</h3>

            <div>
              <label className="block text-[10px] md:text-xs font-bold uppercase text-slate-500 mb-2">Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-3 md:p-4 border-2 border-black bg-white focus:bg-yellow-50 focus:outline-none font-bold text-sm md:text-base"
                placeholder="e.g. Campaign Idea"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Channel</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.values(Channel).map(c => {
                    const colors: Record<string, string> = {
                      LINKEDIN: 'bg-[#0A66C2] border-[#0A66C2]',
                      YOUTUBE: 'bg-[#FF0000] border-[#FF0000]',
                      INSTAGRAM: 'bg-gradient-to-tr from-[#405DE6] via-[#E1306C] to-[#FFDC80] border-[#E1306C]'
                    };
                    return (
                      <button
                        key={c}
                        onClick={() => setChannel(c)}
                        className={`p-2 text-[10px] font-black uppercase border-2 transition-all ${channel === c
                          ? `${colors[c] || 'bg-black border-black'} text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)]`
                          : 'bg-white border-black hover:bg-slate-50'
                          }`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Content Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['VIDEO', 'CREATIVE_ONLY'] as ContentType[]).map(ct => {
                    const colors: Record<string, string> = {
                      VIDEO: 'bg-[#0085FF] border-[#0085FF]',
                      CREATIVE_ONLY: 'bg-[#D946EF] border-[#D946EF]'
                    };
                    return (
                      <button
                        key={ct}
                        onClick={() => setContentType(ct)}
                        className={`p-2 text-[10px] font-black uppercase border-2 transition-all ${contentType === ct
                          ? `${colors[ct] || 'bg-black border-black'} text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)]`
                          : 'bg-white border-black hover:bg-slate-50'
                          }`}
                      >
                        {ct === 'CREATIVE_ONLY' ? '🎨 Creative' : '📹 Video'}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] md:text-xs font-bold uppercase text-slate-500 mb-2">Idea Description *</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-3 md:p-4 border-2 border-black bg-white focus:bg-yellow-50 focus:outline-none font-medium min-h-[150px] md:min-h-[200px] resize-none text-sm md:text-base"
                placeholder="Describe your idea in detail..."
              />
            </div>

            {/* Thumbnail Reference Link */}
            <div>
              <label className="block text-[10px] md:text-xs font-bold uppercase text-slate-500 mb-2">Reference Thumbnail (Optional)</label>
              <input
                type="text"
                value={thumbnailReferenceLink}
                onChange={(e) => setThumbnailReferenceLink(e.target.value)}
                className="w-full p-3 md:p-4 border-2 border-black bg-white focus:bg-yellow-50 focus:outline-none text-sm md:text-base"
                placeholder="Paste thumbnail link"
              />
            </div>

            <div>
              <label className="block text-[10px] md:text-xs font-bold uppercase text-slate-500 mb-2">Priority</label>
              <div className="grid grid-cols-3 gap-2">
                {(['LOW', 'NORMAL', 'HIGH'] as const).map(p => {
                  const colors: Record<string, string> = {
                    HIGH: 'bg-[#FF3131] border-[#FF3131]',
                    NORMAL: 'bg-[#FFB800] border-[#FFB800]',
                    LOW: 'bg-[#00D1FF] border-[#00D1FF]'
                  };
                  return (
                    <button
                      key={p}
                      onClick={() => setPriority(p)}
                      className={`p-2 text-[10px] md:text-xs font-bold uppercase border-2 transition-all ${priority === p
                        ? `${colors[p] || 'bg-black border-black'} text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)]`
                        : 'bg-white border-black hover:bg-slate-50'
                        }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
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
};

export default CreateIdeaProject;