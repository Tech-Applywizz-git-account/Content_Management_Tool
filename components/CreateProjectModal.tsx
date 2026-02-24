import React, { useState, useEffect } from 'react';
import { Channel } from '../types';
import { X, Calendar } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (title: string, channel: Channel, dueDate: string, isDirectCreative?: boolean) => void;
}

const CreateProjectModal: React.FC<Props> = ({ isOpen, onClose, onSubmit }) => {
  const [title, setTitle] = useState('');
  const [channel, setChannel] = useState<Channel>(Channel.LINKEDIN);
  const [dueDate, setDueDate] = useState('');
  const [isDirectCreative, setIsDirectCreative] = useState(false);

  // Listen for beforeLogout event to close modal automatically
  useEffect(() => {
    const handleBeforeLogout = () => {
      console.log('Closing modal before logout...');
      onClose(); // Just close the modal, no need to save anything here
    };

    window.addEventListener('beforeLogout', handleBeforeLogout);
    return () => {
      window.removeEventListener('beforeLogout', handleBeforeLogout);
    };
  }, []);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !dueDate) return;
    onSubmit(title, channel, dueDate, isDirectCreative);
    // Reset form
    setTitle('');
    setChannel(Channel.LINKEDIN);
    setDueDate('');
    setIsDirectCreative(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] md:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] w-full max-w-lg overflow-y-auto max-h-[90vh] animate-fade-in-up">
        <div className="flex justify-between items-center p-4 md:p-6 border-b-2 border-black bg-slate-50">
          <h2 className="text-lg md:text-2xl font-black text-slate-900 uppercase tracking-tight">Create New Project</h2>
          <button onClick={onClose} className="p-1 border-2 border-transparent hover:border-black hover:bg-red-500 hover:text-white transition-all flex-shrink-0">
            <X className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 md:p-8 space-y-4 md:space-y-6">
          <div>
            <label className="block text-xs md:text-sm font-bold uppercase text-slate-900 mb-2">Project Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q4 Marketing Video"
              className="w-full p-3 md:p-4 border-2 border-black bg-white focus:bg-yellow-50 focus:ring-0 focus:outline-none font-bold text-base md:text-lg"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs md:text-sm font-bold uppercase text-slate-900 mb-2">Channel</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 md:grid-cols-3 md:gap-3">
              {[Channel.LINKEDIN, Channel.YOUTUBE, Channel.INSTAGRAM].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setChannel(c)}
                  className={`p-2 md:p-3 text-[10px] md:text-sm font-black uppercase border-2 transition-all ${channel === c
                      ? 'bg-black text-white border-black shadow-[2px_2px_0px_0px_rgba(100,100,100,0.5)] md:shadow-[4px_4px_0px_0px_rgba(100,100,100,0.5)]'
                      : 'bg-white border-black text-slate-500 hover:bg-slate-100'
                    }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs md:text-sm font-bold uppercase text-slate-900 mb-2">Due Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-slate-900" />
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full pl-10 md:pl-12 p-3 md:p-4 border-2 border-black bg-white focus:bg-yellow-50 focus:ring-0 focus:outline-none font-bold text-sm md:text-base"
                required
              />
            </div>
          </div>

          {/* Direct Creative Upload Option */}
          <div className="p-3 md:p-4 bg-blue-50 border-2 border-blue-200 rounded">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isDirectCreative}
                onChange={(e) => setIsDirectCreative(e.target.checked)}
                className="w-4 h-4 md:w-5 md:h-5 mt-1"
              />
              <div className="min-w-0">
                <span className="block text-xs md:text-sm font-bold uppercase text-slate-900">Direct Creative Upload</span>
                <span className="block text-[10px] md:text-xs text-slate-600 mt-1">Skip script writing and start with assets</span>
              </div>
            </label>
          </div>

          <div className="pt-2 md:pt-4 flex flex-col md:flex-row gap-3 md:gap-4 md:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="w-full md:w-auto px-6 py-2 md:py-3 border-2 border-black text-black text-sm md:text-base font-bold uppercase hover:bg-slate-100 transition-colors order-2 md:order-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="w-full md:w-auto px-6 py-2 md:py-3 bg-[#D946EF] border-2 border-black text-white font-black uppercase text-sm md:text-base shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all order-1 md:order-2"
            >
              Start Workflow
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateProjectModal;