// Shared parsing/catalog contract. Provider names and arguments are data, never shell code.
export function slashCommand(text) {
  const match = /^\/([\p{L}\p{N}_:.-]+)(?=\s|$)([\s\S]*)$/u.exec(text || '');
  return match ? {name:match[1], argument:match[2].trim(), suffix:match[2]} : null;
}

export function goalAction(argument) {
  if (!argument || argument === 'status') return 'get';
  if (['clear','stop','off','reset','none','cancel'].includes(argument)) return 'clear';
  if (['pause','resume'].includes(argument)) return argument;
  if (argument === 'edit') throw Error('Zum Ändern /goal gefolgt vom neuen Ziel eingeben.');
  return 'set';
}

export function commandCatalog(workerId, nativeCommands, skills = []) {
  const commands = new Map();
  const add = command => {
    if (typeof command?.name !== 'string' || slashCommand('/'+command.name)?.name !== command.name || commands.has(command.name)) return;
    commands.set(command.name, command);
  };
  if (workerId === 'codex') {
    add({name:'goal',description:'Ziel setzen, anzeigen, pausieren oder beenden',input:{hint:'Ziel | pause | resume | clear'}});
    add({name:'plan',description:'Planungsmodus',input:{hint:'Aufgabe (optional)'}});
    add({name:'compact',description:'Gesprächskontext komprimieren'});
    for (const skill of skills) if (skill.enabled && skill.path) add({name:skill.name,description:skill.interface?.shortDescription || skill.shortDescription || skill.description,input:{hint:'Aufgabe'},skillPath:skill.path});
  } else {
    for (const command of nativeCommands || []) add(command);
    // Claude supports /goal in non-interactive prompts as well as its terminal.
    if (workerId === 'claw-code' && nativeCommands === undefined) add({name:'goal',description:'Bis zum erreichten Ziel weiterarbeiten',input:{hint:'Ziel | clear'}});
  }
  if (commands.has('goal')) add({name:'ziel',description:'Alias für /goal',input:commands.get('goal').input});
  return [...commands.values()];
}

export function canonicalCommand(text) {
  const command = slashCommand(text);
  return command?.name === 'ziel' ? '/goal'+command.suffix : text;
}

export function codexTurnCommand(text, commands) {
  const command = slashCommand(canonicalCommand(text));
  if (!command) return null;
  if (command.name === 'goal') {
    if (goalAction(command.argument) === 'resume') return {resume:true};
    if (goalAction(command.argument) !== 'set') throw Error('Diesen Zielbefehl über die Befehlseingabe im ruhenden Chat ausführen.');
    if ([...command.argument].length > 4000) throw Error('Ein Ziel darf höchstens 4.000 Zeichen enthalten.');
    return {objective:command.argument};
  }
  if (command.name === 'plan') {
    if (!command.argument) throw Error('/plan ohne Aufgabe wechselt nur den Modus im Composer.');
    return {mode:'plan'};
  }
  const skill = commands.find(c => c.name === command.name && c.skillPath);
  if (skill) return {skill:{type:'skill',name:skill.name,path:skill.skillPath}};
  throw Error(`/${command.name} ist über diesen Codex-Anschluss nicht ausführbar. Die Befehlsauswahl zeigt die angeschlossenen Befehle; reine Terminalbefehle benötigen die native CLI.`);
}

export async function codexControl(call, threadId, text) {
  const command = slashCommand(canonicalCommand(text));
  if (command?.name === 'compact' && !command.argument) {
    await call('thread/compact/start',{threadId});
    return {message:'Komprimierung gestartet.'};
  }
  if (command?.name !== 'goal') throw Error('Kein unterstützter Steuerbefehl.');
  const action = goalAction(command.argument);
  if (action === 'set' || action === 'resume') throw Error('Ein neues Ziel oder dessen Fortsetzung wird über die normale Nachrichtenübergabe gestartet.');
  if (action === 'clear') {
    const result = await call('thread/goal/clear',{threadId});
    return {goal:null,message:result.cleared ? 'Ziel beendet.' : 'Kein aktives Ziel.'};
  }
  const result = action === 'get'
    ? await call('thread/goal/get',{threadId})
    : await call('thread/goal/set',{threadId,status:action === 'pause' ? 'paused' : 'active'});
  return {goal:result.goal,message:goalMessage(result.goal)};
}

export function goalMessage(goal) {
  if (!goal) return 'Kein aktives Ziel.';
  const status = {active:'Aktiv',paused:'Pausiert',complete:'Erreicht',blocked:'Blockiert',usageLimited:'Nutzungslimit erreicht',budgetLimited:'Budget erreicht'}[goal.status] || goal.status;
  return `${status}: ${goal.objective}`;
}
