import React from 'react';
import { Project, Role } from '../../types';
import { formatDistanceToNow } from 'date-fns';
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

  return (
    <div className="p-8 space-y-8 animate-fade-in">

      {/* Back and Edit Buttons */}
      <div className="flex justify-between items-center">
        <button
          onClick={onBack}
          className="font-bold underline uppercase"
        >
          ← Back to History
        </button>
        {isActor && onEdit && (
          <button
            onClick={onEdit}
            className="px-4 py-2 bg-[#0085FF] text-white font-black uppercase border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
          >
            Edit
          </button>
        )}
      </div>

      {/* Title */}
      <h1 className="text-4xl font-black uppercase tracking-tight">
        {project.title}
      </h1>

      {/* ===================== 1️⃣ SCRIPT CONTENT ===================== */}
      <div className="border-2 border-black bg-slate-100 p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
        <h3 className="font-black uppercase mb-3">Script Content</h3>
        <pre className="whitespace-pre-wrap text-sm">
          {project.data?.script_content || 'No script content available'}
        </pre>
      </div>

      {/* ===================== 2️⃣ CMO COMMENT ===================== */}
      <div className="border-2 border-black bg-yellow-50 p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
        <h3 className="font-black uppercase mb-3">CMO Comment</h3>
        <p className="text-sm">
          {history.comment || 'No comments provided'}
        </p>
      </div>

      {/* ===================== 3️⃣ STATUS / META ===================== */}
      <div className="border-2 border-black bg-white p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p><strong>Writer:</strong> {writerName}</p>
          <p><strong>Reviewed By:</strong> {history.actor_name}</p>
        </div>

        <div>
          <p>
            <strong>Status:</strong>{' '}
            <span
              className={`font-black ${
                history.action === 'APPROVED'
                  ? 'text-green-600'
                  : 'text-red-600'
              }`}
            >
              {history.action}
            </span>
          </p>
          <p>
            <strong>Updated:</strong>{' '}
            {formatDistanceToNow(new Date(history.timestamp))} ago
          </p>
        </div>
      </div>
    </div>
  );
};

export default CmoHistoryDetail;
