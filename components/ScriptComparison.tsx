import React, { useState, useEffect } from 'react';
import { decodeHtmlEntities, stripHtmlTags } from '../utils/htmlDecoder';
import ScriptDisplay from './ScriptDisplay';
import { diff_match_patch as DiffMatchPatch } from 'diff-match-patch';

interface ScriptComparisonProps {
  previousScript: string;
  currentScript: string;
  previousCaption?: string;
  currentCaption?: string;
  previousAuthor?: string;
  currentAuthor?: string;
  previousTimestamp?: string;
  currentTimestamp?: string;
}

const dmp = new DiffMatchPatch();

const highlightAddedContent = (oldText: string, newText: string) => {
  const cleanOldText = stripHtmlTags(oldText || '');
  const cleanNewText = stripHtmlTags(newText || '');

  if (cleanOldText === cleanNewText) {
    return cleanNewText.split('\n').map(line => ({ type: 'unchanged', content: line }));
  }

  // Use diff-match-patch for intelligent diffing
  const diffs = dmp.diff_main(cleanOldText, cleanNewText);
  dmp.diff_cleanupSemantic(diffs);

  const highlightedLines: Array<{ type: string, content: string }> = [];

  // We want to reconstruct the NEW text with highlights
  // A 'change' in our UI is often an addition following a deletion
  diffs.forEach((diff, index) => {
    const [type, text] = diff;

    if (type === 0) { // Unchanged
      text.split('\n').forEach(line => {
        highlightedLines.push({ type: 'unchanged', content: line });
      });
    } else if (type === 1) { // Added
      // Check if this addition was preceded by a deletion (making it a 'change')
      const prevDiff = index > 0 ? diffs[index - 1] : null;
      const isChange = prevDiff && prevDiff[0] === -1;

      text.split('\n').forEach(line => {
        if (line.trim() === '') return;
        highlightedLines.push({ type: isChange ? 'changed' : 'added', content: line });
      });
    }
    // Type -1 (Deleted) is ignored for the CURRENT script view
  });

  // Clean up: join fragments that belong to the same line if necessary
  // (DMP can sometimes split lines awkwardly)
  return highlightedLines.filter(l => l.content.trim() !== '' || l.type === 'unchanged');
};

const ScriptComparison: React.FC<ScriptComparisonProps> = ({
  previousScript,
  currentScript,
  previousCaption,
  currentCaption,
}) => {
  const [highlightedLines, setHighlightedLines] = useState<Array<{ type: string, content: string }>>([]);

  useEffect(() => {
    const highlighted = highlightAddedContent(previousScript || '', currentScript || '');
    setHighlightedLines(highlighted);
  }, [previousScript, currentScript]);

  const renderHighlightedLine = (line: { type: string, content: string }, index: number) => {
    const baseClasses = "py-2 px-4 font-serif text-xl border-l-4";

    if (line.type === 'added') {
      return (
        <div key={`added-${index}`} className={`${baseClasses} bg-green-100 border-green-500 mb-1`}>
          {line.content}
        </div>
      );
    } else if (line.type === 'changed') {
      return (
        <div key={`changed-${index}`} className={`${baseClasses} bg-yellow-100 border-yellow-500 mb-1`}>
          {line.content}
        </div>
      );
    } else {
      return (
        <div key={`unchanged-${index}`} className="py-1 px-4 font-serif text-xl border-l-4 border-transparent">
          {line.content || '\u00A0'}
        </div>
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Side-by-side comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Previous Script */}
        <div className="bg-white border-2 border-red-100 rounded-lg overflow-hidden flex flex-col shadow-sm">
          <div className="bg-red-500 text-white p-3 font-bold uppercase text-xs tracking-wider">
            Previous Script
          </div>
          <div className="font-serif text-xl text-gray-800 leading-normal max-h-[600px] overflow-y-auto flex-1">
            <div className="p-4">
              <ScriptDisplay content={previousScript} caption={previousCaption} showBox={false} />
            </div>
          </div>
        </div>

        {/* Current Script with Highlights */}
        <div className="bg-white border-2 border-green-100 rounded-lg overflow-hidden flex flex-col shadow-sm">
          <div className="bg-green-600 text-white p-3 font-bold uppercase text-xs tracking-wider">
            Current Script (With Highlights)
          </div>
          <div className="font-serif text-gray-800 leading-normal max-h-[600px] overflow-y-auto flex-1">
            <div className="p-4 text-xl">
              <div className="space-y-1">
                {highlightedLines.length > 0 ? (
                  <>
                    {highlightedLines.map((line, index) => renderHighlightedLine(line, index))}
                    {currentCaption && (
                      <div className="mt-8 pt-6 border-t font-sans">
                        <span className="text-[10px] font-black uppercase text-slate-400 block mb-2 tracking-widest">SUBMITTED CAPTION</span>
                        <div className="text-slate-900 font-bold whitespace-pre-wrap">{currentCaption}</div>
                      </div>
                    )}
                  </>
                ) : (
                  <ScriptDisplay content={currentScript} caption={currentCaption} showBox={false} />
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