/**
 * Security utilities for XSS prevention
 */

/**
 * Escape HTML special characters to prevent XSS attacks
 * @param {string} text - Text to escape
 * @returns {string} - HTML-safe text
 */
function escapeHtml(text) {
  if (text === null || text === undefined) {
    return '';
  }
  
  const str = String(text);
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Sanitize HTML but allow safe tags (like <br>, <b>, <i>)
 * Use with caution - only for trusted content
 * @param {string} html - HTML to sanitize
 * @returns {string} - Sanitized HTML
 */
function sanitizeHtml(html) {
  if (html === null || html === undefined) {
    return '';
  }
  
  const str = String(html);
  // Allow only safe tags
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '') // Remove event handlers
    .replace(/on\w+\s*=\s*[^\s>]*/gi, ''); // Remove unquoted event handlers
}

/**
 * Create a safe HTML element with escaped text content
 * @param {string} tag - HTML tag name
 * @param {string} text - Text content to escape
 * @param {string} className - Optional CSS class
 * @returns {string} - Safe HTML string
 */
function createSafeElement(tag, text, className = '') {
  const escapedText = escapeHtml(text);
  const classAttr = className ? ` class="${escapeHtml(className)}"` : '';
  return `<${tag}${classAttr}>${escapedText}</${tag}>`;
}

/**
 * Safely set innerHTML with automatic escaping
 * @param {HTMLElement} element - Target element
 * @param {string} text - Text to set (will be escaped)
 */
function safeSetText(element, text) {
  if (!element) return;
  element.textContent = text === null || text === undefined ? '' : String(text);
}

/**
 * Safely append HTML with escaped variables
 * Use template: safeHtml`<div>Hello ${username}</div>`
 * @param {Array} strings - Template strings
 * @param {...*} values - Values to escape
 * @returns {string} - Safe HTML
 */
function safeHtml(strings, ...values) {
  let result = strings[0];
  for (let i = 0; i < values.length; i++) {
    result += escapeHtml(values[i]) + strings[i + 1];
  }
  return result;
}
