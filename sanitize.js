// Simple HTML entity escaping to prevent XSS via user-controlled strings
function sanitize(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .trim()
        .slice(0, 500); // Cap length too
}

module.exports = sanitize;
