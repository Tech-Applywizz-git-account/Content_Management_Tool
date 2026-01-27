import React, { useState, useEffect } from 'react';
import { Project, Role, WorkflowStage } from '../../types';
import { format } from 'date-fns';
import { Eye, Calendar, FileText, CheckCircle, Clock } from 'lucide-react';
import { db } from '../../services/supabaseDb';
import { supabase } from '../../src/integrations/supabase/client';
import CmoReviewScreen from './CmoReviewScreen';

interface Props {
  user: { id: string; full_name: string; role: Role };
  onBack: () => void;
  onProjectSelect: (project: Project) => void;
  selectedProject: Project | null;
}

const CmoFinalReview: React.FC<Props> = ({ user, onBack, onProjectSelect, selectedProject }) => {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    const loadFinalReviewProjects = async () => {
      try {

        // Fetch projects where current_stage is FINAL_REVIEW_CMO or POST_WRITER_REVIEW
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .or('current_stage.eq.FINAL_REVIEW_CMO,current_stage.eq.POST_WRITER_REVIEW')
          .order('created_at', { ascending: false });

        if (error) {
          throw new Error(error.message);
        }

        if (data) {
          // Convert raw data to Project objects
          const projectObjects: Project[] = data.map((item: any) => ({
            id: item.id,
            title: item.title,
            channel: item.channel,
            content_type: item.content_type,
            current_stage: item.current_stage,
            assigned_to_role: item.assigned_to_role,
            assigned_to_user_id: item.assigned_to_user_id,
            status: item.status,
            priority: item.priority,
            due_date: item.due_date,
            created_by: item.created_by,
            created_by_user_id: item.created_by_user_id,
            created_by_name: item.created_by_name,
            writer_id: item.writer_id,
            writer_name: item.writer_name,
            editor_name: item.editor_name,
            designer_name: item.designer_name,
            sub_editor_name: item.sub_editor_name,
            created_at: item.created_at,
            writer_submitted_at: item.writer_submitted_at,
            cmo_approved_at: item.cmo_approved_at,
            cmo_rework_at: item.cmo_rework_at,
            ceo_approved_at: item.ceo_approved_at,
            ceo_rework_at: item.ceo_rework_at,
            cine_uploaded_at: item.cine_uploaded_at,
            editor_uploaded_at: item.editor_uploaded_at,
            sub_editor_uploaded_at: item.sub_editor_uploaded_at,
            designer_uploaded_at: item.designer_uploaded_at,
            edited_by_role: item.edited_by_role,
            edited_by_user_id: item.edited_by_user_id,
            edited_by_name: item.edited_by_name,
            edited_at: item.edited_at,
            shoot_date: item.shoot_date,
            delivery_date: item.delivery_date,
            post_scheduled_date: item.post_scheduled_date,
            video_link: item.video_link,
            edited_video_link: item.edited_video_link,
            thumbnail_link: item.thumbnail_link,
            creative_link: item.creative_link,
            data: item.data || {},
            history: item.history || [],
            rework_target_role: item.rework_target_role,
            rework_initiator_role: item.rework_initiator_role,
            rework_initiator_stage: item.rework_initiator_stage,
            first_review_opened_at: item.first_review_opened_at,
            first_review_opened_by_role: item.first_review_opened_by_role,
            updated_at: item.updated_at,
          }));

          setProjects(projectObjects);
        }
      } catch (err) {
        console.error('Error loading final review projects:', err);
      }
    };

    loadFinalReviewProjects();
  }, []);



  if (selectedProject) {
    return (
      <CmoReviewScreen
        project={selectedProject}
        user={user}
        onBack={onBack}
        onProjectUpdated={() => {
          // Refresh the project list after update
          window.location.reload();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black uppercase text-slate-900">Final Review</h1>
          <p className="text-slate-600 mt-2">
            Projects requiring final CMO review before publishing
          </p>
        </div>
        <div className="bg-[#D946EF] border-2 border-black px-4 py-2 rounded-lg">
          <span className="font-black text-black uppercase">
            {projects.length} Project{projects.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg p-12 text-center">
          <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-600 mb-2">No Projects in Final Review</h3>
          <p className="text-slate-500">
            There are currently no projects in the final review stage.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div
              key={project.id}
              onClick={() => onProjectSelect(project)}
              className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all cursor-pointer group"
            >
              <div className="p-6 space-y-4">
                {/* Project Header */}
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-black text-slate-900 uppercase leading-tight group-hover:text-[#D946EF] transition-colors">
                      {project.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className={`px-2 py-1 text-[10px] font-black uppercase border-2 border-black ${project.channel === 'YOUTUBE' ? 'bg-[#FF4F4F] text-white' :
                          project.channel === 'LINKEDIN' ? 'bg-[#0085FF] text-white' :
                            'bg-[#D946EF] text-white'
                          }`}
                      >
                        {project.channel}
                      </span>
                      <span
                        className={`px-2 py-1 text-[10px] font-black uppercase border-2 border-black ${project.priority === 'HIGH' ? 'bg-red-500 text-white' :
                          project.priority === 'NORMAL' ? 'bg-yellow-500 text-black' :
                            'bg-green-500 text-white'
                          }`}
                      >
                        {project.priority}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stage Indicator */}
                <div className="bg-slate-50 border-2 border-slate-200 p-3 rounded">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-slate-600" />
                    <span className="text-sm font-bold text-slate-700 uppercase">
                      Final Review
                    </span>
                  </div>
                </div>

                {/* Project Details */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="font-bold text-slate-400 uppercase text-xs">Writer</span>
                    <span className="font-bold text-slate-900">{project.writer_name || 'Unknown'}</span>
                  </div>

                  {project.editor_name && (
                    <div className="flex justify-between">
                      <span className="font-bold text-slate-400 uppercase text-xs">Editor</span>
                      <span className="font-bold text-slate-900">{project.editor_name}</span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span className="font-bold text-slate-400 uppercase text-xs">Created</span>
                    <span className="font-bold text-slate-900">
                      {format(new Date(project.created_at), 'MMM dd, yyyy')}
                    </span>
                  </div>


                </div>

                {/* Action Button */}
                <button
                  onClick={() => onProjectSelect(project)}
                  className="w-full bg-[#D946EF] border-2 border-black text-black font-black uppercase py-3 hover:bg-[#c039d0] transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1"
                >
                  Review Project
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CmoFinalReview;