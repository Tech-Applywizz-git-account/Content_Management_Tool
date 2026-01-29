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
 * 
 * @param html - The HTML string to strip
 * @returns The stripped plain text
 */
export const stripHtmlTags = (html: string): string => {
    if (!html) return '';

    // 1. Decode entities first to get actual tags
    let decoded = decodeHtmlEntities(html);

    // 2. Replace common block-level tags and line breaks with newlines
    // This ensures that <p>, <div>, <h3>, <br> etc. translate to visual separation
    decoded = decoded.replace(/<br\s*\/?>/gi, '\n');
    decoded = decoded.replace(/<\/(p|div|h[1-6])>/gi, '\n');

    // 3. Strip all remaining tags and their attributes entirely
    const stripped = decoded.replace(/<[^>]*>/g, '');

    // 4. Clean up excess whitespace
    // Replace triple+ newlines with double newlines, trim trailing whitespace per line
    return stripped
        .split('\n')
        .map(line => line.trim())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
};
