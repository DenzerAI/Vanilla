// Keep captured voice notes until explicitly replaced; attachment/send failure
// never deletes the recording. Separate from PCM dictation's storage contract.
function database(){return new Promise((resolve,reject)=>{const r=indexedDB.open('agent-inbox-recordings',1);r.onupgradeneeded=()=>r.result.createObjectStore('recordings');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function saveInboxRecording(id,blob){const db=await database();try{await new Promise((resolve,reject)=>{const tx=db.transaction('recordings','readwrite');tx.objectStore('recordings').put(blob,id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}finally{db.close();}}
export async function loadInboxRecording(id){const db=await database();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('recordings');const r=tx.objectStore('recordings').get(id);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);});}finally{db.close();}}
