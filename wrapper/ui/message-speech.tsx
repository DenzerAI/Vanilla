import React, {useEffect, useRef, useState} from 'react';
import {SpeechPlayback, spokenText} from './speech-playback.mjs';
import {Volume2, Square, LoaderCircle} from './icons.jsx';

type Props = {text: string; disabled?: boolean; api: (url: string, data?: unknown) => Promise<any>; Button: React.ElementType};
export function MessageSpeech({text, disabled, api, Button}: Props) {
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');
  const playback = useRef<SpeechPlayback | null>(null);
  useEffect(() => {
    const player = new SpeechPlayback(api, setState);
    playback.current = player;
    return () => { playback.current = null; void player.close().catch(() => {}); };
  }, [api, text]);
  useEffect(() => { if(disabled) playback.current?.cancel(); }, [disabled]);
  const active = state !== 'idle';
  const label = state === 'loading' ? 'Vorlesen wird vorbereitet – stoppen' : active ? 'Vorlesen stoppen' : 'Antwort vorlesen';
  const Icon = state === 'loading' ? LoaderCircle : active ? Square : Volume2;
  async function toggle() {
    const player = playback.current;
    if(!player) return;
    if(active) { player.cancel(); return; }
    setError('');
    try { await player.speak(text); }
    catch(e) { if(playback.current === player) setError(e instanceof Error ? e.message : 'Vorlesen fehlgeschlagen. Bitte erneut versuchen.'); }
  }
  return <>
    <Button label={label} active={active} aria-pressed={active} disabled={!active && (disabled || !spokenText(text))} onClick={toggle} data-capability="chat.message.read-aloud"><Icon size={15} strokeWidth={1.55}/></Button>
    {error && <span className="inline-error message-speech-error" role="alert">{error}</span>}
  </>;
}
