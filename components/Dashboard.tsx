import React, { useState, useMemo, useEffect } from 'react';
import { Project, Role, TaskStatus, STAGE_LABELS, ROLE_LABELS } from '../types';
import { format } from 'date-fns';
import { Clock, CheckCircle, AlertCircle } from 'lucide-react';
import TaskDetail from './TaskDetail';
import { supabase } from '../src/integrations/supabase/client';

interface Props {
  user: { id: string; role: Role; full_name: string };
  projects: { inbox: Project[]; history: Project[] };
  refreshData: () => void;
}

const Dashboard: React.FC<Props> = ({ user, projects, refreshData }) => {
  const [filter, setFilter] = useState<'assigned' | 'watching' | 'all'>('assigned');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const filteredProjects = useMemo(() => {
    // Use inbox data for assigned/watching filters, history for all
    let list = filter === 'all' ? (projects.history || []) : (projects.inbox || []);
    
    if (filter === 'assigned') {
      // Show projects assigned to the user's role that are not done
      list = (projects.inbox || []).filter(p => p.assigned_to_role === user.role && p.status !== TaskStatus.DONE);
    } else if (filter === 'watching') {
      // Show projects the user has participated in that are not assigned to their role and not done
      list = (projects.inbox || []).filter(p => p.assigned_to_role !== user.role && p.status !== TaskStatus.DONE);
    }
    // For 'all', show all projects from getMyWork
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [projects, filter, user.role]);

  // Realtime: ask parent to refresh data when projects change
  useEffect(() => {
    const subscription = supabase
      .channel('public:projects:global_dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
        try { refreshData(); } catch (e) { console.error('Failed to refresh dashboard data', e); }
      })
      .subscribe();

    return () => { try { supabase.removeChannel(subscription); } catch (e) {} };
  }, [refreshData]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tight text-slate-900 mb-2">Dashboard</h1>
          <p className="font-bold text-slate-500">Welcome back, {user.full_name}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex space-x-4 border-b-2 border-black pb-4 overflow-x-auto">
        <button
          onClick={() => setFilter('assigned')}
          className={`px-6 py-2 font-black uppercase text-sm border-2 transition-all ${filter === 'assigned' ? 'bg-black text-white border-black shadow-[4px_4px_0px_0px_rgba(100,100,100,0.5)]' : 'bg-white text-slate-500 border-transparent hover:border-black hover:text-black'}`}
        >
          My Tasks
        </button>
        <button
          onClick={() => setFilter('watching')}
          className={`px-6 py-2 font-black uppercase text-sm border-2 transition-all ${filter === 'watching' ? 'bg-black text-white border-black shadow-[4px_4px_0px_0px_rgba(100,100,100,0.5)]' : 'bg-white text-slate-500 border-transparent hover:border-black hover:text-black'}`}
        >
          In Production
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`px-6 py-2 font-black uppercase text-sm border-2 transition-all ${filter === 'all' ? 'bg-black text-white border-black shadow-[4px_4px_0px_0px_rgba(100,100,100,0.5)]' : 'bg-white text-slate-500 border-transparent hover:border-black hover:text-black'}`}
        >
          All Content
        </button>
      </div>

      {/* Stats Cards */}
      {filter === 'assigned' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Green Card */}
          <div className="bg-[#4ADE80] p-6 border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-transform hover:-translate-y-1">
            <h3 className="font-black uppercase text-lg mb-4">My Tasks</h3>
            <div className="text-6xl font-black mb-2">{filteredProjects.length}</div>
            <div className="font-bold text-sm uppercase tracking-wide opacity-80">Pending Actions</div>
          </div>

          {/* Blue Card */}
          <div className="bg-[#0085FF] p-6 border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-white transition-transform hover:-translate-y-1">
            <h3 className="font-black uppercase text-lg mb-4">In Production</h3>
            <div className="text-6xl font-black mb-2">{(projects.inbox || []).filter(p => p.status !== TaskStatus.DONE).length}</div>
            <div className="font-bold text-sm uppercase tracking-wide opacity-90">Active Projects</div>
          </div>

          {/* Magenta Card */}
          <div className="bg-[#D946EF] p-6 border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-white transition-transform hover:-translate-y-1">
            <h3 className="font-black uppercase text-lg mb-4">Published</h3>
            <div className="text-6xl font-black mb-2">{(projects.inbox || []).filter(p => p.status === TaskStatus.DONE).length}</div>
            <div className="font-bold text-sm uppercase tracking-wide opacity-90">This Month</div>
          </div>
        </div>
      )}

      {/* Recent Content Area */}
      <div>
        <h2 className="text-2xl font-black uppercase text-slate-900 mb-6 border-b-4 border-black inline-block pb-1">Recent Content</h2>

        {filteredProjects.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredProjects.map(project => (
              <div
                key={project.id}
                onClick={() => setSelectedProject(project)}
                className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-5 cursor-pointer hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all group"
              >
                <div className="flex justify-between items-start mb-4">
                  <span className={`px-2 py-1 text-xs font-black uppercase border-2 border-black ${project.channel === 'YOUTUBE' ? 'bg-[#FF4F4F] text-white' :
                      project.channel === 'LINKEDIN' ? 'bg-[#0085FF] text-white' :
                        'bg-[#D946EF] text-white'
                    }`}>
                    {project.channel}
                  </span>
                  <div className="w-3 h-3 rounded-full border-2 border-black bg-slate-200 group-hover:bg-[#4ADE80]"></div>
                </div>

                <h3 className="text-xl font-black text-slate-900 mb-2 leading-tight uppercase">
                  {project.title}
                </h3>

                <div className="space-y-3 mt-6 border-t-2 border-slate-100 pt-4">
                  <div className="flex justify-between text-sm">
                    <span className="font-bold text-slate-400 uppercase text-xs">Stage</span>
                    <span className="font-bold text-slate-900">{STAGE_LABELS[project.current_stage]}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-bold text-slate-400 uppercase text-xs">Role</span>
                    <span className="font-bold text-slate-900">{ROLE_LABELS[project.assigned_to_role]}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-bold text-slate-400 uppercase text-xs">Due</span>
                    <span className="font-bold text-slate-900">{format(new Date(project.due_date), 'MMM dd')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="border-2 border-dashed border-black p-12 text-center bg-slate-50">
            <h3 className="text-xl font-bold text-slate-900 mb-2">No content found.</h3>
            <p className="text-slate-500">Create your first content piece to get started.</p>
          </div>
        )}
      </div>

      {/* Task Detail Modal */}
      {selectedProject && (
        <TaskDetail
          project={selectedProject}
          currentUserRole={user.role}
          onClose={() => setSelectedProject(null)}
          onUpdate={refreshData}
        />
      )}
    </div>
  );
};

export default Dashboard;