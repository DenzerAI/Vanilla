import React, {useEffect,useRef,useState} from 'react';
import {ComposerFocus} from './composer-focus';
import {IconButton} from './icon-button';
import {ArrowUp,Plus,Mic,Square,X} from './icons.jsx';
import {holdMicrophone} from './speech-playback.mjs';
import {saveInboxRecording,loadInboxRecording} from './inbox-recording.mjs';

export function InboxComposer({text,onText,onSend,onFile,disabled,busy,messenger,attachment,reply,onClearAttachment,onClearReply,threadId}:any) {
  const input=useRef<HTMLTextAreaElement>(null),file=useRef<HTMLInputElement>(null),recorder=useRef<MediaRecorder|null>(null);
  const [recording,setRecording]=useState(false),[issue,setIssue]=useState(''),[recovery,setRecovery]=useState<Blob|null>(null);
  const mounted=useRef(true),pendingMic=useRef(false);
  const activeThread=useRef(threadId);activeThread.current=threadId;
  useEffect(()=>{let alive=true;mounted.current=true;setRecovery(null);void loadInboxRecording(threadId).then((blob:Blob|null)=>{if(alive)setRecovery(blob);}).catch(()=>{});return()=>{alive=false;mounted.current=false;if(recorder.current?.state==='recording')recorder.current.stop();};},[threadId]);
  useEffect(()=>{const field=input.current;if(!field)return;const resize=()=>{field.style.height='0px';field.style.height=Math.min(field.scrollHeight,180)+'px';};resize();const observer=new ResizeObserver(resize);observer.observe(field);return()=>observer.disconnect();},[text]);
  async function record(){
    if(recorder.current){recorder.current.stop();return;}
    if(pendingMic.current)return;pendingMic.current=true;
    const owner=threadId;let stream:MediaStream|null=null;const release=holdMicrophone(Symbol());
    try{
      await loadInboxRecording(owner); // Durable browser storage must be available before capture.
      stream=await navigator.mediaDevices.getUserMedia({audio:true});
      if(!mounted.current||activeThread.current!==owner){stream.getTracks().forEach(t=>t.stop());release();return;}
      const type=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4'].find(t=>MediaRecorder.isTypeSupported(t));
      const r=new MediaRecorder(stream,type?{mimeType:type}:undefined);recorder.current=r;
      const chunks:Blob[]=[];let writes=Promise.resolve();
      r.ondataavailable=e=>{if(e.data.size){chunks.push(e.data);const blob=new Blob(chunks,{type:r.mimeType});writes=writes.then(()=>saveInboxRecording(owner,blob)).catch(()=>{setIssue('Aufnahme bitte vor dem Verlassen herunterladen.');});}};
      r.onstop=()=>{stream?.getTracks().forEach(t=>t.stop());release();recorder.current=null;setRecording(false);void writes.then(()=>{if(activeThread.current===owner)setRecovery(new Blob(chunks,{type:r.mimeType}));});};
      r.start(1000);setRecording(true);setIssue('');
    }catch(e:any){stream?.getTracks().forEach(t=>t.stop());release();setIssue(e.message||'Mikrofon nicht verfügbar.');}finally{pendingMic.current=false;}
  }
  return <div className="inbox-compose-inner">
    {issue&&<p role="alert">{issue}</p>}
    {reply&&<div className="inbox-reply"><span>Antwort auf {reply.sender}: {reply.text || 'Nachricht'}</span><IconButton label="Antwortbezug entfernen" onClick={onClearReply}><X size={16}/></IconButton></div>}
    {attachment&&<div className="inbox-reply"><span>{attachment.name}</span><IconButton label="Anhang entfernen" onClick={onClearAttachment}><X size={16}/></IconButton></div>}
    {recovery&&<div className="inbox-reply"><span>Gespeicherte Sprachnachricht</span><button type="button" disabled={busy} onClick={async()=>{try{await onFile(new File([recovery],'Sprachnachricht.webm',{type:recovery.type}),true);setRecovery(null);}catch(e:any){setIssue(e.message);}}}>Anhängen</button><button type="button" onClick={()=>{const url=URL.createObjectURL(recovery);const a=document.createElement('a');a.href=url;a.download='Sprachnachricht.webm';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}}>Herunterladen</button></div>}
    <ComposerFocus active multiple={false} onActivate={()=>{}}>
      {messenger&&<IconButton label="Datei anhängen" disabled={disabled||busy||recording} onClick={()=>file.current?.click()}><Plus size={21}/></IconButton>}
      <textarea ref={input} aria-label="Antwortentwurf" rows={1} wrap="soft" placeholder={recording?'Sprachnachricht wird aufgenommen …':'Nachricht'} value={text} disabled={disabled||recording} onChange={e=>onText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing&&!busy&&!disabled){e.preventDefault();onSend();}}}/>
      {messenger&&<IconButton label={recording?'Aufnahme beenden':'Sprachnachricht aufnehmen'} disabled={disabled||busy} onClick={()=>void record()}>{recording?<Square size={19}/>:<Mic size={19}/>}</IconButton>}
      <button className="send-button" type="button" aria-label="Nachricht senden" disabled={disabled||busy||recording||(!text.trim()&&!attachment)} onClick={onSend}><ArrowUp size={21}/></button>
    </ComposerFocus>
    <input ref={file} hidden type="file" onChange={async e=>{const f=e.target.files?.[0];e.target.value='';if(f)try{await onFile(f,false);}catch(error:any){setIssue(error.message);}}}/>
  </div>;
}
