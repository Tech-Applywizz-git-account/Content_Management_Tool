import React, { useState, useEffect, useRef } from 'react';

interface RichTextEditorProps {
  initialContent: string;
  onSave: (content: string) => void;
  onCancel: () => void;
  canEdit: boolean;
  projectId?: string;
  projectName?: string;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({ 
  initialContent, 
  onSave, 
  onCancel, 
  canEdit 
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState(initialContent);

  // Function to save selection before updating content
  const saveSelection = () => {
    if (!editorRef.current) return null;
    
    const selection = window.getSelection();
    if (!selection?.rangeCount) return null;
    
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
    
    // Update the content state
    const newContent = editorRef.current.innerHTML;
    setContent(newContent);
    
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
    
    // Update the content state
    const newContent = editorRef.current.innerHTML;
    setContent(newContent);
    
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

  // Initialize the contentEditable div with initial content
  useEffect(() => {
    if (editorRef.current) {
      // Only set content if editor is empty
      if (!editorRef.current.innerHTML || editorRef.current.innerHTML === '<br>' || editorRef.current.innerHTML === '<div><br></div>') {
        editorRef.current.innerHTML = initialContent;
      }
    }
  }, [initialContent]);

  return (
    <div className="bg-white p-6 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] min-h-[700px] flex flex-col">
      <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-center">
        <span className="font-black uppercase text-xs text-slate-400">
          Rich Text Editor
        </span>
        {/* Color picker toolbar - appears when text is selected */}
        {canEdit && (
          <div className="flex space-x-2">
            <button 
              onClick={() => applyColor('red')}
              className="w-6 h-6 bg-red-800 border border-black rounded-sm"
              title="Red"
              disabled={!canEdit}
            />
            <button 
              onClick={() => applyColor('blue')}
              className="w-6 h-6 bg-blue-800 border border-black rounded-sm"
              title="Blue"
              disabled={!canEdit}
            />
            <button 
              onClick={() => applyColor('green')}
              className="w-6 h-6 bg-green-800 border border-black rounded-sm"
              title="Green"
              disabled={!canEdit}
            />
            <button 
              onClick={() => applyColor('purple')}
              className="w-6 h-6 bg-purple-800 border border-black rounded-sm"
              title="Purple"
              disabled={!canEdit}
            />
            <button 
              onClick={() => applyColor('orange')}
              className="w-6 h-6 bg-orange-700 border border-black rounded-sm"
              title="Orange"
              disabled={!canEdit}
            />
            <button 
              onClick={() => applyColor('black')}
              className="w-6 h-6 bg-black border border-black rounded-sm"
              title="Black"
              disabled={!canEdit}
            />
            <button
              onClick={applyBold}
              className="w-6 h-6 bg-gray-500 border border-black rounded-sm flex items-center justify-center font-bold text-white"
              title="Bold"
              disabled={!canEdit}
            >
              B
            </button>
          </div>
        )}
      </div>

      <div
        contentEditable={canEdit}
        suppressContentEditableWarning={true}
        onInput={(e) => {
          if (canEdit) {
            const newContent = e.currentTarget.innerHTML;
            setContent(newContent);
          }
        }}
        onMouseUp={handleTextSelection}
        onKeyDown={handleTextSelection}
        onBlur={() => {
          // Ensure content is synced when editor loses focus
          if (canEdit && editorRef.current) {
            const newContent = editorRef.current.innerHTML;
            setContent(newContent);
          }
        }}
        className="flex-1 w-full text-lg resize-none outline-none font-serif p-4 border border-gray-300 rounded min-h-[600px]"
        ref={editorRef}
      />

      {/* Action Buttons */}
      <div className="flex gap-2 justify-end mt-4 pt-4 border-t-2 border-gray-200">
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-500 text-white font-bold uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(content)}
          className="px-4 py-2 bg-[#0085FF] text-white font-bold uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
        >
          Save Script
        </button>
      </div>
    </div>
  );
};

export default RichTextEditor;