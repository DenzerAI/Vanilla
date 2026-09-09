// Keep only an opaque request key across reloads; never persist message text here.
// A lost HTTP response is not evidence that dispatch failed.
export async function submitMessage(api, chatId, body, storage=globalThis.sessionStorage) {
  const bytes=new TextEncoder().encode(JSON.stringify({chatId,...body}));
  const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
  const key='vanilla.delivery.'+digest;
  let id=storage.getItem(key);
  if(!id){id=crypto.randomUUID();storage.setItem(key,id);}
  const result=await api('/turn',{id:chatId,...body,messageId:id});
  const message=result.message;
  if(message?.status==='failed') {
    storage.removeItem(key);
    throw Error(message.detail || 'Nachricht wurde nicht übergeben.');
  }
  if(message?.status==='unknown') throw Error('Zustellung unklar. Verlauf und Nachrichtenstatus prüfen; diese Nachricht wird nicht automatisch wiederholt.');
  if(message?.status==='waiting' && result.blocked) throw Error('Nachricht gespeichert, aber Folge pausiert. Vor Fortsetzung den bisherigen Verlauf prüfen.');
  storage.removeItem(key);
  return result;
}
