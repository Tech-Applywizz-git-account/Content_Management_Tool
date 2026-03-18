import React from 'react';
import { Project, Role, TaskStatus } from '../../types';
import { Clock, FileText, CheckCircle, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { isReworkProject } from '../../services/workflowUtils';
import { db } from '../../services/supabaseDb';

interface Props {
  user: { full_name: string; role: Role };
  projects: Project[];
  onReview: (project: Project) => void;
}

const CmoMyWork: React.FC<Props> = ({ user, projects, onReview }) => {
  // ✅ Filter projects based on the correct status and current stage for CMO
  const myTasks = (projects || []).filter(p =>
    (
      p.assigned_to_role === Role.CMO ||  // Traditional assignment
      (p.visible_to_roles && p.visible_to_roles.includes('CMO'))  // Parallel visibility
    ) &&
    p.status === "WAITING_APPROVAL" &&  // The correct status value for pending approval
    (
      p.current_stage === "SCRIPT_REVIEW_L1" ||  // Checking for the appropriate stage
      p.current_stage === "FINAL_REVIEW_CMO" ||
      p.current_stage === "POST_WRITER_REVIEW"  // New stage for multi-writer approval
    )
  );

  console.log('Filtered myTasks:', myTasks); // Log to verify the filtered tasks

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-3xl font-black uppercase">My Work</h2>
        <p className="text-slate-600">
          Projects awaiting your approval
        </p>
      </div>

      <div className="grid gap-4">
        {myTasks.length === 0 ? (
          <div className="bg-slate-50 border-2 border-dashed p-12 text-center">
            <CheckCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-black uppercase text-slate-400">
              All Caught Up!
            </h3>
            <p className="text-slate-500">
              No pending approvals
            </p>
          </div>
        ) : (
          myTasks.map(task => (
            <div
              key={task.id}
              onClick={() => onReview(task)}
              className="bg-white p-6 border-2 border-black shadow hover:-translate-y-1 transition cursor-pointer"
            >
              <div className="flex justify-between mb-3">
                <span className="text-xs font-black uppercase border-2 px-2 py-1">
                  {task.channel}
                </span>
                <span
                  className={`text-xs font-black uppercase border-2 px-2 py-1 ${task.priority === 'HIGH'
                        ? 'bg-red-500 text-white'
                        : task.priority === 'NORMAL'
                            ? 'bg-yellow-500 text-black'
                            : 'bg-green-500 text-white'
                    }`}
                >
                  {task.priority}
                </span>
                <span className="text-xs font-black uppercase bg-blue-100 border-2 px-2 py-1">
                  {isReworkProject(task) ? 'Rework' : 'Pending Approval'}
                </span>
              </div>

              <h3 className="text-2xl font-black uppercase mb-2">
                {task.title}
              </h3>

              {task.data?.brief && (
                <p className="text-slate-600 mb-4">
                  {task.data.brief}
                </p>
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

                <div className="flex justify-between pt-3 border-t">
                <div className="flex flex-col">
                  <div className="flex items-center text-xs font-bold uppercase text-slate-500">
                    <Clock className="w-4 h-4 mr-2" />
                    By: {task.writer_name || task.data?.writer_name || task.created_by_name || 'Unknown Writer'}
                  </div>
                  <div className="flex items-center text-xs font-bold uppercase text-slate-500 mt-1">
                    Submitted {format(new Date(task.created_at), 'MMM dd, yyyy h:mm a')}
                  </div>
                </div>

                <div className="flex items-center">
                  <div className="flex items-center text-xs font-bold uppercase text-blue-600">
                    <FileText className="w-4 h-4 mr-2" />
                    Review Now
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CmoMyWork;
