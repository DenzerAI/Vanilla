import path from 'node:path';
import {existsSync, realpathSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
export const projectRoot = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
export function localPath(value, root = projectRoot) {
  root = realpathSync(root);
  const target = path.resolve(root, value);
  let ancestor = target;
  while (!existsSync(ancestor)) ancestor = path.dirname(ancestor);
  const resolved = path.resolve(realpathSync(ancestor), path.relative(ancestor, target));
  if (resolved === root || !resolved.startsWith(root + path.sep))
    throw new Error('Vanilla-Pfade müssen innerhalb des eigenen Projektordners liegen.');
  return resolved;
}
export function localPort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1024 || port > 65535 || [8890,9090].includes(port))
    throw new Error('Unzulässiger Vanilla-Port.');
  return port;
}
