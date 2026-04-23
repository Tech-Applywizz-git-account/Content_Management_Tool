import React, { useState, useEffect, useRef } from 'react';
import { Channel, Priority } from '../../types';
import { db } from '../../services/supabaseDb';
import { ArrowLeft, Send, Bold, SpellCheck } from 'lucide-react';
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
  { value: 'CAREER_IDENTIFIER', label: '🎯 Career Identifier', color: 'bg-[#EF4444]' },
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
  const editorRef = useRef<HTMLDivElement>(null);
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
  const [scriptContent, setScriptContent] = useState('');
  const [scriptReferenceLink, setScriptReferenceLink] = useState('');

  // Corrections feature state
  const [correctionsEnabled, setCorrectionsEnabled] = useState(false);
  const [correctionsRunning, setCorrectionsRunning] = useState(false);
  const [correctionErrors, setCorrectionErrors] = useState<any[]>([]);
  const [lastCheckedContent, setLastCheckedContent] = useState<string>('');
  const [isLimitExceeded, setIsLimitExceeded] = useState(false);

  // Character count
  const scriptCharCount = React.useMemo(() => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = scriptContent || '';
    const text = tempDiv.textContent || '';
    return text.length;
  }, [scriptContent]);

  // Add CSS styles for grammar errors
  useEffect(() => {
    let styleElement = document.getElementById('grammar-error-styles-upload-editor') as HTMLStyleElement;
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = 'grammar-error-styles-upload-editor';
      styleElement.textContent = `
        .grammar-error {
          text-decoration: underline wavy red !important;
          text-decoration-skip-ink: none;
          cursor: pointer;
          position: relative;
          display: inline !important;
        }
        .grammar-error.spelling { text-decoration-color: #ef4444 !important; }
        .grammar-error.grammar { text-decoration-color: #f59e0b !important; }
        .grammar-error.formation { text-decoration-color: #f59e0b !important; }
        .grammar-error.enhancement { text-decoration-color: #3b82f6 !important; }

        .grammar-error:hover {
          background-color: rgba(255, 0, 0, 0.05);
        }
        .grammar-error.spelling:hover { background-color: rgba(239, 68, 68, 0.1); }
        .grammar-error.grammar:hover { background-color: rgba(245, 158, 11, 0.1); }

        .grammar-error::after {
          content: attr(data-label) ": " attr(data-suggestion);
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%) translateY(-10px);
          background: #1e293b !important;
          color: #ffffff !important;
          padding: 8px 16px;
          border-radius: 6px;
          white-space: pre-wrap;
          max-width: 250px;
          z-index: 2147483647 !important;
          font-size: 13px;
          font-weight: 600;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1px solid #334155;
          text-align: center;
          line-height: 1.4;
        }
        
        .grammar-error.spelling::after { border-bottom: 3px solid #ef4444; }
        .grammar-error.grammar::after { border-bottom: 3px solid #f59e0b; }

        .grammar-error::before {
          content: "";
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%) translateY(0);
          border: 6px solid transparent;
          border-top-color: #1e293b;
          z-index: 2147483647 !important;
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          margin-bottom: -2px;
        }
        .grammar-error:hover::after,
        .grammar-error:focus::after {
          opacity: 1 !important;
          visibility: visible !important;
          transform: translateX(-50%) translateY(-14px);
        }
        .grammar-error:hover::before,
        .grammar-error:focus::before {
          opacity: 1 !important;
          visibility: visible !important;
          transform: translateX(-50%) translateY(-2px);
        }
      `;
      document.head.appendChild(styleElement);
    }

    return () => {
      if (styleElement && document.head.contains(styleElement)) {
        document.head.removeChild(styleElement);
      }
    };
  }, []);

  // Function to check grammar and spelling using OpenAI API
  const checkGrammarAndSpelling = async (text: string) => {
    try {
      const normalizedText = text.replace(/\s+/g, ' ').trim();

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      let data;
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/openai-correction`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'apikey': supabaseAnonKey,
          },
          body: JSON.stringify({ text: normalizedText }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Service error: ${response.status}`);
        }

        data = await response.json();
      } catch (fetchErr: any) {
        if (fetchErr.name === 'AbortError') throw new Error('Correction request timed out. Please try again.');
        throw fetchErr;
      }

      const issues = data.issues || [];
      const errors: any[] = [];
      const usedRanges: { start: number; end: number }[] = [];

      issues.forEach((issue: any) => {
        const incorrect = issue.incorrect;
        if (!incorrect) return;

        let searchIndex = 0;
        while ((searchIndex = text.indexOf(incorrect, searchIndex)) !== -1) {
          const startIndex = searchIndex;
          const endIndex = startIndex + incorrect.length;

          const isOverlapping = usedRanges.some(range =>
            (startIndex >= range.start && startIndex < range.end) ||
            (endIndex > range.start && endIndex <= range.end)
          );

          if (!isOverlapping) {
            errors.push({
              offset: startIndex,
              length: incorrect.length,
              message: `${issue.type}: ${incorrect} -> ${issue.suggestion}`,
              type: issue.type,
              suggestions: [issue.suggestion],
            });
            usedRanges.push({ start: startIndex, end: endIndex });
            break;
          }
          searchIndex++;
        }
      });

      return errors.sort((a, b) => a.offset - b.offset);
    } catch (error: any) {
      console.error('Correction failed:', error);
      alert(error.message || 'Correction failed');
      return [];
    }
  };

  // Function to apply corrections
  const applyCorrections = async () => {
    if (!editorRef.current) return;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = editorRef.current.innerHTML;
    tempDiv.querySelectorAll('.grammar-error').forEach(span => {
      const textNode = document.createTextNode(span.textContent || '');
      span.parentNode?.replaceChild(textNode, span);
    });
    const plainText = tempDiv.textContent || tempDiv.innerText || '';

    if (plainText.length > 6000) {
      setIsLimitExceeded(true);
      alert('Script is too long for automated correction (max 6000 chars).');
      setTimeout(() => setIsLimitExceeded(false), 5000);
      return;
    }

    if (plainText === lastCheckedContent && correctionErrors.length > 0) {
      const highlightsApplied = editorRef.current.querySelectorAll('.grammar-error').length > 0;
      if (!highlightsApplied) {
        processHighlights(editorRef.current, correctionErrors);
        setCorrectionsEnabled(true);
      }
      return;
    }

    setCorrectionsRunning(true);
    setIsLimitExceeded(false);

    try {
      const errors = await checkGrammarAndSpelling(plainText);
      setCorrectionErrors(errors);
      setLastCheckedContent(plainText);

      processHighlights(editorRef.current, errors);
      setCorrectionsEnabled(true);
    } catch (error) {
      console.error('Error applying corrections:', error);
    } finally {
      setCorrectionsRunning(false);
    }
  };

  // Helper function to process highlights
  const processHighlights = (container: HTMLElement, errors: any[]) => {
    const editorClone = document.createElement('div');
    editorClone.innerHTML = container.innerHTML;

    editorClone.querySelectorAll('.grammar-error').forEach(span => {
      const textNode = document.createTextNode(span.textContent || '');
      span.parentNode?.replaceChild(textNode, span);
    });

    const sortedErrors = [...errors].sort((a, b) => b.offset - a.offset);

    for (const error of sortedErrors) {
      const { offset, length, message, suggestions } = error;
      wrapTextAtPosition(editorClone, offset, length, message, suggestions, error.type);
    }

    if (editorRef.current) {
      editorRef.current.innerHTML = editorClone.innerHTML;
    }
  };

  // Helper function to wrap text at specific position
  const wrapTextAtPosition = (container: HTMLElement, offset: number, length: number, message: string, suggestions: string[], type: string) => {
    let currentOffset = 0;
    let remainingLength = length;
    let currentTargetOffset = offset;

    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT
    );

    let node: Node | null;
    const nodesToReplace: { node: Node; start: number; end: number }[] = [];

    while (node = walker.nextNode()) {
      const nodeValue = node.nodeValue || '';
      const nodeLength = nodeValue.length;

      if (currentOffset + nodeLength <= currentTargetOffset) {
        currentOffset += nodeLength;
        continue;
      }

      const startInNode = Math.max(0, currentTargetOffset - currentOffset);
      const actualRemainingLength = Math.min(remainingLength, nodeLength - startInNode);
      const endInNode = startInNode + actualRemainingLength;

      if (startInNode < nodeLength && actualRemainingLength > 0) {
        nodesToReplace.push({
          node: node,
          start: startInNode,
          end: endInNode
        });

        remainingLength -= actualRemainingLength;
        currentTargetOffset += actualRemainingLength;
      }

      if (remainingLength <= 0) break;
      currentOffset += nodeLength;
    }

    for (const item of nodesToReplace) {
      const { node, start, end } = item;
      const nodeValue = node.nodeValue || '';

      const beforeText = nodeValue.substring(0, start);
      const errorText = nodeValue.substring(start, end);
      const afterText = nodeValue.substring(end);

      const fragment = document.createDocumentFragment();

      if (beforeText) {
        fragment.appendChild(document.createTextNode(beforeText));
      }

      const errorSpan = document.createElement('span');
      const typeClass = type?.toLowerCase() || 'grammar';
      errorSpan.className = `grammar-error ${typeClass}`;

      const labelMap: Record<string, string> = {
        'spelling': 'Spelling',
        'grammar': 'Grammar',
        'formation': 'Formation',
        'enhancement': 'Enhancement'
      };

      errorSpan.setAttribute('data-label', labelMap[typeClass] || 'Correction');
      errorSpan.setAttribute('data-suggestion', suggestions && suggestions.length > 0 ? suggestions[0] : 'Correction available');
      errorSpan.setAttribute('title', message);
      errorSpan.setAttribute('tabindex', '0');
      errorSpan.textContent = errorText;
      fragment.appendChild(errorSpan);

      if (afterText) {
        fragment.appendChild(document.createTextNode(afterText));
      }

      node.parentNode?.replaceChild(fragment, node);
    }
  };

  // Function to clear corrections
  const clearCorrections = () => {
    if (!editorRef.current) return;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = editorRef.current.innerHTML;

    const errorSpans = tempDiv.querySelectorAll('.grammar-error');
    errorSpans.forEach(span => {
      const textNode = document.createTextNode(span.textContent || '');
      span.parentNode?.replaceChild(textNode, span);
    });

    if (editorRef.current) {
      editorRef.current.innerHTML = tempDiv.innerHTML;
    }

    setCorrectionsEnabled(false);
    setCorrectionErrors([]);
  };

  // Function to apply a specific correction
  const applyCorrection = (spanElement: HTMLElement) => {
    const suggestion = spanElement.getAttribute('data-suggestion');
    if (!suggestion || suggestion === 'Correction available') return;

    const textNode = document.createTextNode(suggestion);
    const parent = spanElement.parentNode;
    if (parent) {
      parent.replaceChild(textNode, spanElement);

      if (editorRef.current) {
        const newContent = editorRef.current.innerHTML;
        setScriptContent(newContent);
      }
    }
  };

  // Function to apply bold formatting
  const applyBold = () => {
    if (!editorRef.current) return;

    const selection = window.getSelection();
    if (!selection || selection.toString().trim() === '') return;

    document.execCommand('bold', false, null);

    const content = editorRef.current.innerHTML;
    setScriptContent(content);
  };

  // Function to apply color to selected text
  const applyColor = (color: string) => {
    if (!editorRef.current) return;

    const selection = window.getSelection();
    if (!selection || selection.toString().trim() === '') return;

    const colorMap: Record<string, string> = {
      'red': '#990000',
      'blue': '#000099',
      'green': '#006600',
      'purple': '#6600cc',
      'orange': '#cc6600',
      'black': '#000000',
    };

    const darkColor = colorMap[color] || color;

    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand('foreColor', false, darkColor);

    const content = editorRef.current.innerHTML;
    setScriptContent(content);
  };

  // Function to handle editor content change
  const handleEditorChange = () => {
    if (editorRef.current) {
      setScriptContent(editorRef.current.innerHTML);
    }
  };

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
        nicheOther,
        scriptContent,
        scriptReferenceLink
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

              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-2">Script Content</label>
                
                {/* Formatting Toolbar */}
                <div className="flex items-center gap-2 mb-2 p-2 bg-slate-100 border-2 border-black rounded">
                  <button
                    onClick={applyBold}
                    className="p-2 hover:bg-slate-200 transition-colors border border-slate-300 rounded"
                    title="Bold"
                  >
                    <Bold className="w-4 h-4" />
                  </button>
                  <div className="w-px h-6 bg-slate-300"></div>
                  
                  {/* Color Picker */}
                  <div className="flex gap-1">
                    <button
                      onClick={() => applyColor('#990000')}
                      className="w-6 h-6 rounded border border-slate-300 hover:scale-110 transition-transform"
                      style={{ backgroundColor: '#990000' }}
                      title="Red"
                    />
                    <button
                      onClick={() => applyColor('#000099')}
                      className="w-6 h-6 rounded border border-slate-300 hover:scale-110 transition-transform"
                      style={{ backgroundColor: '#000099' }}
                      title="Blue"
                    />
                    <button
                      onClick={() => applyColor('#006600')}
                      className="w-6 h-6 rounded border border-slate-300 hover:scale-110 transition-transform"
                      style={{ backgroundColor: '#006600' }}
                      title="Green"
                    />
                    <button
                      onClick={() => applyColor('#6600cc')}
                      className="w-6 h-6 rounded border border-slate-300 hover:scale-110 transition-transform"
                      style={{ backgroundColor: '#6600cc' }}
                      title="Purple"
                    />
                    <button
                      onClick={() => applyColor('#cc6600')}
                      className="w-6 h-6 rounded border border-slate-300 hover:scale-110 transition-transform"
                      style={{ backgroundColor: '#cc6600' }}
                      title="Orange"
                    />
                    <button
                      onClick={() => applyColor('#000000')}
                      className="w-6 h-6 rounded border border-slate-300 hover:scale-110 transition-transform"
                      style={{ backgroundColor: '#000000' }}
                      title="Black"
                    />
                  </div>
                  
                  <div className="w-px h-6 bg-slate-300"></div>
                  <button
                    onClick={applyCorrections}
                    disabled={correctionsRunning}
                    className={`p-2 hover:bg-slate-200 transition-colors border border-slate-300 rounded flex items-center gap-2 ${correctionsRunning ? 'opacity-50' : ''}`}
                    title="Check Grammar & Spelling"
                  >
                    <SpellCheck className="w-4 h-4" />
                    {correctionsRunning ? 'Checking...' : 'Spell Check'}
                  </button>
                  {correctionsEnabled && (
                    <>
                      <div className="w-px h-6 bg-slate-300"></div>
                      <button
                        onClick={clearCorrections}
                        className="p-2 hover:bg-slate-200 transition-colors border border-slate-300 rounded text-xs font-bold uppercase"
                        title="Clear Corrections"
                      >
                        Clear
                      </button>
                    </>
                  )}
                  <div className="ml-auto text-xs font-bold text-slate-600">
                    {scriptCharCount} chars
                  </div>
                </div>

                {/* Rich Text Editor */}
                <div
                  ref={editorRef}
                  contentEditable
                  onInput={handleEditorChange}
                  className="w-full p-4 border-2 border-black bg-white focus:outline-none focus:ring-2 focus:ring-black font-bold text-sm md:text-base shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all min-h-[120px] max-h-[400px] overflow-y-auto"
                  style={{ outline: 'none' }}
                  suppressContentEditableWarning={true}
                />
                {isLimitExceeded && (
                  <p className="text-xs text-red-600 mt-1 font-bold">Script is too long for automated correction (max 6000 chars).</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-2">Script Reference Link</label>
                <input
                  type="url"
                  value={scriptReferenceLink}
                  onChange={(e) => setScriptReferenceLink(e.target.value)}
                  className="w-full p-3 md:p-4 border-2 border-black bg-white focus:outline-none focus:ring-2 focus:ring-black font-bold text-sm md:text-base placeholder:text-slate-300 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
                  placeholder="https://docs.google.com/document/d/..."
                />
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
