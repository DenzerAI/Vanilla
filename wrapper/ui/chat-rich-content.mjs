import {Marked, Renderer} from 'marked';
import {localFilePath, fileKind} from './artifact-content.mjs';
const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function chatMarkup(text, workspace = '', directory = workspace) {
  const renderer = new Renderer();
  const renderCode = renderer.code, renderTable = renderer.table;
  renderer.code = function(token) {
    const lang = token.lang?.split(/\s/)[0] || 'Code';
    const code = `<div class="chat-code"><div class="chat-code-toolbar"><span>${escape(lang)}</span><span data-copy-code="true"></span></div>${renderCode.call(this,token)}</div>`;
    if (lang.toLowerCase() === 'svg' && token.text.length <= 2e6 && /^\s*(?:<\?xml[^>]*>\s*)?<svg\b/i.test(token.text) && /<\/svg>\s*$/i.test(token.text)) {
      // An SVG image is an inert document, never markup in the app DOM. Image
      // mode prevents scripts, navigation and external subresource requests.
      const svg = token.text.replace(/<svg\b([^>]*)>/i, (tag, attrs) => /\bxmlns\s*=/.test(attrs) ? tag : `<svg xmlns="http://www.w3.org/2000/svg"${attrs}>`);
      const src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      return `<figure class="chat-svg-preview"><img src="${escape(src)}" alt="SVG-Grafik" loading="lazy"><details><summary>SVG-Quelltext</summary>${code}</details></figure>`;
    }
    return code;
  };
  renderer.table = function(token) {
    return `<div class="chat-table" role="region" aria-label="Tabelle" tabindex="0">${renderTable.call(this,token)}</div>`;
  };
  renderer.image = function(token) {
    const local = localFilePath(token.href,workspace,directory);
    if (local && fileKind(local) === 'image') return `<a href="${escape(token.href)}" class="chat-inline-image"><img src="/api/file/raw?path=${encodeURIComponent(local)}" alt="${escape(token.text || 'Bild')}" loading="lazy"></a>`;
    if (local || /^https?:\/\//i.test(token.href)) return `<a href="${escape(token.href)}">${escape(token.text || 'Bild öffnen')}</a>`;
    return escape(token.text || 'Bild nicht verfügbar');
  };
  // Raw HTML is text, not another way to inject external images or controls.
  renderer.html = token => escape(token.text);
  return new Marked({gfm:true,breaks:true,renderer}).parse(text);
}
