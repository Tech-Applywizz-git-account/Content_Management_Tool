import React, { useState } from 'react';
import { Project, Role, TaskStatus, WorkflowStage } from '../../types';
import { Clock, FileText, CheckCircle, Edit3, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import CreateScript from './CreateScript';
import { db } from '../../services/supabaseDb';

interface Props {
  user: { full_name: string; role: Role };
  projects: Project[];
}

const WriterMyWork: React.FC<Props> = ({ user, projects }) => {
  // ✅ hooks MUST be inside component
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [reviewComments, setReviewComments] = useState<any[]>([]);
  const [editingProject, setEditingProject] = useState<Project | null>(null);


  // Remove duplicate projects based on ID
  const myTasks: Project[] = Array.from(
  new Map<string, Project>(
    (projects || [])
      .filter(project =>
        project.created_by === user.id ||  // Projects created by this user
        project.history?.some(h => h.actor_id === user.id) || // Projects user worked on
        project.assigned_to_user_id === user.id // Projects assigned to user
      )
      .map(project => [project.id, project])
  ).values()
);


  /* ===============================
     DETAIL VIEW (SCRIPT VIEW)
  =============================== */
  if (selectedProject) {
    return (
      <div className="p-8 space-y-6 animate-fade-in">
        <button
          onClick={() => setSelectedProject(null)}
          className="font-black underline text-sm"
        >
          ← Back to My Work
        </button>

        <h1 className="text-3xl font-black uppercase">
          {selectedProject.title}
        </h1>

        {/* STATUS BAR */}
        <div className="flex justify-between border-2 border-black p-4 bg-slate-50">
          <span className="font-black uppercase">
            Status: {selectedProject.status}
          </span>
          <span className="text-sm text-slate-500">
            Updated{' '}
            {formatDistanceToNow(
              new Date(selectedProject.updated_at || selectedProject.created_at)
            )}{' '}
            ago
          </span>
        </div>

        {/* SCRIPT CONTENT */}
        <div className="border-2 border-black bg-white p-6 shadow">
          <h3 className="font-black uppercase mb-3">Script Content</h3>
          <pre className="whitespace-pre-wrap text-sm text-slate-900">
            {selectedProject.data?.script_content || 'No script found'}
          </pre>
        </div>
        {/* REVIEWER COMMENTS */}
{reviewComments.length > 0 && (
  <div className="border-2 border-black bg-red-50 p-6 shadow">
    <h3 className="font-black uppercase mb-3 text-red-700">
      Reviewer Comments
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
          {formatDistanceToNow(new Date(c.timestamp))} ago
        </p>
      </div>
    ))}
  </div>
)}

      </div>
    );
  }

  /* ===============================
     MAIN VIEW - Show edit modal OR list view
  =============================== */
  
  // If editing project, show the CreateScript component
  if (editingProject) {
    return (
      <CreateScript 
        project={editingProject} 
        onClose={() => setEditingProject(null)} 
        onSuccess={() => {
          setEditingProject(null);
          // Optionally refresh data here if needed
        }}
        creatorRole={Role.WRITER}
      />
    );
  }
  
  // If viewing project details
  if (selectedProject) {
    return (
      <div className="p-8 space-y-6 animate-fade-in">
        <button
          onClick={() => setSelectedProject(null)}
          className="font-black underline text-sm"
        >
          ← Back to My Work
        </button>

        <h1 className="text-3xl font-black uppercase">
          {selectedProject.title}
        </h1>

        {/* STATUS BAR */}
        <div className="flex justify-between border-2 border-black p-4 bg-slate-50">
          <span className="font-black uppercase">
            Status: {selectedProject.status}
          </span>
          <span className="text-sm text-slate-500">
            Updated{' '}
            {formatDistanceToNow(
              new Date(selectedProject.updated_at || selectedProject.created_at)
            )}{' '}
            ago
          </span>
        </div>

        {/* SCRIPT CONTENT */}
        <div className="border-2 border-black bg-white p-6 shadow">
          <h3 className="font-black uppercase mb-3">Script Content</h3>
          <pre className="whitespace-pre-wrap text-sm text-slate-900">
            {selectedProject.data?.script_content || 'No script found'}
          </pre>
        </div>
        {/* REVIEWER COMMENTS */}
{reviewComments.length > 0 && (
  <div className="border-2 border-black bg-red-50 p-6 shadow">
    <h3 className="font-black uppercase mb-3 text-red-700">
      Reviewer Comments
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
          {formatDistanceToNow(new Date(c.timestamp))} ago
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

      <div className="grid gap-4">
        {myTasks.length === 0 ? (
          <div className="bg-slate-50 border-2 border-dashed border-slate-300 p-12 text-center">
            <CheckCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-black uppercase text-slate-400">
              All Caught Up!
            </h3>
            <p className="text-slate-500">No projects yet</p>
          </div>
        ) : (
          myTasks.map(task => (
            <div
              key={task.id}
              onClick={async () => {
  setSelectedProject(task);

  const { data, error } = await import('../../src/integrations/supabase/client')
    .then(m => m.supabase)
    .then(supabase =>
      supabase
        .from('workflow_history')
        .select('action, comment, actor_name, timestamp')
        .eq('project_id', task.id)
        .in('action', ['REJECTED', 'REWORK', 'APPROVED'])
        .order('timestamp', { ascending: false })
    );

  if (!error) {
    setReviewComments(data || []);
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
                    // Check if this is a rework project (REWORK action in history)
                    task.history?.some(h => h.action === 'REWORK')
                      ? 'bg-orange-100 text-orange-800 border-2 border-orange-600'
                      : task.history?.some(h => h.action === 'REJECTED')
                      ? 'bg-red-100 text-red-700 border-red-600'
                      : task.status === TaskStatus.DONE
                      ? 'bg-green-100 text-green-700 border-green-600'
                      : 'bg-blue-100 text-blue-700 border-blue-600'
                  }`}
                >
                  {task.history?.some(h => h.action === 'REWORK')
                    ? 'Rework'
                    : task.history?.some(h => h.action === 'REJECTED')
                    ? 'Rejected'
                    : task.status === TaskStatus.DONE
                    ? 'Approved'
                    : 'In Progress'}
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
                  Created{' '}
                  {formatDistanceToNow(new Date(task.created_at))} ago
                </div>

                <div className="flex items-center space-x-3">
                  <button 
                    className="flex items-center font-bold uppercase text-blue-600 hover:text-blue-800"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedProject(task);
                    }}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    View
                  </button>
                  
                  {/* Show Edit button for scripts that can be edited */}
                  {task.created_by === user.id && (
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
                  
                  {/* Show Delete button for scripts that can be deleted */}
                  {task.created_by === user.id && (
                    <button 
                      className="flex items-center font-bold uppercase text-red-600 hover:text-red-800"
                      onClick={async (e) => {
                        e.stopPropagation();
                        
                        // Confirmation dialog
                        if (!window.confirm(`Are you sure you want to delete the script "${task.title}"? This action cannot be undone.`)) {
                          return;
                        }
                        
                        try {
                          // Delete the project from Supabase
                          await db.projects.delete(task.id);
                          
                          // Force a page refresh to update the list
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
};

export default WriterMyWork;
