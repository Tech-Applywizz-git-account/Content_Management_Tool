import React, { useState } from 'react';
import { Project, Role, TaskStatus, WorkflowStage } from '../../types';
import { Clock, FileText, CheckCircle, Edit3, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import CreateScript from './CreateScript';
import CreateIdeaProject from './CreateIdeaProject';
import { db } from '../../services/supabaseDb';
import { getWorkflowStateForRole } from '../../services/workflowUtils';

interface Props {
  user: { id: string; full_name: string; role: Role };
  projects: Project[];
}

const WriterMyWork: React.FC<Props> = ({ user, projects }) => {
  // ✅ hooks MUST be inside component
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [reviewComments, setReviewComments] = useState<any[]>([]);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [scriptFromIdea, setScriptFromIdea] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<'IDEA' | 'SCRIPT'>('IDEA');
  // Helper function to safely parse project data
  const parseProjectData = (data: any) => {
    if (!data) return null;
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch {
        return null;
      }
    }
    return data;
  };

  // Helper function to validate Project type
  const isValidProject = (item: any): item is Project => {
    return (
      typeof item === 'object' &&
      item !== null &&
      typeof item.id === 'string' &&
      typeof item.title === 'string' &&
      typeof item.channel === 'string' &&
      typeof item.content_type === 'string'
    );
  };

  // Normalize projects ONCE at the top - parse all project data upfront AND filter valid projects
  const fullyNormalizedProjects = (projects || []).filter(isValidProject).map(project => ({
    ...project,
    data: parseProjectData(project.data),
  }));

  // Function to check if a project has been opened by CMO or CEO
 const isProjectOpenedByReviewers = (project: Project): boolean => {
  if (!project.history || project.history.length === 0) {
    return false;
  }

  return project.history.some(h =>
    ['REVIEWED', 'APPROVED', 'REJECTED'].includes(h.action)
  );
};

// Function to check if a project is in rework state
const isReworkProject = (project: Project): boolean => {
  if (!project.history || project.history.length === 0) {
    return false;
  }

  return project.history.some(h =>
    h.action === 'REWORK'
  );
};

// Function to check if a rework project has been opened by the next reviewer after rework
const isReworkOpenedByNextReviewer = (project: Project): boolean => {
  if (!project.history || project.history.length === 0) {
    return false;
  }

  // Find the most recent rework action
  const reworkActions = project.history
    .filter(h => h.action === 'REWORK')
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (reworkActions.length === 0) {
    return false;
  }

  const lastReworkTimestamp = new Date(reworkActions[0].timestamp);

  // Check if there are any REVIEWED, APPROVED, or REJECTED actions after the last rework
  return project.history.some(h => {
    const actionTimestamp = new Date(h.timestamp);
    return (
      actionTimestamp > lastReworkTimestamp &&
      ['REVIEWED', 'APPROVED', 'REJECTED'].includes(h.action)
    );
  });
};



  // Function to check if an idea was approved by CEO
  const isIdeaApprovedByCEO = (project: Project) => {
    const parsedData = parseProjectData(project.data);
    return (
      parsedData?.source === 'IDEA_PROJECT' &&
      project.history?.some(h =>
        h.stage === WorkflowStage.FINAL_REVIEW_CEO &&
        h.action === 'APPROVED'
      )
    );
  };

  // Check if we're editing an approved idea project
  const ideaToConvert =
  editingProject &&
  (() => {
    const parsedData = parseProjectData(editingProject.data);
    return (
      parsedData?.source === 'IDEA_PROJECT' &&
      !parsedData?.script_content && // 🔥 THIS IS THE KEY
      isIdeaApprovedByCEO(editingProject)
    );
  })();

  // 🔁 FULL PAGE: Create Script from Approved Idea
  



  // Separate idea and script projects
 const ideaProjects: Project[] = Array.from(
  new Map(
    (fullyNormalizedProjects as Project[])
      .filter(project => {
        const isIdea = !project.data?.script_content && project.data?.source === 'IDEA_PROJECT';
        return project.created_by_user_id === user.id && isIdea;
      })
      .map(project => [project.id, project])
  ).values()
);

 const scriptProjects: Project[] = Array.from(
  new Map(
    (fullyNormalizedProjects as Project[])
      .filter(project =>
        !!project.data?.script_content &&
        project.created_by_user_id === user.id &&
        // Include projects that have script content, regardless of source
        // This allows scripts that originated from IDEA projects to appear in SCRIPT tab
        (!!project.data?.script_content)
      )
      .map(project => [project.id, project])
  ).values()
);
const canModifyProject = (project: Project, userId: string) => {
  // Check if it's a rework project that hasn't been opened by next reviewer
  const isReworkNotOpened = isReworkProject(project) && !isReworkOpenedByNextReviewer(project);
  
  // Check if it's an IDEA project in rework status
  const isIdeaRework = project.data?.source === 'IDEA_PROJECT' && project.status === 'REWORK';
  
  return (
    project.created_by_user_id === userId &&
    (!isProjectOpenedByReviewers(project) || isReworkNotOpened || isIdeaRework)
  );
};

  // Determine which projects to display based on active tab
  const displayProjects = activeTab === 'IDEA' ? ideaProjects : scriptProjects;

  /* ===============================
    MAIN VIEW - Show edit modal OR list view
  =============================== */
  
  // If converting approved idea to script, show the CreateScript component
  if (scriptFromIdea) {
    return (
      <CreateScript
        project={scriptFromIdea}
        mode="SCRIPT_FROM_APPROVED_IDEA"
        onClose={() => setScriptFromIdea(null)}
        onSuccess={() => setScriptFromIdea(null)}
        creatorRole={Role.WRITER}
      />
    );
  }
  
  // If editing project, check if it's an idea or script and show appropriate component
  if (editingProject) {
  const parsedData =
    typeof editingProject.data === 'string'
      ? JSON.parse(editingProject.data)
      : editingProject.data;

  const isIdeaProject = !parsedData?.script_content || parsedData?.source === 'IDEA_PROJECT';
  const isApprovedIdea =
    isIdeaProject && isIdeaApprovedByCEO(editingProject);

  // ✅ Approved idea → convert to script
  if (isApprovedIdea) {
    return (
      <CreateScript
        project={editingProject}
        mode="SCRIPT_FROM_APPROVED_IDEA"
        onClose={() => setEditingProject(null)}
        onSuccess={() => setEditingProject(null)}
        creatorRole={Role.WRITER}
      />
    );
  }

  // ✅ Normal idea edit
  if (isIdeaProject) {
    return (
      <CreateIdeaProject
        project={editingProject}
        onClose={() => setEditingProject(null)}
        onSuccess={() => setEditingProject(null)}
      />
    );
  }

  // ✅ Normal script edit
  return (
    <CreateScript
      project={editingProject}
      onClose={() => setEditingProject(null)}
      onSuccess={() => setEditingProject(null)}
      creatorRole={Role.WRITER}
    />
  );
}

  // If viewing project details
  if (selectedProject) {
    const isReadOnly = isProjectOpenedByReviewers(selectedProject);
      const parsedData = selectedProject.data;
  const isIdeaProject = parsedData?.source === 'IDEA_PROJECT';
    return (
      <div className="p-8 space-y-6 animate-fade-in">
        <button
          onClick={() => setSelectedProject(null)}
          className="font-black underline text-sm"
        >
          ← Back to My Work
        </button>
         {selectedProject &&
    isIdeaApprovedByCEO(selectedProject) &&
    selectedProject.data?.brief && (
      <div className="border-2 border-black bg-yellow-50 p-5 shadow">
        <h3 className="font-black uppercase mb-2">
          Approved Idea Description
        </h3>
        <p className="text-slate-800 whitespace-pre-wrap">
          {selectedProject.data.brief}
        </p>
      </div>
    )}

        <div className="flex justify-between items-start">
          <h1 className="text-3xl font-black uppercase">
            {selectedProject.title}
          </h1>
          {isReadOnly && (
            <span className="bg-red-100 text-red-800 px-3 py-1 border-2 border-red-300 text-sm font-black uppercase">
              Read Only
            </span>
          )}
        </div>

        {/* STATUS BAR */}
        <div className="flex justify-between border-2 border-black p-4 bg-slate-50">
          <span className="font-black uppercase">
            Status: {selectedProject.status}
          </span>
          <span className="text-sm text-slate-500">
            Updated: {format(new Date(selectedProject.updated_at || selectedProject.created_at), 'MMM dd, yyyy h:mm a')}
          </span>
        </div>

        {/* SCRIPT CONTENT */}
        {/* CONTENT */}
<div className="border-2 border-black bg-white p-6 shadow">
  <h3 className="font-black uppercase mb-3">
    {isIdeaProject ? 'Idea Description' : 'Script Content'}
  </h3>

  {isIdeaProject
    ? parsedData?.idea_description 
      ? <div className="whitespace-pre-wrap text-sm text-slate-900" dangerouslySetInnerHTML={{ __html: parsedData.idea_description }} />
      : 'No idea description found'
    : parsedData?.script_content 
      ? <div className="whitespace-pre-wrap text-sm text-slate-900" dangerouslySetInnerHTML={{ __html: parsedData.script_content }} />
      : 'No script found'}
</div>

        
        {/* COMMENTS SECTION */}
{reviewComments.length > 0 && (
  <div className="border-2 border-black bg-red-50 p-6 shadow">
    <h3 className="font-black uppercase mb-3 text-red-700">
      {selectedProject.data?.source === 'IDEA_PROJECT' ? 'Rework Comments' : 'Reviewer Comments'}
    </h3>

    {reviewComments.map((c, i) => (
      <div key={i} className="mb-4">
        <p className="font-black text-sm text-slate-900">
          {c.actor_name} ({c.action})
        </p>
        <p className="text-sm text-slate-700 whitespace-pre-wrap">
          {c.comment}
        </p>
        <p className="text-xs text-slate-500">
          {format(new Date(c.timestamp), 'MMM dd, yyyy h:mm a')}
        </p>
      </div>
    ))}
  </div>
)}

      </div>
    );
  }
  
  // List view
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-3xl font-black uppercase text-slate-900">
          My Work
        </h2>
        <p className="text-slate-600 font-medium">
          All your assigned and submitted projects
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-2 mb-4">
        <button
          className={`px-4 py-2 font-bold uppercase border-2 ${activeTab === 'IDEA' ? 'bg-[#D946EF] text-white border-black' : 'bg-white text-black border-black'} shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`}
          onClick={() => setActiveTab('IDEA')}
        >
          Idea
        </button>
        <button
          className={`px-4 py-2 font-bold uppercase border-2 ${activeTab === 'SCRIPT' ? 'bg-[#D946EF] text-white border-black' : 'bg-white text-black border-black'} shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`}
          onClick={() => setActiveTab('SCRIPT')}
        >
          Script
        </button>
      </div>

      <div className="grid gap-4">
        {displayProjects.length === 0 ? (
          <div className="bg-slate-50 border-2 border-dashed border-slate-300 p-12 text-center">
            <CheckCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-black uppercase text-slate-400">
              All Caught Up!
            </h3>
            <p className="text-slate-500">No projects yet</p>
          </div>
        ) : (
          displayProjects.map(task => (
            <div
              key={task.id}
              onClick={async (e) => {
                e.stopPropagation();
                
                // Check if this is a rework project that the writer can edit
                const isReworkNotOpened = isReworkProject(task) && !isReworkOpenedByNextReviewer(task);
                
                if (canModifyProject(task, user.id) || isReworkNotOpened) {
                  // For rework projects or projects that can be modified, go directly to edit mode
                  setEditingProject(task);
                } else {
                  // Otherwise, show the details view
                  setSelectedProject(task);
                  
                  const { data, error } = await import('../../src/integrations/supabase/client')
                    .then(m => m.supabase)
                    .then(async (supabase) => {
                      // First, get the current user's ID
                      const { data: { session } } = await supabase.auth.getSession();
                      const currentUserId = session?.user?.id;
                      
                      // Fetch all workflow history
                      const { data: historyData, error: historyError } = await supabase
                        .from('workflow_history')
                        .select('action, comment, actor_name, timestamp, actor_id')
                        .eq('project_id', task.id)
                        .in('action', ['REJECTED', 'REWORK', 'APPROVED'])
                        .order('timestamp', { ascending: false });
                      
                      if (historyError) {
                        throw historyError;
                      }
                      
                      // Filter comments to show only relevant ones for the current user:
                      const filteredComments = historyData?.filter(comment => {
                        // For REWORK/REJECTED actions, only show if:
                        // 1. The comment is assigned to the current user specifically
                        // 2. OR the project is assigned to the current user's role and user
                        if (comment.action === 'REWORK' || comment.action === 'REJECTED') {
                          // Check if this rework was specifically for the current user
                          const isForCurrentUser = task.assigned_to_user_id === currentUserId && 
                                                  task.assigned_to_role === user.role;
                          
                          // Check if the comment mentions the current user
                          const mentionsCurrentUser = comment.comment?.includes(`@${currentUserId}`);
                          
                          // Show if either condition is met
                          return isForCurrentUser || mentionsCurrentUser;
                        }
                        
                        // Always show APPROVED comments (informative for everyone)
                        if (comment.action === 'APPROVED') {
                          return true;
                        }
                        
                        // Show comments from the project creator
                        if (comment.actor_id === task.created_by_user_id) {
                          return true;
                        }
                        
                        return false;
                      }) || [];
                      
                      return { data: filteredComments, error: null };
                    });
                  
                  if (!error) {
                    setReviewComments(data || []);
                  }
                }
              }}
              className={`bg-white p-6 border-2 border-black cursor-pointer shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all ${task.priority === 'HIGH' ? 'ring-4 ring-red-500 ring-offset-2' : ''}`}
            >
              {/* HEADER */}
              <div className="flex justify-between items-start mb-4">
                <span
                  className={`px-3 py-1 text-xs font-black uppercase border-2 border-black ${
                    task.channel === 'YOUTUBE'
                      ? 'bg-[#FF4F4F] text-white'
                      : task.channel === 'LINKEDIN'
                      ? 'bg-[#0085FF] text-white'
                      : 'bg-[#D946EF] text-white'
                  }`}
                >
                  {task.channel}
                </span>
                
                {/* Show IDEA badge for idea projects */}
                {(task.data?.source === 'IDEA_PROJECT' || !task.data?.script_content) && (
                  <span className="px-3 py-1 text-xs font-black uppercase border-2 border-black bg-purple-100 text-purple-900">
                    IDEA
                  </span>
                )}
                
                <span
                  className={`px-3 py-1 text-xs font-black uppercase border-2 border-black ${task.priority === 'HIGH'
                        ? 'bg-red-500 text-white'
                        : task.priority === 'NORMAL'
                            ? 'bg-yellow-500 text-black'
                            : 'bg-green-500 text-white'
                    }`}
                >
                  {task.priority}
                </span>
                
                <span
                  className={`px-3 py-1 text-xs font-black uppercase border-2 ${
                    // Use role-specific workflow state detection
                    (() => {
                      const workflowState = getWorkflowStateForRole(task, user.role);
                      if (workflowState.isTargetedRework || workflowState.isRework)
                        return 'bg-orange-100 text-orange-800 border-2 border-orange-600';
                      else if (workflowState.isRejected)
                        return 'bg-red-100 text-red-700 border-red-600';
                      else if (task.status === TaskStatus.DONE)
                        return 'bg-green-100 text-green-700 border-green-600';
                      else
                        return 'bg-blue-100 text-blue-700 border-blue-600';
                    })()
                  }`}
                >
                  {(() => {
                    const workflowState = getWorkflowStateForRole(task, user.role);
                    if (workflowState.isTargetedRework || workflowState.isRework)
                      return 'Rework';
                    else if (workflowState.isRejected)
                      return 'Rejected';
                    else if (task.status === TaskStatus.DONE)
                      return 'Approved';
                    else
                      return 'In Progress';
                  })()}
                </span>
              </div>

              {/* TITLE */}
              <h3 className="text-2xl font-black uppercase mb-2">
                {task.title}
              </h3>

              {/* BRIEF */}
              {task.data?.brief && (
                <p className="text-slate-600 mb-4">{task.data.brief}</p>
              )}

              {/* FOOTER */}
              <div className="flex justify-between items-center border-t pt-3 text-sm">
                <div className="flex items-center font-bold text-slate-500 uppercase">
                  <Clock className="w-4 h-4 mr-2" />
                  Created: {format(new Date(task.created_at), 'MMM dd, yyyy h:mm a')}
                </div>

                <div className="flex items-center space-x-3">
                  <button 
                    className="flex items-center font-bold uppercase text-blue-600 hover:text-blue-800"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedProject(task);
                      
                      // Fetch comments for the selected project
                      const fetchComments = async () => {
                        const { data, error } = await import('../../src/integrations/supabase/client')
                          .then(m => m.supabase)
                          .then(async (supabase) => {
                            // First, get the current user's ID
                            const { data: { session } } = await supabase.auth.getSession();
                            const currentUserId = session?.user?.id;
                            
                            // Fetch all workflow history
                            const { data: historyData, error: historyError } = await supabase
                              .from('workflow_history')
                              .select('action, comment, actor_name, timestamp, actor_id')
                              .eq('project_id', task.id)
                              .in('action', ['REJECTED', 'REWORK', 'APPROVED'])
                              .order('timestamp', { ascending: false });
                            
                            if (historyError) {
                              throw historyError;
                            }
                            
                            // Filter comments to show only relevant ones for the current user:
                            const filteredComments = historyData?.filter(comment => {
                              // For REWORK/REJECTED actions, only show if:
                              // 1. The comment is assigned to the current user specifically
                              // 2. OR the project is assigned to the current user's role and user
                              if (comment.action === 'REWORK' || comment.action === 'REJECTED') {
                                // Check if this rework was specifically for the current user
                                const isForCurrentUser = task.assigned_to_user_id === currentUserId && 
                                                        task.assigned_to_role === user.role;
                                
                                // Check if the comment mentions the current user
                                const mentionsCurrentUser = comment.comment?.includes(`@${currentUserId}`);
                                
                                // Show if either condition is met
                                return isForCurrentUser || mentionsCurrentUser;
                              }
                              
                              // Always show APPROVED comments (informative for everyone)
                              if (comment.action === 'APPROVED') {
                                return true;
                              }
                              
                              // Show comments from the project creator
                              if (comment.actor_id === task.created_by_user_id) {
                                return true;
                              }
                              
                              return false;
                            }) || [];
                            
                            return { data: filteredComments, error: null };
                          });
                        
                        if (!error) {
                          setReviewComments(data || []);
                        }
                      };
                      
                      fetchComments();
                    }}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    View
                  </button>
   {canModifyProject(task, user.id) && (
  <button
    className="flex items-center font-bold uppercase text-green-600 hover:text-green-800"
    onClick={(e) => {
      e.stopPropagation();
      setEditingProject(task);
    }}
  >
    <Edit3 className="w-4 h-4 mr-2" />
    Edit
  </button>
)}


                  
    {canModifyProject(task, user.id) && (
  <button
    className="flex items-center font-bold uppercase text-red-600 hover:text-red-800"
    onClick={async (e) => {
      e.stopPropagation();

      if (!window.confirm(`Are you sure you want to delete the project "${task.title}"? This action cannot be undone.`)) {
        return;
      }

      try {
        await db.projects.delete(task.id);
        window.location.reload();
      } catch (error) {
        console.error('Error deleting project:', error);
        alert('Failed to delete project. Please try again.');
      }
    }}
  >
    <Trash2 className="w-4 h-4 mr-2" />
    Delete
  </button>
)}

                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default WriterMyWork;
