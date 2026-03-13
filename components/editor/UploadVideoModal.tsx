import React, { useState } from 'react';
import { Channel, Priority } from '../../types';
import { db } from '../../services/supabaseDb';
import { ArrowLeft, Send } from 'lucide-react';
import Popup from '../Popup';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

const UploadVideoModal: React.FC<Props> = ({ onClose, onSuccess }) => {
  const [title, setTitle] = useState('');
  const [videoLink, setVideoLink] = useState('');
  const [channel, setChannel] = useState<Channel>(Channel.YOUTUBE);
  const [dueDate, setDueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');
  const [stageName, setStageName] = useState('');

  const handleSubmit = async () => {
    if (!title.trim() || !videoLink.trim() || !dueDate) {
      alert('Title, Due Date, and Video Link are required');
      return;
    }

    setIsSubmitting(true);

    try {
      const createdProject = await db.createDirectVideoProject(
        title,
        channel,
        dueDate,
        videoLink,
        'NORMAL'
      );

      setPopupMessage(
        `Video project "${title}" submitted successfully. Waiting for Multi-Writer approval.`
      );
      setStageName('Multi-Writer Approval');
      setShowPopup(true);

      setTimeout(() => {
        onSuccess();
      }, 1200);

    } catch (err) {
      console.error('Video submit failed:', err);
      alert('Failed to submit video project');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col animate-fade-in-up font-sans">
      <header className="h-16 md:h-20 border-b-2 border-black flex items-center justify-between px-4 md:px-6 bg-white shadow-sm sticky top-0 z-10">
        <div className="flex items-center space-x-3 md:space-x-6 min-w-0">
          <button onClick={onClose} className="p-2 md:p-3 border-2 border-transparent hover:border-black hover:bg-slate-100 flex-shrink-0 transition-all">
            <ArrowLeft className="w-5 h-5 md:w-6 md:h-6 text-black" />
          </button>
          <h1 className="text-lg md:text-2xl font-black text-slate-900 uppercase tracking-tight truncate">
            Direct Video Upload
          </h1>
        </div>
        <div className="flex items-center">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !title.trim() || !videoLink.trim()}
            className={`px-4 md:px-6 py-2 md:py-3 border-2 border-black font-black uppercase text-xs md:text-base shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] md:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] md:hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center ${(isSubmitting || !title.trim() || !videoLink.trim()) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-[#D946EF] text-white'}`}
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
                placeholder="e.g. November Highlight Reel"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Video Link (G-Drive / Frame.io) *</label>
              <input
                type="url"
                value={videoLink}
                onChange={(e) => setVideoLink(e.target.value)}
                className="w-full p-3 md:p-4 border-2 border-black bg-white focus:bg-yellow-50 focus:outline-none font-medium text-sm md:text-base"
                placeholder="https://drive.google.com/file/d/..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Due Date *</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full p-3 md:p-4 border-2 border-black bg-white focus:bg-yellow-50 focus:outline-none font-bold text-sm md:text-base cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Channel</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {Object.values(Channel).map(c => (
                  <button
                    key={c}
                    onClick={() => setChannel(c)}
                    className={`p-2 md:p-3 text-[10px] md:text-xs font-black uppercase border-2 border-black ${channel === c ? 'bg-black text-white shadow-[2px_2px_0px_0px_rgba(100,100,100,0.5)]' : 'bg-white hover:bg-slate-50 text-slate-500'}`}
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

export default UploadVideoModal;
