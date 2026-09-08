import {Marked, Renderer} from 'marked';
import {localFilePath} from './artifact-content.mjs';
const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function chatMarkup(text, workspace = '', directory = workspace) {
  const renderer = new Renderer();
  const renderCode = renderer.code, renderTable = renderer.table;
  renderer.code = function(token) {
    return `<div class="chat-code"><div class="chat-code-toolbar"><span>${escape(token.lang?.split(/\s/)[0] || 'Code')}</span><button type="button" data-copy-code="true" aria-label="Code kopieren">Kopieren</button></div>${renderCode.call(this,token)}</div>`;
  };
  renderer.table = function(token) {
    return `<div class="chat-table" role="region" aria-label="Tabelle" tabindex="0">${renderTable.call(this,token)}</div>`;
  };
  renderer.image = function(token) {
    const local = localFilePath(token.href,workspace,directory);
    if (local && /\.(png|jpe?g|webp|gif)$/i.test(local)) return `<a href="${escape(token.href)}" class="chat-inline-image"><img src="/api/file/raw?path=${encodeURIComponent(local)}" alt="${escape(token.text || 'Bild')}" loading="lazy"></a>`;
    if (local || /^https?:\/\//i.test(token.href)) return `<a href="${escape(token.href)}">${escape(token.text || 'Bild öffnen')}</a>`;
    return escape(token.text || 'Bild nicht verfügbar');
  };
  // Raw HTML is text, not another way to inject external images or controls.
  renderer.html = token => escape(token.text);
  return new Marked({gfm:true,breaks:true,renderer}).parse(text);
}
