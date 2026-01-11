import React, { useState, useEffect } from 'react';
import { Channel, Project, ContentType, TaskStatus, WorkflowStage, Role } from '../../types';
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
  const [title, setTitle] = useState('');
  const [channel, setChannel] = useState<Channel>(Channel.LINKEDIN);
  const [contentType, setContentType] = useState<ContentType>('CREATIVE_ONLY');
  const [description, setDescription] = useState('');

  const isRework = project?.status === 'REWORK';


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
      

    }
  }, [project]);

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
    


    setIsSubmitting(true);

    try {
      if (project) {
        // Update existing project data
        await db.updateProjectData(project.id, {
          idea_description: description,
          brief: description,
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
                
                // Determine where to send the rework based on who sent it
                if (reworkUser.role === 'CEO') {
                  targetStage = WorkflowStage.FINAL_REVIEW_CEO;
                  targetRole = 'CEO' as Role;
                } else {
                  // Default to CMO if not CEO (could be CMO or other roles)
                  targetStage = WorkflowStage.FINAL_REVIEW_CMO;
                  targetRole = 'CMO' as Role;
                }
                
                // Update the project to send it back to the appropriate reviewer
                await db.projects.update(project.id, {
                  current_stage: targetStage as WorkflowStage,
                  assigned_to_role: targetRole as Role,
                  status: TaskStatus.WAITING_APPROVAL
                });
                
                // Get current user
                const { data: { user }, error: userError } = await supabase.auth.getUser();
                if (userError || !user) {
                  throw new Error('Could not get current user');
                }
                
                // Get user details
                const { data: currentUserData, error: userDataError } = await supabase
                  .from('users')
                  .select('id, full_name, role')
                  .eq('id', user.id)
                  .single();
                
                if (userDataError || !currentUserData) {
                  throw new Error('Could not get user details');
                }
                
                // Add workflow history entry for resubmission
                await supabase.from('workflow_history').insert([{
                  project_id: project.id,
                  from_stage: project.current_stage,
                  to_stage: targetStage as WorkflowStage,
                  action: 'RESUBMITTED',
                  actor_id: currentUserData.id,
                  actor_name: currentUserData.full_name,
                  comment: 'Idea resubmitted after rework',
                  timestamp: new Date().toISOString()
                }]);
                
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
          description
        );

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
      <header className="h-20 border-b-2 border-black flex items-center justify-between px-6 bg-white shadow-sm">
        <div className="flex items-center space-x-6">
          <button onClick={onClose} className="p-3 border-2 border-transparent hover:border-black hover:bg-slate-100 rounded-full transition-all">
            <ArrowLeft className="w-6 h-6 text-black" />
          </button>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
            {project ? 'Edit Idea Project' : 'Create Idea Project'}
          </h1>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !title.trim() || !description.trim()}
            className={`px-6 py-3 border-2 border-black font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center ${(isSubmitting || !title.trim() || !description.trim()) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-[#D946EF] text-white'}`}
          >
            {isSubmitting ? 'Submitting...' : project?.data?.source === 'IDEA_PROJECT' && project.current_stage === 'FINAL_REVIEW_CEO' ? 'Submit as Script' : 'Submit to CMO'}
            <Send className="w-4 h-4 ml-2" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-slate-50 p-6 md:p-10">
        <div className="max-w-4xl mx-auto space-y-6">
          {isRework && project?.rejected_reason && (
    <div className="p-4 bg-red-50 border-l-4 border-red-500">
      <h4 className="font-black text-red-800 uppercase mb-2">
        Rework Comments from Reviewer
      </h4>
      <p className="text-red-700 whitespace-pre-wrap">
        {project.rejected_reason}
      </p>
    </div>
  )}
          <div className="bg-white p-8 border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-6">
            <h3 className="font-black uppercase text-lg text-slate-900">Idea Details</h3>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-4 border-2 border-black bg-white focus:bg-yellow-50 focus:outline-none font-bold"
                placeholder="e.g. Marketing Campaign Idea"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Channel</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.values(Channel).map(c => (
                    <button
                      key={c}
                      onClick={() => setChannel(c)}
                      className={`p-2 text-[10px] font-black uppercase border-2 border-black ${channel === c ? 'bg-black text-white' : 'bg-white hover:bg-slate-50'}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Content Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['VIDEO', 'CREATIVE_ONLY'] as ContentType[]).map(ct => (
                    <button
                      key={ct}
                      onClick={() => setContentType(ct)}
                      className={`p-2 text-xs font-black uppercase border-2 border-black ${contentType === ct ? 'bg-black text-white' : 'bg-white hover:bg-slate-50'}`}
                    >
                      {ct}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Idea Description *</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-4 border-2 border-black bg-white focus:bg-yellow-50 focus:outline-none font-medium min-h-[150px] resize-none"
                placeholder="Describe your idea in detail..."
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
        />
      )}
    </div>
  );
};

export default CreateIdeaProject;