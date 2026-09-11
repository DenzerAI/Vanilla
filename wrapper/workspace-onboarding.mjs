import path from 'node:path';
export function workspaceOnboardingInstructions(project,root){
  return '\n\nWorkspace-Einrichtung: '+project.id+'. Führe ein kurzes Gespräch, eine oder zwei fehlende Angaben pro Schritt. Lies zuerst die bereits geladenen Firmen- und Workspace-Quellen. Vorhandene Angaben nicht erneut abfragen.\n'
    +'Kläre in dieser Reihenfolge: 1. Wofür wird dieser Workspace verwendet? 2. Was sollst du hier besonders beachten? 3. Welche Unterlagen und bestehenden Skills werden gebraucht? 4. Welche wiederkehrenden Abläufe und Ergebnisse sind gewünscht? Unvollständige Angaben dürfen als offene Punkte bleiben.\n'
    +'Pflege '+path.join(root,project.path,'AGENTS.md')+' anhand der Antworten. Vor jedem Schreiben den aktuellen Stand lesen und eigene bestehende Abschnitte erhalten. YAML-Kopf: schema_version: 1, unverändert id: '+project.id+', name, description, status (draft oder ready), optional icon und color. Name bezeichnet das Thema, nicht die Assistentenidentität. Der Text darunter enthält Aufgabe, Bereichsvorgaben, Arbeitsweise, Wissen und Skills sowie offene Punkte.\n'
    +'Grundlegende Spezialisierung bleibt hier. Verlinke vorhandene Skills. Nur ein tatsächlich beauftragter wiederverwendbarer Ablauf erhält eine eigene skills/<name>/SKILL.md, samt Verweis hier. Keine Kopien gemeinsamer Firmenregeln. Sobald Zweck und wesentliche Besonderheiten feststehen, darf status ready gesetzt werden. Offene optionale Anschlüsse bleiben benannt. Das startet keinen Auftrag und keinen Zeitplan. Am Ende nur tatsächlich gespeicherte Inhalte zusammenfassen.';
}
export function workspaceOnboardingOpener({store,newChat,sendTurn,emit,updateChat,canUseChat=async()=>true}){
  const pending=new Map(),byProject=new Map();
  return function open({projectId,requestId,worker='auto',model,effort}={}){
    const key=projectId||requestId;
    if(typeof key!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(key))throw Error('Ungültige Einrichtungsanfrage.');
    if(pending.has(key))return pending.get(key);
    const work=(async()=>{
      const project=projectId?store.project(projectId):await store.workspaces.create({requestId});
      if(byProject.has(project.id))return byProject.get(project.id);
      const setup=(async()=>{
      await store.workspaces.context(project.id);
      emit({method:'wrapper/projects'});
      const existing=store.state.chats.find(c=>c.workspaceOnboarding===project.id&&!c.channelOnly);
      if(existing){
        if(!await canUseChat(existing))throw Error('Der Einrichtungschat ist privat. Bitte im ursprünglichen Chat fortsetzen.');
        if(existing.archived)await updateChat(existing.id,{archived:false});
        return {project,thread:{id:existing.id},resumed:true};
      }
      const result=await newChat({title:'Workspace einrichten',worker,model,projectId:project.id,cwd:await store.projectRoot(project.id),mode:'default',permission:'workspace'});
      const chat=store.chat(result.thread.id);chat.workspaceOnboarding=project.id;
      await store.save();emit({method:'wrapper/chats'});
      try{await sendTurn(chat.id,{text:'Hilf mir, diesen Workspace einzurichten. Lass uns mit seinem Zweck beginnen.',...(effort?{effort}:{})});}
      catch{return {project,thread:{id:chat.id},startError:'Der Einrichtungschat ist angelegt. Bitte dort den Verlauf prüfen und fortsetzen.'};}
      return {project,thread:{id:chat.id},resumed:false};
      })().finally(()=>byProject.delete(project.id));
      byProject.set(project.id,setup);return setup;
    })().finally(()=>pending.delete(key));
    pending.set(key,work);return work;
  };
}
