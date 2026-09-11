import {slashCommand,canonicalCommand,goalAction} from '../worker-commands.mjs';

export async function submitComposerCommand(text,context) {
  const {workerId,running,chatId,sameWorker,attachments,api,setMode,setBusy,notify,report,currentId,clearDraft}=context;
  const command=slashCommand(canonicalCommand(text));
  if(!command)return false;
  const action=workerId==='codex' && command.name==='goal' ? goalAction(command.argument) : null;
  if(running && !(workerId==='codex' && ['get','pause','clear'].includes(action))) {
    report('Bitte die laufende Antwort vor einem Slash-Befehl abwarten oder stoppen.');return true;
  }
  if(workerId!=='codex')return false;
  if(command.name==='plan') {
    setMode('plan');
    if(!command.argument){clearDraft();notify('Planungsmodus aktiviert.');return true;}
  }
  if(command.name!=='compact' && !(action && !['set','resume'].includes(action)))return false;
  if(attachments.length){report('Diesen Steuerbefehl bitte ohne Anhänge senden.');return true;}
  if(!chatId || chatId.startsWith('outbox-')){report('Dafür zuerst eine Nachricht in diesem Chat senden.');return true;}
  if(!sameWorker){report('Diesen Befehl erst nach dem vorgemerkten Anbieterwechsel ausführen.');return true;}
  setBusy(true);
  try {
    const result=await api('/worker-command',{id:chatId,workerId,text});
    if(currentId()===chatId){clearDraft();notify(result.message);}
  } finally {setBusy(false);}
  return true;
}
