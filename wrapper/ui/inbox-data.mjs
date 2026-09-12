export function inboxConversation(row, messages = []) {
  return {...row, sender:(row.sender||'').replace(/\s*<[^>]+>$/, '').replace(/^"|"$/g, '') || row.sender, account:row.address, provider:({gmail:'Gmail',outlook:'Outlook',whatsapp:'WhatsApp','telegram-user':'Telegram'})[row.provider]||row.provider,
    time:new Date(row.updated).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}),
    unread:row.revision>row.seen, done:!!row.done, messages};
}

// Each thread has one sequence. A conflict stops it instead of silently replacing
// a draft written by another browser or worker. Navigating never changes its ID.
export class InboxDrafts {
  constructor(api, projectId, changed=()=>{}) {Object.assign(this,{api,projectId,changed});this.records=new Map();}
  load(id, draft) {
    if (!this.records.has(id)) this.records.set(id,{...draft,saved:draft.text,serial:Promise.resolve(),error:null});
    const record=this.records.get(id);
    if(record.text===record.saved) Object.assign(record,draft,{saved:draft.text});
    return record;
  }
  edit(id, text) {
    const record=this.records.get(id);
    if (!record) throw Error('Entwurf zuerst laden.');
    record.text=text;
    record.serial=record.serial.then(async()=>{
      if (record.error || record.saved===record.text) return;
      const text=record.text;
      try {
        const saved=await this.api(id.startsWith('msg:')?'/messenger/draft':'/inbox/draft',{id,projectId:this.projectId,text,version:record.version,revision:record.revision});
        record.version=saved.version;record.saved=text;
      } catch(error) {record.error=error.message || 'Entwurf konnte nicht gespeichert werden.';}
      this.changed();
    });
    this.changed();return record.serial;
  }
  get pending() {return [...this.records.values()].some(r=>r.text!==r.saved);}
}

const draftStores=new Map();
export function inboxDraftStore(api,projectId,changed) {
  // Survives switching app sections; only the server stores saved message text.
  const key=projectId;
  if(!draftStores.has(key))draftStores.set(key,new InboxDrafts(api,projectId,changed));
  const store=draftStores.get(key);store.changed=changed;return store;
}

if(typeof window!=='undefined')window.addEventListener('beforeunload',event=>{
  if([...draftStores.values()].some(store=>store.pending)){event.preventDefault();event.returnValue='';}
});
