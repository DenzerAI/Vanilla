import {coreEnabled, coreRequest} from './core-client.mjs';

const reasons = {
  paused: 'Neue KI- und Dienstübergaben sind unter Datenschutz pausiert. Bereits laufende Arbeit wird dadurch nicht gestoppt.',
  credentials: 'Übergabe blockiert: Der Text enthält ein bekanntes Muster für Zugangsdaten. Bitte entferne den Wert.',
  contacts: 'Übergabe blockiert: Im Text wurde eine E-Mail-Adresse oder ein IBAN-Muster erkannt.',
  attachments: 'Übergabe blockiert: Anhänge sind unter Datenschutz gesperrt.',
  uninspectable: 'Übergabe blockiert: Diese Audio- oder Liveübertragung kann vorab nicht als Text geprüft werden.',
};

export async function checkHandoff(kind, {text = '', attachments = 0, opaque = false} = {}, request = coreRequest) {
  if (!coreEnabled && request === coreRequest) throw Error('Die lokale Datenschutzprüfung ist nicht erreichbar. Bitte Vanilla über den gemeinsamen Kern starten.');
  const result = await request('privacy/check', {kind, text, attachments, opaque});
  if (result?.allowed !== true) throw Error(reasons[result?.reason] || 'Die Datenschutzprüfung hat diese Übergabe nicht freigegeben.');
  return result;
}

export function workerHandoff(params) {
  const input = params.input || [];
  // Include the fresh company instructions and selected memory, not just visible chat text.
  const text = [params.developerInstructions, params.collaborationMode?.settings?.developer_instructions,
    ...input.filter(p => p.type === 'text').map(p => p.text)].filter(Boolean).join('\n');
  const attachments = input.filter(p => ['localImage', 'localAudio', 'image', 'audio'].includes(p.type) || (p.type === 'text' && p.text?.startsWith('Angehängte Datei: '))).length;
  return {text, attachments};
}
