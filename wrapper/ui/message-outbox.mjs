// One durable sender per browser tab, independent of panes and selected conversations.
export function createMessageOutbox({storage, api, changed = () => {}, now = Date.now}) {
  let entries = [], key = '', timer, active = false;
  const inflight = new Set();
  const save = () => {
    for(const entry of entries){
      const recordKey=key+":"+entry.clientMessageId;
      if(entry.status==="started"){
        if(entry.localId?.startsWith("outbox-"))storage.setItem(recordKey,JSON.stringify({version:1,entry:{
          clientMessageId:entry.clientMessageId,chatId:entry.chatId,localId:entry.localId,status:"started",mappingOnly:true}}));
        else storage.removeItem(recordKey);
      }
      else storage.setItem(recordKey,JSON.stringify({version:1,entry}));
    }
  };
  const publish = () => changed([...entries]);
  // Entries saved by an older page version lack the workspace in their payload; the server rejects
  // them forever ("Arbeitsbereich fehlt"). Restore it from the entry so a retry can succeed.
  const heal = entry => {
    if (entry.payload && !entry.payload.id && !entry.payload.chat?.projectId && entry.projectId)
      entry.payload = {...entry.payload, chat:{...(entry.payload.chat || {}), projectId:entry.projectId}};
    return entry;
  };
  // A pending chat that only exists in this browser can be dropped without asking the server.
  function discard(id) {
    const dropped = entries.filter(e=>e.localId===id || e.clientMessageId===id);
    if (!dropped.length) return false;
    entries = entries.filter(e=>!dropped.includes(e));
    for(const entry of dropped) storage.removeItem(key+":"+entry.clientMessageId);
    publish();
    return true;
  }
  function start(scope) {
    const next = 'agent-message-outbox-v1:' + scope;
    if (key === next) return;
    key = next;
    entries = storage.keys().filter(name=>name.startsWith(key+":")).map(name=>{
      const saved=JSON.parse(storage.getItem(name));
      if(saved.version!==1 || !saved.entry?.clientMessageId)throw Error("Postausgang kann nicht gelesen werden.");
      return heal(saved.entry);
    });
    active = true;
    publish();
    clearInterval(timer);
    timer = setInterval(pump,2000);
    pump();
  }
  function enqueue(payload) {
    if (!active) throw Error('Postausgang ist noch nicht bereit.');
    const entry = {clientMessageId:payload.clientMessageId, localId:payload.localId,
      chatId:payload.id || null, projectId:payload.chat?.projectId || payload.projectId,
      text:payload.text, attachments:payload.attachments || [], createdAt:now(), status:'sending', payload};
    entries.push(entry);
    try {save();} catch(error) {entries.pop();throw Error('Nachricht konnte lokal nicht gespeichert werden. Dein Entwurf bleibt erhalten.');}
    publish();
    void pump();
    return entry;
  }
  async function transmit(entry) {
    inflight.add(entry.clientMessageId);
    try {
      const receipt = entry.status === 'sending' || entry.status === 'offline'
        ? await api('/delivery',entry.payload)
        : await api('/delivery?clientMessageId='+encodeURIComponent(entry.clientMessageId)+(entry.chatId?'&id='+encodeURIComponent(entry.chatId):''));
      if (!receipt?.clientMessageId) return; // Locked private receipt, never infer delivery.
      Object.assign(entry,receipt,{error:receipt.error || ''});
      save(); publish();
    } catch(error) {
      if (entry.status === 'sending' || entry.status === 'offline') {
        entry.status = [400,401,403,404,413,423].includes(error.status) ? 'failed' : 'offline';
      }
      entry.error = error.message;
      try {save();} catch {}
      publish();
    } finally {inflight.delete(entry.clientMessageId);}
  }
  async function pump() {
    if (!active) return;
    await Promise.all(entries.filter(e=>['sending','offline','accepted'].includes(e.status) && !inflight.has(e.clientMessageId)).map(transmit));
  }
  function retry(id) {
    const entry = entries.find(e=>e.clientMessageId===id);
    if (!entry || inflight.has(id)) return;
    // Unknown worker handoffs are queried only. Resending requires a separate explicit user action.
    if (entry.status !== 'unknown') entry.status = 'sending';
    save(); publish(); void transmit(entry);
  }
  function merge(receipts) {
    for (const receipt of receipts) {
      const old = entries.find(e=>e.clientMessageId===receipt.clientMessageId);
      if (old) Object.assign(old,receipt,{mappingOnly:false});
      else entries.push(receipt);
    }
    publish();
  }
  return {start,enqueue,retry,discard,merge,pump,snapshot:()=>entries, stop:()=>{active=false;clearInterval(timer);}};
}

// Match each receipt once, within the acknowledged turn, including repeated identical messages.
const deliveryTurns = new WeakMap();
export function deliveryView(thread, receipts) {
  const turns = [...(thread?.turns || [])];
  const annotations = new Map();
  const used = new Set();
  for (const receipt of receipts) {
    if(receipt.mappingOnly)continue;
    let match;
    const matches = item => {
      const content=item.content || [];
      if(receipt.itemId && item.id!==receipt.itemId)return false;
      if(receipt.text && content.find(c=>c.type==="text")?.text!==receipt.text)return false;
      return (receipt.attachments || []).every(file=>content.some(c=>(c.path || c.text || "").includes(file.path)));
    };
    for (const turn of turns) {
      if (!receipt.turnId || turn.id !== receipt.turnId) continue;
      match = turn.items?.find(item=>item.type==='userMessage' && !used.has(item)
        && matches(item));
      if(match){used.add(match);
        if(!annotations.has(turn))annotations.set(turn,new Map());
        annotations.get(turn).set(match,receipt);break;}
    }
    if (!match) turns.push({id:'delivery-'+receipt.clientMessageId,deliveryOnly:true,
      startedAt:receipt.createdAt,status:'pending',items:[{id:receipt.clientMessageId,type:'userMessage',delivery:receipt,
        content:[...(receipt.text?[{type:'text',text:receipt.text}]:[]),...(receipt.attachments || []).map(f=>({type:'attachment',path:f.path}))]}]});
  }
  return turns.map(turn=>{
    const matches=annotations.get(turn);
    if(!matches)return turn;
    const signature=JSON.stringify([...matches].map(([item,receipt])=>[item.id,receipt]));
    const cached=deliveryTurns.get(turn);
    if(cached?.signature===signature)return cached.turn;
    const annotated={...turn,items:turn.items.map(item=>matches.has(item)?{...item,delivery:{...matches.get(item)}}:item)};
    deliveryTurns.set(turn,{signature,turn:annotated});
    return annotated;
  });
}
