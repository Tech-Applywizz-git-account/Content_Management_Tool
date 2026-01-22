import React from 'react';
import { Project, Role } from '../../types';
import { format } from 'date-fns';
import { db } from '../../services/supabaseDb';

interface HistoryEntry {
  action: 'APPROVED' | 'REJECTED';
  timestamp: string;
  actor_name: string;
  actor_id: string;
  comment?: string;
}

interface Props {
  project: Project;
  history: HistoryEntry;
  onBack: () => void;
  onEdit?: () => void; // Optional edit callback
  currentUser?: { id: string; role: Role }; // Current user info
}

const CmoHistoryDetail: React.FC<Props> = ({ project, history, onBack, onEdit, currentUser }) => {
  const writerName =
    project.writer_name ||
    project.data?.writer_name ||
    'Unknown Writer';

  // Check if current user is the actor who made the decision
  const isActor = currentUser?.id === history.actor_id;

  // Check if this is a script project (exclude idea projects)
  const isScriptProject = project.data?.source !== 'IDEA_PROJECT' || project.data?.script_content;

  // If not a script project, show a message and return early
  if (!isScriptProject) {
    return (
      <div className="min-h-screen bg-white font-sans flex flex-col">
        <header className="h-20 border-b-2 border-black flex items-center justify-between px-6 sticky top-0 bg-white z-20 shadow-[0px_4px_0px_0px_rgba(0,0,0,0.05)]">
          <div className="flex items-center space-x-6">
            <button
              onClick={onBack}
              className="p-3 border-2 border-transparent hover:border-black hover:bg-slate-100 rounded-full transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
              Project Not Available
            </h1>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center p-12">
          <div className="text-center max-w-md">
            <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.47-.881-6.08-2.33M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">Idea Project</h2>
            <p className="text-slate-600 mb-6">
              This project is an idea and doesn't contain script content. Only script projects are displayed in the history details.
            </p>
            <button
              onClick={onBack}
              className="px-6 py-3 bg-[#0085FF] text-white font-black uppercase border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
            >
              ← Back to History
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans flex flex-col">
      <header className="h-20 border-b-2 border-black flex items-center justify-between px-6 sticky top-0 bg-white z-20 shadow-[0px_4px_0px_0px_rgba(0,0,0,0.05)]">
        <div className="flex items-center space-x-6">
          <button
            onClick={onBack}
            className="p-3 border-2 border-transparent hover:border-black hover:bg-slate-100 rounded-full transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
              {project.data?.source === 'DESIGNER_INITIATED' ? 'Creative Details: ' : 'Script Details: '}
              {project.title}
            </h1>
            
            <div className="flex items-center space-x-2 mt-2">
              {project.data?.source === 'DESIGNER_INITIATED' && (
                <span className="px-2 py-0.5 text-xs font-black uppercase border-2 border-black bg-pink-100 text-pink-900">
                  DESIGNER
                </span>
              )}
              <span className={`px-2 py-0.5 text-xs font-black uppercase border-2 border-black text-white ${project.channel === 'YOUTUBE' ? 'bg-[#FF4F4F]' :
                project.channel === 'LINKEDIN' ? 'bg-[#0085FF]' :
                  'bg-[#D946EF]'
                }`}>
                {project.channel}
              </span>
              <span className="text-xs font-bold uppercase text-slate-500">
                Reviewed: {format(new Date(history.timestamp), 'MMM dd, yyyy')}
              </span>
              <span
                className={`px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black ${project.priority === 'HIGH'
                  ? 'bg-red-500 text-white'
                  : project.priority === 'NORMAL'
                    ? 'bg-yellow-500 text-black'
                    : 'bg-green-500 text-white'
                  }`}>
                {project.priority}
              </span>
            </div>
          </div>
        </div>
        
        {isActor && onEdit && (
          <button
            onClick={onEdit}
            className="px-4 py-2 bg-[#0085FF] text-white font-black uppercase border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
          >
            Edit
          </button>
        )}
      </header>

      <div className="flex-1 flex flex-col md:flex-row max-w-[1920px] mx-auto w-full">

        {/* LEFT COLUMN: Content (70%) */}
        <div className="flex-1 p-6 md:p-12 space-y-10 overflow-y-auto bg-slate-50">

          {/* Info Block */}
          <div className="bg-white border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase mb-1">Priority</label>
              <div className={`font-bold uppercase ${project.priority === 'HIGH' ? 'text-red-600' : 'text-slate-900'}`}>
                {project.priority}
              </div>
            </div>
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase mb-1">Status</label>
              <div className="font-bold text-slate-900 uppercase">
                {history.action}
              </div>
            </div>
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase mb-1">Type</label>
              <div className="font-bold text-slate-900 uppercase">
                {project.data?.source === 'DESIGNER_INITIATED' ? 'Creative' : 'Script'}
              </div>
            </div>
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase mb-1">Channel</label>
              <div className="font-bold text-slate-900 uppercase">
                {project.channel}
              </div>
            </div>
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase mb-1">Content Type</label>
              <div className="font-bold text-slate-900 uppercase">
                {project.content_type}
              </div>
            </div>
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase mb-1">Reviewed</label>
              <div className="font-bold text-slate-900 uppercase">
                {format(new Date(history.timestamp), 'MMM dd, yyyy')}
              </div>
            </div>
          </div>

          {/* Content */}
          <section className="space-y-4">
            <h3 className="text-2xl font-black text-slate-900 uppercase">
              {project.data?.source === 'DESIGNER_INITIATED' ? 'Creative Link' : 'Script Content'}
            </h3>
            
            <div className="border-2 border-black bg-white p-8 min-h-[300px] whitespace-pre-wrap font-serif text-lg leading-relaxed text-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              {project.data?.source === 'DESIGNER_INITIATED'
                ? project.data?.creative_link || 'No creative link available.'
                : project.data?.script_content 
                    ? (() => {
                        // Decode HTML entities to properly display the content
                        let decodedContent = project.data.script_content
                            .replace(/&lt;/g, '<')
                            .replace(/&gt;/g, '>')
                            .replace(/&amp;/g, '&')
                            .replace(/&quot;/g, '"')
                            .replace(/&#39;/g, "'")
                            .replace(/&nbsp;/g, ' ');
                        return <div dangerouslySetInnerHTML={{ __html: decodedContent }} />;
                      })()
                    : 'No script content available.'}
            </div>
          </section>



        </div>

        {/* RIGHT COLUMN: Project Status Panel (30%) - Information only */}
        <div className="w-full md:w-[450px] bg-white border-l-2 border-black p-8 shadow-[-10px_0px_20px_rgba(0,0,0,0.05)] sticky bottom-0 md:top-20 md:h-[calc(100vh-80px)] overflow-y-auto z-10">
          <h2 className="text-2xl font-black text-slate-900 uppercase mb-8 border-b-4 border-black pb-2 inline-block">Project Details</h2>

          <div className="space-y-6">
            <div className="p-6 border-2 border-black bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-black text-lg uppercase text-slate-900">Writer</div>
                  <div className="text-xs font-bold uppercase text-slate-600">
                    {writerName}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-2 border-black bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-black text-lg uppercase text-slate-900">Review Status</div>
                  <div className="text-xs font-bold uppercase text-slate-600">
                    {history.action}
                  </div>
                </div>
                <span className={`px-3 py-1 text-xs font-black uppercase border-2 border-black ${history.action === 'APPROVED'
                  ? 'bg-green-500 text-white'
                  : 'bg-red-500 text-white'
                  }`}>
                  {history.action}
                </span>
              </div>
            </div>

            <div className="p-6 border-2 border-black bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-black text-lg uppercase text-slate-900">Reviewed By</div>
                  <div className="text-xs font-bold uppercase text-slate-600">
                    {history.actor_name}
                  </div>
                </div>
              </div>
              <div className="mt-2 text-xs font-bold text-slate-500 uppercase">
                {format(new Date(history.timestamp), 'MMM dd, yyyy h:mm a')}
              </div>
            </div>

            <div className="p-6 border-2 border-black bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-black text-lg uppercase text-slate-900">Project Stage</div>
                  <div className="text-xs font-bold uppercase text-slate-600">
                    {project.current_stage}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-2 border-black bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-black text-lg uppercase text-slate-900">Created</div>
                  <div className="text-xs font-bold uppercase text-slate-600">
                    {format(new Date(project.created_at), 'MMM dd, yyyy h:mm a')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CmoHistoryDetail;
