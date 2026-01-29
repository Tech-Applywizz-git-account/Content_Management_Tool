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
