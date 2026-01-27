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

import { useSearchParams } from 'react-router-dom';

const WriterMyWork: React.FC<Props> = ({ user, projects }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [reviewComments, setReviewComments] = useState<any[]>([]);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [scriptFromIdea, setScriptFromIdea] = useState<Project | null>(null);

  const activeTab = (searchParams.get('type') as 'IDEA' | 'SCRIPT') || 'IDEA';
  const setActiveTab = (tab: 'IDEA' | 'SCRIPT') => {
    setSearchParams(prev => {
      prev.set('type', tab);
      return prev;
    }, { replace: true });
  };

  const scriptFilter = searchParams.get('filter') || 'ALL';
  const setScriptFilter = (filter: string) => {
    setSearchParams(prev => {
      prev.set('filter', filter);
      return prev;
    }, { replace: true });
  };
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

    // NEW: Check if this is a rework project from MULTI_WRITER_APPROVAL with a specific target role
    const isReworkFromMultiWriterApproval =
      project.status === 'REWORK' &&
      project.data?.rework_initiator_stage === 'MULTI_WRITER_APPROVAL' &&
      project.data?.rework_target_role;

    // If it's a rework project from MULTI_WRITER_APPROVAL with a target role,
    // only allow modification if the target role matches the writer role
    if (isReworkFromMultiWriterApproval) {
      return (
        project.created_by_user_id === userId &&
        project.data?.rework_target_role === 'WRITER'
      );
    }

    return (
      project.created_by_user_id === userId &&
      (!isProjectOpenedByReviewers(project) || isReworkNotOpened || isIdeaRework)
    );
  };

  // Determine which projects to display based on active tab
  const filteredScriptProjects = scriptProjects.filter(project => {
    if (scriptFilter === 'ALL') return true;
    if (scriptFilter === 'POSTED') return project.status === 'DONE';

    // For other filters, we check the assigned_to_role
    // Note: We only show non-completed projects for role-based filters
    if (project.status === 'DONE') return false;

    switch (scriptFilter) {
      case 'WRITER': return project.assigned_to_role === 'WRITER';
      case 'CMO': return project.assigned_to_role === 'CMO';
      case 'CEO': return project.assigned_to_role === 'CEO';
      case 'CINE': return project.assigned_to_role === 'CINE';
      case 'EDITOR': return project.assigned_to_role === 'EDITOR' || project.assigned_to_role === 'SUB_EDITOR';
      case 'DESIGNER': return project.assigned_to_role === 'DESIGNER';
      case 'OPS': return project.assigned_to_role === 'OPS';
      default: return true;
    }
  });

  const displayProjects = activeTab === 'IDEA' ? ideaProjects : filteredScriptProjects;

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
      <div className="space-y-6 animate-fade-in">
        {/* Back button */}
        <button
          onClick={() => setSelectedProject(null)}
          className="flex items-center text-sm font-black text-slate-700 hover:text-slate-900 py-2 px-4 bg-gray-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
        >
          ← Back to My Work
        </button>

        <div className="space-y-6">
          {/* Basic Info Section */}
          <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="text-2xl font-black uppercase mb-4">Project Details</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Title</h3>
                <p className="font-medium bg-slate-50 p-2">{selectedProject.title}</p>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Channel</h3>
                <p className="font-medium bg-slate-50 p-2">{selectedProject.channel}</p>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Writer</h3>
                <p className="font-medium bg-slate-50 p-2">
                  {selectedProject.writer_name || '—'}
                </p>
              </div>
              {selectedProject.data?.source !== 'IDEA_PROJECT' && (
                <div>
                  <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Editor</h3>
                  <p className="font-medium bg-slate-50 p-2">
                    {selectedProject.editor_name || selectedProject.sub_editor_name || selectedProject.data?.editor_name || selectedProject.data?.sub_editor_name || '—'}
                  </p>
                </div>
              )}
              <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Status</h3>
                <p className="font-medium bg-slate-50 p-2">{selectedProject.status}</p>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Current Stage</h3>
                <p className="font-medium bg-slate-50 p-2">{selectedProject.current_stage ? selectedProject.current_stage.replace(/_/g, ' ') : 'N/A'}</p>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Priority</h3>
                <span className={`inline-block px-2 py-1 text-xs font-black uppercase border-2 border-black ${selectedProject.priority === 'HIGH'
                  ? 'bg-red-500 text-white'
                  : selectedProject.priority === 'NORMAL'
                    ? 'bg-yellow-500 text-black'
                    : 'bg-green-500 text-white'
                  }`}>
                  {selectedProject.priority}
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Assigned To</h3>
                <p className="font-medium bg-slate-50 p-2">{selectedProject.assigned_to_role || 'Unassigned'}</p>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Created At</h3>
                <p className="font-medium bg-slate-50 p-2">{new Date(selectedProject.created_at).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Script Content Section */}
          {(selectedProject.data?.script_content || selectedProject.data?.idea_description) && (
            <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="text-lg font-black uppercase mb-4">
                {selectedProject.data?.source === 'IDEA_PROJECT' ? 'Idea Description' : 'Script Content'}
              </h3>
              <div className="max-h-60 overflow-y-auto border-2 border-gray-200 p-4 bg-gray-50">
                {selectedProject.data?.script_content || selectedProject.data?.idea_description ? (
                  <div
                    className="whitespace-pre-wrap font-sans text-sm"
                    dangerouslySetInnerHTML={{
                      __html: (() => {
                        let content = selectedProject.data?.script_content || selectedProject.data?.idea_description || 'No content available';
                        if (content !== 'No content available') {
                          // Decode HTML entities to properly display the content
                          content = content
                            .replace(/&lt;/g, '<')
                            .replace(/&gt;/g, '>')
                            .replace(/&amp;/g, '&')
                            .replace(/&quot;/g, '"')
                            .replace(/&#39;/g, "'")
                            .replace(/&nbsp;/g, ' ');
                        }
                        return content;
                      })()
                    }}
                  />
                ) : (
                  <pre className="whitespace-pre-wrap font-sans text-sm">
                    No content available
                  </pre>
                )}

                {/* Show cinematographer comments if available */}
                {selectedProject.data?.cine_comments && (
                  <div className="mt-2 pt-2 border-t border-slate-200">
                    <p className="text-xs font-bold text-blue-700 uppercase">Cinematographer Note:</p>
                    <p className="text-xs text-slate-600 whitespace-pre-wrap">{selectedProject.data.cine_comments}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Workflow Status Section */}
          <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <h3 className="text-lg font-black uppercase mb-4">Workflow Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-bold text-slate-500 uppercase mb-1">Current Stage</h4>
                <p className="font-medium bg-slate-50 p-2">{selectedProject.current_stage ? selectedProject.current_stage.replace(/_/g, ' ') : 'N/A'}</p>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-500 uppercase mb-1">Status</h4>
                <span className={`inline-block px-2 py-1 text-xs font-black uppercase border-2 border-black ${selectedProject.status === 'DONE'
                  ? 'bg-green-500 text-white'
                  : selectedProject.status === 'WAITING_APPROVAL'
                    ? 'bg-yellow-500 text-black'
                    : 'bg-blue-500 text-white'
                  }`}>
                  {selectedProject.status}
                </span>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-500 uppercase mb-1">Rework Indicator</h4>
                <p className="font-medium bg-slate-50 p-2">
                  {selectedProject.history?.some(h => h.action === 'REJECTED' || h.action.startsWith('REWORK')) ? 'Yes' : 'No'}
                </p>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-500 uppercase mb-1">Project Type</h4>
                <span className="inline-block px-2 py-1 text-xs font-black uppercase border-2 border-black bg-purple-100 text-purple-900">
                  {selectedProject.data?.source === 'IDEA_PROJECT' ? (selectedProject.data?.script_content ? 'IDEA-TO-SCRIPT' : 'IDEA') : 'SCRIPT'}
                </span>
              </div>
            </div>
          </div>

          {/* Comments and Feedback Section */}
          <div className="border-2 border-black p-6 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <h3 className="text-xl font-black uppercase mb-6 border-b-2 border-black pb-3 text-slate-900">
              Project Comments & Feedback
            </h3>

            {/* Display current project dates if they exist */}
            {(selectedProject?.shoot_date || selectedProject?.delivery_date || selectedProject?.post_scheduled_date) && (
              <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {selectedProject?.shoot_date && (
                    <div className="flex items-center">
                      <span className="mr-2 font-bold text-slate-700">📅 Shoot Date:</span>
                      <span className="font-bold text-green-600">{format(new Date(selectedProject.shoot_date), 'dd-MM-yyyy')}</span>
                    </div>
                  )}
                  {selectedProject?.delivery_date && (
                    <div className="flex items-center">
                      <span className="mr-2 font-bold text-slate-700">📦 Delivery Date:</span>
                      <span className="font-bold text-blue-600">{format(new Date(selectedProject.delivery_date), 'dd-MM-yyyy')}</span>
                    </div>
                  )}
                  {selectedProject?.post_scheduled_date && (
                    <div className="flex items-center">
                      <span className="mr-2 font-bold text-slate-700">🗓️ Post Date:</span>
                      <span className="font-bold text-purple-600">{format(new Date(selectedProject.post_scheduled_date), 'dd-MM-yyyy')}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Display comments */}
            {reviewComments.length > 0 ? (
              <div className="space-y-6 bg-white border-2 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                {reviewComments.map((comment, index) => {
                  // Determine the description based on stage and action
                  let description = `${comment.action} in ${comment.stage}`;

                  switch (comment.stage) {
                    case 'SCRIPT':
                      if (comment.action === 'SUBMITTED') {
                        description = 'Project submitted by writer';
                      }
                      break;
                    case 'SCRIPT_REVIEW_L1':
                      if (comment.action === 'APPROVED') {
                        description = 'Project approved by CMO';
                      } else if (comment.action === 'REWORK') {
                        description = 'CMO requested rework';
                      }
                      break;
                    case 'FINAL_REVIEW_CMO':
                      if (comment.action === 'APPROVED') {
                        description = 'Project approved by CMO';
                      } else if (comment.action === 'REWORK') {
                        description = 'CMO requested rework';
                      }
                      break;
                    case 'FINAL_REVIEW_CEO':
                      if (comment.action === 'APPROVED') {
                        description = 'Project approved by CEO';
                      } else if (comment.action === 'REWORK') {
                        description = 'CEO requested rework';
                      }
                      break;
                    case 'MULTI_WRITER_APPROVAL':
                      if (comment.action === 'APPROVED') {
                        description = 'Writer approved the final video';
                      } else if (comment.action === 'SUBMITTED') {
                        description = 'All writers have approved - Project advanced to CMO for final review';
                      }
                      break;
                    case 'CINEMATOGRAPHY':
                      if (comment.action === 'SUBMITTED') {
                        description = 'Raw video uploaded by cinematographer';
                      }
                      break;
                    case 'VIDEO_EDITING':
                      if (comment.action === 'SUBMITTED') {
                        description = 'Edited video uploaded by editor';
                      }
                      break;
                    case 'SUB_EDITOR_PROCESSING':
                      if (comment.action === 'SUBMITTED') {
                        description = 'Edited video uploaded by sub-editor';
                      } else if (comment.action === 'APPROVED') {
                        description = 'Sub-editor completed processing';
                      }
                      break;
                    case 'THUMBNAIL_DESIGN':
                      if (comment.action === 'SUBMITTED') {
                        description = 'Assets uploaded by designer';
                      }
                      break;
                    default:
                      // Handle special actions that might not have a specific stage mapping
                      if (comment.action === 'SET_SHOOT_DATE') {
                        description = 'Shoot date set';
                      } else if (comment.action === 'SET_DELIVERY_DATE') {
                        description = 'Delivery date set';
                      } else if (comment.action === 'REWORK_VIDEO_SUBMITTED') {
                        description = 'Rework video uploaded';
                      } else if (comment.action === 'SUB_EDITOR_ASSIGNED') {
                        description = 'Project assigned to sub-editor';
                      } else {
                        description = `${comment.action} in ${comment.stage}`;
                      }
                  }

                  return (
                    <div key={`${comment.stage}-${comment.action}-${comment.timestamp}-${comment.actor_id || comment.actor_name}`} className={`border-l-4 pl-4 py-2 ${comment.action === 'APPROVED' ? 'border-green-500' : comment.action === 'REWORK' ? 'border-yellow-500' : 'border-red-500'}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-slate-900">{comment.actor_name}</p>
                          <p className="text-sm text-slate-600">{format(new Date(comment.timestamp), 'MMM dd, yyyy h:mm a')}</p>
                        </div>
                        <span className={`px-2 py-1 text-xs font-bold uppercase ${comment.action === 'APPROVED' ? 'bg-green-100 text-green-800' : comment.action === 'REWORK' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                          {comment.action}
                        </span>
                      </div>
                      <p className="mt-2 text-slate-700">{comment.comment || description}</p>
                      {/* Display shoot date and delivery date based on action type */}
                      {comment.action === 'SET_SHOOT_DATE' && (
                        <div className="mt-2 text-sm text-slate-600 font-bold">
                          📅 Shoot Date: <span className="text-green-600">{comment.comment}</span>
                        </div>
                      )}
                      {comment.action === 'SET_DELIVERY_DATE' && (
                        <div className="mt-2 text-sm text-slate-600 font-bold">
                          📅 Delivery Date: <span className="text-blue-600">{comment.comment}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-gray-400 mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-gray-500 italic font-medium">Comments and feedback will appear here as they are added</p>
                <p className="text-sm text-gray-400 mt-1">No comments or feedback recorded yet</p>
              </div>
            )}
          </div>
        </div>
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
          className={`px-4 py-2 font-bold uppercase border-2 transition-all ${activeTab === 'IDEA'
            ? 'bg-[#D946EF] text-white border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
            : 'bg-white text-black border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
            }`}
          onClick={() => setActiveTab('IDEA')}
        >
          Idea
        </button>
        <button
          className={`px-4 py-2 font-bold uppercase border-2 transition-all ${activeTab === 'SCRIPT'
            ? 'bg-[#0085FF] text-white border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
            : 'bg-white text-black border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
            }`}
          onClick={() => setActiveTab('SCRIPT')}
        >
          Script
        </button>
      </div>

      {/* Script Role Filters */}
      {activeTab === 'SCRIPT' && (
        <div className="flex flex-wrap gap-2 mb-6 p-4 bg-slate-50 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          {[
            { id: 'ALL', label: 'All Projects', color: 'bg-slate-900', textColor: 'text-white' },
            { id: 'WRITER', label: 'Writer', color: 'bg-yellow-400', textColor: 'text-black' },
            { id: 'CMO', label: 'CMO', color: 'bg-indigo-600', textColor: 'text-white' },
            { id: 'CEO', label: 'CEO', color: 'bg-violet-700', textColor: 'text-white' },
            { id: 'CINE', label: 'Cine', color: 'bg-cyan-500', textColor: 'text-white' },
            { id: 'EDITOR', label: 'Editor', color: 'bg-orange-500', textColor: 'text-white' },
            { id: 'DESIGNER', label: 'Designer', color: 'bg-pink-500', textColor: 'text-white' },
            { id: 'OPS', label: 'Ops', color: 'bg-red-500', textColor: 'text-white' },
            { id: 'POSTED', label: 'Posted', color: 'bg-emerald-500', textColor: 'text-white' },
          ].map((filter) => (
            <button
              key={filter.id}
              onClick={() => setScriptFilter(filter.id)}
              className={`px-3 py-1.5 text-xs font-black uppercase border-2 border-black transition-all ${scriptFilter === filter.id
                ? `${filter.color} ${filter.textColor} shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]`
                : 'bg-white text-slate-600 hover:bg-slate-100'
                }`}
            >
              {filter.label}
              {filter.id === 'ALL' ? '' : ` (${filter.id === 'POSTED'
                ? scriptProjects.filter(p => p.status === 'DONE').length
                : scriptProjects.filter(p => {
                  if (p.status === 'DONE') return false;
                  if (filter.id === 'EDITOR') return p.assigned_to_role === 'EDITOR' || p.assigned_to_role === 'SUB_EDITOR';
                  return p.assigned_to_role === filter.id;
                }).length
                })`}
            </button>
          ))}
        </div>
      )}

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
                  className={`px-3 py-1 text-xs font-black uppercase border-2 border-black ${task.channel === 'YOUTUBE'
                    ? 'bg-[#FF4F4F] text-white'
                    : task.channel === 'LINKEDIN'
                      ? 'bg-[#0085FF] text-white'
                      : 'bg-[#D946EF] text-white'
                    }`}
                >
                  {task.channel}
                </span>

                {task.content_type === 'CREATIVE_ONLY' && (
                  <span className="px-3 py-1 text-xs font-black uppercase border-2 border-black bg-yellow-400 text-black">
                    CREATIVE
                  </span>
                )}

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

              {/* CINEMATOGRAPHER COMMENTS PREVIEW */}
              {task.data?.cine_comments && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
                  <p className="text-xs font-bold text-blue-700 uppercase mb-1">Cinematographer Note:</p>
                  <p className="text-xs text-slate-600 whitespace-pre-wrap truncate max-h-12 overflow-hidden">
                    {task.data.cine_comments}
                  </p>
                </div>
              )}

              {/* Show live URL for completed projects */}
              {task.status === 'DONE' && task.data?.live_url && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-green-800 uppercase">Live URL</span>
                    <a
                      href={task.data.live_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-blue-600 hover:underline truncate max-w-[120px]"
                      title={task.data.live_url}
                    >
                      View Live
                    </a>
                  </div>
                  <div className="text-xs text-slate-600 truncate" title={task.data.live_url}>
                    {task.data.live_url}
                  </div>
                </div>
              )}

              {/* FOOTER */}
              <div className="flex flex-col space-y-2 border-t pt-3 text-sm">
                {/* Cinematographer Comments */}
                {task.data?.cine_comments && (
                  <div className="flex items-start">
                    <span className="text-xs font-bold uppercase text-blue-700 mr-2">Cine Note:</span>
                    <p className="text-xs text-slate-600 whitespace-pre-wrap truncate max-w-xs">
                      {task.data.cine_comments}
                    </p>
                  </div>
                )}

                <div className="flex items-center font-bold text-slate-500 uppercase">
                  <span className="mr-2 text-lg leading-none">📌</span>
                  Stage: <span className="text-slate-900 ml-1">{task.current_stage ? task.current_stage.replace(/_/g, ' ') : 'N/A'}</span>
                </div>

                <div className="flex items-center font-bold text-slate-500 uppercase">
                  <Clock className="w-4 h-4 mr-2" />
                  Created: {format(new Date(task.created_at), 'MMM dd, yyyy h:mm a')}
                </div>

                <div className="flex items-center space-x-3 self-end">
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
