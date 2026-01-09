import React, { useState } from 'react';
import { Channel } from '../../types';
import { db } from '../../services/supabaseDb';
import { ArrowLeft, Send } from 'lucide-react';
import Popup from '../Popup';

// Define ContentType as actual values since it's a type alias
const ContentTypeValues = {
  VIDEO: 'VIDEO' as const,
  CREATIVE_ONLY: 'CREATIVE_ONLY' as const,
};

type ContentType = typeof ContentTypeValues[keyof typeof ContentTypeValues];

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

const CreateIdeaProject: React.FC<Props> = ({ onClose, onSuccess }) => {
  const [title, setTitle] = useState('');
  const [channel, setChannel] = useState<Channel>(Channel.LINKEDIN);
  const [contentType, setContentType] = useState<ContentType>(ContentTypeValues.VIDEO);
  const [description, setDescription] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');
  const [stageName, setStageName] = useState('');

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      alert('Title and Description are required');
      return;
    }

    setIsSubmitting(true);

    try {
      // Create an idea project that starts at the FINAL_REVIEW_CMO stage
      const createdProject = await db.createIdeaProject(
        title,
        channel,
        contentType,
        description
      );

      setPopupMessage(`Idea project "${title}" created successfully. Waiting for CMO review.`);
      setStageName('Final Review (CMO)');
      setShowPopup(true);

      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (error) {
      console.error('Failed to create idea project:', error);
      alert('Failed to create idea project');
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
            Create Idea Project
          </h1>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !title.trim() || !description.trim()}
            className={`px-6 py-3 border-2 border-black font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center ${(isSubmitting || !title.trim() || !description.trim()) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-[#D946EF] text-white'}`}
          >
            {isSubmitting ? 'Submitting...' : 'Submit to CMO'}
            <Send className="w-4 h-4 ml-2" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-slate-50 p-6 md:p-10">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="bg-white p-8 border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-6">
            <h3 className="font-black uppercase text-lg text-slate-900">Idea Details</h3>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-4 border-2 border-black bg-white focus:bg-yellow-50 focus:outline-none font-bold"
                placeholder="e.g. Marketing Campaign Idea"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  {Object.values(ContentTypeValues).map(ct => (
                    <button
                      key={ct}
                      onClick={() => setContentType(ct)}
                      className={`p-2 text-xs font-black uppercase border-2 border-black ${contentType === ct ? 'bg-black text-white' : 'bg-white hover:bg-slate-50'}`}
                    >
                      {ct}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Idea Description *</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-4 border-2 border-black bg-white focus:bg-yellow-50 focus:outline-none font-medium min-h-[150px] resize-none"
                placeholder="Describe your idea in detail..."
              />
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

export default CreateIdeaProject;