
import React, { useState, useEffect, useRef } from 'react';
import { decodeHtmlEntities } from '../../utils/htmlDecoder';
import { Project, ProjectData, Channel, Role, ContentType, WorkflowStage, STAGE_LABELS, TaskStatus, Priority } from '../../types';
import Popup from '../Popup';
import { db } from '../../services/supabaseDb';
import { supabase } from '../../src/integrations/supabase/client';
import { ArrowLeft, Save, Send, Image as ImageIcon, Link as LinkIcon, FileText, X, SpellCheck } from 'lucide-react';
import { getWorkflowState } from '../../services/workflowUtils';

interface Props {
  project?: Project; // If editing existing draft
  onClose: () => void;
  onSuccess: () => void;
  creatorRole?: Role;
  mode?: 'SCRIPT_FROM_APPROVED_IDEA'; // WRITER or CMO
}

const CreateScript: React.FC<Props> = ({ project, onClose, onSuccess, creatorRole, mode }) => {
  const editorRef = React.useRef<HTMLDivElement>(null);

  const parsedProjectData: ProjectData | null = React.useMemo(() => {
    if (!project?.data) return null;
    if (typeof project.data === 'string') {
      try {
        return JSON.parse(project.data);
      } catch {
        return null;
      }
    }
    return project.data;
  }, [project]);

  // Helper to check if project has script content
  const hasScript = React.useMemo(() => !!parsedProjectData?.script_content, [parsedProjectData]);

  // State for reviewer access check
  const [hasReviewerAccessed, setHasReviewerAccessed] = useState<boolean>(false);

  // Helper function to check if a reviewer (CMO or CEO) has accessed the project
  useEffect(() => {
    const checkReviewerAccess = async () => {
      if (!project?.id) {
        setHasReviewerAccessed(false);
        return;
      }

      try {
        // First, get workflow history entries for this project
        const { data: historyData, error: historyError } = await supabase
          .from('workflow_history')
          .select('actor_id')
          .eq('project_id', project.id)
          .limit(10); // Get recent history entries

        if (historyError) {
          console.error('Error checking reviewer access:', historyError);
          setHasReviewerAccessed(false);
          return;
        }

        // If no history entries, no reviewer has accessed
        if (!historyData || historyData.length === 0) {
          setHasReviewerAccessed(false);
          return;
        }

        // Get unique actor IDs from history, filtering out null values
        const actorIds = [...new Set(historyData.map(entry => entry.actor_id).filter(id => id !== null && id !== undefined))];

        // Only proceed if we have valid actor IDs
        if (actorIds.length === 0) {
          setHasReviewerAccessed(false);
          return;
        }

        // Check if any of these actors are CMO or CEO
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, role')
          .in('id', actorIds)
          .in('role', ['CMO', 'CEO']);

        if (userError) {
          console.error('Error checking user roles:', userError);
          setHasReviewerAccessed(false);
          return;
        }

        // Set state if any of the actors who accessed the project are CMO or CEO
        setHasReviewerAccessed(userData && userData.length > 0);
      } catch (error) {
        console.error('Error checking reviewer access:', error);
        setHasReviewerAccessed(false);
      }
    };

    checkReviewerAccess();
  }, [project?.id]);

  // State for edit permission
  const [canEdit, setCanEdit] = useState(true);

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [publicUser, setPublicUser] = useState<any>(null);
  const [formData, setFormData] = useState<ProjectData>({
    ...(parsedProjectData || {}),
    script_content: parsedProjectData?.script_content || '',
    _workflow_script_loaded: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewComment, setReviewComment] = useState<any>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [previousScript, setPreviousScript] = useState<string | null>(null);
  const [previousIdeaDescription, setPreviousIdeaDescription] = useState<string | null>(null);
  const [returnType, setReturnType] = useState<'rework' | 'reject' | null>(null); // 'rework' or 'reject'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Define newProjectDetails state properly
  const [newProjectDetails, setNewProjectDetails] = useState({
    title: project?.title || '',
    channel: project?.channel || '', // No default selection
    contentType: project?.content_type || '', // No default selection
    dueDate: project?.due_date || new Date().toISOString().split('T')[0],
    priority: project?.priority || 'NORMAL',
    brand: project?.brand || '',
    brand_other: project?.data?.brand_other || ''
  });

  // Update newProjectDetails when project changes to handle reloads
  useEffect(() => {
    setNewProjectDetails({
      title: project?.title || '',
      channel: project?.channel || '',
      contentType: project?.content_type || '',
      dueDate: project?.due_date || new Date().toISOString().split('T')[0],
      priority: project?.priority || 'NORMAL',
      brand: project?.brand || '',
      brand_other: project?.data?.brand_other || ''
    });
  }, [project]);

  const [validationError, setValidationError] = useState<string | null>(null);

  const [dynamicBrands, setDynamicBrands] = useState<any[]>([]);

  // Fetch dynamic brands to show brands created by PA
  useEffect(() => {
    const fetchDynamicBrands = async () => {
      try {
        const brands = await db.brands.getAll();
        setDynamicBrands(brands);
      } catch (err) {
        console.error("Failed to load dynamic brands:", err);
      }
    };
    fetchDynamicBrands();
  }, []);

  // Track editor initialization to prevent cursor jumping
  const isEditorInitialized = useRef(false);

  // Initialize editor content when available
  useEffect(() => {
    if (!loading && editorRef.current && formData.script_content) {
      // Only set content if we haven't initialized yet
      if (!isEditorInitialized.current) {
        editorRef.current.innerHTML = formData.script_content;
        isEditorInitialized.current = true;
      }
      // Or if we specifically loaded new content from workflow history (rework/reject)
      // We check if the content is drastically different to avoid overwriting minor edits
      else if (formData._workflow_script_loaded) {
        const currentContent = editorRef.current.innerHTML;
        if (currentContent !== formData.script_content && (currentContent === '' || currentContent === '<br>')) {
          editorRef.current.innerHTML = formData.script_content;
        }
      }
    }
  }, [loading, formData.script_content, formData._workflow_script_loaded]);

  // Corrections feature state
  const [correctionsEnabled, setCorrectionsEnabled] = useState(false);
  const [correctionsRunning, setCorrectionsRunning] = useState(false);
  const [correctionErrors, setCorrectionErrors] = useState<any[]>([]);
  const [lastCheckedContent, setLastCheckedContent] = useState<string>('');
  const [isLimitExceeded, setIsLimitExceeded] = useState(false);

  const scriptCharCount = React.useMemo(() => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = formData.script_content || '';
    const text = tempDiv.textContent || '';
    return text.length;
  }, [formData.script_content]);

  // Add CSS styles for grammar errors
  useEffect(() => {
    let styleElement = document.getElementById('grammar-error-styles') as HTMLStyleElement;
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = 'grammar-error-styles';
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

    // Cleanup function to remove style when component unmounts
    return () => {
      if (styleElement && document.head.contains(styleElement)) {
        document.head.removeChild(styleElement);
      }
    };
  }, []);


  // Function to check grammar and spelling using OpenAI API
  const checkGrammarAndSpelling = async (text: string) => {
    try {
      // Normalize text: clean whitespace but preserve structure
      const normalizedText = text.replace(/\s+/g, ' ').trim();

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      // Add AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

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

      // String-based matching for frontend reliability
      issues.forEach((issue: any) => {
        const incorrect = issue.incorrect;
        if (!incorrect) return;

        // Find all occurrences of the incorrect string in the ORIGINAL text
        let searchIndex = 0;
        while ((searchIndex = text.indexOf(incorrect, searchIndex)) !== -1) {
          const startIndex = searchIndex;
          const endIndex = startIndex + incorrect.length;

          // Check if this range overlaps with already identified errors
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
            break; // Just pick the first non-overlapping match for this issue
          }
          searchIndex++;
        }
      });

      return errors.sort((a, b) => a.offset - b.offset);
    } catch (error: any) {
      console.error('Correction failed:', error);
      setError(error.message || 'Correction failed');
      return [];
    }
  };

  // Function to apply corrections to the editor content
  const applyCorrections = async () => {
    if (!editorRef.current) return;

    // Extract plain text content to check length and caching
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = editorRef.current.innerHTML;
    // Remove existing correction spans to get clean plain text
    tempDiv.querySelectorAll('.grammar-error').forEach(span => {
      const textNode = document.createTextNode(span.textContent || '');
      span.parentNode?.replaceChild(textNode, span);
    });
    const plainText = tempDiv.textContent || tempDiv.innerText || '';

    // Check character limit (OpenAI mini models usually handle context well, but we keep a safe limit)
    if (plainText.length > 6000) {
      setIsLimitExceeded(true);
      setError('Script is too long for automated correction (max 6000 chars).');
      setTimeout(() => setError(null), 5000);
      return;
    }

    // Check caching: if content hasn't changed since last check, don't call API again
    if (plainText === lastCheckedContent && correctionErrors.length > 0) {
      // Re-apply existing highlights if they were cleared
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
      // Check grammar and spelling
      const errors = await checkGrammarAndSpelling(plainText);
      setCorrectionErrors(errors);
      setLastCheckedContent(plainText);

      // Apply highlights
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
    // Process content to add error highlights
    const editorClone = document.createElement('div');
    editorClone.innerHTML = container.innerHTML;

    // Clear any existing highlights first
    editorClone.querySelectorAll('.grammar-error').forEach(span => {
      const textNode = document.createTextNode(span.textContent || '');
      span.parentNode?.replaceChild(textNode, span);
    });

    // Sort errors by offset in descending order to avoid index shifting issues
    const sortedErrors = [...errors].sort((a, b) => b.offset - a.offset);

    // Process each error from last to first
    for (const error of sortedErrors) {
      const { offset, length, message, suggestions } = error;
      wrapTextAtPosition(editorClone, offset, length, message, suggestions, error.type);
    }

    // Update the editor with processed content
    if (editorRef.current) {
      editorRef.current.innerHTML = editorClone.innerHTML;
    }
  };

  // Helper function to wrap text at specific position
  const wrapTextAtPosition = (container: HTMLElement, offset: number, length: number, message: string, suggestions: string[], type: string) => {
    let currentOffset = 0;
    let remainingLength = length;
    let currentTargetOffset = offset;

    // Walk through all text nodes to find the one containing our target position
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT
    );

    let node: Node | null;
    const nodesToReplace: { node: Node; start: number; end: number }[] = [];

    while (node = walker.nextNode()) {
      const nodeValue = node.nodeValue || '';
      const nodeLength = nodeValue.length;

      // If we haven't reached the start of the error yet
      if (currentOffset + nodeLength <= currentTargetOffset) {
        currentOffset += nodeLength;
        continue;
      }

      // This node contains at least part of the error
      const startInNode = Math.max(0, currentTargetOffset - currentOffset);
      // Safety check for length
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

    // Process the collected nodes
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
      errorSpan.setAttribute('title', message); // Fallback title
      errorSpan.setAttribute('tabindex', '0'); // Allow focus for click behavior
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

    // Remove all grammar-error spans and restore original text
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = editorRef.current.innerHTML;

    const errorSpans = tempDiv.querySelectorAll('.grammar-error');
    errorSpans.forEach(span => {
      // Replace the span with its text content
      const textNode = document.createTextNode(span.textContent || '');
      span.parentNode?.replaceChild(textNode, span);
    });

    // Update the editor
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

    // Save cursor position to restore it after replacement
    const position = saveCursorPosition();

    // Create text node with suggestion
    const textNode = document.createTextNode(suggestion);
    const parent = spanElement.parentNode;
    if (parent) {
      parent.replaceChild(textNode, spanElement);

      // Sync state and formData
      if (editorRef.current) {
        const newContent = editorRef.current.innerHTML;
        setFormData(prev => ({ ...prev, script_content: newContent }));
      }

      // Restore cursor
      if (position !== null) {
        setTimeout(() => restoreCursorPosition(position), 0);
      }
    }
  };

  // Sync editor state when project changes


  // Initialize formData when component mounts or when project/parsedProjectData changes
  useEffect(() => {
    if (project && parsedProjectData) {
      setFormData(prevFormData => ({
        ...prevFormData,
        ...parsedProjectData
      }));
    }
  }, [project, parsedProjectData]); // Depend on project and parsedProjectData

  // Popup state for submit
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');
  const [stageName, setStageName] = useState('');

  // Calculate workflow state once
  const workflowState = project ? getWorkflowState(project) : null;

  // Calculate other derived values
  const isScriptFromApprovedIdea = mode === 'SCRIPT_FROM_APPROVED_IDEA';
  const isRework = workflowState?.isRework;
  // Check if this script is being created from an approved idea
  const isFromIdea = project?.data?.source === 'IDEA_PROJECT' &&
    project.history?.some(h => h.action === 'APPROVED' && h.stage === 'FINAL_REVIEW_CEO');

  // A project is a pure idea ONLY if source is IDEA_PROJECT AND script_content does NOT exist AND it's not being converted from an approved idea
  const isPureIdeaEdit = React.useMemo(() => {
    const parsedData = parsedProjectData;
    return parsedData?.source === 'IDEA_PROJECT' &&
      !hasScript &&
      !isScriptFromApprovedIdea &&
      !isFromIdea;
  }, [parsedProjectData, hasScript, isScriptFromApprovedIdea, isFromIdea]);

  // Show idea description as reference when converting an approved idea to script
  const showIdeaAsReference = React.useMemo(() => {
    return isScriptFromApprovedIdea && parsedProjectData?.source === 'IDEA_PROJECT';
  }, [isScriptFromApprovedIdea, parsedProjectData]);

  // Function to save selection before updating content
  const saveSelection = () => {
    if (!editorRef.current) return null;

    const selection = window.getSelection();
    if (!selection.rangeCount) return null;

    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(editorRef.current);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    const start = preCaretRange.toString().length;

    return {
      start,
      end: start + range.toString().length
    };
  };

  // Function to restore selection after updating content
  const restoreSelection = (savedSelection: { start: number; end: number } | null) => {
    if (!savedSelection || !editorRef.current) return;

    let charIndex = 0;
    const walker = document.createTreeWalker(
      editorRef.current,
      NodeFilter.SHOW_TEXT
    );

    let node;
    let foundStart = false;
    let range = document.createRange();
    range.setStart(editorRef.current, 0);
    range.collapse(true);

    while ((node = walker.nextNode())) {
      const nextCharIndex = charIndex + node.textContent!.length;
      if (!foundStart && savedSelection.start >= charIndex && savedSelection.start <= nextCharIndex) {
        range.setStart(node, savedSelection.start - charIndex);
        foundStart = true;
      }
      if (foundStart && savedSelection.end >= charIndex && savedSelection.end <= nextCharIndex) {
        range.setEnd(node, savedSelection.end - charIndex);
        break;
      }
      charIndex = nextCharIndex;
    }

    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
  };

  // Function to apply color to selected text
  const applyColor = (color: string) => {
    if (!canEdit || !editorRef.current) return;

    const selection = window.getSelection();
    if (!selection || selection.toString().trim() === '') return;

    // Map color names to bolder/darker hex values for better contrast
    const colorMap: Record<string, string> = {
      'red': '#990000', // bold dark red
      'blue': '#000099', // bold dark blue
      'green': '#006600', // bold dark green
      'purple': '#6600cc', // bold dark purple
      'orange': '#cc6600', // bold dark orange
      'black': '#000000', // black
    };

    const darkColor = colorMap[color] || color;

    // Save selection before applying color
    const savedSelection = saveSelection();

    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand('foreColor', false, darkColor);

    // Update the form data with the new content
    const content = editorRef.current.innerHTML;
    setFormData({ ...formData, script_content: content });

    // Restore selection after updating state
    setTimeout(() => {
      restoreSelection(savedSelection);
    }, 0);
  };

  // Function to apply bold formatting
  const applyBold = () => {
    if (!canEdit || !editorRef.current) return;

    const selection = window.getSelection();
    if (!selection || selection.toString().trim() === '') return;

    // Save selection before applying bold
    const savedSelection = saveSelection();

    document.execCommand('bold', false, null);

    // Update the form data with the new content
    const content = editorRef.current.innerHTML;
    setFormData({ ...formData, script_content: content });

    // Restore selection after updating state
    setTimeout(() => {
      restoreSelection(savedSelection);
    }, 0);
  };

  // Function to handle text selection events
  const handleTextSelection = () => {
    // We can add logic here to show/hide the toolbar based on selection
    // For now, just keeping the toolbar visible
  };


  // Load user effect
  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await db.getCurrentUser();
        if (user) {
          setCurrentUser(user);

          // Fetch the public user once using the logged-in user's email
          const { data: pUser, error: pError } = await supabase
            .from('users')
            .select('*')
            .eq('email', user.email)
            .single();

          if (!pError && pUser) {
            setPublicUser(pUser);
          } else {
            console.error('Error fetching public user:', pError);
            setError('User profile not found in database. Please contact support.');
          }
        } else {
          setError('No user session found');
        }
      } catch (err) {
        console.error('Error loading current user:', err);
        setError('Failed to load user session');
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  // Initialize form data when project changes
  useEffect(() => {
    if (!project) return;

    const parsed =
      typeof project.data === 'string'
        ? JSON.parse(project.data)
        : project.data;

    const isPredefinedBrand = (b: string) => ['APPLYWIZZ', 'APPLYWIZZ_JOB_BOARD', 'LEAD_MAGNET_RTW', 'SHYAMS_PERSONAL_BRANDING', 'APPLYWIZZ_USA_JOBS'].includes(b);
    
    // Always update formData when project changes to ensure content is preserved
    setFormData(prev => {
      const brandValue = parsed?.brand || project.brand || '';
      return {
        ...prev,
        ...parsed,
        brand: isPredefinedBrand(brandValue) ? brandValue : (brandValue ? 'OTHER' : prev.brand),
        brand_other: isPredefinedBrand(brandValue) ? '' : brandValue || parsed?.brand_other || prev.brand_other || '',
        script_content: parsed?.script_content || prev?.script_content || ''
      };
    });

    setNewProjectDetails(prev => {
      const brandValue = project.brand || '';
      return {
        ...prev,
        title: project.title || '',
        channel: project.channel || '',
        contentType: project.content_type || '',
        dueDate: project.due_date || new Date().toISOString().split('T')[0],
        priority: project.priority || 'NORMAL',
        brand: isPredefinedBrand(brandValue) ? brandValue : (brandValue ? 'OTHER' : prev.brand),
        brand_other: isPredefinedBrand(brandValue) ? '' : brandValue || parsed?.brand_other || prev.brand_other || ''
      };
    });
  }, [project, dynamicBrands]); // Run when project or dynamicBrands changes

  // Check edit permissions after user is loaded
  useEffect(() => {
    if (project && currentUser) {
      const checkEditPermission = async () => {
        // Writer can edit/delete ONLY if:
        // 1. The project was created by the writer
        // 2. CMO or CEO has not opened the project
        const isCreator = project.created_by_user_id === publicUser.id;

        if (!isCreator) {
          setCanEdit(false);
          return;
        }

        // Check if reviewer has accessed by looking for review-related actions in history
        if (project.id) {
          try {
            const { data: historyData, error: historyError } = await supabase
              .from('workflow_history')
              .select('actor_id, action, timestamp')
              .eq('project_id', project.id)
              .order('timestamp', { ascending: false });

            if (!historyError && historyData) {
              // Check if any CMO or CEO has reviewed the project
              for (const history of historyData) {
                // Skip if actor_id is null or undefined
                if (!history.actor_id) {
                  continue;
                }

                // Get the role of the actor who accessed the project
                const { data: userData, error: userError } = await supabase
                  .from('users')
                  .select('role')
                  .eq('id', history.actor_id)
                  .single();

                if (!userError && userData &&
                  (userData.role === 'CMO' || userData.role === 'CEO')) {
                  // If a reviewer has accessed the project (not just viewed), set canEdit to false
                  // Consider actions like 'REVIEWED', 'REJECTED', 'REWORK', 'SUBMITTED' as access
                  // But for SCRIPT_FROM_APPROVED_IDEA mode, we allow editing even after APPROVED action
                  if (isScriptFromApprovedIdea) {
                    setCanEdit(true);
                    return;
                  }
                  if (project.status === TaskStatus.REWORK) {
                    setCanEdit(true);
                    return;
                  }

                  // ❌ Block editing for real review states
                  if (['REVIEWED', 'REJECTED', 'SUBMITTED', 'APPROVED'].includes(history.action)) {
                    setCanEdit(false);
                    return;
                  }

                  // For APPROVED action, only disable editing if NOT in SCRIPT_FROM_APPROVED_IDEA mode
                  if (history.action === 'APPROVED' && !isScriptFromApprovedIdea) {
                    setCanEdit(false);
                    return;
                  }
                }
              }
              // If no reviewer has accessed, the creator can still edit
              setCanEdit(true);
            } else {
              setCanEdit(true);
            }
          } catch (error) {
            console.error('Error checking reviewer access:', error);
            setCanEdit(true);
          }
        } else {
          setCanEdit(true);
        }
      };

      checkEditPermission();
    }
  }, [project, currentUser]);

  // Validation effect
  useEffect(() => {
    // Check for invalid channel/content type combinations and thumbnail requirement
    if (newProjectDetails.channel === Channel.LINKEDIN && newProjectDetails.contentType === 'VIDEO') {
      const channelLabel = 'LinkedIn';
      setValidationError(`${channelLabel} does not support video content. Please select a different channel or change content type to Creative Only.`);
    } else if ((newProjectDetails.contentType === 'VIDEO' || newProjectDetails.contentType === 'APPLYWIZZ_USA_JOBS') && formData.thumbnail_required === undefined) {
      setValidationError('Thumbnail requirement must be specified for video content.');
    } else if (newProjectDetails.contentType === 'VIDEO' && formData.brand === 'OTHER' && (!formData.brand_other || !formData.brand_other.trim())) {
      setValidationError('Please specify the brand name when "Other" is selected.');
    } else {
      setValidationError(null);
    }
  }, [newProjectDetails.channel, newProjectDetails.contentType, formData.thumbnail_required, formData.brand, formData.brand_other]);

  // Listen for beforeLogout event to save changes automatically
  useEffect(() => {
    const handleBeforeLogout = () => {
      console.log('Saving draft before logout...');
      handleSaveDraft();
    };

    window.addEventListener('beforeLogout', handleBeforeLogout);
    return () => {
      window.removeEventListener('beforeLogout', handleBeforeLogout);
    };
  }, [formData, newProjectDetails, project]);

  // Function to save current cursor position
  const saveCursorPosition = () => {
    if (!editorRef.current) return null;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(editorRef.current);
    preCaretRange.setEnd(range.endContainer, range.endOffset);

    return preCaretRange.toString().length;
  };

  // Function to restore cursor position
  const restoreCursorPosition = (position: number | null) => {
    if (!editorRef.current || position === null) return;

    let charIndex = 0;
    const walker = document.createTreeWalker(
      editorRef.current,
      NodeFilter.SHOW_TEXT
    );

    let node;
    let foundStart = false;
    let range = document.createRange();
    const selection = window.getSelection();

    if (!selection) return;

    while ((node = walker.nextNode())) {
      const nextCharIndex = charIndex + node.textContent!.length;

      if (!foundStart && position >= charIndex && position <= nextCharIndex) {
        range.setStart(node, position - charIndex);
        foundStart = true;
      }

      if (foundStart && position >= charIndex && position <= nextCharIndex) {
        range.setEnd(node, position - charIndex);
        break;
      }

      charIndex = nextCharIndex;
    }

    selection.removeAllRanges();
    selection.addRange(range);
  };



  // Helper function to format content for the editor with proper line breaks
  const formatContentForEditor = (content) => {
    if (!content) return '';

    // If content doesn't contain HTML tags but has line breaks, wrap paragraphs in <p> tags
    if (!content.includes('<p>') && !content.includes('<br>')) {
      return content.split('\n\n').map(paragraph => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`).join('');
    }

    return content;
  };

  // Effect to update editor when workflow script is loaded
  useEffect(() => {
    if (editorRef.current && formData._workflow_script_loaded && formData.script_content) {
      // Save cursor position before updating content
      const cursorPosition = saveCursorPosition();

      // Format content for proper display in editor
      const formattedContent = formatContentForEditor(formData.script_content);
      editorRef.current.innerHTML = formattedContent;

      // Restore cursor position after updating content
      if (cursorPosition !== null) {
        setTimeout(() => {
          restoreCursorPosition(cursorPosition);
        }, 0);
      }
    }
  }, [formData._workflow_script_loaded, formData.script_content, editorRef]);

  // This effect ensures the editor content is initialized with the script content when available
  useEffect(() => {
    if (editorRef.current && formData.script_content !== undefined && !formData._workflow_script_loaded) {
      // Only initialize if the editor is currently empty or has default content
      if (!editorRef.current.innerHTML ||
        editorRef.current.innerHTML === '' ||
        editorRef.current.innerHTML === 'Start writing your script here...') {
        // Format content for proper display in editor, preserving formatting
        const formattedContent = formatContentForEditor(formData.script_content);
        editorRef.current.innerHTML = formattedContent || 'Start writing your script here...';
      }
    }
  }, [formData.script_content, formData._workflow_script_loaded, editorRef]);

  // Initialize editor content when formData.script_content changes or when component mounts
  useEffect(() => {
    if (editorRef.current && formData.script_content !== undefined) {
      // Initialize if the editor is empty, has default content, or component just mounted
      if (!editorRef.current.innerHTML ||
        editorRef.current.innerHTML === '' ||
        editorRef.current.innerHTML === 'Start writing your script here...') {
        // Format content for proper display in editor, preserving formatting
        const formattedContent = formatContentForEditor(formData.script_content);
        editorRef.current.innerHTML = formattedContent || 'Start writing your script here...';
      }
    }
  }, [formData.script_content, editorRef]); // Run when script_content or editorRef changes


  // Fetch reviewer comments and previous script for rework/rejected projects
  useEffect(() => {
    const fetchReviewData = async () => {
      if (project?.id) {
        try {
          // Determine return type based on the latest action
          if (workflowState?.isRejected) {
            setReturnType('reject');
          } else if (workflowState?.isRework) {
            setReturnType('rework');
          }

          // Fetch the most recent workflow history entry to get comments
          const { data: historyData, error: historyError } = await supabase
            .from('workflow_history')
            .select('actor_name, comment, timestamp, action')
            .eq('project_id', project.id)
            .order('timestamp', { ascending: false })
            .limit(1);

          if (historyError) {
            console.error('Error fetching workflow history:', historyError);
          } else if (historyData && historyData.length > 0) {
            setReviewComment(historyData[0]);
          }

          // Fetch script version based on the latest action
          // We'll try both REWORK and REJECTED actions to find the most recent script content
          let scriptData = null;
          let scriptError = null;

          // First, try to get the most recent script based on workflow state
          if (workflowState?.isRework || workflowState?.isRejected) {
            let scriptAction = workflowState.isRework ? 'REWORK' : 'REJECTED';

            const { data, error } = await supabase
              .from('workflow_history')
              .select('script_content')
              .eq('project_id', project.id)
              .eq('action', scriptAction)
              .order('timestamp', { ascending: false })
              .limit(1);

            if (!error && data && data.length > 0 && data[0].script_content) {
              scriptData = data;
              scriptError = error;
            } else {
              // If the specific action didn't have script content, try the other one
              let fallbackAction = workflowState.isRework ? 'REJECTED' : 'REWORK';
              const { data: fallbackData, error: fallbackError } = await supabase
                .from('workflow_history')
                .select('script_content')
                .eq('project_id', project.id)
                .eq('action', fallbackAction)
                .order('timestamp', { ascending: false })
                .limit(1);

              if (!fallbackError && fallbackData && fallbackData.length > 0 && fallbackData[0].script_content) {
                scriptData = fallbackData;
                scriptError = fallbackError;
              }
            }
          }

          // If we still don't have script content from rework/reject, try to get the most recent script content regardless of action
          if (!scriptData || (scriptData.length === 0 || !scriptData[0].script_content)) {
            const { data: fallbackData, error: fallbackError } = await supabase
              .from('workflow_history')
              .select('script_content, action')
              .eq('project_id', project.id)
              .not('script_content', 'is', null)
              .neq('script_content', '')
              .order('timestamp', { ascending: false })
              .limit(1);

            if (!fallbackError && fallbackData && fallbackData.length > 0) {
              scriptData = fallbackData;
              scriptError = fallbackError;
            }
          }

          if (scriptError) {
            console.error('Error fetching previous script:', scriptError);
          } else if (scriptData && scriptData.length > 0 && scriptData[0].script_content) {
            const script = scriptData[0].script_content;

            setPreviousScript(script);

            // Update formData with script content from workflow history (this is the source of truth for rework/reject)
            setFormData(prev => {
              // Only update if we don't already have script content from workflow history
              if (prev._workflow_script_loaded) {
                return prev;
              }

              return {
                ...prev,
                script_content: script,
                _workflow_script_loaded: true  // Flag to prevent overwrites
              };
            });
          }

          // Also try to get the idea description from the project data itself
          if (project.data?.idea_description) {
            setPreviousIdeaDescription(project.data.idea_description);
            setFormData(prev => ({
              ...prev,
              idea_description: project.data?.idea_description
            }));
          }

          // For rework projects, also update formData with script content if available
          if (workflowState?.isRework && project.data?.script_content && !formData._workflow_script_loaded) {
            setFormData(prev => ({
              ...prev,
              script_content: project.data?.script_content
            }));
          }
        } catch (err) {
          console.error('Error fetching review data:', err);
        }
      }
    };

    fetchReviewData();
  }, [project?.id, workflowState?.isRework, workflowState?.isRejected, formData._workflow_script_loaded]);

  // Don't render the main form if user is not loaded yet
  if (loading) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto"></div>
          <p className="mt-4 font-bold">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render the main form if there's an error or no current user
  if (error || !currentUser) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
        <div className="text-center p-6 max-w-md">
          <p className="font-bold text-red-500 mb-4">{error || 'No user session found'}</p>
          <p className="text-gray-600 mb-6">Please log in again to continue.</p>
          <button
            onClick={() => window.location.href = '/'}
            className="px-6 py-3 bg-[#D946EF] text-white border-2 border-black font-bold uppercase"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // Helper function to check if project was sent back from CEO after CMO approval
  const wasProjectSentBackFromCEO = async (projectId: string | undefined) => {
    if (!projectId) return false;

    try {
      const { data: historyData, error: historyError } = await supabase
        .from('workflow_history')
        .select('actor_id, action, from_stage, to_stage, timestamp')
        .eq('project_id', projectId)
        .order('timestamp', { ascending: false });

      if (historyError || !historyData) {
        console.error('Error fetching workflow history:', historyError);
        return false;
      }

      // Check if the project was sent back for rework by a CEO
      // Find if there was a REWORK or REJECT action by a CEO
      const ceoReworkHistory = historyData.find(history =>
        (history.action === 'REWORK' || history.action === 'REJECTED')
      );

      if (ceoReworkHistory) {
        // Check if the actor was a CEO by fetching their role
        try {
          const { data: userData, error } = await supabase
            .from('users')
            .select('role')
            .eq('id', ceoReworkHistory.actor_id)
            .single();

          if (!error && userData && userData.role === 'CEO') {
            return true;
          }
        } catch (err) {
          console.error('Error checking user role:', err);
        }
      }

      return false;
    } catch (error) {
      console.error('Error checking if project was sent back from CEO:', error);
      return false;
    }
  };


  const handleSaveDraft = async () => {
    if (!publicUser?.id) {
      alert('User profile not loaded. Please refresh and try again.');
      return;
    }
    const actualBrand = formData.brand === 'OTHER' ? formData.brand_other : formData.brand;
    const selectedBrandDoc = dynamicBrands.find(b => b.brand_name === actualBrand);
    const isPaBrand = selectedBrandDoc ? !!selectedBrandDoc.created_by_user_id : false;
    
    console.log('🚀 Starting save draft process', { isPaBrand });
    if (project) {
      console.log('Updating existing project data...');
      try {
        await db.updateProjectData(project.id, {
          ...formData,
          brand: formData.brand, // UI state
          brand_other: formData.brand_other,
          is_pa_brand: isPaBrand,
          writer_id: publicUser.id,
          writer_name: currentUser?.full_name
        });
        console.log('✅ Project data updated successfully');
      } catch (error: any) {
        console.error('Failed to update project data:', error);
        // Don't show alert during auto-save on logout
        if (!window.location.href.includes('logout')) {
          alert(`Failed to update project: ${error.message || 'Unknown error occurred'}`);
        }
      }
    } else {
      try {
        console.log('Creating new project...');

        // Validate required fields for new projects
        if (!newProjectDetails.title.trim()) {
          throw new Error('Title is required. Please enter a title for your script.');
        }

        if (!newProjectDetails.channel) {
          throw new Error('Channel is required. Please select a channel for your script.');
        }

        if (!newProjectDetails.contentType) {
          throw new Error('Content type is required. Please select a content type for your script.');
        }

        // Validate niche field
        if (!formData.niche) {
          throw new Error('Niche is required. Please select a niche for your script.');
        }

        if (formData.niche === 'OTHER' && (!formData.niche_other || !formData.niche_other.trim())) {
          throw new Error('Please specify the niche when "Other" is selected.');
        }

        // Validate thumbnail requirement for video content
        if (newProjectDetails.contentType === 'VIDEO' && formData.thumbnail_required === undefined) {
          throw new Error('Thumbnail requirement must be specified for video content. Please select Yes or No.');
        }

        const createdProject = await db.createProject(
          newProjectDetails.title,
          newProjectDetails.channel,
          newProjectDetails.dueDate,
          newProjectDetails.contentType,
          newProjectDetails.priority
        );
        console.log('Created project with ID:', createdProject.id);
        await db.updateProjectData(createdProject.id, {
          ...formData,
          brand: formData.brand, // UI state
          brand_other: formData.brand_other,
          is_pa_brand: isPaBrand,
          writer_id: publicUser.id,
          writer_name: currentUser?.full_name
        });
        console.log('✅ Project data saved successfully');
      } catch (error: any) {
        console.error('Failed to create project:', error);
        // Don't show alert during auto-save on logout
        if (!window.location.href.includes('logout')) {
          alert(`Failed to save draft: ${error.message || 'Unknown error occurred'}`);
        }
      }
    }
    console.log('✅ Save draft completed');
    onSuccess('draft_saved'); // This will trigger a refresh in the parent component
  };



  // Main submit function that handles all workflow scenarios
  const handleSubmitForReview = async () => {
    if (!publicUser?.id) {
      alert('User profile not loaded. Please refresh and try again.');
      return;
    }
    setIsSubmitting(true);
    const actualBrand = formData.brand === 'OTHER' ? formData.brand_other : formData.brand;
    const selectedBrandDoc = dynamicBrands.find(b => b.brand_name === actualBrand);
    const isPaBrand = selectedBrandDoc ? !!selectedBrandDoc.created_by_user_id : false;

    console.log('🚀 Starting submit process', { isPaBrand });

    // Check if project is in rejected state and not in the resubmit flow
    if (project && getWorkflowState(project).isRejected && returnType !== 'reject') {
      setIsSubmitting(false);
      alert('Cannot submit this project. It has been rejected and requires resubmission through the rejection workflow.');
      return;
    }

    try {
      let realProjectId = project?.id;

      // Check if this is a script being created from an approved idea
      if (isFromIdea) {
        console.log('Creating new script project from approved idea');

        // Create a BRAND NEW project in Supabase
        const { data: newScript, error: createError } = await supabase
          .from('projects')
          .insert({
            title: project.title,
            channel: project.channel,
            content_type: project.content_type || 'CREATIVE_ONLY', // Using CREATIVE_ONLY for script projects
            current_stage: WorkflowStage.SCRIPT_REVIEW_L1,
            assigned_to_role: Role.CMO,
            assigned_to_user_id: null, // No specific user assigned yet
            status: TaskStatus.WAITING_APPROVAL,
            due_date: project.due_date || new Date().toISOString().split('T')[0], // Use original due date or today
            created_by_user_id: publicUser.id,
            created_by_name: currentUser.full_name,
            writer_id: publicUser.id,
            writer_name: currentUser.full_name,
            brand: formData.brand === 'OTHER' ? formData.brand_other : formData.brand,
            data: {
              source: 'SCRIPT_FROM_IDEA',
              parent_idea_id: project.id,
              script_content: formData.script_content,
              brand: formData.brand, // Preserve UI selection
              brand_other: formData.brand_other,
              // Copy form data but exclude fields that belong to the original idea project
              ...Object.fromEntries(
                Object.entries(formData).filter(([key]) =>
                  !['first_review_opened_by_role', 'first_review_opened_at'].includes(key)
                )
              ),
              is_pa_brand: isPaBrand
            }
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating new script from idea:', createError);
          throw createError;
        }

        realProjectId = newScript.id;

        // Add workflow history entry for the new script
        await db.workflow.recordAction(
          newScript.id,
          WorkflowStage.SCRIPT_REVIEW_L1,
          publicUser.id,
          currentUser.full_name,
          'SUBMITTED',
          'Script created from CEO-approved idea',
          undefined,
          Role.WRITER, // fromRole
          Role.CMO, // toRole
          currentUser.role as Role // actorRole
        );

        console.log('✅ Successfully created new script project from approved idea:', newScript.id);
      } else {
        // For existing projects (editing), use the existing project ID
        if (!realProjectId) {
          // 1️⃣ CREATE PROJECT FIRST (if new)
          const createdProject = await db.createProject(
            newProjectDetails.title,
            newProjectDetails.channel,
            newProjectDetails.dueDate,
            newProjectDetails.contentType,
            newProjectDetails.priority
          );
          await (db.projects.update as any)(createdProject.id, {
            created_by_user_id: publicUser.id,
            created_by_name: currentUser.full_name,
            assigned_to_user_id: publicUser.id
          });

          // Update project data with writer information and brand details
          await db.updateProjectData(createdProject.id, {
            ...formData,
            brand: formData.brand, // Store 'OTHER' in data.brand for UI
            brand_other: formData.brand_other,
            is_pa_brand: isPaBrand,
            writer_id: publicUser.id,
            writer_name: currentUser.full_name
          });

          if (!createdProject?.id) {
            throw new Error('Project creation failed – no ID returned');
          }

          realProjectId = createdProject.id;
          console.log('✅ Project created with ID:', realProjectId);
        } else {
          // 2️⃣ UPDATE EXISTING PROJECT DATA (for edits)
          const updateData = {
            ...formData,
          };

          if (creatorRole === Role.CMO) {
            // Store CMO information
            updateData.cmo_id = publicUser.id;
            updateData.cmo_name = currentUser?.full_name;
          } else {
            // Default to Writer information
            updateData.writer_id = publicUser.id;
            updateData.writer_name = currentUser?.full_name;
          }

          await db.updateProjectData(realProjectId, {
            ...updateData,
            brand: formData.brand, // Store 'OTHER' in data.brand to preserve UI state
            brand_other: formData.brand_other,
            is_pa_brand: isPaBrand,
            actual_brand: actualBrand // Helper for debugging if needed
          });
          console.log('✅ Existing project data updated');
        }

        // 2️⃣ HARD SAFETY CHECK
        if (!realProjectId) {
          throw new Error('Cannot submit project without valid project ID');
        }

        // Validate project ID format
        if (realProjectId.startsWith('temp_')) {
          throw new Error('Invalid project ID format. Project must be saved to database first.');
        }

        // Validate required fields for new projects
        if (!newProjectDetails.title.trim()) {
          throw new Error('Title is required. Please enter a title for your script.');
        }

        if (!realProjectId) {
          if (!newProjectDetails.channel) {
            throw new Error('Channel is required. Please select a channel for your script.');
          }

          if (!newProjectDetails.contentType) {
            throw new Error('Content type is required. Please select a content type for your script.');
          }

          // Validate thumbnail requirement for video-based content
          const isVideoBased = ['VIDEO', 'APPLYWIZZ_USA_JOBS'].includes(newProjectDetails.contentType) || 
                               ['APPLYWIZZ_JOB_BOARD', 'LEAD_MAGNET_RTW'].includes(formData.brand);
          if (isVideoBased && formData.thumbnail_required === undefined) {
            throw new Error('Thumbnail requirement must be specified for this content type. Please select Yes or No.');
          }
        }

        // Small delay to ensure project is fully created before proceeding
        await new Promise(resolve => setTimeout(resolve, 100));

        // 4️⃣ SUBMIT WORKFLOW
        // Determine workflow based on latest action
        const workflowState = project ? getWorkflowState(project) : { isRejected: false, isRework: false, isInReview: false, isApproved: false, latestAction: null };

        // For script projects created from ideas, don't consider idea rework history as script rework
        // This prevents script projects from being considered in rework due to rework in previous stages (like idea)
        let isScriptInRework = false;
        if (project?.history && project?.data?.source === 'SCRIPT_FROM_IDEA') {
          // For scripts created from ideas, check if there have been rework actions since the script was created
          // Only consider rework actions that happened when the project was in script-related stages
          const scriptReworkActions = project.history.filter(h =>
            h.action === 'REWORK' &&
            (h.from_stage === WorkflowStage.SCRIPT_REVIEW_L1 || h.from_stage === WorkflowStage.SCRIPT_REVIEW_L2)
          );
          isScriptInRework = scriptReworkActions.length > 0 && workflowState.latestAction !== 'APPROVED';
        } else {
          // For other projects, use the standard rework logic
          isScriptInRework = workflowState.isRework;
        }

        // Check if project was sent back from CEO after CMO approval
        const wasSentBackFromCEO = await wasProjectSentBackFromCEO(project?.id);

        // Special handling for idea projects in rework
        const isIdeaInRework = project?.data?.source === 'IDEA_PROJECT' &&
          project.status === TaskStatus.REWORK &&
          workflowState.isRework;

        if (isIdeaInRework) {
          // For idea projects in rework, we need to determine who sent it for rework and route back to them
          try {
            // Fetch workflow history to determine who sent for rework
            const { data: history, error: historyError } = await supabase
              .from('workflow_history')
              .select('actor_id, action, comment, timestamp')
              .eq('project_id', project.id)
              .order('timestamp', { ascending: false });

            if (historyError) {
              console.error('Error fetching workflow history:', historyError);
            }

            const reworkHistory = history?.find(h => h.action === 'REWORK');

            if (reworkHistory) {
              let targetRole, targetStage;

              // Get the actor's role to determine where to send it back
              const { data: userData, error: userError } = await supabase
                .from('users')
                .select('role')
                .eq('id', reworkHistory.actor_id)
                .single();

              if (!userError && userData) {
                // Determine where to send the rework based on who sent it
                if (userData.role === Role.CMO) {
                  targetRole = Role.CMO;
                  // For idea projects, if CMO sent for rework, return to FINAL_REVIEW_CMO stage
                  targetStage = WorkflowStage.FINAL_REVIEW_CMO;
                } else if (userData.role === Role.CEO) {
                  targetRole = Role.CEO;
                  targetStage = WorkflowStage.FINAL_REVIEW_CEO;
                } else {
                  // Default fallback
                  targetRole = Role.CMO;
                  targetStage = WorkflowStage.FINAL_REVIEW_CMO;
                }
              } else {
                // Default fallback if user role cannot be determined
                targetRole = Role.CMO;
                targetStage = WorkflowStage.FINAL_REVIEW_CMO;
              }

              // Update the idea project with the reworked content
              await db.projects.update(realProjectId, {
                current_stage: targetStage,
                assigned_to_role: targetRole,
                status: TaskStatus.WAITING_APPROVAL
              });

              // Add workflow history entry
              await db.workflow.recordAction(
                realProjectId,
                targetStage as WorkflowStage,
                publicUser.id,
                currentUser.full_name,
                'SUBMITTED',
                'Idea resubmitted after rework',
                undefined,
                Role.WRITER, // fromRole
                targetRole as Role, // toRole
                currentUser.role as Role // actorRole
              );

              console.log(`✅ Successfully resubmitted idea rework project back to ${targetRole}`);
            } else {
              // If we can't determine who sent it for rework, use advanceWorkflow
              await db.advanceWorkflow(realProjectId, 'Idea resubmitted after rework');
              console.log('✅ Successfully resubmitted idea rework project via advanceWorkflow');
            }
          } catch (reworkError) {
            console.error('Error determining idea rework routing:', reworkError);
            // Fallback: use advanceWorkflow
            await db.advanceWorkflow(realProjectId, 'Idea resubmitted after rework');
            console.log('✅ Successfully resubmitted idea rework project via advanceWorkflow');
          }
        } else if (isScriptInRework) {
          // Handle script rework - determine who sent it for rework
          const { data: history, error: historyError } = await supabase
            .from('workflow_history')
            .select('actor_id, action, comment, timestamp')
            .eq('project_id', realProjectId)
            .order('timestamp', { ascending: false });

          if (historyError) {
            console.error('Error fetching workflow history:', historyError);
            throw historyError;
          }

          // Find the most recent REWORK action
          const reworkHistory = history?.find(h => h.action === 'REWORK');

          if (reworkHistory) {
            let targetRole: Role;
            let targetStage: WorkflowStage;

            // 🔍 Find who sent this project for rework
            const { data: reviewer, error: reviewerError } = await supabase
              .from('users')
              .select('role')
              .eq('id', reworkHistory.actor_id)
              .single();

            // ✅ Route based on WHO originally sent for rework
            if (reviewer && reviewer.role === Role.CEO) {
              // If CEO sent for rework, go directly back to CEO
              targetRole = Role.CEO;
              targetStage = WorkflowStage.SCRIPT_REVIEW_L2;
            } else {
              // If CMO or others sent for rework, go back to CMO
              targetRole = Role.CMO;
              targetStage = WorkflowStage.SCRIPT_REVIEW_L1;
            }

            await db.projects.update(realProjectId, {
              current_stage: targetStage,
              assigned_to_role: targetRole,
              status: TaskStatus.WAITING_APPROVAL
            });

            await db.workflow.recordAction(
              realProjectId,
              targetStage as WorkflowStage,
              publicUser.id,
              currentUser.full_name,
              'SUBMITTED',
              'Resubmitted after rework',
              undefined,
              Role.WRITER, // fromRole
              targetRole as Role, // toRole
              currentUser.role as Role // actorRole
            );

            console.log(`✅ Rework resubmitted back to ${targetRole}`);
          } else {
            await db.advanceWorkflow(realProjectId, 'Resubmitted after rework');
            console.log('⚠️ Rework history missing → used advanceWorkflow');
          }
        } else {
          // ✅ IMPORTANT: Decide routing based on ACTUAL REVIEW, not creator role
          const cmoHasOpened =
            project?.first_review_opened_by_role === Role.CMO &&
            project?.first_review_opened_at;

          /* -----------------------------------
             SCRIPT FROM CEO-APPROVED IDEA
             ----------------------------------- */
          if (mode === 'SCRIPT_FROM_APPROVED_IDEA') {
            await db.projects.update(realProjectId, {
              current_stage: WorkflowStage.SCRIPT_REVIEW_L1,
              assigned_to_role: Role.CMO,
              status: TaskStatus.WAITING_APPROVAL
            });

            const currentData =
              typeof project?.data === 'string'
                ? JSON.parse(project.data)
                : project?.data || {};

            delete currentData.source; // remove IDEA_PROJECT flag

            await db.updateProjectData(realProjectId, currentData);

            await db.workflow.recordAction(
              realProjectId,
              WorkflowStage.SCRIPT_REVIEW_L1,
              publicUser.id,
              currentUser.full_name,
              'SUBMITTED',
              'Script created from CEO-approved idea',
              undefined,
              Role.WRITER, // fromRole
              Role.CMO, // toRole
              currentUser.role as Role // actorRole
            );

            console.log('✅ Script from idea sent to CMO');
          }

          /* -----------------------------------
             DEFAULT → FOLLOW PROPER WORKFLOW (Writer → CMO → CEO)
             ----------------------------------- */
          else {
            // Follow standard workflow: Writer → CMO → CEO
            const targetRole = Role.CMO;
            const targetStage = WorkflowStage.SCRIPT_REVIEW_L1;

            await db.projects.update(realProjectId, {
              current_stage: targetStage,
              assigned_to_role: targetRole,
              status: TaskStatus.WAITING_APPROVAL
            });

            await db.workflow.recordAction(
              realProjectId,
              targetStage,
              publicUser.id,
              currentUser.full_name,
              'SUBMITTED',
              'Script submitted for CMO review',
              undefined,
              Role.WRITER, // fromRole
              targetRole, // toRole
              Role.WRITER // actorRole
            );

            console.log(`✅ Script submitted for review -> sent to ${targetRole}`);
          }
        }

        /* =========================
           DETERMINE REWORK REVIEWER IF NEEDED
           ========================= */

        // For rework cases, we need to determine who originally sent for rework
        let reworkReviewer: string | null = null;
        if (workflowState?.isRework) {
          const { data: fullHistory, error: historyError } = await supabase
            .from('workflow_history')
            .select('actor_id, action, comment, timestamp')
            .eq('project_id', realProjectId)
            .order('timestamp', { ascending: false });

          if (fullHistory && fullHistory.length > 0) {
            const originalReworkHistory = fullHistory
              .filter(h => h.action === 'REWORK')
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

            if (originalReworkHistory) {
              const { data: reviewerData, error: reviewerError } = await supabase
                .from('users')
                .select('role')
                .eq('id', originalReworkHistory.actor_id)
                .single();

              if (reviewerData && reviewerData.role === Role.CEO) {
                reworkReviewer = 'CEO';
              } else {
                reworkReviewer = 'CMO';
              }
            }
          }
        }

        /* =========================
           POPUP MESSAGE LOGIC
           ========================= */

        let nextStageLabel: string;
        let message: string;

        const latestProject = await db.getProjectById(realProjectId);

        if (mode === 'SCRIPT_FROM_APPROVED_IDEA') {
          nextStageLabel = STAGE_LABELS[WorkflowStage.SCRIPT_REVIEW_L1];
          message = 'Script created from approved idea and sent to CMO for review.';
        }
        else if (workflowState?.isRework) {
          nextStageLabel = STAGE_LABELS[latestProject.current_stage];

          const reviewer = reworkReviewer === 'CEO' ? 'CEO' : 'CMO';

          message = `Script resubmitted after rework. Waiting for ${reviewer} review.`;
        }
        else if (latestProject.current_stage === WorkflowStage.SCRIPT_REVIEW_L2) {
          nextStageLabel = STAGE_LABELS[WorkflowStage.SCRIPT_REVIEW_L2];
          message = `Script submitted successfully. Waiting for CEO review.`;
        }
        else {
          // Now following proper workflow: Writer → CMO → CEO
          nextStageLabel = STAGE_LABELS[WorkflowStage.SCRIPT_REVIEW_L1];
          message = `Script submitted successfully. Waiting for CMO review.`;
        }


        setStageName(nextStageLabel);
        setPopupMessage(message);
        console.log('Showing popup with message:', message);
        console.log('Stage name:', nextStageLabel);
        setShowPopup(true);
        console.log('Popup should be visible now');

        // Call onSuccess after a delay to ensure popup is visible
        setTimeout(() => {
          onSuccess(); // refresh dashboard
        }, 3000); // Increased to 3 seconds to ensure popup is visible
      }
    } catch (err: any) {
      console.error('❌ Submit failed:', err);
      // Log more detailed error information
      if (err.message) {
        console.error('Error message:', err.message);
      }
      if (err.details) {
        console.error('Error details:', err.details);
      }
      if (err.hint) {
        console.error('Error hint:', err.hint);
      }

      const errorMessage = creatorRole === Role.CMO ? 'Failed to submit to CEO' : 'Failed to submit to CMO';
      alert(err.message || errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };





  // ── Validation helpers (computed before JSX) ──────────────────────────────
  const _isInstagramVideo = newProjectDetails.channel === Channel.INSTAGRAM && newProjectDetails.contentType === 'VIDEO';
  const _nicheRequired = (_isInstagramVideo && formData.brand === 'APPLYWIZZ') || newProjectDetails.channel !== Channel.INSTAGRAM;
  const _nicheInvalid = _nicheRequired && (!formData.niche || (formData.niche === 'OTHER' && (!formData.niche_other || !formData.niche_other.trim())));
  const _draftDisabled = (
    !canEdit ||
    !newProjectDetails.title.trim() ||
    !newProjectDetails.channel ||
    !newProjectDetails.contentType ||
    (_isInstagramVideo && !formData.brand) ||
    _nicheInvalid ||
    (newProjectDetails.contentType === 'VIDEO' && formData.thumbnail_required === undefined) ||
    (['APPLYWIZZ_JOB_BOARD', 'LEAD_MAGNET_RTW'].includes(formData.brand) && formData.thumbnail_required === undefined)
  );
  const _submitDisabled = (
    !canEdit ||
    isSubmitting ||
    !!validationError ||
    !newProjectDetails.title.trim() ||
    (!isRework && (
      !newProjectDetails.channel ||
      !newProjectDetails.contentType ||
      (_isInstagramVideo && !formData.brand) ||
      _nicheInvalid ||
      (newProjectDetails.contentType === 'VIDEO' && formData.thumbnail_required === undefined) ||
      (['APPLYWIZZ_JOB_BOARD', 'LEAD_MAGNET_RTW'].includes(formData.brand) && formData.thumbnail_required === undefined)
    )) ||
    (!!project && getWorkflowState(project).isRejected && returnType !== 'reject')
  );
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col animate-fade-in-up font-sans">
      {/* Header */}
      <header className="min-h-[4.5rem] md:h-20 border-b-2 border-black flex items-center justify-between px-3 md:px-6 bg-white shadow-sm gap-2">
        <div className="flex items-center space-x-2 md:space-x-6 overflow-hidden">
          <button
            onClick={() => {
              console.log('⬅ Back clicked');
              // Reset popup states when going back to prevent any lingering popup
              setShowPopup(false);
              setShowConfirmation(false);
              onClose();
            }} className="p-2 md:p-3 border-2 border-transparent hover:border-black hover:bg-slate-100 rounded-full transition-all flex-shrink-0">
            <ArrowLeft className="w-5 h-5 md:w-6 md:h-6 text-black" />
          </button>
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base md:text-2xl font-black text-slate-900 uppercase tracking-tight truncate">
                {isScriptFromApprovedIdea
                  ? 'New Script'
                  : project
                    ? `Edit: ${project.title}`
                    : 'New Script'}
              </h1>
              {isFromIdea && (
                <span className="hidden sm:inline-block bg-green-100 text-green-800 px-2 py-1 border-2 border-green-300 text-[10px] font-black uppercase whitespace-nowrap">
                  Approved Idea
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2 md:space-x-4 flex-shrink-0">
          <button
            onClick={handleSaveDraft}
            disabled={_draftDisabled}
            className={`px-3 md:px-6 py-2 md:py-3 border-2 border-black text-black font-black uppercase text-xs md:text-sm hover:bg-slate-100 transition-colors flex items-center shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)] md:shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] active:translate-y-[1px] active:shadow-none ${_draftDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Save className="w-4 h-4 md:mr-2" />
            <span className="hidden sm:inline">Draft</span>
          </button>
          <button
            onClick={() => setShowConfirmation(true)}
            disabled={_submitDisabled}
            className={`px-3 md:px-6 py-2 md:py-3 border-2 border-black font-black uppercase text-xs md:text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] md:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center ${_submitDisabled ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-[#0085FF] text-white'}`}
          >
            <span className="inline">
              {isSubmitting ? '...' : (
                <>
                  <span className="hidden lg:inline">
                    {project && getWorkflowState(project).isRework ? 'Submit for Review' : project && getWorkflowState(project).isRejected ? (returnType === 'reject' ? 'Resubmit for Review' : 'Cannot Submit (Rejected)') : creatorRole === Role.CMO ? 'Submit to CEO' : 'Submit to CMO'}
                  </span>
                  <span className="lg:hidden">
                    {project && getWorkflowState(project).isRework ? 'Submit' : 'Review'}
                  </span>
                </>
              )}
            </span>
            <Send className="w-4 h-4 ml-1 md:ml-2" />
          </button>
        </div>
      </header>


      <div className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-10">
        <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">

          {/* ================= LEFT COLUMN ================= */}
          <div className="lg:col-span-1 space-y-4 md:space-y-6">

            {/* Project Info */}
            {!isPureIdeaEdit && (
              <div className="bg-white p-5 md:p-8 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-4 md:space-y-6">
                <h3 className="font-black uppercase text-base md:text-lg text-slate-900">
                  Project Info
                </h3>

                {/* Title */}
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={newProjectDetails.title}
                    onChange={e =>
                      canEdit ? setNewProjectDetails({ ...newProjectDetails, title: e.target.value }) : null
                    }
                    readOnly={!canEdit}
                    className="w-full p-4 border-2 border-black font-bold focus:bg-yellow-50 focus:outline-none"
                    placeholder="e.g. Q4 Updates"
                  />
                </div>



                {/* Channel */}
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-2">
                    Channel *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.values(Channel)
                      .filter(c => c !== Channel.JOBBOARD && c !== Channel.LEAD_MAGNET)
                      .map(c => {
                        const colors: Record<string, string> = {
                          LINKEDIN: 'bg-[#0A66C2] border-[#0A66C2]',
                          YOUTUBE: 'bg-[#FF0000] border-[#FF0000]',
                          INSTAGRAM: 'bg-gradient-to-tr from-[#405DE6] via-[#E1306C] to-[#FFDC80] border-[#E1306C]'
                        };
                        return (
                          <button
                            key={c}
                            onClick={() => {
                              if (!canEdit) return;
                              // Reset content type, brand, niche when channel changes
                              setNewProjectDetails({ ...newProjectDetails, channel: c, contentType: '' });
                              setFormData(prev => ({ ...prev, brand: undefined, niche: undefined, niche_other: undefined }));
                            }}
                            disabled={!canEdit}
                            className={`p-2 text-[10px] font-black uppercase border-2 transition-all ${newProjectDetails.channel === c
                              ? `${colors[c] || 'bg-black border-black'} text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)]`
                              : 'bg-white border-black hover:bg-slate-50'
                              } ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {c}
                          </button>
                        );
                      })}
                  </div>
                </div>


                {/* Content Type Selection */}
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-2">
                    Content Type *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {/* Video - always shown */}
                    <button
                      onClick={() => {
                        if (!canEdit) return;
                        setNewProjectDetails({ ...newProjectDetails, contentType: 'VIDEO' });
                        // Don't reset brand/niche if already on video
                      }}
                      disabled={!canEdit}
                      className={`p-3 text-xs font-black uppercase border-2 border-black ${newProjectDetails.contentType === 'VIDEO'
                        ? 'bg-[#0085FF] text-white'
                        : 'bg-white hover:bg-slate-50'
                        } ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      📹 Video
                    </button>
                    {/* Creative - always shown */}
                    <button
                      onClick={() => {
                        if (!canEdit) return;
                        setNewProjectDetails({ ...newProjectDetails, contentType: 'CREATIVE_ONLY' });
                        // Reset brand and niche when switching away from Video
                        setFormData(prev => ({ ...prev, brand: undefined, niche: undefined, niche_other: undefined }));
                      }}
                      disabled={!canEdit}
                      className={`p-3 text-xs font-black uppercase border-2 border-black ${newProjectDetails.contentType === 'CREATIVE_ONLY'
                        ? 'bg-[#D946EF] text-white'
                        : 'bg-white hover:bg-slate-50'
                        } ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      🎨 Creative
                    </button>
                  </div>
                </div>

                {/* Brand Selection - shown whenever Video is selected */}
                {newProjectDetails.contentType === 'VIDEO' && (
                  <div className="space-y-6">
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-2">
                        Brands *
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {([
                          { value: 'SHYAMS_PERSONAL_BRANDING', label: '🤵 Shyam Personal Brand', color: 'bg-[#F97316]' },
                          { value: 'APPLYWIZZ', label: '🚀 ApplyWizz', color: 'bg-[#0085FF]' },
                          { value: 'APPLYWIZZ_JOB_BOARD', label: '💼 ApplyWizz Job Board', color: 'bg-[#00A36C]' },
                          { value: 'LEAD_MAGNET_RTW', label: '🧲 Lead Magnet (RTW lead magnet)', color: 'bg-[#6366F1]' },
                          { value: 'APPLYWIZZ_USA_JOBS', label: '🇺🇸 ApplyWizz USA Jobs', color: 'bg-[#8B5CF6]' },
                          { value: 'CAREER_IDENTIFIER', label: '🎯 Career Identifier', color: 'bg-[#0EA5E9]' },
                          ...dynamicBrands
                            .filter(b => {
                              const normalizedName = (b.brand_name || '').trim().toUpperCase().replace(/[\s_]/g, '');
                              const systemBrands = [
                                'SHYAMS_PERSONAL_BRANDING', 
                                'APPLYWIZZ', 
                                'APPLYWIZZ_JOB_BOARD', 
                                'LEAD_MAGNET_RTW', 
                                'APPLYWIZZ_USA_JOBS', 
                                'CAREER_IDENTIFIER'
                              ].map(s => s.replace(/[\s_]/g, '').toUpperCase());
                              return !systemBrands.includes(normalizedName);
                            })
                            .map(b => ({
                              value: b.brand_name,
                              label: `🏢 ${b.brand_name}`,
                              color: 'bg-[#10B981]',
                              isDynamic: true
                            }))
                        ]).map(brand => (
                          <button
                            key={brand.value}
                            onClick={() => {
                              if (!canEdit) return;
                              setFormData(prev => ({ ...prev, brand: brand.value, niche: undefined, niche_other: undefined }));
                            }}
                            disabled={!canEdit}
                            className={`px-4 py-3 text-xs font-black uppercase border-2 border-black transition-all ${
                              formData.brand === brand.value
                                ? `${brand.color} text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:opacity-90`
                                : `bg-white hover:border-[#10B981] hover:text-[#10B981] hover:bg-emerald-50`
                            } ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {brand.label}
                          </button>
                        ))}
                      </div>


                    </div>



                    {/* Influencer and Referral fields - only for Job Board or Lead Magnet */}
                    {(formData.brand === 'APPLYWIZZ_JOB_BOARD' || formData.brand === 'LEAD_MAGNET_RTW') && (
                      <div className="space-y-4 pt-4 border-t-2 border-dashed border-slate-200">
                        <div>
                          <label className="block text-xs font-bold uppercase text-slate-500 mb-2">
                            Influencer Name
                          </label>
                          <input
                            type="text"
                            value={formData.influencer_name || ''}
                            onChange={e =>
                              canEdit ? setFormData({ ...formData, influencer_name: e.target.value }) : null
                            }
                            readOnly={!canEdit}
                            className="w-full p-4 border-2 border-black font-medium focus:bg-yellow-50 focus:outline-none"
                            placeholder="Enter influencer name"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold uppercase text-slate-500 mb-2">
                            Referral Link
                          </label>
                          <input
                            type="url"
                            value={formData.referral_link || ''}
                            onChange={e =>
                              canEdit ? setFormData({ ...formData, referral_link: e.target.value }) : null
                            }
                            readOnly={!canEdit}
                            className="w-full p-4 border-2 border-black font-medium focus:bg-yellow-50 focus:outline-none"
                            placeholder="Enter referral link"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Niche Selection - Only for ApplyWizz corporate content */}
                {formData.brand === 'APPLYWIZZ' && (
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-2">
                    Niche *
                  </label>
                  <select
                    value={formData.niche || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value) {
                        setFormData({
                          ...formData,
                          niche: value as any,
                          niche_other: value === 'OTHER' ? (formData.niche_other || '') : undefined
                        });
                      } else {
                        setFormData({
                          ...formData,
                          niche: undefined,
                          niche_other: undefined
                        });
                      }
                    }}
                    className="w-full p-3 border-2 border-black font-medium focus:bg-yellow-50 focus:outline-none"
                    disabled={!canEdit}
                  >
                    <option value="">Select a niche...</option>
                    <option value="PROBLEM_SOLVING">Problem Solving</option>
                    <option value="SOCIAL_PROOF">Social Proof</option>
                    <option value="LEAD_MAGNET">Lead Magnet</option>
                    <option value="CAPTION_BASED">Caption-Based</option>
                    <option value="OTHER">Other</option>
                  </select>

                  {/* Show input field when 'Other' is selected */}
                  {formData.niche === 'OTHER' && (
                    <div className="mt-3">
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-2">
                        Specify Other Niche
                      </label>
                      <input
                        type="text"
                        value={formData.niche_other || ''}
                        onChange={e =>
                          canEdit ? setFormData({ ...formData, niche_other: e.target.value }) : null
                        }
                        readOnly={!canEdit}
                        className="w-full p-3 border-2 border-black font-medium focus:bg-yellow-50 focus:outline-none"
                        placeholder="Enter the niche..."
                        required
                      />
                    </div>
                  )}
                </div>
                )}

                {/* Thumbnail Required - Only for Video-based content */}
                {newProjectDetails.contentType === 'VIDEO' && (
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-2">
                      Thumbnail Required *
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => canEdit && setFormData({ ...formData, thumbnail_required: true })}
                        disabled={!canEdit}
                        className={[
                          'p-3 text-xs font-black uppercase border-2 border-black',
                          formData.thumbnail_required === true
                            ? 'bg-black text-white'
                            : 'bg-white hover:bg-slate-50',
                          !canEdit && 'opacity-50 cursor-not-allowed',
                        ].filter(Boolean).join(' ')}
                      >
                        Yes
                      </button>

                      <button
                        onClick={() => canEdit ? setFormData({ ...formData, thumbnail_required: false }) : null}
                        disabled={!canEdit}
                        className={`p-3 text-xs font-black uppercase border-2 border-black ${formData.thumbnail_required === false
                          ? 'bg-black text-white'
                          : 'bg-white hover:bg-slate-50'
                          } ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        No
                      </button>
                    </div>

                    {/* Thumbnail Options - Only when Yes is selected */}
                    {formData.thumbnail_required === true && (
                      <div className="mt-4 space-y-4">
                        <div>
                          <label className="block text-xs font-bold uppercase text-slate-500 mb-2">
                            Reference Thumbnail (Optional)
                          </label>
                          <div className="flex items-center space-x-4">
                            <input
                              type="text"
                              value={formData.thumbnail_reference_link || ''}
                              onChange={e => canEdit ? setFormData({ ...formData, thumbnail_reference_link: e.target.value }) : null}
                              readOnly={!canEdit}
                              className="flex-1 p-2 border-2 border-black focus:bg-yellow-50 focus:outline-none"
                              placeholder="Paste thumbnail link here"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold uppercase text-slate-500 mb-2">
                            Thumbnail Concept Notes
                          </label>
                          <textarea
                            value={formData.thumbnail_notes || ''}
                            onChange={e => canEdit ? setFormData({ ...formData, thumbnail_notes: e.target.value }) : null}
                            readOnly={!canEdit}
                            className="w-full p-2 border-2 border-black min-h-[100px] focus:bg-yellow-50 focus:outline-none resize-none"
                            placeholder="Describe your thumbnail concept, colors, composition, text overlay, etc."
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Script Reference Link */}
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-2">
                    Script Reference Link
                  </label>
                  <input
                    type="url"
                    value={formData.script_reference_link || ''}
                    onChange={e =>
                      canEdit ? setFormData({ ...formData, script_reference_link: e.target.value }) : null
                    }
                    readOnly={!canEdit}
                    className="w-full p-3 border-2 border-black font-medium focus:bg-yellow-50 focus:outline-none"
                    placeholder="Enter script reference link (optional)"
                  />
                </div>

                {/* Cinematographer Instructions - Only for Video-based content */}
                {(newProjectDetails.contentType === 'VIDEO' || newProjectDetails.contentType === 'JOBBOARD' || newProjectDetails.contentType === 'LEAD_MAGNET' || newProjectDetails.contentType === 'CAPTION_BASED' || newProjectDetails.contentType === 'APPLYWIZZ_USA_JOBS') && (
                  <div className="bg-white p-5 md:p-8 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-4 md:space-y-6">
                    <h3 className="font-black uppercase text-base md:text-lg text-slate-900">
                      Cinematography Instructions
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] md:text-xs font-bold uppercase text-slate-500 mb-2">
                          Actor
                        </label>
                        <input
                          type="text"
                          value={formData.actor || ''}
                          onChange={e =>
                            canEdit ? setFormData({ ...formData, actor: e.target.value }) : null
                          }
                          readOnly={!canEdit}
                          className="w-full p-3 md:p-4 border-2 border-black font-medium focus:bg-yellow-50 focus:outline-none text-sm"
                          placeholder="Presenter info"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] md:text-xs font-bold uppercase text-slate-500 mb-2">
                          Location
                        </label>
                        <input
                          type="text"
                          value={formData.location || ''}
                          onChange={e =>
                            canEdit ? setFormData({ ...formData, location: e.target.value }) : null
                          }
                          readOnly={!canEdit}
                          className="w-full p-3 md:p-4 border-2 border-black font-medium focus:bg-yellow-50 focus:outline-none text-sm"
                          placeholder="e.g. Office"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] md:text-xs font-bold uppercase text-slate-500 mb-2">
                          Lighting
                        </label>
                        <input
                          type="text"
                          value={formData.lighting || ''}
                          onChange={e =>
                            canEdit ? setFormData({ ...formData, lighting: e.target.value }) : null
                          }
                          readOnly={!canEdit}
                          className="w-full p-3 md:p-4 border-2 border-black font-medium focus:bg-yellow-50 focus:outline-none text-sm"
                          placeholder="e.g. Soft daylight"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] md:text-xs font-bold uppercase text-slate-500 mb-2">
                          Angles
                        </label>
                        <input
                          type="text"
                          value={formData.angles || ''}
                          onChange={e =>
                            canEdit ? setFormData({ ...formData, angles: e.target.value }) : null
                          }
                          readOnly={!canEdit}
                          className="w-full p-3 md:p-4 border-2 border-black font-medium focus:bg-yellow-50 focus:outline-none text-sm"
                          placeholder="e.g. Medium shot"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Priority */}
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-2">
                    Priority
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['LOW', 'NORMAL', 'HIGH'] as const).map(p => {
                      const colors: Record<string, string> = {
                        HIGH: 'bg-[#FF3131] border-[#FF3131]',
                        NORMAL: 'bg-[#FFB800] border-[#FFB800]',
                        LOW: 'bg-[#00D1FF] border-[#00D1FF]'
                      };
                      return (
                        <button
                          key={p}
                          onClick={() =>
                            canEdit ? setNewProjectDetails({ ...newProjectDetails, priority: p }) : null
                          }
                          disabled={!canEdit}
                          className={`p-2 text-xs font-bold uppercase border-2 transition-all ${newProjectDetails.priority === p
                            ? `${colors[p] || 'bg-black border-black'} text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)]`
                            : 'bg-white border-black hover:bg-slate-50'
                            } ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Idea Description (for idea projects) */}
            {isPureIdeaEdit && (
              <div className="bg-white p-8 border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <h3 className="font-black uppercase text-lg text-slate-900 mb-4">
                  {isRework ? 'Updated Idea Description' : 'Idea Description'}
                </h3>
                <textarea
                  value={formData.idea_description || ''}
                  onChange={e => canEdit ? setFormData({ ...formData, idea_description: e.target.value }) : null}
                  readOnly={!canEdit}
                  className="w-full p-4 border-2 border-black min-h-[200px] focus:bg-yellow-50 focus:outline-none resize-none"
                  placeholder={isRework ? "Update the idea description based on the review comments..." : "Describe your idea..."}
                />
              </div>
            )}



            {/* Brief / Notes */}
            <div className="bg-white p-8 border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="font-black uppercase text-lg text-slate-900 mb-4">
                Brief / Notes
              </h3>
              <textarea
                value={formData.brief || ''}
                onChange={e => canEdit ? setFormData({ ...formData, brief: e.target.value }) : null}
                readOnly={!canEdit}
                className="w-full p-4 border-2 border-black min-h-[200px] focus:bg-yellow-50 focus:outline-none resize-none"
                placeholder="What is the goal of this content?"
              />
            </div>


          </div>

          {/* ================= RIGHT COLUMN ================= */}
          <div className="lg:col-span-2 space-y-6">

            {/* ✅ ORIGINAL IDEA DESCRIPTION (RIGHT SIDE) */}
            {project?.data?.source === 'IDEA_PROJECT' && (
              <div className="bg-blue-50 p-8 border-2 border-blue-300 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <h3 className="font-black uppercase text-lg text-blue-800 mb-4">
                  {isRework ? 'Previous Idea Description' : 'Original Idea Description'}
                </h3>

                <div className="bg-white p-4 border-2 border-blue-200 min-h-[120px]">
                  <p className="text-slate-700 whitespace-pre-wrap">
                    {(isRework && previousIdeaDescription) ? previousIdeaDescription : (project.data.idea_description || 'No idea description provided.')}
                  </p>
                </div>

                <p className="text-sm text-blue-600 mt-3 font-medium">
                  {isRework
                    ? 'This idea was sent back for rework. Please update the idea description (left) based on feedback.'
                    : isPureIdeaEdit ? 'Original description reference.' : 'This idea was approved by CEO. Please convert it into a detailed script below.'}
                </p>
              </div>
            )}



            {/* REVIEW COMMENTS (FOR REWORK/REJECTED PROJECTS) */}
            {(returnType === 'rework' || returnType === 'reject') && (
              <div className="bg-red-50 p-6 border-2 border-red-300 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <h3 className="font-black uppercase text-lg text-red-800 mb-4">
                  Review Comments
                </h3>

                <div className="space-y-4">
                  {reviewComment && (
                    <div className="bg-white p-4 border-2 border-red-200">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-slate-700">{reviewComment.actor_name}</span>
                        <span className="text-sm text-slate-500">{new Date(reviewComment.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="text-slate-700 whitespace-pre-wrap">{reviewComment.comment || 'No specific comments provided.'}</p>
                      <div className="mt-2 px-3 py-1 bg-red-100 text-red-800 font-bold text-sm border border-red-300 inline-block">
                        {reviewComment.action}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* PREVIOUS SCRIPT (FOR REWORK/REJECTED PROJECTS) */}
            {(returnType === 'rework' || returnType === 'reject') && previousScript && (
              <div className="bg-yellow-50 p-6 border-2 border-yellow-300 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <h3 className="font-black uppercase text-lg text-yellow-800 mb-4">
                  Previous Script
                </h3>

                <div className="bg-white p-4 border-2 border-yellow-200 min-h-[200px] max-h-60 overflow-y-auto">
                  <div className="text-slate-700 whitespace-pre-wrap font-serif">
                    <div dangerouslySetInnerHTML={{ __html: decodeHtmlEntities(previousScript) }} />
                  </div>
                </div>
              </div>
            )}

            {/* Script Editor - Only show if NOT a pure idea edit */}
            {!isPureIdeaEdit && (
              <div className="bg-white p-4 md:p-8 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] min-h-[500px] md:min-h-[700px] flex flex-col">
                <div className="border-b-2 border-black pb-4 mb-6 flex flex-col sm:flex-row justify-between gap-4">
                  <div className="flex items-center justify-between sm:justify-start sm:space-x-4">
                    <span className="font-black uppercase text-[10px] text-slate-400">
                      Rich Text Editor
                    </span>
                    {canEdit && (
                      <div className="text-[10px] font-black uppercase text-slate-400">
                        {scriptCharCount} / 6000 chars
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {canEdit && (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={applyCorrections}
                          disabled={correctionsRunning}
                          className={`px-3 py-1.5 md:px-4 md:py-2 border-2 border-black font-black uppercase text-[10px] md:text-sm flex items-center transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] md:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-none ${correctionsRunning ? 'bg-slate-200 text-slate-500 border-slate-400 shadow-none' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                          title="Check grammar and spelling"
                        >
                          {correctionsRunning ? 'Wait...' : 'Corrections'}
                          <SpellCheck className="w-3 h-3 md:w-4 md:h-4 ml-1 md:ml-2" />
                        </button>
                        {correctionsEnabled && (
                          <button
                            onClick={clearCorrections}
                            className="px-3 py-1.5 md:px-4 md:py-2 border-2 border-black font-black uppercase text-[10px] md:text-sm bg-white hover:bg-slate-100 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-none"
                            title="Clear corrections"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    )}

                    {/* Color picker toolbar */}
                    {canEdit && (
                      <div className="flex items-center space-x-1 ml-auto sm:ml-0 bg-slate-50 p-1 border border-slate-200 rounded">
                        <button onClick={() => applyColor('red')} className="w-5 h-5 md:w-6 md:h-6 bg-red-800 border border-black rounded-sm" title="Red" />
                        <button onClick={() => applyColor('blue')} className="w-5 h-5 md:w-6 md:h-6 bg-blue-800 border border-black rounded-sm" title="Blue" />
                        <button onClick={() => applyColor('green')} className="w-5 h-5 md:w-6 md:h-6 bg-green-800 border border-black rounded-sm" title="Green" />
                        <button onClick={() => applyBold()} className="w-5 h-5 md:w-6 md:h-6 bg-gray-500 border border-black rounded-sm flex items-center justify-center font-bold text-white text-[10px]" title="Bold">B</button>
                      </div>
                    )}
                  </div>
                </div>

                <div
                  contentEditable={canEdit}
                  suppressContentEditableWarning={true}
                  onInput={(e) => {
                    if (canEdit) {
                      const content = e.currentTarget.innerHTML;
                      if (formData.script_content !== content) {
                        setFormData({ ...formData, script_content: content });
                        if (correctionsEnabled) clearCorrections();
                      }
                    }
                  }}
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.classList.contains('grammar-error')) applyCorrection(target);
                  }}
                  onMouseUp={handleTextSelection}
                  className="flex-1 w-full text-base md:text-lg resize-none outline-none font-serif p-3 md:p-4 border border-slate-200 rounded min-h-[400px] md:min-h-[700px] whitespace-pre-wrap"
                  ref={editorRef}
                  onKeyDown={(e) => {
                    if (e.key === 'Tab' && correctionsEnabled) {
                      const firstError = editorRef.current?.querySelector('.grammar-error') as HTMLElement;
                      if (firstError) {
                        e.preventDefault();
                        applyCorrection(firstError);
                        return;
                      }
                    }
                    handleTextSelection();
                  }}
                  onBlur={() => {
                    if (canEdit && editorRef.current) {
                      const content = editorRef.current.innerHTML;
                      if (formData.script_content !== content) {
                        setFormData({ ...formData, script_content: content });
                      }
                    }
                  }}
                />
              </div>
            )}
          </div>
        </div>
        {/* Confirmation Popup */}
        {showConfirmation && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-8 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-md w-full mx-4">
              <h3 className="text-2xl font-black uppercase mb-4">Confirm Submission</h3>
              <p className="mb-6">Are you sure you want to submit this script?</p>
              <div className="flex space-x-4">
                <button
                  onClick={() => setShowConfirmation(false)}
                  className="flex-1 px-4 py-3 border-2 border-black text-black font-black uppercase hover:bg-slate-100 transition-colors"
                >
                  No
                </button>
                <button
                  onClick={async () => {
                    setShowConfirmation(false);
                    // Small delay to ensure confirmation dialog closes before showing success popup
                    setTimeout(() => {
                      handleSubmitForReview();
                    }, 100);
                  }}
                  className="flex-1 px-4 py-3 bg-[#0085FF] border-2 border-black text-white font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                >
                  Yes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateScript;