import {addPresentationBridge} from './html-presentation.mjs';
import {readFile, stat} from 'node:fs/promises';

// The document runs in an opaque origin. It cannot read the app, use its API,
// submit forms, open windows, or load active content from another server.
export const htmlPreviewPolicy = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; sandbox allow-scripts; frame-ancestors 'self'";
export async function readHtmlPreview(file, {channel} = {}) {
  if (!/\.html?$/i.test(file)) throw new Error('Nur HTML-Dateien haben eine HTML-Vorschau.');
  const info = await stat(file);
  if (!info.isFile()) throw new Error('Keine Datei.');
  if (info.size > 2e6) throw new Error('Für die HTML-Vorschau zu groß. Bitte herunterladen.');
  const content = await readFile(file);
  if (content.length > 2e6) throw new Error('Für die HTML-Vorschau zu groß. Bitte herunterladen.');
  return channel === undefined ? content : addPresentationBridge(content,channel);
}
