/**
 * Utility function to recursively decode HTML entities
 * This handles cases where content has been double-encoded or multiple times encoded
 * 
 * @param str - The string containing HTML entities to decode
 * @returns The fully decoded string
 */
export const decodeHtmlEntities = (str: string): string => {
    if (!str) return str;

    const textarea = document.createElement('textarea');
    textarea.innerHTML = str;
    const decoded = textarea.value;

    // If the decoded string is different and still contains entities, decode again
    if (decoded !== str && (decoded.includes('&lt;') || decoded.includes('&gt;') || decoded.includes('&amp;'))) {
        return decodeHtmlEntities(decoded);
    }

    return decoded;
};

/**
 * Utility function to strip all HTML tags while preserving line breaks
 * Uses a robust DOM-based approach to handle nested tags and attributes
 * 
 * @param html - The HTML string to strip
 * @returns The stripped plain text
 */
export const stripHtmlTags = (html: string): string => {
    if (!html) return '';

    // 1. First decode entities to handle &lt; etc.
    const decoded = decodeHtmlEntities(html);

    // 2. Use DOMParser to handle the removal of tags robustly
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(decoded, 'text/html');

        // 1a. Remove hidden elements that often cause duplication (e.g. sr-only labels, ui artifacts)
        const hidden = doc.querySelectorAll('.sr-only, .aria-hidden, .hidden, .ql-ui, [aria-hidden="true"]');
        hidden.forEach(h => h.remove());

        // 2a. Replace block elements with themselves + a newline to preserve formatting
        const blocks = doc.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, br, li, tr');
        blocks.forEach(block => {
            if (block.tagName.toLowerCase() === 'br') {
                block.parentNode?.replaceChild(doc.createTextNode('\n'), block);
            } else {
                const newline = doc.createTextNode('\n');
                block.parentNode?.insertBefore(newline, block.nextSibling);
            }
        });

        let text = doc.body.textContent || "";

        // 2b. Remove leaked attribute-like strings (fix for specific observed artifacts like tabindex="0">)
        text = text.replace(/[\w-]+="[^"]*">/g, '');

        // 3. Final cleanup of whitespace and empty lines
        return text
            .split('\n')
            .map(line => line.trim())
            .filter((line, index, array) => {
                // Remove redundant empty lines but keep single separators
                if (line === '' && index > 0 && array[index - 1] === '') return false;
                return true;
            })
            .join('\n')
            .trim();
    } catch (e) {
        // Fallback to regex if DOMParser fails
        console.warn('DOMParser failed in stripHtmlTags, falling back to regex:', e);
        return decoded
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/(p|div|h[1-6])>/gi, '\n')
            .replace(/<[^>]*>/g, '')
            .replace(/[\w-]+="[^"]*">/g, '') // Also apply fix in fallback
            .split('\n')
            .map(line => line.trim())
            .join('\n')
            .trim();
    }
};
