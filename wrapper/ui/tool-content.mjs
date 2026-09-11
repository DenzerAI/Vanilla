// Public, typed tool output only. Never infer execution success from prose.
const computerPattern = /(?:computer[_-]?use|cua[_-]?repl|mcp__computer|browser[_./-](?:click|navigate|snapshot|screenshot|type)|playwright|puppeteer|^computer$)/i;
export function isComputerTool(item = {}) {
  return item.type === 'computerUse' || [item.server, item.tool, item.toolName, item.name].some(s => computerPattern.test(s || ''));
}
export function toolContent(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.content)) return value.content;
  if (typeof value === 'string') {
    try { const parsed = JSON.parse(value); if (Array.isArray(parsed) || Array.isArray(parsed?.content)) return toolContent(parsed); } catch {}
    return [{type:'text', text:value}];
  }
  return value == null ? [] : [{type:'text', text:JSON.stringify(value, null, 2)}];
}
export function publicToolContent(value) {
  let imageCount = 0, imageBytes = 0, textLength = 0;
  return toolContent(value).slice(0, 100).flatMap(block => {
    if (!block || typeof block !== 'object') return [];
    if (typeof block.text === 'string') { const text=block.text.slice(0,Math.max(0,250000-textLength)); textLength+=text.length; return [{type:'text',text}]; }
    if (block.type === 'input_image' && typeof block.image_url === 'string') {
      const match=block.image_url.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/);
      if (match) block={type:'image',mimeType:match[1],data:match[2]};
    }
    if (block.type === 'image' && block.source?.type === 'base64') block={type:'image',mimeType:block.source.media_type,data:block.source.data};
    if (block.type === 'image' && /^(image\/(png|jpeg|webp|gif))$/.test(block.mimeType || '') && typeof block.data === 'string' && block.data.length <= 12e6 && imageBytes+block.data.length <= 16e6 && imageCount < 4 && /^[A-Za-z0-9+/]+={0,2}$/.test(block.data)) {
      imageBytes+=block.data.length; imageCount++;
      return [{type:'image', mimeType:block.mimeType, data:block.data}];
    }
    return [];
  });
}
export function toolImages(item) {
  return publicToolContent(item.result ?? item.output ?? item.contentItems ?? item.toolContent).filter(b => b.type === 'image').slice(0,4);
}
// Generated media belongs to the answer, even when the provider delivers it
// through a generic exec tool. Screenshots and inspected reference images stay
// in the activity log. The receipt is used only for classification, never as a
// file path or an instruction to fetch something outside the workspace.
export function generatedImageItems(items = []) {
  return items.filter(item => {
    if (item.status !== 'completed' || isComputerTool(item) || !toolImages(item).length) return false;
    if (item.type === 'imageGeneration' || /(?:imagegen|image_generate|generate_image)/i.test([item.tool, item.toolName, item.name].filter(Boolean).join(' '))) return true;
    return toolContent(item.result ?? item.output ?? item.contentItems ?? item.toolContent).some(block =>
      typeof block?.text === 'string' && /^Generated images are saved to /m.test(block.text));
  });
}
export function toolOutputText(item) {
  const value = item.result ?? item.output ?? item.contentItems ?? item.toolContent ?? item.arguments;
  return toolContent(value).map(b => ['image','input_image'].includes(b?.type) ? '[Bildschirmaufnahme / Bild]' : b?.text ?? (b?.type === 'resource_link' ? b.name || b.uri : '')).filter(Boolean).join('\n');
}
export function computerToolStatus(servers = []) {
  const names = servers.flatMap(s => Object.keys(s.tools || {}).filter(tool => isComputerTool({server:s.name,tool})).map(tool => `${s.name} · ${tool}`));
  return { state:names.length ? 'detected' : 'unavailable', tools:names };
}
