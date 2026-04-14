import React from 'react';
import { decodeHtmlEntities } from '../utils/htmlDecoder';

interface ScriptDisplayProps {
    content: string;
    caption?: string;
    className?: string;
    fontSize?: string;
    lineHeight?: string;
    padding?: string;
    showBox?: boolean;
}

const ScriptDisplay: React.FC<ScriptDisplayProps> = ({
    content,
    caption,
    className = '',
    fontSize = '1.125rem', // text-lg to match writer
    lineHeight = '1.8',
    padding = 'p-8',
    showBox = true
}) => {
    if (!content) {
        return <div className="text-slate-400 italic">No script content available</div>;
    }

    const decodedContent = decodeHtmlEntities(content);

    // Enforce standard styling to match the writer's editor
    // We only force bold tags to be bold, and allow paragraph spacing.
    // We do NOT enforce weight on the container, allowing natural inheritance.
    const styles = (
        <style dangerouslySetInnerHTML={{
            __html: `
            .script-content-display b, .script-content-display strong {
                font-weight: bold;
            }
            .script-content-display p {
                margin-bottom: 1.5em;
            }
        `}} />
    );

    const display = (
        <div className="flex flex-col">
            {styles}
            <div
                className={`script-content-display text-slate-900 font-serif ${className}`}
                style={{
                    fontSize,
                    lineHeight,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                    // removed explicit fontWeight: 400 to allow bold tags to work naturally
                }}
                dangerouslySetInnerHTML={{ __html: decodedContent }}
            />
            {caption && (
                <div className={`mt-8 pt-8 border-t-2 border-dashed border-slate-200 ${!showBox ? 'bg-slate-50/50 p-4 -mx-4' : ''}`}>
                    <h4 className="text-xs font-black text-slate-400 uppercase mb-4 tracking-widest">Caption</h4>
                    <div className="text-slate-700 italic font-medium whitespace-pre-wrap leading-relaxed">
                        {caption}
                    </div>
                </div>
            )}
        </div>
    );

    if (!showBox) return display;

    return (
        <div className={`bg-white ${padding} border-2 border-slate-100 shadow-inner overflow-hidden`} >
            {display}
        </div >
    );
};

export default ScriptDisplay;
