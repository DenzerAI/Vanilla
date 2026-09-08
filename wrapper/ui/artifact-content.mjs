import {marked} from 'marked';
// Only local workspace references are eligible for previews. No remote fetches.
export function localFilePath(value, workspace = '', directory = workspace) {
  if (typeof value !== 'string' || !value.trim() || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value.trim())) return null;
  let path;
  try { path = decodeURIComponent(value.trim().split('#')[0]).replace(/:\d+(?::\d+)?$/, ''); } catch { return null; }
  const absolute = path.startsWith('/');
  if (workspace && path.startsWith(workspace + '/')) path = path.slice(workspace.length + 1);
  else if (path.startsWith('/')) return null;
  path = path.replace(/^\.\//, '');
  if (!path || path.includes('\\') || /[\x00-\x1f?]/.test(path) || path.split('/').some(p => !p || p.startsWith('.') || /^(secrets|node_modules)$/i.test(p))) return null;
  if (!absolute && directory && directory !== workspace) {
    if (!directory.startsWith(workspace + '/')) return null;
    const prefix = localFilePath(directory, workspace);
    if (!prefix) return null;
    path = prefix + '/' + path;
  }
  return path;
}

export function fileKind(path = '') {
  if (/\.(png|jpe?g|webp|gif)$/i.test(path)) return 'image';
  if (/\.pdf$/i.test(path)) return 'pdf';
  if (/\.(mp3|wav|m4a|ogg)$/i.test(path)) return 'audio';
  if (/\.(mp4|webm)$/i.test(path)) return 'video';
  if (/\.(txt|md|csv|tsv|json|ya?ml|toml|xml|html?|css|scss|[cm]?js|jsx|tsx?|py|sh|sql|rs|go|swift|java|c|h|cpp|diff|patch|svg)$/i.test(path)) return 'text';
  return 'download';
}

export function patchChanges(patch) {
  if (typeof patch !== 'string') return [];
  const changes = [];
  let current;
  for (const line of patch.split('\n')) {
    const header = line.match(/^\*\*\* (Add|Update|Delete) File: (.+)$/);
    if (header) { current = {path:header[2], kind:header[1].toLowerCase(), diff:''}; changes.push(current); }
    else if (current && !line.startsWith('*** End Patch')) current.diff += line + '\n';
  }
  return changes;
}

export function diffLines(diff = '', limit = 400) {
  const lines = String(diff).split('\n');
  return { total: lines.length, lines: lines.slice(0, limit).map(text => ({text, kind: text.startsWith('@@') || /^(---|\+\+\+)/.test(text) ? 'header' : text.startsWith('+') ? 'added' : text.startsWith('-') ? 'removed' : 'context'})) };
}

export function collectArtifacts(items = [], workspace = '', directory = workspace) {
  const files = new Map();
  const add = (value, label) => {
    const path = localFilePath(value, workspace, directory);
    if (path && !files.has(path)) files.set(path, {path, label:label || path.split('/').pop()});
  };
  for (const item of items) {
    if (item.type === 'agentMessage' && item.phase !== 'commentary' && typeof item.text === 'string') {
      marked.walkTokens(marked.lexer(item.text), token => {
        if (token.type === 'link' || token.type === 'image') add(token.href, token.text);
      });
    }
    if (item.type === 'imageGeneration' && (item.path || item.savedPath)) add(item.path || item.savedPath);
    if (item.status === 'completed') {
      for (const change of Array.isArray(item.changes) ? item.changes : []) if (change.kind !== 'delete' && change.kind?.type !== 'delete') add(change.path);
      if (item.type === 'imageGeneration') add(item.path || item.savedPath);
      for (const artifact of Array.isArray(item.artifacts) ? item.artifacts : []) add(artifact.path, artifact.name);
    }
  }
  return [...files.values()];
}

