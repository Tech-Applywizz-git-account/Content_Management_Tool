
import React, { useState, useEffect } from 'react';
import { Project, ProjectData, Channel, Role, ContentType, WorkflowStage, STAGE_LABELS, TaskStatus, Priority } from '../../types';
import Popup from '../Popup';
import { db } from '../../services/supabaseDb';
import { supabase } from '../../src/integrations/supabase/client';
import { ArrowLeft, Save, Send, Image as ImageIcon, Link as LinkIcon, FileText, X } from 'lucide-react';
import { getWorkflowState } from '../../services/workflowUtils';

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
    const [previousScript, setPreviousScript] = useState<string | null>(null);
    const [returnType, setReturnType] = useState<'rework' | 'reject' | null>(null); // 'rework' or 'reject'
    const currentUser = db.getCurrentUser();
      
    // Ensure we have a current user
    if (!currentUser) {
      throw new Error('No current user found. Please log in again.');
    }


    const [newProjectDetails, setNewProjectDetails] = useState({
        title: project?.title || '',
        channel: project?.channel || '', // No default selection
        contentType: project?.content_type || '', // No default selection
        dueDate: project?.due_date || new Date().toISOString().split('T')[0],
        priority: project?.priority || ('Normal' as Priority)
    });
    
    // State for validation error
    const [validationError, setValidationError] = useState<string | null>(null);
    
    // Helper function to check if project was sent back from CEO after CMO approval
    const wasProjectSentBackFromCEO = async (projectId: string | undefined) => {
      if (!projectId) return false;
      
      try {
        const { data: historyData, error: historyError } = await supabase
          .from('workflow_history')
          .select('actor_id, action, from_stage, to_stage, timestamp')
          .eq('project_id', projectId)
          .order('timestamp', { ascending: false });
          
        if (historyError || !historyData) {
          console.error('Error fetching workflow history:', historyError);
          return false;
        }
        
        // Check if the project was sent back for rework by a CEO
        // Find if there was a REWORK or REJECT action by a CEO
        const ceoReworkHistory = historyData.find(history => 
          (history.action === 'REWORK' || history.action === 'REJECTED')
        );
        
        if (ceoReworkHistory) {
          // Check if the actor was a CEO by fetching their role
          try {
            const { data: userData, error } = await supabase
              .from('users')
              .select('role')
              .eq('id', ceoReworkHistory.actor_id)
              .single();
            
            if (!error && userData && userData.role === 'CEO') {
              return true;
            }
          } catch (err) {
            console.error('Error checking user role:', err);
          }
        }
        
        return false;
      } catch (error) {
        console.error('Error checking if project was sent back from CEO:', error);
        return false;
      }
    };
    
    // Helper function to submit project directly to CEO
    const submitDirectlyToCEO = async (projectId: string) => {
      try {
        await db.projects.update(projectId, {
          current_stage: WorkflowStage.SCRIPT_REVIEW_L2,
          assigned_to_role: Role.CEO,
          status: TaskStatus.WAITING_APPROVAL
        });
        
        // Add workflow history entry
        const project = await db.getProjectById(projectId);
        await supabase.from('workflow_history').insert([{
          project_id: projectId,
          from_stage: project?.current_stage || WorkflowStage.SCRIPT,
          to_stage: WorkflowStage.SCRIPT_REVIEW_L2,
          action: 'SUBMITTED',
          actor_id: currentUser.id,
          actor_name: currentUser.full_name,
          comment: 'Resubmitted after CEO rework',
          timestamp: new Date().toISOString()
        }]);
      } catch (error) {
        console.error('Error submitting directly to CEO:', error);
        throw error;
      }
    };
    
    // Check for invalid channel/content type combinations and thumbnail requirement
    useEffect(() => {
        if (newProjectDetails.channel === Channel.LINKEDIN && newProjectDetails.contentType === 'VIDEO') {
            setValidationError('LinkedIn does not support video content. Please select a different channel or change content type to Creative Only.');
        } else if (newProjectDetails.contentType === 'VIDEO' && formData.thumbnail_required === undefined) {
            setValidationError('Thumbnail requirement must be specified for video content.');
        } else {
            setValidationError(null);
        }
    }, [newProjectDetails.channel, newProjectDetails.contentType, formData.thumbnail_required]);

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

    // Fetch reviewer comments and previous script for rework/rejected projects
    useEffect(() => {
        const fetchReviewData = async () => {
            if (project?.id) {
                try {
                    // Use the new workflow state logic to determine the latest action
                    const workflowState = getWorkflowState(project);
                    
                    // Determine return type based on the latest action
                    if (workflowState.isRejected) {
                        setReturnType('reject');
                    } else if (workflowState.isRework) {
                        setReturnType('rework');
                    }
                    
                    // Fetch the most recent workflow history entry to get comments
                    const { data: historyData, error: historyError } = await supabase
                        .from('workflow_history')
                        .select('actor_name, comment, timestamp, action')
                        .eq('project_id', project.id)
                        .order('timestamp', { ascending: false })
                        .limit(1);

                    if (historyError) {
                        console.error('Error fetching workflow history:', historyError);
                    } else if (historyData && historyData.length > 0) {
                        setReviewComment(historyData[0]);
                    }
                    
                    // Fetch previous script version based on the latest action
                    let scriptAction = workflowState.isRework ? 'REWORK' : 'REJECTED';
                    const { data: scriptData, error: scriptError } = await supabase
                        .from('workflow_history')
                        .select('script_content')
                        .eq('project_id', project.id)
                        .eq('action', scriptAction)
                        .order('timestamp', { ascending: false })
                        .limit(1);

                    if (scriptError) {
                        console.error('Error fetching previous script:', scriptError);
                    } else if (scriptData && scriptData.length > 0 && scriptData[0].script_content) {
                        setPreviousScript(scriptData[0].script_content);
                    }
                } catch (err) {
                    console.error('Error fetching review data:', err);
                }
            }
        };

        fetchReviewData();
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
                
                // Validate required fields for new projects
                if (!newProjectDetails.title.trim()) {
                  throw new Error('Title is required. Please enter a title for your script.');
                }
                
                if (!newProjectDetails.channel) {
                  throw new Error('Channel is required. Please select a channel for your script.');
                }
                
                if (!newProjectDetails.contentType) {
                  throw new Error('Content type is required. Please select a content type for your script.');
                }
                
                // Validate thumbnail requirement for video content
                if (newProjectDetails.contentType === 'VIDEO' && formData.thumbnail_required === undefined) {
                  throw new Error('Thumbnail requirement must be specified for video content. Please select Yes or No.');
                }
                
                const createdProject = await db.createProject(
                    newProjectDetails.title,
                    newProjectDetails.channel,
                    newProjectDetails.dueDate,
                    newProjectDetails.contentType,
                    newProjectDetails.priority
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
        newProjectDetails.contentType,
        newProjectDetails.priority
      );
      await db.projects.update(createdProject.id, {
        created_by: currentUser.id,
        assigned_to_user_id: currentUser.id
      });
      
      // Update project data with writer information
      await db.updateProjectData(createdProject.id, {
        writer_id: currentUser.id,
        writer_name: currentUser.full_name
      });

      if (!createdProject?.id) {
        throw new Error('Project creation failed – no ID returned');
      }

      realProjectId = createdProject.id;
      console.log('✅ Project created with ID:', realProjectId);
    }

    // 2️⃣ HARD SAFETY CHECK
    if (!realProjectId) {
      throw new Error('Cannot submit project without valid project ID');
    }
    
    // Validate project ID format
    if (realProjectId.startsWith('temp_')) {
      throw new Error('Invalid project ID format. Project must be saved to database first.');
    }
    
    // Validate required fields for new projects
    if (!newProjectDetails.title.trim()) {
      throw new Error('Title is required. Please enter a title for your script.');
    }
    
    if (!newProjectDetails.channel) {
      throw new Error('Channel is required. Please select a channel for your script.');
    }
    
    if (!newProjectDetails.contentType) {
      throw new Error('Content type is required. Please select a content type for your script.');
    }
    
    // Validate thumbnail requirement for video content
    if (newProjectDetails.contentType === 'VIDEO' && formData.thumbnail_required === undefined) {
      throw new Error('Thumbnail requirement must be specified for video content. Please select Yes or No.');
    }

    // Small delay to ensure project is fully created before proceeding
    await new Promise(resolve => setTimeout(resolve, 100));

    // 3️⃣ SAVE SCRIPT + CREATOR INFO (ONCE)
    const creatorData = {
      ...formData,
    };
    
    if (creatorRole === Role.CMO) {
      // Store CMO information
      creatorData.cmo_id = currentUser?.id;
      creatorData.cmo_name = currentUser?.full_name;
    } else {
      // Default to Writer information
      creatorData.writer_id = currentUser?.id;
      creatorData.writer_name = currentUser?.full_name;
    }
    
    await db.updateProjectData(realProjectId, creatorData);
    console.log('✅ Project data updated');

    // 4️⃣ SUBMIT WORKFLOW
    // Determine workflow based on latest action
    const workflowState = project ? getWorkflowState(project) : { isRejected: false, isRework: false, isInReview: false, isApproved: false, latestAction: null };
    
    // Check if project was sent back from CEO after CMO approval
    const wasSentBackFromCEO = await wasProjectSentBackFromCEO(project?.id);
    
    if (workflowState.isRejected || workflowState.isRework) {
      // For rework projects, use advanceWorkflow which has built-in logic to determine the next stage
      // based on who initiated the rework (this handles the CEO rework scenario)
      await db.advanceWorkflow(realProjectId, 'Resubmitted after rework');
      console.log('✅ Successfully resubmitted rework project via advanceWorkflow');
    } else if (creatorRole === Role.CMO) {
      // For CMO-created scripts, we need to bypass the normal workflow and go straight to CEO review
      try {
        const project = await db.getProjectById(realProjectId);
        if (project) {
          // Update the project directly to SCRIPT_REVIEW_L2 stage and assign to CEO
          await db.projects.update(realProjectId, {
            current_stage: WorkflowStage.SCRIPT_REVIEW_L2,
            assigned_to_role: Role.CEO,
            status: TaskStatus.WAITING_APPROVAL
          });
        }
        console.log('✅ Successfully submitted directly to CEO');
      } catch (updateError) {
        console.error('❌ Failed to update project for CEO review:', updateError);
        throw new Error(`Failed to submit directly to CEO: ${updateError.message || updateError}`);
      }
    } else {
      await db.submitToReview(realProjectId);
      console.log('✅ Successfully submitted to CMO');
    }

    // Show popup after successful DB operation
    let nextStageLabel, creatorLabel, message;
    if (workflowState.isRejected || workflowState.isRework) {
      // For rejected or rework projects being resubmitted
      const projectDetails = await db.getProjectById(realProjectId);
      nextStageLabel = STAGE_LABELS[projectDetails?.current_stage || WorkflowStage.SCRIPT_REVIEW_L1] || 'Script Review (CMO)';
      const actionType = workflowState.isRework ? 'Rework' : 'Rejected';
      message = `${actionType} script resubmitted successfully. Waiting for ${nextStageLabel}.`;
    } else if (creatorRole === Role.CMO) {
      nextStageLabel = STAGE_LABELS[WorkflowStage.SCRIPT_REVIEW_L2] || 'Script Review (CEO)';
      creatorLabel = 'CMO';
      message = `${creatorLabel} script submitted successfully. Waiting for ${nextStageLabel}.`;
    } else {
      nextStageLabel = STAGE_LABELS[WorkflowStage.SCRIPT_REVIEW_L1] || 'Script Review (CMO)';
      creatorLabel = 'Writer';
      message = `${creatorLabel} script submitted successfully. Waiting for ${nextStageLabel}.`;
    }
    
    setStageName(nextStageLabel);
    setPopupMessage(message);
    console.log('Showing popup with message:', message);
    console.log('Stage name:', nextStageLabel);
    setShowPopup(true);
    console.log('Popup should be visible now');
    
    // Call onSuccess after a short delay to ensure popup is visible
    setTimeout(() => {
      onSuccess(); // refresh dashboard immediately
    }, 1000);
    
  } catch (err: any) {
    console.error('❌ Submit failed:', err);
    // Log more detailed error information
    if (err.message) {
      console.error('Error message:', err.message);
    }
    if (err.details) {
      console.error('Error details:', err.details);
    }
    if (err.hint) {
      console.error('Error hint:', err.hint);
    }
    
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
                        disabled={!newProjectDetails.title.trim() || !newProjectDetails.channel || !newProjectDetails.contentType || (newProjectDetails.contentType === 'VIDEO' && formData.thumbnail_required === undefined)}
                        className={`px-6 py-3 border-2 border-black text-black font-black uppercase hover:bg-slate-100 transition-colors flex items-center shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] active:translate-y-[2px] active:shadow-none ${(!newProjectDetails.title.trim() || !newProjectDetails.channel || !newProjectDetails.contentType || (newProjectDetails.contentType === 'VIDEO' && formData.thumbnail_required === undefined)) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <Save className="w-4 h-4 mr-2" />
                        Draft
                    </button>
                    <button
                        onClick={() => setShowConfirmation(true)}
                        disabled={isSubmitting || !!validationError || !newProjectDetails.title.trim() || !newProjectDetails.channel || !newProjectDetails.contentType || (newProjectDetails.contentType === 'VIDEO' && formData.thumbnail_required === undefined)}
                        className={`px-6 py-3 border-2 border-black font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center ${(validationError || !newProjectDetails.title.trim() || !newProjectDetails.channel || !newProjectDetails.contentType || (newProjectDetails.contentType === 'VIDEO' && formData.thumbnail_required === undefined)) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-[#0085FF] text-white'}`}
                    >
                        {isSubmitting ? 'Sending...' : project && getWorkflowState(project).isRework ? 'Submit for Review' : project && getWorkflowState(project).isRejected && returnType === 'reject' ? 'Resubmit for Review' : creatorRole === Role.CMO ? 'Submit to CEO' : 'Submit to CMO'}
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
                                <div className={`${!newProjectDetails.title.trim() ? 'border-l-4 border-red-500 pl-3 -ml-3' : ''}`}>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Title *</label>
                                    <input
                                        type="text"
                                        value={newProjectDetails.title}
                                        onChange={e => setNewProjectDetails({ ...newProjectDetails, title: e.target.value })}
                                        className={`w-full p-4 border-2 border-black bg-white focus:bg-yellow-50 focus:outline-none font-bold ${!newProjectDetails.title.trim() ? 'border-red-500' : ''}`}
                                        placeholder="e.g. Q4 Updates"
                                    />
                                </div>
                                <div className={`${!newProjectDetails.channel ? 'border-l-4 border-red-500 pl-3 -ml-3' : ''}`}>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Channel *</label>
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
                                <div className={`${!newProjectDetails.contentType ? 'border-l-4 border-red-500 pl-3 -ml-3' : ''}`}>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Content Type *</label>
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
                                
                                {/* Thumbnail Required Field - Only for Video Content Type */}
                                {newProjectDetails.contentType === 'VIDEO' && (
                                    <div className={`${!formData.thumbnail_required ? 'border-l-4 border-red-500 pl-3 -ml-3' : ''}`}>
                                        <div className="bg-white p-8 border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                                            <h3 className="font-black uppercase text-lg text-slate-900 mb-4">Thumbnail Requirements</h3>
                                            <div className="space-y-4">
                                                <div className="flex space-x-4">
                                                    <label className="flex items-center space-x-2 cursor-pointer">
                                                        <input
                                                            type="radio"
                                                            name="thumbnail_required_radio"
                                                            checked={formData.thumbnail_required === true}
                                                            onChange={() => setFormData({ ...formData, thumbnail_required: true })}
                                                            className="w-5 h-5"
                                                        />
                                                        <span className="font-bold text-slate-900">Yes</span>
                                                    </label>
                                                    <label className="flex items-center space-x-2 cursor-pointer">
                                                        <input
                                                            type="radio"
                                                            name="thumbnail_required_radio"
                                                            checked={formData.thumbnail_required === false}
                                                            onChange={() => setFormData({ ...formData, thumbnail_required: false })}
                                                            className="w-5 h-5"
                                                        />
                                                        <span className="font-bold text-slate-900">No</span>
                                                    </label>
                                                </div>
                                                
                                                {formData.thumbnail_required && (
                                                    <div className="space-y-4 mt-4">
                                                        <div>
                                                            <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Thumbnail Reference (Optional)</label>
                                                            <input
                                                                type="url"
                                                                value={formData.thumbnail_reference_link || ''}
                                                                onChange={e => setFormData({ ...formData, thumbnail_reference_link: e.target.value })}
                                                                className="w-full p-4 border-2 border-black bg-white focus:bg-yellow-50 focus:outline-none font-medium"
                                                                placeholder="https://example.com/reference-thumbnail.jpg"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Thumbnail Notes / Description</label>
                                                            <textarea
                                                                value={formData.thumbnail_notes || ''}
                                                                onChange={e => setFormData({ ...formData, thumbnail_notes: e.target.value })}
                                                                className="w-full p-4 border-2 border-black rounded-none text-sm min-h-[100px] focus:bg-yellow-50 focus:outline-none font-medium resize-none"
                                                                placeholder="Describe the desired thumbnail concept, colors, style, text, etc."
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Priority</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {(['LOW', 'NORMAL', 'HIGH'] as const).map(priority => (
                                            <button
                                                key={priority}
                                                onClick={() => setNewProjectDetails({ ...newProjectDetails, priority: priority })}
                                                className={`p-2 text-xs font-black uppercase border-2 border-black ${newProjectDetails.priority === priority ? 'bg-black text-white' : 'bg-white hover:bg-slate-50'}`}
                                            >
                                                {priority}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {/* Cinematography Instructions (Optional) */}
<div className="bg-white p-8 border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-6">
  <h3 className="font-black uppercase text-lg text-slate-900">
    Cinematography Instructions
    <span className="block text-xs font-medium text-slate-500 mt-1">
      (Optional – helps the cinematographer plan the shoot)
    </span>
  </h3>

  <div>
    <label className="block text-xs font-bold uppercase text-slate-500 mb-2">
      Actor
    </label>
    <input
      type="text"
      value={formData.actor || ''}
      onChange={e =>
        setFormData({ ...formData, actor: e.target.value })
      }
      className="w-full p-4 border-2 border-black font-medium focus:bg-yellow-50 focus:outline-none"
      placeholder="e.g. Female presenter, 30s, business attire"
    />
  </div>

  <div>
    <label className="block text-xs font-bold uppercase text-slate-500 mb-2">
      Location
    </label>
    <input
      type="text"
      value={formData.location || ''}
      onChange={e =>
        setFormData({ ...formData, location: e.target.value })
      }
      className="w-full p-4 border-2 border-black font-medium focus:bg-yellow-50 focus:outline-none"
      placeholder="e.g. Office, studio, outdoor street"
    />
  </div>

  <div>
    <label className="block text-xs font-bold uppercase text-slate-500 mb-2">
      Lighting
    </label>
    <input
      type="text"
      value={formData.lighting || ''}
      onChange={e =>
        setFormData({ ...formData, lighting: e.target.value })
      }
      className="w-full p-4 border-2 border-black font-medium focus:bg-yellow-50 focus:outline-none"
      placeholder="e.g. Soft daylight, cinematic, low-key"
    />
  </div>

  <div>
    <label className="block text-xs font-bold uppercase text-slate-500 mb-2">
      Angles
    </label>
    <input
      type="text"
      value={formData.angles || ''}
      onChange={e =>
        setFormData({ ...formData, angles: e.target.value })
      }
      className="w-full p-4 border-2 border-black font-medium focus:bg-yellow-50 focus:outline-none"
      placeholder="e.g. Medium shot, close-up, over-the-shoulder"
    />
  </div>
</div>

                                
                                {/* Validation Error Message */}
                                {validationError && (
                                    <div className="mt-4 p-4 bg-red-100 border-2 border-red-400 text-red-800 rounded-lg">
                                        <div className="flex items-start">
                                            <div className="flex-shrink-0">
                                                <X className="h-5 w-5 text-red-600" />
                                            </div>
                                            <div className="ml-3">
                                                <p className="text-sm font-bold uppercase">Invalid Combination</p>
                                                <p className="text-sm mt-1">{validationError}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
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
                                                
                        {/* REWORK COMMENTS (ONLY FOR REJECTED/REWORK PROJECTS) */}
                        {project && (getWorkflowState(project).isRejected || getWorkflowState(project).isRework) && (
                          <div className="bg-red-50 p-8 border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                            <h3 className="font-black uppercase text-lg text-red-700 mb-4">
                              Reviewer Comments
                              {returnType === 'reject' && (
                                <span className="block text-sm font-normal text-red-600 mt-1">
                                  (Project was rejected - limited editing capabilities)
                                </span>
                              )}
                              {returnType === 'rework' && (
                                <span className="block text-sm font-normal text-red-600 mt-1">
                                  (Project sent for rework - full editing capabilities)
                                </span>
                              )}
                            </h3>

                            {reviewComment ? (
                              <div className="space-y-2">
                                <p className="font-bold text-slate-900">
                                  {reviewComment.actor_name || 'Reviewer'}
                                  <span className="ml-2 text-xs uppercase text-red-600">
                                    ({returnType === 'reject' ? 'PROJECT REJECTED' : 'REWORK REQUIRED'})
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
                        {/* Previous Script (for rework projects) */}
                        {project && getWorkflowState(project).isRework && previousScript && (
                            <div className="bg-white p-8 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                                <h3 className="font-black uppercase text-lg text-slate-900 mb-4">Previous Script Version</h3>
                                <div className="font-serif text-slate-800 whitespace-pre-wrap bg-slate-50 p-4 border-2 border-slate-200 max-h-96 overflow-y-auto">
                                    {previousScript}
                                </div>
                                <p className="text-sm text-slate-500 mt-4 italic">This is the previous version of your script that was sent back for rework. Compare it with your changes above.</p>
                            </div>
                        )}
                        
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