import DOMPurify from './dompurify-3.4.17.mjs';
DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
  if (node.tagName === 'IMG' && data.attrName === 'src' && data.attrValue.startsWith('blob:' + window.location.origin + '/')) data.forceKeepAttr = true;
});
export function sanitizeMailHtml(value, { isolated = true } = {}) {
  return DOMPurify.sanitize(String(value ?? ''), {
    USE_PROFILES: {html: true},
    FORBID_TAGS: ['script','iframe','object','embed','form','input','button','textarea','select','option','link','meta','base', ...(!isolated ? ['style'] : [])],
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

// Sandboxed srcdoc has an opaque origin and cannot load parent-origin blob URLs.
// Resolve only images belonging to this parsed message, never arbitrary URLs.
export async function mailIframeHtml(value, attachments = []) {
  const doc = new DOMParser().parseFromString(sanitizeMailHtml(value), 'text/html');
  await Promise.all(Array.from(doc.querySelectorAll('img[src]'), async image => {
    const attachment = attachments.find(item => item.url === image.getAttribute('src'));
    if (!attachment?.blob || !attachment.blob.type.startsWith('image/')) return;
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(attachment.blob);
    });
    image.setAttribute('src', data);
  }));
  return sanitizeMailHtml(doc.body.innerHTML);
}
