import React, {useEffect, useId, useRef, useState} from 'react';
import {commandCatalog} from '../worker-commands.mjs';
import './composer-question.css';
import './composer-commands.css';

type Command = {name:string;description?:string;input?:{hint?:string}};
export function useComposerCommands({text,workerId,chatId,projectId,nativeCommands,enabled,api,onSelect}:any) {
  const id = useId();
  const [dismissed,setDismissed] = useState<string|null>(null);
  const [index,setIndex] = useState(0);
  const [remote,setRemote] = useState<{key:string;commands:Command[]}|null>(null);
  const [error,setError] = useState('');
  const [loading,setLoading] = useState(false);
  const [revision,setRevision] = useState(0);
  const key = `${workerId}:${chatId || projectId}`;
  const open = enabled && /^\/[\p{L}\p{N}_:.-]*$/u.test(text) && dismissed !== text;
  useEffect(()=>{setIndex(0);setDismissed(null);},[key]);
  useEffect(()=>{setIndex(0);setDismissed(null);},[text]);
  useEffect(()=>{
    if (!open) return;
    let current = true;
    setLoading(true);setError('');
    const query = new URLSearchParams({workerId,projectId:projectId || 'default',...(chatId && !chatId.startsWith('outbox-') ? {id:chatId} : {})});
    api('/worker-commands?'+query).then((result:any)=>{
      if(current){setRemote({key,commands:result.commands});setError(result.notice || '');}
    }).catch((error:Error)=>{if(current)setError(error.message);}).finally(()=>{if(current)setLoading(false);});
    return ()=>{current=false;};
  },[open,key,revision]);
  const catalog:Command[] = workerId !== 'codex' && nativeCommands !== undefined
    ? commandCatalog(workerId,nativeCommands)
    : remote?.key === key ? remote.commands : commandCatalog(workerId,undefined);
  const query = text.slice(1).toLocaleLowerCase();
  const commands = catalog.filter(c=>`${c.name} ${c.description || ''}`.toLocaleLowerCase().includes(query));
  const selected = Math.min(index,Math.max(0,commands.length-1));
  const select = (command:Command) => {onSelect('/'+command.name+' ');setDismissed(text);};
  const onKeyDown = (event:React.KeyboardEvent) => {
    if(!open || event.nativeEvent.isComposing)return false;
    if(event.key==='Escape'){event.preventDefault();setDismissed(text);return true;}
    if(!commands.length)return false;
    if(['ArrowDown','ArrowUp'].includes(event.key)){
      event.preventDefault();setIndex((selected+(event.key==='ArrowDown'?1:-1)+commands.length)%commands.length);return true;
    }
    if((event.key==='Enter' && !event.shiftKey) || (event.key==='Tab' && !event.shiftKey)) {event.preventDefault();select(commands[selected]);return true;}
    return false;
  };
  return {id,open,commands,selected,select,onKeyDown,loading,error,retry:()=>setRevision(n=>n+1)};
}

export function ComposerCommands({state}: {state:ReturnType<typeof useComposerCommands>}) {
  const list = useRef<HTMLDivElement>(null);
  useEffect(()=>{list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({block:'nearest'});},[state.selected]);
  if(!state.open)return null;
  return <section className="composer-question composer-commands" aria-label="Slash-Befehle">
    <div className="composer-question-status"><span>{state.loading?'Befehle werden geladen …':'Befehle'}</span><button type="button" onClick={state.retry} disabled={state.loading}>Neu laden</button></div>
    <div role="listbox" aria-label="Verfügbare Befehle" id={state.id} ref={list}>
      {state.commands.map((command,i)=><button type="button" role="option" aria-selected={state.selected===i} id={`${state.id}-${i}`} key={command.name}
        className="composer-question-option composer-command" onClick={()=>state.select(command)}>
        <span><span>/{command.name}</span><small>{command.description}{command.input?.hint ? ` · ${command.input.hint}` : ''}</small></span>
      </button>)}
    </div>
    {!state.commands.length && !state.loading && <p className="composer-question-title">Keine passenden Befehle gemeldet.</p>}
    {state.error && <p className="composer-question-title" role="status">{state.error}</p>}
  </section>;
}

export function ComposerCommandController({controlRef,inputRef,...props}:any) {
  const state=useComposerCommands(props);
  useEffect(()=>{controlRef.current=state;return()=>{controlRef.current=null;};});
  useEffect(()=>{
    const input=inputRef.current;
    if(!input)return;
    if(state.open){
      input.setAttribute('aria-controls',state.id);
      if(state.commands.length)input.setAttribute('aria-activedescendant',`${state.id}-${state.selected}`);
    }
    return()=>{input.removeAttribute('aria-controls');input.removeAttribute('aria-activedescendant');};
  },[state.open,state.id,state.selected,state.commands.length,inputRef]);
  return <ComposerCommands state={state}/>;
}

export function ComposerCommandsPreview() {
  const [text,setText] = useState('/');
  const state = useComposerCommands({text,workerId:'codex',projectId:'example',enabled:true,onSelect:setText,
    api:async()=>({commands:commandCatalog('codex',undefined,[{name:'beispiel',description:'Dynamisch geladener Beispiel-Skill',path:'/example/SKILL.md',enabled:true}])})});
  return <div className="composer-question-preview"><ComposerCommands state={state}/><textarea aria-label="Slash-Befehle ausprobieren" value={text} onChange={e=>setText(e.target.value)} onKeyDown={state.onKeyDown}/></div>;
}
