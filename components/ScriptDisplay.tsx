import React from 'react';
import { decodeHtmlEntities } from '../utils/htmlDecoder';

interface ScriptDisplayProps {
    content: string;
    className?: string;
    fontSize?: string;
    lineHeight?: string;
    padding?: string;
    showBox?: boolean;
}

const ScriptDisplay: React.FC<ScriptDisplayProps> = ({
    content,
    className = '',
    fontSize = '1.25rem',
    lineHeight = '1.8',
    padding = 'p-8',
    showBox = true
}) => {
    if (!content) {
        return <div className="text-slate-400 italic">No script content available</div>;
    }

    const decodedContent = decodeHtmlEntities(content);

    const styles = (
        <style dangerouslySetInnerHTML={{
            __html: `
            .script-content-display p {
                margin-bottom: 1.5em;
            }
            .script-content-display b, .script-content-display strong {
                font-weight: 900;
            }
            .script-content-display span[style*="color"] {
                font-weight: 700;
            }
            .script-content-display span[style*="font-weight"] {
                font-weight: 900;
            }
        `}} />
    );

    const display = (
        <>
            {styles}
            <div
                className={`script-content-display text-slate-900 font-serif ${className}`}
                style={{
                    fontSize,
                    lineHeight,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                }}
                dangerouslySetInnerHTML={{ __html: decodedContent }}
            />
        </>
    );

    if (!showBox) return display;

    return (
        <div className={`bg-white ${padding} border-2 border-slate-100 shadow-inner overflow-hidden`}>
            {display}
        </div>
    );
};

export default ScriptDisplay;
