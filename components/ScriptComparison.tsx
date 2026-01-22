import React, { useState, useEffect } from 'react';

interface ScriptComparisonProps {
  previousScript: string;
  currentScript: string;
  previousAuthor?: string;
  currentAuthor?: string;
  previousTimestamp?: string;
  currentTimestamp?: string;
}

// Utility function to decode HTML entities and clean inline styles
const decodeHtmlEntities = (html: string) => {
  if (!html) return '';
  const txt = document.createElement('textarea');
  txt.innerHTML = html;
  let decoded = txt.value;
  
  // Remove Tailwind CSS inline styles
  decoded = decoded.replace(/style="[^"]*"/g, '');
  
  // Remove empty span and div tags that might remain
  decoded = decoded.replace(/<span\s*>/g, '').replace(/<\/span>/g, '');
  decoded = decoded.replace(/<div\s*>/g, '').replace(/<\/div>/g, '');
  
  return decoded;
};

// Simple diff algorithm for comparing text
const getTextDifferences = (oldText: string, newText: string) => {
  // Decode HTML entities before comparison
  const decodedOldText = decodeHtmlEntities(oldText);
  const decodedNewText = decodeHtmlEntities(newText);
  
  const oldLines = decodedOldText.split('\n');
  const newLines = decodedNewText.split('\n');
  const maxLength = Math.max(oldLines.length, newLines.length);

  const differences = [];

  for (let i = 0; i < maxLength; i++) {
    const oldLine = oldLines[i] || '';
    const newLine = newLines[i] || '';
    
    if (oldLine === newLine) {
      differences.push({ type: 'unchanged', content: newLine, lineNumber: i + 1 });
    } else if (!oldLine) {
      differences.push({ type: 'added', content: newLine, lineNumber: i + 1 });
    } else if (!newLine) {
      differences.push({ type: 'removed', content: oldLine, lineNumber: i + 1 });
    } else {
      // For changed lines, we'll highlight the whole line as changed
      differences.push({ type: 'removed', content: oldLine, lineNumber: i + 1 });
      differences.push({ type: 'added', content: newLine, lineNumber: i + 1 });
    }
  }

  return differences;
};

// Function to highlight added content in current script at word level
const highlightAddedContent = (oldText: string, newText: string) => {
  const decodedOldText = decodeHtmlEntities(oldText);
  const decodedNewText = decodeHtmlEntities(newText);
  
  const oldLines = decodedOldText.split('\n');
  const newLines = decodedNewText.split('\n');
  
  const highlightedLines = [];
  
  // Compare line by line
  for (let i = 0; i < newLines.length; i++) {
    const newLine = newLines[i];
    const oldLine = oldLines[i] || '';
    
    // Clean the line content by removing Tailwind CSS inline styles
    const cleanNewLine = newLine.replace(/style="[^"]*"/g, '').replace(/<[^>]*>/g, match => {
      // Preserve the tag but remove style attributes
      return match.replace(/style="[^"]*"/g, '');
    });
    
    const cleanOldLine = oldLine.replace(/style="[^"]*"/g, '').replace(/<[^>]*>/g, match => {
      return match.replace(/style="[^"]*"/g, '');
    });
    
    if (cleanNewLine === cleanOldLine) {
      // Line unchanged
      highlightedLines.push({ type: 'unchanged', content: cleanNewLine });
    } else if (!oldLine) {
      // Completely new line - highlight entire line
      highlightedLines.push({ type: 'added', content: cleanNewLine });
    } else {
      // Partially changed line - highlight individual words
      const highlightedContent = highlightWordDifferences(cleanOldLine, cleanNewLine);
      highlightedLines.push({ type: 'changed', content: highlightedContent });
    }
  }
  
  return highlightedLines;
};

// Function to highlight word-level differences
const highlightWordDifferences = (oldLine: string, newLine: string) => {
  // Split lines into words (split by spaces and punctuation)
  const oldWords = oldLine.split(/(\s+)/);
  const newWords = newLine.split(/(\s+)/);
  
  let result = '';
  
  // Compare word by word
  const maxLength = Math.max(oldWords.length, newWords.length);
  
  for (let i = 0; i < maxLength; i++) {
    const oldWord = oldWords[i] || '';
    const newWord = newWords[i] || '';
    
    if (oldWord === newWord) {
      // Word unchanged
      result += newWord;
    } else if (!oldWord && newWord.trim() !== '') {
      // New word - wrap in highlight span
      result += `<span style="background-color: #bbf7d0; padding: 0 2px; border-radius: 2px;">${newWord}</span>`;
    } else if (oldWord && !newWord) {
      // Word removed (skip for current script)
      continue;
    } else {
      // Word changed - highlight the new version
      if (newWord.trim() !== '') {
        result += `<span style="background-color: #fef08a; padding: 0 2px; border-radius: 2px;">${newWord}</span>`;
      } else {
        result += newWord;
      }
    }
  }
  
  return result;
};

const ScriptComparison: React.FC<ScriptComparisonProps> = ({
  previousScript,
  currentScript,
  previousAuthor,
  currentAuthor,
  previousTimestamp,
  currentTimestamp
}) => {
  const [highlightedLines, setHighlightedLines] = useState<Array<{type: string, content: string}>>([]);

  useEffect(() => {
    const highlighted = highlightAddedContent(previousScript || '', currentScript || '');
    setHighlightedLines(highlighted);
  }, [previousScript, currentScript]);

  const renderHighlightedLine = (line: {type: string, content: string}, index: number) => {
    const baseClasses = "py-1 px-2 font-serif text-base";
    
    switch (line.type) {
      case 'added':
        return (
          <div 
            key={`added-${index}`} 
            className={`${baseClasses} bg-green-100 border-l-4 border-green-500`}
          >
            <div dangerouslySetInnerHTML={{ __html: line.content }} />
          </div>
        );
      case 'changed':
        return (
          <div 
            key={`changed-${index}`} 
            className={`${baseClasses} bg-yellow-100 border-l-4 border-yellow-500`}
          >
            <div dangerouslySetInnerHTML={{ __html: line.content }} />
          </div>
        );
      default:
        return (
          <div 
            key={`unchanged-${index}`} 
            className={`${baseClasses} bg-white`}
          >
            <div dangerouslySetInnerHTML={{ __html: line.content }} />
          </div>
        );
    }
  };

  const renderLine = (diff: {type: string, content: string, lineNumber: number}) => {
    const baseClasses = "py-1 px-2 font-mono text-sm border-l-4";
    
    switch (diff.type) {
      case 'added':
        return (
          <div 
            key={`${diff.lineNumber}-${diff.type}`} 
            className={`${baseClasses} border-green-500 bg-green-50 text-green-800`}
          >
            <span className="text-gray-400 mr-2">+{diff.lineNumber}</span>
            {diff.content}
          </div>
        );
      case 'removed':
        return (
          <div 
            key={`${diff.lineNumber}-${diff.type}`} 
            className={`${baseClasses} border-red-500 bg-red-50 text-red-800 line-through`}
          >
            <span className="text-gray-400 mr-2">-{diff.lineNumber}</span>
            {diff.content}
          </div>
        );
      default:
        return (
          <div 
            key={`${diff.lineNumber}-${diff.type}`} 
            className={`${baseClasses} border-gray-300 bg-white text-gray-700`}
          >
            <span className="text-gray-400 mr-2"> {diff.lineNumber}</span>
            {diff.content}
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Side-by-side comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Previous Script */}
        <div className="bg-white border-2 border-red-200 rounded-lg overflow-hidden">
          <div className="bg-red-500 text-white p-3 font-bold uppercase text-sm">
            Previous Script
          </div>
          <div className="font-serif text-gray-800 leading-relaxed max-h-96 overflow-y-auto">
            <div className="p-4">
              {(() => {
                if (!previousScript) return 'No previous script available';
                
                const decodedContent = decodeHtmlEntities(previousScript);
                return <div dangerouslySetInnerHTML={{ __html: decodedContent }} />;
              })()}
            </div>
          </div>
        </div>

        {/* Current Script with Highlights */}
        <div className="bg-white border-2 border-green-200 rounded-lg overflow-hidden">
          <div className="bg-green-500 text-white p-3 font-bold uppercase text-sm">
            Current Script
          </div>
          <div className="font-serif text-gray-800 leading-relaxed max-h-96 overflow-y-auto">
            <div className="p-4 text-base">
              {highlightedLines.length > 0 ? (
                <div className="space-y-0">
                  {highlightedLines.map((line, index) => renderHighlightedLine(line, index))}
                </div>
              ) : (
                <div className="text-gray-500 italic">
                  {(() => {
                    if (!currentScript) return 'No script content available';
                    
                    const decodedContent = decodeHtmlEntities(currentScript);
                    return <div dangerouslySetInnerHTML={{ __html: decodedContent }} />;
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScriptComparison;