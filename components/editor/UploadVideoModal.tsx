import React, { useState } from 'react';
import { Channel, Priority } from '../../types';
import { db } from '../../services/supabaseDb';
import { ArrowLeft, Send } from 'lucide-react';
import Popup from '../Popup';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

const BRANDS = [
  { value: 'APPLYWIZZ', label: '🚀 ApplyWizz', color: 'bg-[#0085FF]' },
  { value: 'APPLYWIZZ_JOB_BOARD', label: '💼 ApplyWizz Job Board', color: 'bg-[#00A36C]' },
  { value: 'LEAD_MAGNET_RTW', label: '🧲 Lead Magnet', color: 'bg-[#6366F1]' },
  { value: 'APPLYWIZZ_USA_JOBS', label: '🇺🇸 ApplyWizz USA Jobs', color: 'bg-[#8B5CF6]' },
  { value: 'CAREER_IDENTIFIER', label: '🎯 Career Identifier', color: 'bg-[#0EA5E9]' },
  { value: 'SHYAMS_PERSONAL_BRANDING', label: '✨ Shyam\'s Personal Branding', color: 'bg-[#F97316]' },
] as const;

const NICHES = [
  { value: 'PROBLEM_SOLVING', label: 'Problem Solving' },
  { value: 'SOCIAL_PROOF', label: 'Social Proof' },
  { value: 'LEAD_MAGNET', label: 'Lead Magnet' },
  { value: 'CAPTION_BASED', label: 'Caption-Based' },
  { value: 'OTHER', label: 'Other' },
] as const;

const UploadVideoModal: React.FC<Props> = ({ onClose, onSuccess }) => {
  const [title, setTitle] = useState('');
  const [videoLink, setVideoLink] = useState('');
  const [tempVideoLink, setTempVideoLink] = useState('');
  const [isLinkSaved, setIsLinkSaved] = useState(false);
  const [channel, setChannel] = useState<Channel>(Channel.YOUTUBE);
  const [brand, setBrand] = useState<string>('');
  const [niche, setNiche] = useState<string>('');
  const [nicheOther, setNicheOther] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');
  const [stageName, setStageName] = useState('');

  const handleSubmit = async () => {
    if (!title.trim() || !videoLink.trim()) {
      alert('Title and Video Link are required');
      return;
    }

    setIsSubmitting(true);

    try {
      const createdProject = await db.createDirectVideoProject(
        title,
        channel,
        dueDate,
        videoLink,
        'NORMAL',
        brand,
        niche,
        nicheOther
      );

      setPopupMessage(
        `Video project "${title}" submitted successfully. Waiting for CMO approval.` // SKIP MULTI_WRITER_APPROVAL: `Video project "${title}" submitted successfully. Waiting for Multi-Writer approval.`
      );
      setStageName('CMO Approval'); // SKIP MULTI_WRITER_APPROVAL: setStageName('Multi-Writer Approval');
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
      <header className="h-16 md:h-20 border-b-2 border-black flex items-center justify-between px-4 md:px-6 bg-white sticky top-0 z-10 shadow-[0_4px_0px_0px_rgba(0,0,0,0.05)]">
        <div className="flex items-center space-x-3 md:space-x-6 min-w-0">
          <button onClick={onClose} className="p-2 border-2 border-black hover:bg-slate-100 flex-shrink-0 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
            <ArrowLeft className="w-5 h-5 md:w-6 md:h-6 text-black" />
          </button>
          <h1 className="text-lg md:text-2xl font-black text-slate-900 uppercase truncate">
            Direct Video Upload
          </h1>
        </div>
        <div className="flex items-center">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !title.trim() || !videoLink.trim() || !brand}
            className={`px-4 md:px-6 py-2 md:py-3 border-2 border-black font-black uppercase text-xs md:text-base shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center ${(isSubmitting || !title.trim() || !videoLink.trim() || !brand) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-[#D946EF] text-white'}`}
          >
            {isSubmitting ? '...' : 'Submit'}
            <Send className="w-4 h-4 ml-2" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-10 font-sans pb-24">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="bg-white p-6 md:p-10 border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] md:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] space-y-10">
            <div className="flex items-center gap-3 border-b-4 border-black pb-4">
              <div className="w-10 h-10 bg-black flex items-center justify-center">
                <Send className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-black uppercase text-xl md:text-3xl text-slate-900">Project Details</h3>
            </div>

            <div className="space-y-8">
              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-2">Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full p-3 md:p-4 border-2 border-black bg-white focus:outline-none focus:ring-2 focus:ring-black font-bold text-sm md:text-base placeholder:text-slate-300 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
                  placeholder="e.g. November Highlight Reel"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-2">Video Link (G-Drive / Frame.io) *</label>
                <div className="flex gap-3">
                  <input
                    type="url"
                    value={tempVideoLink}
                    onChange={(e) => {
                        setTempVideoLink(e.target.value);
                        setIsLinkSaved(false);
                    }}
                    className="flex-1 p-3 md:p-4 border-2 border-black bg-white focus:outline-none focus:ring-2 focus:ring-black font-bold text-sm md:text-base placeholder:text-slate-300 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
                    placeholder="https://drive.google.com/file/d/..."
                  />
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      if (tempVideoLink.trim()) {
                          setVideoLink(tempVideoLink.trim());
                          setIsLinkSaved(true);
                      } else {
                          alert('Please enter a valid link');
                      }
                    }}
                    className={`px-6 md:px-10 p-3 md:p-4 border-2 border-black font-black uppercase text-xs md:text-base shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-[3px] active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center justify-center min-w-[120px] ${isLinkSaved ? 'bg-green-500 text-white' : 'bg-[#FFB800] text-black hover:bg-[#E6A600]'}`}
                  >
                    {isLinkSaved ? 'Linked' : 'Upload'}
                  </button>
                </div>
                {isLinkSaved && (
                  <div className="flex items-center gap-2 mt-3 animate-fade-in-down">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <p className="text-[10px] font-black uppercase text-green-600 tracking-wider">Video link confirmed and saved</p>
                  </div>
                )}
              </div>



              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-2">Channel *</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[Channel.LINKEDIN, Channel.INSTAGRAM, Channel.YOUTUBE].map(c => (
                    <button
                      key={c}
                      onClick={() => setChannel(c)}
                      className={`p-4 text-center text-xs font-black uppercase border-2 border-black transition-all flex flex-col items-center justify-center gap-2 ${channel === c 
                        ? `${c === Channel.YOUTUBE ? 'bg-[#FF4F4F]' : c === Channel.LINKEDIN ? 'bg-[#0085FF]' : 'bg-[#D946EF]'} text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]` 
                        : 'bg-white hover:bg-slate-50 text-slate-500 hover:translate-y-[-2px]'}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-2">Brand *</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {BRANDS.map(b => (
                    <button
                      key={b.value}
                      onClick={() => {
                        setBrand(b.value);
                        if (b.value !== 'APPLYWIZZ') {
                            setNiche('');
                            setNicheOther('');
                        }
                      }}
                      className={`p-4 text-center text-[10px] md:text-xs font-black uppercase border-2 border-black transition-all flex flex-col items-center justify-center gap-2 ${brand === b.value 
                        ? `${b.color} text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-y-[-2px]` 
                        : 'bg-white hover:bg-slate-50 text-slate-700 hover:translate-y-[-2px]'}`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              {brand === 'APPLYWIZZ' && (
                <div className="animate-fade-in-down">
                  <label className="block text-xs font-black uppercase text-slate-500 mb-2">Niche</label>
                  <select
                    value={niche}
                    onChange={(e) => {
                      setNiche(e.target.value);
                      if (e.target.value !== 'OTHER') setNicheOther('');
                    }}
                    className="w-full p-4 border-2 border-black bg-white focus:bg-yellow-50 focus:outline-none font-black text-xs md:text-sm uppercase tracking-wider appearance-none cursor-pointer shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                    style={{
                      backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                      backgroundPosition: 'right 1rem center',
                      backgroundRepeat: 'no-repeat',
                      backgroundSize: '1.5em 1.5em',
                      paddingRight: '2.5rem'
                    }}
                  >
                    <option value="">Select Niche...</option>
                    {NICHES.map(n => (
                      <option key={n.value} value={n.value}>{n.label.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              )}

              {brand === 'APPLYWIZZ' && niche === 'OTHER' && (
                <div className="animate-fade-in-down">
                  <label className="block text-xs font-black uppercase text-slate-500 mb-2">Specify Other Niche</label>
                  <input
                    type="text"
                    value={nicheOther}
                    onChange={(e) => setNicheOther(e.target.value)}
                    className="w-full p-4 border-2 border-black bg-white focus:bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-black font-bold text-sm md:text-base placeholder:text-slate-300 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
                    placeholder="e.g. Testimonial, Behind the Scenes"
                  />
                </div>
              )}
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
