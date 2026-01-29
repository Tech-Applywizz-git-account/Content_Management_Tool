import React, { useState, useEffect } from 'react';
import { decodeHtmlEntities, stripHtmlTags } from '../utils/htmlDecoder';
import ScriptDisplay from './ScriptDisplay';

interface ScriptComparisonProps {
  previousScript: string;
  currentScript: string;
  previousAuthor?: string;
  currentAuthor?: string;
  previousTimestamp?: string;
  currentTimestamp?: string;
}


// Simple diff algorithm for comparing text
const getTextDifferences = (oldText: string, newText: string) => {
  // Strip all HTML tags from both scripts for a clean text comparison
  const cleanOldText = stripHtmlTags(oldText);
  const cleanNewText = stripHtmlTags(newText);

  const oldLines = cleanOldText.split('\n');
  const newLines = cleanNewText.split('\n');
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
  const cleanOldText = stripHtmlTags(oldText);
  const cleanNewText = stripHtmlTags(newText);

  const oldLines = cleanOldText.split('\n');
  const newLines = cleanNewText.split('\n');

  const highlightedLines = [];

  // Compare line by line
  for (let i = 0; i < newLines.length; i++) {
    const newLine = newLines[i];
    const oldLine = oldLines[i] || '';

    // For clear comparison, we use the already stripped lines
    const cleanNewLine = newLine;
    const cleanOldLine = oldLine;

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
  const [highlightedLines, setHighlightedLines] = useState<Array<{ type: string, content: string }>>([]);

  useEffect(() => {
    // We still keep the highlight logic for comparison, but it works on stripped text
    const highlighted = highlightAddedContent(previousScript || '', currentScript || '');
    setHighlightedLines(highlighted);
  }, [previousScript, currentScript]);

  const renderHighlightedLine = (line: { type: string, content: string }, index: number) => {
    const baseClasses = "py-1 px-2 font-serif text-xl";

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

  return (
    <div className="space-y-6">
      {/* Side-by-side comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Previous Script */}
        <div className="bg-white border-2 border-red-200 rounded-lg overflow-hidden flex flex-col">
          <div className="bg-red-500 text-white p-3 font-bold uppercase text-sm">
            Previous Script
          </div>
          <div className="font-serif text-xl text-gray-800 leading-normal max-h-[600px] overflow-y-auto flex-1">
            <div className="p-4">
              <ScriptDisplay content={previousScript} showBox={false} />
            </div>
          </div>
        </div>

        {/* Current Script with Highlights or Formatting */}
        <div className="bg-white border-2 border-green-200 rounded-lg overflow-hidden flex flex-col">
          <div className="bg-green-500 text-white p-3 font-bold uppercase text-sm">
            Current Script
          </div>
          <div className="font-serif text-gray-800 leading-normal max-h-[600px] overflow-y-auto flex-1">
            <div className="p-4 text-xl">
              <div className="space-y-0">
                {highlightedLines.length > 0 ? (
                  highlightedLines.map((line, index) => renderHighlightedLine(line, index))
                ) : (
                  <ScriptDisplay content={currentScript} showBox={false} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScriptComparison;