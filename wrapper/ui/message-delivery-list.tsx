import React, { useEffect, useState } from 'react';
import { deliverMessage, localMessages, reconcileLocal } from './message-delivery-client.mjs';
import './message-delivery.css';

type Message = { id: string; intent: string; status: string; revision: number; payload: { text: string; attachments?: { name?: string; path: string }[] }; detail?: string; outcome?: string };
type Props = { chatId: string | null; api: (url: string, body?: unknown) => Promise<any> };
const labels: Record<string, string> = { waiting: 'Wartet', dispatching: 'Wird zugestellt', delivered: 'Vom Worker bestätigt', unknown: 'Zustellung unklar', cancelled: 'Gelöscht', failed: 'Nicht zugestellt', local: 'Annahme unklar' };
export function MessageDeliveryList({ chatId, api }: Props) {
  const [messages, setMessages] = useState<Message[]>([]), [locals, setLocals] = useState<any[]>([]);
  const [error, setError] = useState(''), [blocked, setBlocked] = useState(false), [pauseToken, setPauseToken] = useState('');
  const [editing, setEditing] = useState<Message | null>(null), [text, setText] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => {
    setMessages([]); setLocals([]); setEditing(null); setError(''); setBlocked(false);
    if (!chatId) return;
    let alive = true, loading = false;
    const local = () => { if (alive) setLocals(localMessages(chatId)); };
    const refresh = async () => {
      if (loading) return; loading = true;
      try {
        const r = await api('/messages?id=' + encodeURIComponent(chatId));
        if (!alive) return;
        reconcileLocal(r.messages); setMessages(r.messages); setBlocked(r.blocked); setPauseToken(r.pauseToken); setError(''); local();
      } catch (e: any) { if (alive) setError(e.message); }
      finally { loading = false; }
    };
    local(); void refresh();
    const changed = () => { local(); void refresh(); };
    const timer = setInterval(refresh, 2000);
    window.addEventListener('message-outbox', changed);
    window.addEventListener('storage', changed);
    return () => { alive = false; clearInterval(timer); window.removeEventListener('message-outbox', changed); window.removeEventListener('storage', changed); };
  }, [chatId, api]);
  async function action(fn: () => Promise<any>) {
    setBusy(true);
    try { await fn(); const r = await api('/messages?id=' + encodeURIComponent(chatId!)); setMessages(r.messages); setBlocked(r.blocked); setPauseToken(r.pauseToken); setEditing(null); setError(''); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }
  if (!chatId || (!messages.length && !locals.length && !error)) return null;
  return <section className="message-deliveries" aria-label="Nachrichten und Zustellung">
    <details open={messages.some(m => ['waiting','dispatching','unknown'].includes(m.status)) || !!locals.length || undefined}>
      <summary>Nachrichten · {messages.length + locals.length}</summary>
      {blocked && <p role="status">Die Aufgabenfolge pausiert. Unklare Nachrichten werden nicht erneut gesendet.</p>}
      {blocked && <button type="button" disabled={busy} onClick={() => action(() => api('/messages/resume', {id:chatId,pauseToken}))}>Ohne Wiederholung fortsetzen</button>}
      <ul>{messages.map(m => <li key={m.id}>
        <div className="delivery-meta"><span>{m.intent === 'after' ? 'Danach' : 'Senden'} · {labels[m.status]}</span>{m.outcome && <span>{m.outcome === 'completed' ? 'Erledigt' : 'Aufgabe unterbrochen'}</span>}</div>
        {editing?.id === m.id ? <div className="delivery-editor">
          <textarea aria-label="Wartende Nachricht bearbeiten" value={text} onChange={e => setText(e.target.value)} />
          <div className="delivery-actions"><button type="button" disabled={busy} onClick={() => action(() => api('/messages/edit', {id: chatId, messageId:m.id, revision:editing.revision, text}))}>Speichern</button><button type="button" onClick={() => setEditing(null)}>Abbrechen</button></div>
        </div> : <p>{m.payload.text || 'Anhang'}{m.payload.attachments?.map(a => <small key={a.path}>{a.name || a.path}</small>)}</p>}
        {m.detail && <small>{m.detail}</small>}
        {m.status === 'waiting' && editing?.id !== m.id && <div className="delivery-actions">
          <button type="button" disabled={busy} onClick={() => {setEditing(m);setText(m.payload.text);}}>Bearbeiten</button>
          <button type="button" disabled={busy} onClick={() => action(() => api('/messages/edit', {id:chatId,messageId:m.id,revision:m.revision,remove:true}))}>Löschen</button>
        </div>}
      </li>) }
      {locals.map(m => <li key={m.messageId}><div className="delivery-meta">Annahme unklar</div><p>{m.text}</p><small>Der Server hat die Speicherung noch nicht bestätigt.</small><div className="delivery-actions"><button type="button" disabled={busy} onClick={() => action(() => deliverMessage(api, m))}>Annahme prüfen</button></div></li>)}
      </ul>
    </details>
    {error && <p role="alert">Zustellliste: {error}</p>}
  </section>;
}
