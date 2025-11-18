import createDOMPurify from 'isomorphic-dompurify'

/**
 * Sanitize HTML to prevent XSS attacks
 * @param {string} html - Raw HTML string
 * @returns {string} - Sanitized HTML
 */
export function sanitizeHtml (html)  {
  if (!html || typeof html !== 'string') {
    return '';
  }

  // Configure DOMPurify
  const clean = createDOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'a', 'img', 'ul', 'ol', 'li', 'br', 'strong', 'em', 'u',
      'table', 'thead', 'tbody', 'tr', 'td', 'th',
      'section', 'article', 'header', 'footer', 'nav', 'main',
      'button', 'form', 'input', 'label', 'textarea', 'select', 'option'
    ],
    ALLOWED_ATTR: [
      'class', 'id', 'href', 'src', 'alt', 'title', 'target',
      'type', 'placeholder', 'name', 'value', 'style', 'data-*'
    ],
    ALLOW_DATA_ATTR: true,
    KEEP_CONTENT: true,
  });

  return clean;
};

/**
 * Sanitize HTML specifically for Tailwind templates
 * Preserves all Tailwind CSS classes
 * @param {string} html - Raw HTML string with Tailwind classes
 * @returns {string} - Sanitized HTML with Tailwind classes preserved
 */
export function sanitizeTailwindHtml  (html) {
  if (!html || typeof html !== 'string') {
    return '';
  }

  // Configure DOMPurify to allow all Tailwind classes
  const clean = createDOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'a', 'img', 'ul', 'ol', 'li', 'br', 'strong', 'em', 'u', 'i', 'b',
      'table', 'thead', 'tbody', 'tr', 'td', 'th',
      'section', 'article', 'header', 'footer', 'nav', 'main', 'aside',
      'button', 'form', 'input', 'label', 'textarea', 'select', 'option',
      'html', 'head', 'body', 'meta', 'link', 'script', 'style',
      'video', 'audio', 'source', 'iframe', 'svg', 'path', 'circle', 'rect'
    ],
    ALLOWED_ATTR: [
      'class', 'id', 'href', 'src', 'alt', 'title', 'target',
      'type', 'placeholder', 'name', 'value', 'data-*',
      'width', 'height', 'style',
      'viewBox', 'd', 'fill', 'stroke', 'xmlns',
      'charset', 'content', 'rel', 'integrity', 'crossorigin'
    ],
    ALLOW_DATA_ATTR: true,
    KEEP_CONTENT: true,
    ADD_TAGS: ['script', 'link'], // Allow Tailwind CDN script and link tags
    ADD_ATTR: ['crossorigin', 'integrity'], // Allow CDN attributes
  });

  return clean;
};

/**
 * Sanitize CSS to prevent malicious code
 * @param {string} css - Raw CSS string
 * @returns {string} - Sanitized CSS
 */
export function sanitizeCss  (css)  {
  if (!css || typeof css !== 'string') {
    return '';
  }

  // Remove potentially dangerous CSS properties
  const dangerous = [
    'behavior',
    'expression',
    'javascript:',
    'vbscript:',
    'data:text/html',
    '-moz-binding'
  ];

  let clean = css;
  dangerous.forEach(term => {
    const regex = new RegExp(term, 'gi');
    clean = clean.replace(regex, '');
  });

  return clean;
};