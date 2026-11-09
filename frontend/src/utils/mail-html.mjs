import DOMPurify from './dompurify-3.4.17.mjs';
DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
  if (node.tagName === 'IMG' && data.attrName === 'src' && data.attrValue.startsWith('blob:' + window.location.origin + '/')) data.forceKeepAttr = true;
});
export function sanitizeMailHtml(value) {
  return DOMPurify.sanitize(String(value ?? ''), {
    USE_PROFILES: {html: true},
    FORBID_TAGS: ['script','iframe','object','embed','form','input','button','textarea','select','option','link','meta','base'],
    FORBID_ATTR: ['srcdoc'],
    ALLOW_UNKNOWN_PROTOCOLS: false,
    SANITIZE_NAMED_PROPS: true
  });
}
export function mailTextHtml(value) {
  const node = document.createElement('pre');
  node.textContent = String(value ?? '');
  return node.outerHTML;
}
