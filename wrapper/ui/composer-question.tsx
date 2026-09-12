import {useEffect, useId, useRef, useState} from 'react';
import {questionRequest, questionResult, questionValue} from '../worker-questions.mjs';
import './composer-question.css';

type Answer = {text?:string; selected?:unknown[]};
type Draft = {index:number; answers:Record<string,Answer>; error?:string};
const empty:Draft = {index:0, answers:{}};

export function useComposerQuestion(requests:any[], chatId:string, onReply:(id:any,result:any)=>Promise<void>) {
  const [drafts, setDrafts] = useState<Record<string,Draft>>({});
  const [pending, setPending] = useState<string | null>(null);
  const lock = useRef(false);
  const liveRequests=useRef(requests);liveRequests.current=requests;
  const request = requests.find(r => r.params?.threadId === chatId && questionRequest(r));
  const key = request ? `${request.workerId || ''}:${request.id}` : '';
  const model = request && questionRequest(request);
  const draft = drafts[key] || empty;
  const question = model?.questions[draft.index];
  const answer = draft.answers[question?.id] || {};
  useEffect(() => {
    const keys = new Set(requests.map(r => `${r.workerId || ''}:${r.id}`));
    setDrafts(old => Object.keys(old).some(k => !keys.has(k)) ? Object.fromEntries(Object.entries(old).filter(([k]) => keys.has(k))) : old);
  }, [requests]);
  function update(change:Partial<Draft>) { setDrafts(old => ({...old,[key]:{...(old[key] || empty), ...change}})); }
  function setText(text:string) { update({answers:{...draft.answers,[question.id]:{text,selected:[]}},error:''}); }
  function appendText(text:string) {
    if(!question || !liveRequests.current.some(r=>`${r.workerId || ''}:${r.id}`===key))return false;
    setDrafts(old=>{
      const saved=old[key] || empty,answer=saved.answers[question.id];
      return {...old,[key]:{...saved,answers:{...saved.answers,[question.id]:{text:answer?.text ? answer.text+'\n'+text : text,selected:[]}},error:''}};
    });
    return true;
  }
  function select(value:unknown) {
    const selected = question.multi ? (answer.selected || []).includes(value)
      ? answer.selected!.filter(v => v !== value) : [...(answer.selected || []),value] : [value];
    update({answers:{...draft.answers,[question.id]:{selected,text:''}},error:''});
  }
  async function submit(text = answer.text || '') {
    if (!request || !model || lock.current) return;
    const answers:Record<string,Answer> = {...draft.answers,[question.id]:{...answer,text}};
    try {
      questionValue(question, answers[question.id]);
      if (draft.index < model.questions.length - 1) { update({answers,index:draft.index+1,error:''}); return; }
      // Back navigation may have left another required question unanswered.
      for (let i=0; i<model.questions.length; i++) {
        try { questionValue(model.questions[i],answers[model.questions[i].id]); }
        catch (e) { update({answers,index:i}); throw e; }
      }
      const result = questionResult(model,answers);
      lock.current = true; setPending(key); update({answers,error:''});
      await onReply(request.id,result);
    } catch (e) { update({error:e instanceof Error ? e.message : 'Antwort konnte nicht gesendet werden.'}); }
    finally { lock.current = false; setPending(null); }
  }
  let valid = false;
  if (question) { try { questionValue(question,answer); valid = true; } catch { /* The field stays editable. */ } }
  return {request,model,question,answer,index:draft.index,error:draft.error,text:answer.text || '',setText,appendText,select,submit,
    pending:pending === key, canSend:valid && pending === null,
    previous:()=>update({index:Math.max(0,draft.index-1),error:''}),
    next:()=>update({index:Math.min(model.questions.length-1,draft.index+1),error:''})};
}

export function ComposerQuestion({state,onActivate}: {state:ReturnType<typeof useComposerQuestion>; onActivate?:()=>void}) {
  const id = useId();
  if (!state.question) return null;
  const {question:q,answer,model,index,pending} = state;
  return <section className="composer-question" aria-labelledby={id} aria-busy={pending}
    onPointerDownCapture={onActivate} onFocusCapture={onActivate}>
    <div className="composer-question-handle" aria-hidden="true" />
    <div className="composer-question-status">
      <span role="status">{pending ? 'Antwort wird gesendet …' : model.kind === 'codex-async' ? 'Deine Antwort ist noch offen' : 'Wartet auf deine Antwort'}</span>
      {model.questions.length > 1 && <nav aria-label="Rückfragen">
        <button type="button" aria-label="Vorherige Frage" disabled={pending || index === 0} onClick={state.previous}>‹</button>
        <span>{index+1} / {model.questions.length}</span>
        <button type="button" aria-label="Nächste Frage" disabled={pending || index === model.questions.length-1} onClick={state.next}>›</button>
      </nav>}
    </div>
    <p id={id} className="composer-question-title">{q.question}</p>
    {!!q.options.length && <fieldset disabled={pending} className="composer-question-options" aria-labelledby={id}>
      {q.options.map((option:any,i:number) => <label className="composer-question-option" key={i}>
        <input type={q.multi ? 'checkbox' : 'radio'} name={id} checked={(answer.selected || []).includes(option.value)}
          onChange={()=>state.select(option.value)} />
        <span><span>{option.label}</span>{option.description && <small>{option.description}</small>}</span>
      </label>)}
    </fieldset>}
    {state.error && <p className="composer-question-error" role="alert">{state.error}</p>}
  </section>;
}

const example = {id:'example',method:'item/tool/requestUserInput',params:{threadId:'example-chat',questions:[{id:'scope',question:'Welchen Bereich soll ich zuerst bearbeiten?',options:[{label:'Oberfläche',description:'Aufbau und Bedienung verfeinern.'},{label:'Funktionen',description:'Den Ablauf im Hintergrund ergänzen.'}]}]}};
export function ComposerQuestionPreview() {
  const [requests,setRequests] = useState<any[]>([example]);
  const [reply,setReply] = useState('');
  const state = useComposerQuestion(requests,'example-chat',async(_,result)=>{setReply(result.answers.scope.answers[0]);setRequests([]);});
  return <div className="composer-question-preview">
    <ComposerQuestion state={state}/>
    {state.request ? <form onSubmit={e=>{e.preventDefault();void state.submit();}} className="composer-entry">
      <textarea aria-label="Sonstiges zur Beispielfrage" placeholder="Sonstiges" rows={1} value={state.text} onChange={e=>state.setText(e.target.value)}/>
      <button type="submit" disabled={!state.canSend}>Senden</button>
    </form> : <><p role="status">Deine Antwort: {reply}</p><button type="button" onClick={()=>{setReply('');setRequests([example]);}}>Beispiel zurücksetzen</button></>}
  </div>;
}
