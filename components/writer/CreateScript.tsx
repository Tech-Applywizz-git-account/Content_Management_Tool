
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
  creatorRole?: Role;
  mode?: 'SCRIPT_FROM_APPROVED_IDEA'; // WRITER or CMO
}

const CreateScript: React.FC<Props> = ({ project, onClose, onSuccess, creatorRole, mode }) => {
  const parsedProjectData: ProjectData | null = React.useMemo(() => {
    if (!project?.data) return null;
    if (typeof project.data === 'string') {
      try {
        return JSON.parse(project.data);
      } catch {
        return null;
      }
    }
    return project.data;
  }, [project]);
  
  // Helper to check if project has script content
  const hasScript = React.useMemo(() => !!parsedProjectData?.script_content, [parsedProjectData]);
  
  // Helper function to check if a reviewer (CMO or CEO) has accessed the project
  const hasReviewerAccessed = React.useMemo(async (): Promise<boolean> => {
    if (!project?.id) return false;
    
    try {
      const { data: historyData, error: historyError } = await supabase
        .from('workflow_history')
        .select('actor_id')
        .eq('project_id', project.id)
        .in('actor_role', ['CMO', 'CEO']) // Assuming there's an actor_role field in workflow_history
        .limit(1);
      
      if (historyError) {
        console.error('Error checking reviewer access:', historyError);
        return false;
      }
      
      // If we find any history entries by CMO or CEO, they've accessed the project
      return historyData && historyData.length > 0;
    } catch (error) {
      console.error('Error checking reviewer access:', error);
      return false;
    }
  }, [project?.id]);
  
  // State for edit permission
  const [canEdit, setCanEdit] = useState(true);
  
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [formData, setFormData] = useState<ProjectData>(parsedProjectData || {});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewComment, setReviewComment] = useState<any>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [previousScript, setPreviousScript] = useState<string | null>(null);
  const [previousIdeaDescription, setPreviousIdeaDescription] = useState<string | null>(null);
  const [returnType, setReturnType] = useState<'rework' | 'reject' | null>(null); // 'rework' or 'reject'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Define newProjectDetails state properly
  const [newProjectDetails, setNewProjectDetails] = useState({
    title: project?.title || '',
    channel: project?.channel || '', // No default selection
    contentType: project?.content_type || '', // No default selection
    dueDate: project?.due_date || new Date().toISOString().split('T')[0],
    priority: project?.priority || 'NORMAL'
  });

  const [validationError, setValidationError] = useState<string | null>(null);

  // Sync editor state when project changes
  useEffect(() => {
    if (project) {
      // Update parsedProjectData and formData when project changes
      const updatedParsedData = parsedProjectData;
      setFormData(updatedParsedData || {});
      
      // Update newProjectDetails when project changes
      setNewProjectDetails({
        title: project.title || '',
        channel: project.channel || '',
        contentType: project.content_type || '',
        dueDate: project.due_date || new Date().toISOString().split('T')[0],
        priority: project.priority || 'NORMAL'
      });
    }
  }, [project, parsedProjectData]);

  // Popup state for submit
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');
  const [stageName, setStageName] = useState('');

  // Calculate workflow state once
  const workflowState = project ? getWorkflowState(project) : null;

  // Calculate other derived values
  const isScriptFromApprovedIdea = mode === 'SCRIPT_FROM_APPROVED_IDEA';
  const isRework = workflowState?.isRework;
  // Check if this script is being created from an approved idea
  const isFromIdea = project?.data?.source === 'IDEA_PROJECT' &&
    project.history?.some(h => h.action === 'APPROVED' && h.stage === 'FINAL_REVIEW_CEO');

  // A project is a pure idea ONLY if source is IDEA_PROJECT AND script_content does NOT exist
  const isPureIdeaEdit = React.useMemo(() => {
    const parsedData = parsedProjectData;
    return parsedData?.source === 'IDEA_PROJECT' &&
           !hasScript &&
           !isScriptFromApprovedIdea &&
           !isFromIdea;
  }, [parsedProjectData, hasScript, isScriptFromApprovedIdea, isFromIdea]);
    

  // Load user effect
  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await db.getCurrentUser();
        if (user) {
          setCurrentUser(user);
        } else {
          setError('No user session found');
        }
      } catch (err) {
        console.error('Error loading current user:', err);
        setError('Failed to load user session');
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
  if (!project) return;

  const parsed =
    typeof project.data === 'string'
      ? JSON.parse(project.data)
      : project.data;

  setFormData({
    ...parsed,
    script_content: parsed?.script_content || '',
    brief: parsed?.brief || ''
  });

  setNewProjectDetails({
    title: project.title || '',
    channel: project.channel || '',
    contentType: project.content_type || '',
    dueDate: project.due_date || new Date().toISOString().split('T')[0],
    priority: project.priority || 'NORMAL'
  });
}, [project]);

  
  // Check edit permissions after user is loaded
  useEffect(() => {
    if (project && currentUser) {
      const checkEditPermission = async () => {
        // Writer can edit/delete ONLY if:
        // 1. The project was created by the writer
        // 2. CMO or CEO has not opened the project
        const isCreator = project.created_by_user_id === currentUser.id;
        
        if (!isCreator) {
          setCanEdit(false);
          return;
        }
        
        // Check if reviewer has accessed by looking for review-related actions in history
        if (project.id) {
          try {
            const { data: historyData, error: historyError } = await supabase
              .from('workflow_history')
              .select('actor_id, action, timestamp')
              .eq('project_id', project.id)
              .order('timestamp', { ascending: false });
            
            if (!historyError && historyData) {
              // Check if any CMO or CEO has reviewed the project
              for (const history of historyData) {
                // Get the role of the actor who accessed the project
                const { data: userData, error: userError } = await supabase
                  .from('users')
                  .select('role')
                  .eq('id', history.actor_id)
                  .single();
                
                if (!userError && userData && 
                    (userData.role === 'CMO' || userData.role === 'CEO')) {
                  // If a reviewer has accessed the project (not just viewed), set canEdit to false
                  // Consider actions like 'REVIEWED', 'APPROVED', 'REJECTED', 'REWORK' as access
                  if (['REVIEWED', 'APPROVED', 'REJECTED', 'REWORK', 'SUBMITTED'].includes(history.action)) {
                    setCanEdit(false);
                    return;
                  }
                }
              }
              // If no reviewer has accessed, the creator can still edit
              setCanEdit(true);
            } else {
              setCanEdit(true);
            }
          } catch (error) {
            console.error('Error checking reviewer access:', error);
            setCanEdit(true);
          }
        } else {
          setCanEdit(true);
        }
      };
      
      checkEditPermission();
    }
  }, [project, currentUser]);

  // Validation effect
  useEffect(() => {
    // Check for invalid channel/content type combinations and thumbnail requirement
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
          // Determine return type based on the latest action
          if (workflowState?.isRejected) {
            setReturnType('reject');
          } else if (workflowState?.isRework) {
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
          let scriptAction = workflowState?.isRework ? 'REWORK' : 'REJECTED';
          const { data: scriptData, error: scriptError } = await supabase
            .from('workflow_history')
            .select('script_content')
            .eq('project_id', project.id)
            .eq('action', scriptAction)
            .order('timestamp', { ascending: false })
            .limit(1);

          if (scriptError) {
            console.error('Error fetching previous script:', scriptError);
          } else if (scriptData && scriptData.length > 0) {
            if (scriptData[0].script_content) {
              setPreviousScript(scriptData[0].script_content);
            }
          }

          // Also try to get the idea description from the project data itself
          if (project.data?.idea_description) {
            setPreviousIdeaDescription(project.data.idea_description);
            setFormData(prev => ({
              ...prev,
              idea_description: project.data?.idea_description
            }));
          }
        } catch (err) {
          console.error('Error fetching review data:', err);
        }
      }
    };

    fetchReviewData();
  }, [project?.id, workflowState?.isRework, workflowState?.isRejected]);

  // Don't render the main form if user is not loaded yet
  if (loading) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto"></div>
          <p className="mt-4 font-bold">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render the main form if there's an error or no current user
  if (error || !currentUser) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
        <div className="text-center p-6 max-w-md">
          <p className="font-bold text-red-500 mb-4">{error || 'No user session found'}</p>
          <p className="text-gray-600 mb-6">Please log in again to continue.</p>
          <button
            onClick={() => window.location.href = '/'}
            className="px-6 py-3 bg-[#D946EF] text-white border-2 border-black font-bold uppercase"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

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



  // Main submit function that handles all workflow scenarios
  const handleSubmitForReview = async () => {
    setIsSubmitting(true);
    console.log('🚀 Starting submit process');

    try {
      let realProjectId = project?.id;

      // Check if this is a script being created from an approved idea
      if (isFromIdea) {
        console.log('Creating new script project from approved idea');

        // Create a BRAND NEW project in Supabase
        const { data: newScript, error: createError } = await supabase
          .from('projects')
          .insert({
            title: project.title,
            channel: project.channel,
            content_type: project.content_type || 'CREATIVE_ONLY', // Using CREATIVE_ONLY for script projects
            current_stage: WorkflowStage.SCRIPT_REVIEW_L1,
            assigned_to_role: Role.CMO,
            assigned_to_user_id: null, // No specific user assigned yet
            status: TaskStatus.WAITING_APPROVAL,
            due_date: project.due_date || new Date().toISOString().split('T')[0], // Use original due date or today
            created_by_user_id: currentUser.id,
            created_by_name: currentUser.full_name,
            writer_id: currentUser.id,
            writer_name: currentUser.full_name,
            data: {
              source: 'SCRIPT_FROM_IDEA',
              parent_idea_id: project.id,
              script_content: formData.script_content,
              ...formData
            }
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating new script from idea:', createError);
          throw createError;
        }

        realProjectId = newScript.id;

        // Add workflow history entry for the new script
        await supabase.from('workflow_history').insert({
          project_id: newScript.id,
          from_stage: WorkflowStage.SCRIPT,
          to_stage: WorkflowStage.SCRIPT_REVIEW_L1,
          action: 'SUBMITTED',
          actor_id: currentUser.id,
          actor_name: currentUser.full_name,
          comment: 'Script created from CEO-approved idea',
          timestamp: new Date().toISOString()
        });

        console.log('✅ Successfully created new script project from approved idea:', newScript.id);
      } else {
        // For existing projects (editing), use the existing project ID
        if (!realProjectId) {
          // 1️⃣ CREATE PROJECT FIRST (if new)
          const createdProject = await db.createProject(
            newProjectDetails.title,
            newProjectDetails.channel,
            newProjectDetails.dueDate,
            newProjectDetails.contentType,
            newProjectDetails.priority
          );
          await (db.projects.update as any)(createdProject.id, {
            created_by_user_id: currentUser.id,
            created_by_name: currentUser.full_name,
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
        } else {
          // 2️⃣ UPDATE EXISTING PROJECT DATA (for edits)
          const updateData = {
            ...formData,
          };

          if (creatorRole === Role.CMO) {
            // Store CMO information
            updateData.cmo_id = currentUser?.id;
            updateData.cmo_name = currentUser?.full_name;
          } else {
            // Default to Writer information
            updateData.writer_id = currentUser?.id;
            updateData.writer_name = currentUser?.full_name;
          }

          await db.updateProjectData(realProjectId, updateData);
          console.log('✅ Existing project data updated');
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

        if (!realProjectId) {
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
        }

        // Small delay to ensure project is fully created before proceeding
        await new Promise(resolve => setTimeout(resolve, 100));

        // 4️⃣ SUBMIT WORKFLOW
        // Determine workflow based on latest action
        const workflowState = project ? getWorkflowState(project) : { isRejected: false, isRework: false, isInReview: false, isApproved: false, latestAction: null };

        // Check if project was sent back from CEO after CMO approval
        const wasSentBackFromCEO = await wasProjectSentBackFromCEO(project?.id);

        // Special handling for idea projects in rework
        const isIdeaInRework = project?.data?.source === 'IDEA_PROJECT' &&
          project.current_stage === WorkflowStage.REWORK &&
          workflowState.isRework;

        if (isIdeaInRework) {
          // For idea projects in rework, we need to determine who sent it for rework and route back to them
          try {
            // Fetch workflow history to determine who sent for rework
            const { data: history, error: historyError } = await supabase
              .from('workflow_history')
              .select('actor_id, action, comment, timestamp')
              .eq('project_id', project.id)
              .order('timestamp', { ascending: false });

            if (historyError) {
              console.error('Error fetching workflow history:', historyError);
            }

            const reworkHistory = history?.find(h => h.action === 'REWORK');

            if (reworkHistory) {
              let targetRole, targetStage;

              // Get the actor's role to determine where to send it back
              const { data: userData, error: userError } = await supabase
                .from('users')
                .select('role')
                .eq('id', reworkHistory.actor_id)
                .single();

              if (!userError && userData) {
                // Determine where to send the rework based on who sent it
                if (userData.role === Role.CMO) {
                  targetRole = Role.CMO;
                  // For idea projects, if CMO sent for rework, return to FINAL_REVIEW_CMO stage
                  targetStage = WorkflowStage.FINAL_REVIEW_CMO;
                } else if (userData.role === Role.CEO) {
                  targetRole = Role.CEO;
                  targetStage = WorkflowStage.FINAL_REVIEW_CEO;
                } else {
                  // Default fallback
                  targetRole = Role.CMO;
                  targetStage = WorkflowStage.FINAL_REVIEW_CMO;
                }
              } else {
                // Default fallback if user role cannot be determined
                targetRole = Role.CMO;
                targetStage = WorkflowStage.FINAL_REVIEW_CMO;
              }

              // Update the idea project with the reworked content
              await db.projects.update(realProjectId, {
                current_stage: targetStage,
                assigned_to_role: targetRole,
                status: TaskStatus.WAITING_APPROVAL
              });

              // Add workflow history entry
              await supabase.from('workflow_history').insert([{
                project_id: realProjectId,
                from_stage: project?.current_stage || WorkflowStage.REWORK,
                to_stage: targetStage,
                action: 'RESUBMITTED',
                actor_id: currentUser.id,
                actor_name: currentUser.full_name,
                comment: 'Idea resubmitted after rework',
                timestamp: new Date().toISOString()
              }]);

              console.log(`✅ Successfully resubmitted idea rework project back to ${targetRole}`);
            } else {
              // If we can't determine who sent it for rework, use advanceWorkflow
              await db.advanceWorkflow(realProjectId, 'Idea resubmitted after rework');
              console.log('✅ Successfully resubmitted idea rework project via advanceWorkflow');
            }
          } catch (reworkError) {
            console.error('Error determining idea rework routing:', reworkError);
            // Fallback: use advanceWorkflow
            await db.advanceWorkflow(realProjectId, 'Idea resubmitted after rework');
            console.log('✅ Successfully resubmitted idea rework project via advanceWorkflow');
          }
        } else if (workflowState.isRework) {
          // Handle script rework - determine who sent it for rework
          const { data: history, error: historyError } = await supabase
            .from('workflow_history')
            .select('actor_id, action, comment, timestamp')
            .eq('project_id', realProjectId)
            .order('timestamp', { ascending: false });

          if (historyError) {
            console.error('Error fetching workflow history:', historyError);
            throw historyError;
          }

          // Find the most recent REWORK action
          const reworkHistory = history?.find(h => h.action === 'REWORK');

          if (reworkHistory) {
            // Determine the next stage based on who sent for rework
            let targetRole, targetStage;

            // Get the actor's role to determine where to send it back
            const { data: userData, error: userError } = await supabase
              .from('users')
              .select('role')
              .eq('id', reworkHistory.actor_id)
              .single();

            if (!userError && userData) {
              if (userData.role === Role.CEO) {
                targetRole = Role.CEO;
                targetStage = WorkflowStage.SCRIPT_REVIEW_L2;
              } else {
                // Default to CMO if not CEO (could be CMO or other roles)
                targetRole = Role.CMO;
                targetStage = WorkflowStage.SCRIPT_REVIEW_L1;
              }
            } else {
              // Default fallback if user role cannot be determined
              targetRole = Role.CMO;
              targetStage = WorkflowStage.SCRIPT_REVIEW_L1;
            }

            // Update the project to send it back to the appropriate reviewer
            await db.projects.update(realProjectId, {
              current_stage: targetStage,
              assigned_to_role: targetRole,
              status: TaskStatus.WAITING_APPROVAL
            });

            // Add workflow history entry
            await supabase.from('workflow_history').insert([{
              project_id: realProjectId,
              from_stage: project?.current_stage || WorkflowStage.REWORK,
              to_stage: targetStage,
              action: 'RESUBMITTED',
              actor_id: currentUser.id,
              actor_name: currentUser.full_name,
              comment: 'Resubmitted after rework',
              timestamp: new Date().toISOString()
            }]);

            console.log(`✅ Successfully resubmitted rework project back to ${targetRole}`);
          } else {
            // Default for rework if no rework history found - use advanceWorkflow
            await db.advanceWorkflow(realProjectId, 'Resubmitted after rework');
            console.log('✅ Successfully resubmitted rework project via advanceWorkflow');
          }
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
          // Special handling for idea projects that were approved by CEO
          if (mode === 'SCRIPT_FROM_APPROVED_IDEA') {
            // For idea projects converted to scripts, send to CMO script review stage (L1)
            await db.projects.update(realProjectId, {
              current_stage: WorkflowStage.SCRIPT_REVIEW_L1,
              assigned_to_role: Role.CMO,
              status: TaskStatus.WAITING_APPROVAL
            });

            // Add workflow history entry
            await supabase.from('workflow_history').insert([{
              project_id: realProjectId,
              from_stage: project?.current_stage || WorkflowStage.SCRIPT,
              to_stage: WorkflowStage.SCRIPT_REVIEW_L1,
              action: 'SUBMITTED',
              actor_id: currentUser.id,
              actor_name: currentUser.full_name,
              comment: 'Script created from approved idea, sent to CMO for review',
              timestamp: new Date().toISOString()
            }]);

            console.log('✅ Successfully submitted script from approved idea to CMO script review');
          } else {
            await db.submitToReview(realProjectId);
            console.log('✅ Successfully submitted to CMO');
          }
        }
      }

      // Show popup after successful DB operation
      let nextStageLabel, creatorLabel, message;
      // Use the local workflow state for this function
      const localWorkflowState = project ? getWorkflowState(project) : { isRejected: false, isRework: false, isInReview: false, isApproved: false, latestAction: null };

      if (isFromIdea) {
        // For scripts created from approved ideas
        nextStageLabel = STAGE_LABELS[WorkflowStage.SCRIPT_REVIEW_L1] || 'Script Review (CMO)';
        message = 'Script created from CEO-approved idea and submitted to CMO for review.';
      } else if (localWorkflowState && (localWorkflowState.isRework)) {
        // For rework projects being resubmitted
        const projectDetails = await db.getProjectById(realProjectId);
        nextStageLabel = STAGE_LABELS[projectDetails?.current_stage || WorkflowStage.SCRIPT_REVIEW_L1] || 'Script Review (CMO)';
        const actionType = localWorkflowState?.isRework ? 'Rework' : 'Rejected';
        message = `${actionType} script resubmitted successfully. Waiting for ${nextStageLabel}.`;
      } else if (creatorRole === Role.CMO) {
        nextStageLabel = STAGE_LABELS[WorkflowStage.SCRIPT_REVIEW_L2] || 'Script Review (CEO)';
        creatorLabel = 'CMO';
        message = `${creatorLabel} script submitted successfully. Waiting for ${nextStageLabel}.`;
      } else if (mode === 'SCRIPT_FROM_APPROVED_IDEA') {
        // For idea projects converted to scripts
        nextStageLabel = STAGE_LABELS[WorkflowStage.SCRIPT_REVIEW_L1] || 'Script Review (CMO)';
        message = 'Script created from approved idea submitted successfully. Waiting for Script Review (CMO).';
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
          <button
            onClick={() => {
              console.log('⬅ Back clicked');
              onClose();
            }} className="p-3 border-2 border-transparent hover:border-black hover:bg-slate-100 rounded-full transition-all">
            <ArrowLeft className="w-6 h-6 text-black" />
          </button>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                {isScriptFromApprovedIdea
                  ? 'New Script'
                  : project
                    ? `Edit: ${project.title}`
                    : 'New Script'}
              </h1>
              {isFromIdea && (
                <span className="bg-green-100 text-green-800 px-2 py-1 border-2 border-green-300 text-xs font-black uppercase">
                  Script from CEO-approved idea
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={handleSaveDraft}
            disabled={!canEdit || !newProjectDetails.title.trim() || !newProjectDetails.channel || !newProjectDetails.contentType || (newProjectDetails.contentType === 'VIDEO' && formData.thumbnail_required === undefined)}
            className={`px-6 py-3 border-2 border-black text-black font-black uppercase hover:bg-slate-100 transition-colors flex items-center shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] active:translate-y-[2px] active:shadow-none ${(!canEdit || !newProjectDetails.title.trim() || !newProjectDetails.channel || !newProjectDetails.contentType || (newProjectDetails.contentType === 'VIDEO' && formData.thumbnail_required === undefined)) ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Save className="w-4 h-4 mr-2" />
            Draft
          </button>
          <button
            onClick={() => setShowConfirmation(true)}
            disabled={!canEdit || isSubmitting || !!validationError || !newProjectDetails.title.trim() || (!isRework && (!newProjectDetails.channel || !newProjectDetails.contentType || (newProjectDetails.contentType === 'VIDEO' && formData.thumbnail_required === undefined)))}
            className={`px-6 py-3 border-2 border-black font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center ${(!canEdit || isSubmitting || (!isRework && !!validationError) || !newProjectDetails.title.trim() || (!isRework && (!newProjectDetails.channel || !newProjectDetails.contentType || (newProjectDetails.contentType === 'VIDEO' && formData.thumbnail_required === undefined)))) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-[#0085FF] text-white'}`}
          >
            {isSubmitting ? 'Sending...' : project && getWorkflowState(project).isRework ? 'Submit for Review' : project && getWorkflowState(project).isRejected && returnType === 'reject' ? 'Resubmit for Review' : creatorRole === Role.CMO ? 'Submit to CEO' : 'Submit to CMO'}
            <Send className="w-4 h-4 ml-2" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-slate-50 p-6 md:p-10">
        <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ================= LEFT COLUMN ================= */}
          <div className="lg:col-span-1 space-y-6">

            {/* Project Info */}
            {!isPureIdeaEdit && (
              <div className="bg-white p-8 border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-6">
                <h3 className="font-black uppercase text-lg text-slate-900">
                  Project Info
                </h3>

                {/* Title */}
                <div className={`${!newProjectDetails.title.trim() ? 'border-l-4 border-red-500 pl-3 -ml-3' : ''}`}>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={newProjectDetails.title}
                    onChange={e =>
                      canEdit ? setNewProjectDetails({ ...newProjectDetails, title: e.target.value }) : null
                    }
                    readOnly={!canEdit}
                    className="w-full p-4 border-2 border-black font-bold focus:bg-yellow-50 focus:outline-none"
                    placeholder="e.g. Q4 Updates"
                  />
                </div>

                {/* Channel */}
                <div className={`${!newProjectDetails.channel ? 'border-l-4 border-red-500 pl-3 -ml-3' : ''}`}>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-2">
                    Channel *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.values(Channel).map(c => (
                      <button
                        key={c}
                        onClick={() =>
                          canEdit ? setNewProjectDetails({ ...newProjectDetails, channel: c }) : null
                        }
                        disabled={!canEdit}
                        className={`p-2 text-[10px] font-black uppercase border-2 border-black ${newProjectDetails.channel === c
                          ? 'bg-black text-white'
                          : 'bg-white hover:bg-slate-50'
                          } ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Content Type */}
                <div className={`${!newProjectDetails.contentType ? 'border-l-4 border-red-500 pl-3 -ml-3' : ''}`}>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-2">
                    Content Type *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() =>
                        canEdit ? setNewProjectDetails({ ...newProjectDetails, contentType: 'VIDEO' }) : null
                      }
                      disabled={!canEdit}
                      className={`p-3 text-xs font-black uppercase border-2 border-black ${newProjectDetails.contentType === 'VIDEO'
                        ? 'bg-[#0085FF] text-white'
                        : 'bg-white hover:bg-slate-50'
                        } ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      📹 Video
                    </button>
                    <button
                      onClick={() =>
                        canEdit ? setNewProjectDetails({
                          ...newProjectDetails,
                          contentType: 'CREATIVE_ONLY',
                        }) : null
                      }
                      disabled={!canEdit}
                      className={`p-3 text-xs font-black uppercase border-2 border-black ${newProjectDetails.contentType === 'CREATIVE_ONLY'
                        ? 'bg-[#D946EF] text-white'
                        : 'bg-white hover:bg-slate-50'
                        } ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      🎨 Creative Only
                    </button>
                  </div>
                </div>

                {/* Thumbnail Required - Only for VIDEO content */}
                {newProjectDetails.contentType === 'VIDEO' && (
                  <div className={`${formData.thumbnail_required === undefined ? 'border-l-4 border-red-500 pl-3 -ml-3' : ''}`}>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-2">
                      Thumbnail Required *
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                     <button
  onClick={() => {
    if (canEdit) {
      setFormData({ ...formData, thumbnail_required: true });
    }
  }}
  disabled={!canEdit}
  className={`p-3 text-xs font-black uppercase border-2 border-black
    ${formData.thumbnail_required === true
      ? 'bg-black text-white'
      : 'bg-white hover:bg-slate-50'}
    ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}
  `}
>
  Yes
</button>

                      <button
                        onClick={() => canEdit ? setFormData({ ...formData, thumbnail_required: false }) : null}
                        disabled={!canEdit}
                        className={`p-3 text-xs font-black uppercase border-2 border-black ${formData.thumbnail_required === false
                          ? 'bg-black text-white'
                          : 'bg-white hover:bg-slate-50'
                          } ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        No
                      </button>
                    </div>

                    {/* Thumbnail Options - Only when Yes is selected */}
                    {formData.thumbnail_required === true && (
                      <div className="mt-4 space-y-4">
                        <div>
                          <label className="block text-xs font-bold uppercase text-slate-500 mb-2">
                            Reference Thumbnail (Optional)
                          </label>
                          <div className="flex items-center space-x-4">
                            <input
                              type="text"
                              value={formData.reference_thumbnail_link || ''}
                              onChange={e => canEdit ? setFormData({ ...formData, reference_thumbnail_link: e.target.value }) : null}
                              readOnly={!canEdit}
                              className="flex-1 p-2 border-2 border-black focus:bg-yellow-50 focus:outline-none"
                              placeholder="Paste thumbnail link here"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold uppercase text-slate-500 mb-2">
                            Thumbnail Concept Notes
                          </label>
                          <textarea
                            value={formData.thumbnail_notes || ''}
                            onChange={e => canEdit ? setFormData({ ...formData, thumbnail_notes: e.target.value }) : null}
                            readOnly={!canEdit}
                            className="w-full p-2 border-2 border-black min-h-[100px] focus:bg-yellow-50 focus:outline-none resize-none"
                            placeholder="Describe your thumbnail concept, colors, composition, text overlay, etc."
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Cinematographer Instructions - Only for VIDEO content */}
                {/* Cinematography Instructions (Optional) */}
                <div className="bg-white p-8 border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-6">
                  <h3 className="font-black uppercase text-lg text-slate-900">
                    Cinematography Instructions

                  </h3>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-2">
                      Actor
                    </label>
                    <input
                      type="text"
                      value={formData.actor || ''}
                      onChange={e =>
                        canEdit ? setFormData({ ...formData, actor: e.target.value }) : null
                      }
                      readOnly={!canEdit}
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
                        canEdit ? setFormData({ ...formData, location: e.target.value }) : null
                      }
                      readOnly={!canEdit}
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
                        canEdit ? setFormData({ ...formData, lighting: e.target.value }) : null
                      }
                      readOnly={!canEdit}
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
                        canEdit ? setFormData({ ...formData, angles: e.target.value }) : null
                      }
                      readOnly={!canEdit}
                      className="w-full p-4 border-2 border-black font-medium focus:bg-yellow-50 focus:outline-none"
                      placeholder="e.g. Medium shot, close-up, over-the-shoulder"
                    />
                  </div>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-2">
                    Priority
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['LOW', 'NORMAL', 'HIGH'] as const).map(p => (
                      <button
                        key={p}
                        onClick={() =>
                          canEdit ? setNewProjectDetails({ ...newProjectDetails, priority: p }) : null
                        }
                        disabled={!canEdit}
                        className={`p-2 text-xs font-black uppercase border-2 border-black ${newProjectDetails.priority === p
                          ? 'bg-black text-white'
                          : 'bg-white hover:bg-slate-50'
                          } ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Idea Description (for idea projects) */}
            {isPureIdeaEdit && (
              <div className="bg-white p-8 border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <h3 className="font-black uppercase text-lg text-slate-900 mb-4">
                  {isRework ? 'Updated Idea Description' : 'Idea Description'}
                </h3>
                <textarea
                  value={formData.idea_description || ''}
                  onChange={e => canEdit ? setFormData({ ...formData, idea_description: e.target.value }) : null}
                  readOnly={!canEdit}
                  className="w-full p-4 border-2 border-black min-h-[200px] focus:bg-yellow-50 focus:outline-none resize-none"
                  placeholder={isRework ? "Update the idea description based on the review comments..." : "Describe your idea..."}
                />
              </div>
            )}

            {/* Brief / Notes */}
            <div className="bg-white p-8 border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="font-black uppercase text-lg text-slate-900 mb-4">
                Brief / Notes
              </h3>
              <textarea
                value={formData.brief || ''}
                onChange={e => canEdit ? setFormData({ ...formData, brief: e.target.value }) : null}
                readOnly={!canEdit}
                className="w-full p-4 border-2 border-black min-h-[200px] focus:bg-yellow-50 focus:outline-none resize-none"
                placeholder="What is the goal of this content?"
              />
            </div>

            {/* REVIEW COMMENTS (FOR REWORK/REJECTED PROJECTS) */}
            {(returnType === 'rework' || returnType === 'reject') && (
              <div className="bg-red-50 p-6 border-2 border-red-300 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <h3 className="font-black uppercase text-lg text-red-800 mb-4">
                  Review Comments
                </h3>

                <div className="space-y-4">
                  {reviewComment && (
                    <div className="bg-white p-4 border-2 border-red-200">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-slate-700">{reviewComment.actor_name}</span>
                        <span className="text-sm text-slate-500">{new Date(reviewComment.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="text-slate-700 whitespace-pre-wrap">{reviewComment.comment || 'No specific comments provided.'}</p>
                      <div className="mt-2 px-3 py-1 bg-red-100 text-red-800 font-bold text-sm border border-red-300 inline-block">
                        {reviewComment.action}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ================= RIGHT COLUMN ================= */}
          <div className="lg:col-span-2 space-y-6">

            {/* ✅ ORIGINAL IDEA DESCRIPTION (RIGHT SIDE) */}
            {project?.data?.source === 'IDEA_PROJECT' && (
              <div className="bg-blue-50 p-8 border-2 border-blue-300 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <h3 className="font-black uppercase text-lg text-blue-800 mb-4">
                  {isRework ? 'Previous Idea Description' : 'Original Idea Description'}
                </h3>

                <div className="bg-white p-4 border-2 border-blue-200 min-h-[120px]">
                  <p className="text-slate-700 whitespace-pre-wrap">
                    {(isRework && previousIdeaDescription) ? previousIdeaDescription : (project.data.idea_description || 'No idea description provided.')}
                  </p>
                </div>

                <p className="text-sm text-blue-600 mt-3 font-medium">
                  {isRework
                    ? 'This idea was sent back for rework. Please update the idea description (left) based on feedback.'
                    : isPureIdeaEdit ? 'Original description reference.' : 'This idea was approved by CEO. Please convert it into a detailed script below.'}
                </p>
              </div>
            )}



            {/* PREVIOUS SCRIPT (FOR REWORK/REJECTED PROJECTS) */}
            {(returnType === 'rework' || returnType === 'reject') && previousScript && (
              <div className="bg-yellow-50 p-6 border-2 border-yellow-300 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <h3 className="font-black uppercase text-lg text-yellow-800 mb-4">
                  Previous Script
                </h3>

                <div className="bg-white p-4 border-2 border-yellow-200 min-h-[200px] max-h-60 overflow-y-auto">
                  <pre className="text-slate-700 whitespace-pre-wrap font-serif">
                    {previousScript}
                  </pre>
                </div>
              </div>
            )}

            {/* Script Editor - Only show if NOT a pure idea edit */}
            {!isPureIdeaEdit && (
              <div className="bg-white p-8 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] min-h-[700px] flex flex-col">
                <div className="border-b-2 border-black pb-4 mb-6 flex justify-between">
                  <span className="font-black uppercase text-xs text-slate-400">
                    Rich Text Editor
                  </span>
                </div>

                <textarea
                  value={formData.script_content || ''}
                  onChange={e =>
                    canEdit ? setFormData({ ...formData, script_content: e.target.value }) : null
                  }
                  readOnly={!canEdit}
                  className="flex-1 w-full text-lg resize-none outline-none font-serif"
                  placeholder="Start writing your script here..."
                />
              </div>
            )}
          </div>
        </div>
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
                    handleSubmitForReview();
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
    </div>
  );
};

export default CreateScript;
