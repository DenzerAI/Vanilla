// Targets reuse existing connections and allowlists. This module never starts receivers.
import {createHash} from 'node:crypto';
const targetId = (connectionId, recipient) => createHash('sha256').update(JSON.stringify([connectionId,recipient])).digest('hex');
export function notificationTargets(services, channels) {
  const targets=[];
  for (const c of services.list()) {
    if (!['telegram','whatsapp-local'].includes(c.provider)) continue;
    for (const recipient of c.config.allowedUsers || []) {
      const session=Object.values(channels.state.sessions).find(s=>s.connectionId===c.id && s.sender===String(recipient));
      const ready=c.provider==='telegram' ? !!c.secretId && !!c.checkedAt : channels.status(c.id).runtimeStatus==='running' && !!session;
      targets.push({id:targetId(c.id,String(recipient)),label:`${c.name} · ${recipient}`,ready,connectionId:c.id,recipient:String(recipient),chatId:session?.chatId||String(recipient),provider:c.provider});
    }
  }
  return targets;
}
export async function sendJobNotification(services,channels,{target,text}) {
  const destination=notificationTargets(services,channels).find(t=>t.id===target && t.ready);
  if (!destination) return {status:'failed',error:'Verbindung oder Empfänger ist nicht mehr bereit. Ergebnis in der App verfügbar.'};
  const c=services.get(destination.connectionId);
  try {
    if(c.provider==='telegram') await channels.sendTelegram(c,destination.chatId,text);
    else await channels.live.get(c.id).send(destination.chatId,text);
    return {status:'sent'};
  } catch {
    return {status:'unknown',error:'Zustellung unbestätigt. Kein automatischer Doppelversand; Ergebnis in der App öffnen.'};
  }
}

export function routineInstructions(projectId) {
  return `\n\nRoutinen aus dem Chat: Aktuelles projectId ist ${JSON.stringify(projectId)}. Bei ausdrücklich beauftragten regelmäßigen Aufgaben oder Erinnerungen routine_capabilities und die routine-Werkzeuge des gemeinsamen MCP-Anschlusses verwenden. Vor Aktivierung benötigte Datenquellen und Werkzeuge prüfen. Arbeitsanweisung eigenständig mit benötigten Quellen und gewünschtem Ergebnis formulieren; spätere Läufe kennen diesen Chat nicht. Das in routine_capabilities gelieferte gespeicherte Benachrichtigungsziel gilt als Standard, sonst App. Externe Zustellung nur an ein vom Nutzer gewähltes, tatsächlich bereites Ziel. Eine explizite wiederkehrende Versandbeauftragung gilt für diese Routine, nicht für andere Empfänger oder Inhalte. Fehlende Zeit oder Empfänger kurz erfragen. Nur einen bestätigten Werkzeugerfolg als eingerichtet melden, mit nächstem Termin, Zeitzone und Benachrichtigungsziel. Bei fehlendem Werkzeug keine Ersatz-Crondateien oder vermeintliche Zusagen. Ändern und Pausieren über routine_list/routine_update. System läuft nur bei wachem Host und aktivem Dienst; Browser darf für externe Zustellung geschlossen sein.`;
}
