// Average over each output sample's interval. State is continuous across worklet blocks.
export class PCMResampler {
  constructor(inputRate, outputRate = 16000) {
    this.ratio = inputRate / outputRate; this.weight = 0; this.sum = 0;
  }
  push(samples, emit) {
    for (const sample of samples) {
      let remaining = 1;
      while (remaining > 1e-9) {
        const take = Math.min(remaining, this.ratio - this.weight);
        this.sum += sample * take; this.weight += take; remaining -= take;
        if (this.weight >= this.ratio - 1e-9) {
          emit(Math.round(Math.max(-1, Math.min(1, this.sum / this.ratio)) * 32767));
          this.sum = 0; this.weight = 0;
        }
      }
    }
  }
}
export async function microphone(media, deviceId = '', audioSession = globalThis.navigator?.audioSession) {
  if (!media?.getUserMedia) throw new Error('Mikrofonzugriff ist in diesem Browser nicht verfügbar.');
  // WebKit rejects capture while an explicit playback category is active.
  // Set the capture category before requesting permission, then let the browser
  // manage the active microphone/output again, including after a denied request.
  const setSession = type => { try { if (audioSession) audioSession.type = type; } catch { /* Optional browser API. */ } };
  setSession('play-and-record');
  try {
    if (!deviceId) return await media.getUserMedia({ audio: true });
    try { return await media.getUserMedia({ audio: { deviceId: { ideal: deviceId } } }); }
    catch (e) {
      if (!['OverconstrainedError', 'ConstraintNotSatisfiedError', 'NotFoundError', 'TypeError'].includes(e.name) && !/invalid constraint/i.test(e.message)) throw e;
      return await media.getUserMedia({ audio: true });
    }
  } finally {
    setSession('auto');
  }
}
export function microphoneError(e) {
  if (/AudioSession category.*audio capture/i.test(e.message)) return 'Der Browser blockiert die Audioaufnahme. Bitte die Seite neu laden und das Mikrofon erneut starten.';
  if (e.name === 'NotAllowedError') return 'Bitte Mikrofonzugriff im Browser und in den Systemeinstellungen erlauben.';
  if (e.name === 'NotFoundError') return 'Kein Mikrofon gefunden. Bitte ein Mikrofon anschließen.';
  if (e.name === 'NotReadableError') return 'Mikrofon ist belegt oder nicht erreichbar.';
  if (/constraint/i.test(e.message)) return 'Mikrofon konnte nicht geöffnet werden. Unter Stimme ein anderes Gerät auswählen.';
  return e.message;
}
