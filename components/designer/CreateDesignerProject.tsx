import React, { useState } from 'react';
import { Channel, Priority } from '../../types';
import { db } from '../../services/supabaseDb';
import { supabase } from '../../src/integrations/supabase/client';
import { ArrowLeft, Send } from 'lucide-react';
import Popup from '../Popup';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

const CreateDesignerProject: React.FC<Props> = ({ onClose, onSuccess }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [link, setLink] = useState('');
  const [channel, setChannel] = useState<Channel>(Channel.LINKEDIN);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');
  const [stageName, setStageName] = useState('');

  const handleSubmit = async () => {
  if (!title.trim() || !link.trim()) {
    alert('Title and Link are required');
    return;
  }

  const currentUser = db.getCurrentUser();
  if (!currentUser) {
    alert('User not logged in');
    return;
  }

  setIsSubmitting(true);

  try {
    // 1️⃣ CREATE PROJECT
    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        title,
        channel,
        content_type: 'CREATIVE_ONLY',
        priority: 'NORMAL',

        // 🔑 WORKFLOW
        current_stage: 'FINAL_REVIEW_CMO',
        assigned_to_role: 'CMO',
        status: 'WAITING_APPROVAL',

        // 🔑 CREATOR
        created_by: currentUser.id,
        created_by_user_id: currentUser.id,
        created_by_name: currentUser.full_name,

        // 🔑 DESIGN DATA
        data: {
          source: 'DESIGNER_PROJECT',
          description,
          creative_link: link
        },

        due_date: new Date().toISOString().split('T')[0]
      })
      .select()
      .single();

    if (error) throw error;

    // 2️⃣ INSERT WORKFLOW HISTORY
    await supabase.from('workflow_history').insert({
      project_id: project.id,
      from_stage: 'DESIGNER',
      to_stage: 'FINAL_REVIEW_CMO',
      action: 'SUBMITTED',
      actor_id: currentUser.id,
      actor_name: currentUser.full_name,
      actor_role: 'DESIGNER',
      timestamp: new Date().toISOString()
    });

    // 3️⃣ SUCCESS UI
    setPopupMessage(
      `Designer project "${title}" submitted successfully. Waiting for CMO review.`
    );
    setStageName('Final Review (CMO)');
    setShowPopup(true);

    setTimeout(() => {
      onSuccess();
    }, 1200);

  } catch (err) {
    console.error('Designer submit failed:', err);
    alert('Failed to submit designer project');
  } finally {
    setIsSubmitting(false);
  }
};


  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col animate-fade-in-up font-sans">
      {/* Header */}
      <header className="h-20 border-b-2 border-black flex items-center justify-between px-6 bg-white shadow-sm">
        <div className="flex items-center space-x-6">
          <button onClick={onClose} className="p-3 border-2 border-transparent hover:border-black hover:bg-slate-100 rounded-full transition-all">
            <ArrowLeft className="w-6 h-6 text-black" />
          </button>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
            Create Designer Project
          </h1>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !title.trim() || !link.trim()}
            className={`px-6 py-3 border-2 border-black font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center ${(isSubmitting || !title.trim() || !link.trim()) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-[#D946EF] text-white'}`}
          >
            {isSubmitting ? 'Submitting...' : 'Submit to CMO'}
            <Send className="w-4 h-4 ml-2" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-slate-50 p-6 md:p-10">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="bg-white p-8 border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-6">
            <h3 className="font-black uppercase text-lg text-slate-900">Project Details</h3>
            
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-4 border-2 border-black bg-white focus:bg-yellow-50 focus:outline-none font-bold"
                placeholder="e.g. Marketing Creative Assets"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-4 border-2 border-black bg-white focus:bg-yellow-50 focus:outline-none font-medium min-h-[100px] resize-none"
                placeholder="Describe the creative assets or project requirements..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Creative Link *</label>
              <input
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                className="w-full p-4 border-2 border-black bg-white focus:bg-yellow-50 focus:outline-none font-medium"
                placeholder="https://drive.google.com/file/d/..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Channel</label>
              <div className="grid grid-cols-3 gap-2">
                {Object.values(Channel).map(c => (
                  <button
                    key={c}
                    onClick={() => setChannel(c)}
                    className={`p-2 text-[10px] font-black uppercase border-2 border-black ${channel === c ? 'bg-black text-white' : 'bg-white hover:bg-slate-50'}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showPopup && (
        <Popup
          message={popupMessage}
          stageName={stageName}
          onClose={() => setShowPopup(false)}
        />
      )}
    </div>
  );
};

export default CreateDesignerProject;