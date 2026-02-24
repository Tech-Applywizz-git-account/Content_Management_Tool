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
  const [channel, setChannel] = useState<Channel>(Channel.YOUTUBE);
  const [contentType, setContentType] = useState<'CREATIVE_ONLY' | 'VIDEO'>('CREATIVE_ONLY');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');
  const [stageName, setStageName] = useState('');

  const handleSubmit = async () => {
    if (!title.trim() || !link.trim()) {
      alert('Title and Link are required');
      return;
    }

    setIsSubmitting(true);

    try {
      // Use the proper db method to create designer project
      const createdProject = await db.createDesignerProject(
        title,
        channel,
        new Date().toISOString().split('T')[0], // due_date
        description,
        link,
        'NORMAL', // priority
        contentType
      );

      // Success UI
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
      <header className="h-16 md:h-20 border-b-2 border-black flex items-center justify-between px-4 md:px-6 bg-white shadow-sm sticky top-0 z-10">
        <div className="flex items-center space-x-3 md:space-x-6 min-w-0">
          <button onClick={onClose} className="p-2 md:p-3 border-2 border-transparent hover:border-black hover:bg-slate-100 rounded-full transition-all">
            <ArrowLeft className="w-5 h-5 md:w-6 h-6 text-black" />
          </button>
          <h1 className="text-lg md:text-2xl font-black text-slate-900 uppercase tracking-tight truncate">
            New Design
          </h1>
        </div>
        <div className="flex items-center">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !title.trim() || !link.trim()}
            className={`px-4 md:px-6 py-2 md:py-3 border-2 border-black font-black uppercase text-xs md:text-base shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] md:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] md:hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center ${(isSubmitting || !title.trim() || !link.trim()) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-[#D946EF] text-white'}`}
          >
            {isSubmitting ? '...' : 'Submit'}
            <Send className="w-4 h-4 ml-2" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-10">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="bg-white p-6 md:p-8 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-6">
            <h3 className="font-black uppercase text-base md:text-lg text-slate-900">Project Details</h3>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-3 md:p-4 border-2 border-black bg-white focus:bg-yellow-50 focus:outline-none font-bold text-sm md:text-base"
                placeholder="e.g. Marketing Creative Assets"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-3 md:p-4 border-2 border-black bg-white focus:bg-yellow-50 focus:outline-none font-medium min-h-[100px] resize-none text-sm md:text-base"
                placeholder="Describe the creative assets or project requirements..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Creative Link *</label>
              <input
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                className="w-full p-3 md:p-4 border-2 border-black bg-white focus:bg-yellow-50 focus:outline-none font-medium text-sm md:text-base"
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

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Content Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setContentType('VIDEO')}
                  className={`p-2 text-xs font-black uppercase border-2 border-black ${contentType === 'VIDEO' ? 'bg-black text-white' : 'bg-white hover:bg-slate-50'}`}
                >
                  Video
                </button>
                <button
                  onClick={() => setContentType('CREATIVE_ONLY')}
                  className={`p-2 text-xs font-black uppercase border-2 border-black ${contentType === 'CREATIVE_ONLY' ? 'bg-black text-white' : 'bg-white hover:bg-slate-50'}`}
                >
                  Creative Only
                </button>
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