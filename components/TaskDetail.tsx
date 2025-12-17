import React, { useState, useEffect } from 'react';
import { Project, Role, WorkflowStage, TaskStatus, STAGE_LABELS, ProjectData, ROLE_LABELS } from '../types';
import { db } from '../services/supabaseDb';
import { format } from 'date-fns';
import {
  ArrowLeft, ArrowRight, CheckCircle, AlertTriangle, FileText, Send, XCircle,
  ExternalLink, Calendar, Video, Image as ImageIcon, Link, X
} from 'lucide-react';

interface Props {
  project: Project;
  currentUserRole: Role;
  onClose: () => void;
  onUpdate: () => void;
}

const TaskDetail: React.FC<Props> = ({ project, currentUserRole, onClose, onUpdate }) => {
  const [formData, setFormData] = useState<ProjectData>(project.data);
  const [comment, setComment] = useState('');
  const [rejectStage, setRejectStage] = useState<WorkflowStage | ''>('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  // Listen for beforeLogout event to close detail view automatically
  useEffect(() => {
    const handleBeforeLogout = () => {
      console.log('Closing task detail before logout...');
      onClose(); // Just close the detail view
    };

    window.addEventListener('beforeLogout', handleBeforeLogout);
    return () => {
      window.removeEventListener('beforeLogout', handleBeforeLogout);
    };
  }, []);

  useEffect(() => {
    setFormData(project.data);
  }, [project]);

  const handleChange = async (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    try {
      await db.updateProjectData(project.id, { [field]: value });
    } catch (error) {
      console.error('Failed to update project data:', error);
      // Don't show alert for every field change
    }
  };

  const handleComplete = async () => {
    if (confirm('Are you sure you want to submit this stage?')) {
      try {
        await db.advanceWorkflow(project.id, comment);
        onUpdate();
        onClose();
      } catch (error) {
        console.error('Failed to complete stage:', error);
        alert(`Failed to complete stage: ${error.message || 'Unknown error occurred'}`);
      }
    }
  };

  const handleReject = async () => {
    if (!rejectStage) return;
    try {
      await db.rejectTask(project.id, rejectStage, comment || 'Rejected');
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Failed to reject task:', error);
      alert(`Failed to reject task: ${error.message || 'Unknown error occurred'}`);
    }
  };

  const isAssignedToMe = project.assigned_to_role === currentUserRole;
  const isApprover = [Role.CMO, Role.CEO].includes(currentUserRole);
  const isReadOnly = !isAssignedToMe || project.status === TaskStatus.DONE;

  const renderScriptFields = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-bold uppercase text-slate-900 mb-2">Script Content</label>
        <textarea
          disabled={isReadOnly}
          value={formData.script_content || ''}
          onChange={(e) => handleChange('script_content', e.target.value)}
          className="w-full h-64 p-4 border-2 border-black rounded-none focus:ring-0 focus:bg-yellow-50 font-mono text-sm leading-relaxed"
          placeholder="Enter the full script here..."
        />
      </div>
    </div>
  );

  const renderShootFields = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-bold uppercase text-slate-900 mb-2">Shoot Date</label>
          <input
            type="date"
            disabled={isReadOnly}
            value={formData.shoot_date || ''}
            onChange={(e) => handleChange('shoot_date', e.target.value)}
            className="w-full p-4 border-2 border-black rounded-none focus:bg-yellow-50"
          />
        </div>
        <div>
          <label className="block text-sm font-bold uppercase text-slate-900 mb-2">Location</label>
          <input
            type="text"
            disabled={isReadOnly}
            value={formData.shoot_location || ''}
            onChange={(e) => handleChange('shoot_location', e.target.value)}
            className="w-full p-4 border-2 border-black rounded-none focus:bg-yellow-50"
            placeholder="Studio A"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-bold uppercase text-slate-900 mb-2">Raw Footage Link</label>
        <div className="flex items-center space-x-2">
          <Link className="text-black w-6 h-6" />
          <input
            type="url"
            disabled={isReadOnly}
            value={formData.raw_footage_link || ''}
            onChange={(e) => handleChange('raw_footage_link', e.target.value)}
            className="w-full p-4 border-2 border-black rounded-none text-blue-600 underline focus:bg-yellow-50"
            placeholder="https://drive.google.com/..."
          />
        </div>
      </div>
    </div>
  );

  const renderEditFields = () => (
    <div className="space-y-4">
      <div className="p-4 bg-slate-100 border-2 border-black mb-4">
        <h4 className="text-xs font-black uppercase tracking-wider mb-2">Resources</h4>
        {formData.script_content && <div className="text-sm text-slate-900 mb-2"><strong>Script Available</strong></div>}
        {formData.raw_footage_link && (
          <a href={formData.raw_footage_link} target="_blank" rel="noreferrer" className="flex items-center text-[#0085FF] hover:underline text-sm font-bold">
            <Video className="w-4 h-4 mr-1" /> View Raw Footage
          </a>
        )}
      </div>
      <div>
        <label className="block text-sm font-bold uppercase text-slate-900 mb-2">Rough Cut Link</label>
        <input
          type="url"
          disabled={isReadOnly}
          value={formData.rough_cut_link || ''}
          onChange={(e) => handleChange('rough_cut_link', e.target.value)}
          className="w-full p-4 border-2 border-black rounded-none focus:bg-yellow-50"
          placeholder="Frame.io link..."
        />
      </div>
      <div>
        <label className="block text-sm font-bold uppercase text-slate-900 mb-2">Master Link (Final)</label>
        <input
          type="url"
          disabled={isReadOnly}
          value={formData.master_link || ''}
          onChange={(e) => handleChange('master_link', e.target.value)}
          className="w-full p-4 border-2 border-black rounded-none focus:bg-yellow-50"
          placeholder="Google Drive link..."
        />
      </div>
    </div>
  );

  const renderDesignFields = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-bold uppercase text-slate-900 mb-2">Thumbnail / Asset Link</label>
        <input
          type="url"
          disabled={isReadOnly}
          value={formData.thumbnail_link || ''}
          onChange={(e) => handleChange('thumbnail_link', e.target.value)}
          className="w-full p-4 border-2 border-black rounded-none focus:bg-yellow-50"
          placeholder="Figma / Drive link..."
        />
      </div>
    </div>
  );

  const renderMetadataFields = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-bold uppercase text-slate-900 mb-2">Video Title (Final)</label>
        <input
          type="text"
          disabled={isReadOnly}
          value={formData.video_title_final || ''}
          onChange={(e) => handleChange('video_title_final', e.target.value)}
          className="w-full p-4 border-2 border-black rounded-none focus:bg-yellow-50"
        />
      </div>
      <div>
        <label className="block text-sm font-bold uppercase text-slate-900 mb-2">Captions / Description</label>
        <textarea
          disabled={isReadOnly}
          value={formData.captions || ''}
          onChange={(e) => handleChange('captions', e.target.value)}
          className="w-full h-32 p-4 border-2 border-black rounded-none focus:bg-yellow-50"
        />
      </div>
      <div>
        <label className="block text-sm font-bold uppercase text-slate-900 mb-2">Tags</label>
        <input
          type="text"
          disabled={isReadOnly}
          value={formData.tags || ''}
          onChange={(e) => handleChange('tags', e.target.value)}
          className="w-full p-4 border-2 border-black rounded-none focus:bg-yellow-50"
        />
      </div>
    </div>
  );

  const renderPublishFields = () => (
    <div className="space-y-4">
      <div className="p-4 bg-[#4ADE80] border-2 border-black mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <h4 className="text-sm font-black uppercase text-black mb-2">Ready to Publish</h4>
        <div className="space-y-1 text-sm font-bold text-black">
          <p>Channel: {project.channel}</p>
          <p>Scheduled: {format(new Date(project.due_date), 'MMM dd, yyyy')}</p>
        </div>
      </div>
      <div>
        <label className="block text-sm font-bold uppercase text-slate-900 mb-2">Live URL</label>
        <input
          type="url"
          disabled={isReadOnly}
          value={formData.live_url || ''}
          onChange={(e) => handleChange('live_url', e.target.value)}
          className="w-full p-4 border-2 border-black rounded-none focus:bg-yellow-50"
          placeholder={`https://${project.channel.toLowerCase()}.com/...`}
        />
      </div>
    </div>
  );

  const getStageContent = () => {
    switch (project.current_stage) {
      case WorkflowStage.SCRIPT:
      case WorkflowStage.SCRIPT_REVIEW_L1:
      case WorkflowStage.SCRIPT_REVIEW_L2:
        return renderScriptFields();
      case WorkflowStage.CINEMATOGRAPHY: return renderShootFields();
      case WorkflowStage.VIDEO_EDITING: return renderEditFields();
      case WorkflowStage.THUMBNAIL_DESIGN:
      case WorkflowStage.CREATIVE_DESIGN: return renderDesignFields();
      case WorkflowStage.FINAL_REVIEW_CMO:
      case WorkflowStage.FINAL_REVIEW_CEO:
        return renderScriptFields();
      case WorkflowStage.OPS_SCHEDULING:
      case WorkflowStage.POSTED:
        return renderPublishFields();
      default: return <p>Details not available for this stage.</p>;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 flex justify-end">
      <div className="w-full md:w-[600px] lg:w-[800px] bg-white h-full border-l-2 border-black shadow-2xl flex flex-col animate-slide-in-right">

        {/* Header */}
        <div className="p-6 border-b-2 border-black flex items-center justify-between bg-white">
          <div className="flex items-center space-x-4">
            <button onClick={onClose} className="p-2 border-2 border-transparent hover:border-black hover:bg-slate-100 transition-all">
              <ArrowRight className="w-5 h-5 text-black" />
            </button>
            <div>
              <h2 className="text-2xl font-black uppercase text-slate-900">{project.title}</h2>
              <div className="flex items-center space-x-2 text-sm mt-1">
                <span className={`px-2 py-0.5 text-xs font-black uppercase bg-black text-white`}>{project.channel}</span>
                <span className="text-slate-900 font-bold uppercase">{STAGE_LABELS[project.current_stage]}</span>
              </div>
            </div>
          </div>
          {project.status === TaskStatus.REJECTED && (
            <span className="px-3 py-1 bg-[#FF4F4F] text-white border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              Rework Required
            </span>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-10 bg-white">

          <section>
            <div className="flex items-center space-x-2 mb-6 border-b-4 border-black inline-flex pb-1">
              <FileText className="w-6 h-6 text-black" />
              <h3 className="font-black text-xl uppercase text-slate-900">Task Deliverables</h3>
            </div>
            <div className="bg-white">
              {getStageContent()}
            </div>
          </section>

          <section className="border-t-2 border-dashed border-slate-300 pt-8">
            <h3 className="font-black text-slate-900 mb-6 text-lg uppercase">Activity History</h3>
            <div className="space-y-6">
              {project.history.slice().reverse().map(event => (
                <div key={event.id} className="flex space-x-4">
                  <div className={`mt-1 min-w-[16px] w-4 h-4 border-2 border-black ${event.action === 'REJECTED' ? 'bg-[#FF4F4F]' :
                    event.action === 'APPROVED' || event.action === 'PUBLISHED' ? 'bg-[#4ADE80]' : 'bg-slate-200'
                    }`} />
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-black text-slate-900 uppercase">{event.actor_name}</span>
                      <span className="text-xs font-bold text-slate-500">{format(new Date(event.timestamp), 'MMM d, h:mm a')}</span>
                    </div>
                    <p className="text-sm font-bold text-slate-700 mt-1">{event.action} - {STAGE_LABELS[event.stage]}</p>
                    {event.comment && (
                      <div className="mt-2 text-sm text-slate-900 bg-yellow-50 p-4 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        "{event.comment}"
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Footer Actions */}
        {isAssignedToMe && !isReadOnly && (
          <div className="p-6 border-t-2 border-black bg-slate-50 flex flex-col space-y-4">
            <div>
              <label className="sr-only">Comment</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a comment or note..."
                className="w-full p-4 border-2 border-black rounded-none text-sm focus:bg-yellow-50 focus:outline-none"
                rows={2}
              />
            </div>

            <div className="flex justify-end space-x-4">
              {isApprover && project.current_stage.includes('REVIEW') ? (
                <>
                  <button
                    onClick={() => setShowRejectModal(true)}
                    className="flex-1 bg-white border-2 border-black text-[#FF4F4F] hover:bg-red-50 px-4 py-3 font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                  >
                    Reject / Rework
                  </button>
                  <button
                    onClick={handleComplete}
                    className="flex-1 bg-[#4ADE80] border-2 border-black text-black px-4 py-3 font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                  >
                    Approve
                  </button>
                </>
              ) : (
                <button
                  onClick={handleComplete}
                  className="w-full bg-[#0085FF] text-white border-2 border-black px-6 py-4 font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center justify-center"
                >
                  <span>Mark as Done</span>
                  <ArrowRight className="w-5 h-5 ml-2" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Reject Modal Overlay */}
        {showRejectModal && (
          <div className="absolute inset-0 bg-white/90 z-50 flex items-center justify-center p-6 backdrop-blur-sm">
            <div className="w-full max-w-md space-y-4 bg-white border-2 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="text-xl font-black text-slate-900 uppercase">Send back for rework</h3>
              <p className="text-sm font-bold text-slate-500">Select where this task should go back to.</p>

              <div className="space-y-3">
                <button
                  onClick={() => setRejectStage(WorkflowStage.SCRIPT)}
                  className={`w-full p-4 border-2 text-left transition-all ${rejectStage === WorkflowStage.SCRIPT ? 'border-black bg-[#FF4F4F] text-white' : 'border-slate-300 text-slate-500 hover:border-black hover:text-black'}`}
                >
                  <span className="font-black block text-sm uppercase">Writer</span>
                  <span className="text-xs font-bold opacity-80">Fix script issues</span>
                </button>
              </div>

              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Reason for rejection..."
                className="w-full p-3 border-2 border-black rounded-none text-sm focus:bg-yellow-50 outline-none"
                rows={3}
              />

              <div className="flex space-x-3 pt-2">
                <button onClick={() => setShowRejectModal(false)} className="flex-1 py-3 border-2 border-transparent hover:border-black font-bold uppercase">Cancel</button>
                <button
                  onClick={handleReject}
                  disabled={!rejectStage}
                  className="flex-1 py-3 bg-black text-white border-2 border-black font-bold uppercase hover:bg-slate-800"
                >
                  Confirm Reject
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskDetail;
