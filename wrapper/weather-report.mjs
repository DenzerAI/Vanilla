import {readUserProfile} from './ui/user-profile.mjs';
import {weatherLabel} from './ui/weather-client.mjs';

const plain=value=>String(value||'').replace(/[\r\n|<>`\[\]*_#]/g,' ').slice(0,100);
const number=(value,unit='')=>Number.isFinite(value)?new Intl.NumberFormat('de-DE',{maximumFractionDigits:1}).format(value)+unit:'–';
export function weatherReportText(location,forecast) {
 const local=(time,options)=>new Intl.DateTimeFormat('de-DE',{timeZone:forecast.timezone,...options}).format(time);
 const clock=time=>local(time,{hour:'2-digit',minute:'2-digit'});
 const day=time=>local(time,{weekday:'short',day:'2-digit',month:'2-digit'});
 const current=`${number(forecast.temperature,' °C')} · ${weatherLabel(forecast.code)}`;
 const rows=forecast.daily.map(d=>`| ${day(d.time)} | ${weatherLabel(d.code)} | ${number(d.low,'°')} / ${number(d.high,'°')} | ${number(d.probability,' %')} | ${number(d.precipitation,' mm')} | ${number(d.gusts,' km/h')} |`);
 const hours=forecast.hourly.filter((_,i)=>i%3===0).slice(0,8).map(h=>`| ${day(h.time)}, ${clock(h.time)} | ${number(h.temperature,'°')} | ${weatherLabel(h.code)} | ${number(h.probability,' %')} |`);
 return `# Wetter für ${plain(location)}\n\n${local(forecast.time,{dateStyle:'medium',timeStyle:'short'})} · Ortszeit (${forecast.timezone})\n\n**Jetzt: ${current}.** Gefühlt ${number(forecast.feelsLike,' °C')}. Wind ${number(forecast.wind,' km/h')}, Böen ${number(forecast.gusts,' km/h')}.\n\n**Sieben Tage ab heute**\n\n| Tag | Wetter | Tief / Hoch | Niederschlag möglich | Menge | Böen bis |\n| --- | --- | --- | --- | --- | --- |\n${rows.join('\n')}\n\n${hours.length?'**Die nächsten Stunden**\n\n| Ortszeit | Temperatur | Wetter | Niederschlag möglich |\n| --- | --- | --- | --- |\n'+hours.join('\n')+'\n\n':''}Vorhersagen können sich ändern, besonders zum Ende der Woche. „–“ bedeutet: kein Wert geliefert.\n\nQuelle: [Open-Meteo](https://open-meteo.com/) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) · Abgerufen ${local(forecast.fetchedAt,{dateStyle:'medium',timeStyle:'short'})}. Werte gerundet und als Bericht aufbereitet. Amtliche Unwetterwarnungen sind hier nicht angebunden.`;
}

export function weatherSummaryPrompt(location) {
 return `Ordne den gerade angezeigten Wetterbericht für ${plain(location)} kurz für mich ein. Nutze die konkreten Wetterwerte und den Datenstand aus dem Bericht. Beginne mit heute und morgen, danach ein kurzer Ausblick auf die Woche. Nenne höchstens drei praktische Hinweise, etwa zu Regen, Wind oder Frost, nur soweit die Werte das tragen. Wenn im Kontext dieses Workspaces bereits passende persönliche Pläne, Termine oder Baustellenarbeiten bekannt sind, beziehe nur diese gezielt ein. Lies bei Bedarf gezielt die relevanten Quellen dieses Workspaces; suche nicht pauschal in anderen Workspaces oder nach privaten Daten. Erfinde keine Baustelle, Tätigkeit, Person, Empfindlichkeit oder Termine. Übertrage den Wetterort nicht auf eine Baustelle mit unbekanntem oder anderem Standort. Gibt es keinen passenden Kontext, genügt eine allgemeine Einordnung ohne Rückfrage. Tageswerte rechtfertigen keine stundengenaue Regenankündigung. Wiederhole die Sieben-Tage-Tabelle nicht. Trenne Vorhersage und praktische Einschätzung; keine Arbeitsfreigaben oder behaupteten amtlichen Warnungen. Lege keine Routine an und versende nichts an Dritte.`;
}

// A click creates a new conversation. Retries of that click retain the same report.
export function weatherChatOpener({store,weather,readProfile,openBriefing,sendTurn,isRestarting=()=>false}) {
 const pending=new Map();
 return async function open(input) {
  if(!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(input.requestId||''))throw Error('Ungültige Wetteranfrage.');
  if(isRestarting())throw Error('Der Server wird neu gestartet. Bitte kurz warten.');
  const projectId=input.projectId||'default';
  await store.projectRoot(projectId);
  const id=`weather-${projectId}-${input.requestId}`;
  if(pending.has(id))return pending.get(id);
  const work=(async()=>{
   let chat=store.state.chats.find(c=>c.briefingId===id),result;
   if(chat?.weatherReportReady){const existing=await openBriefing({id});return {...existing,meta:chat,summaryError:chat.weatherSummaryError||''};}
   let profileText;
   try{profileText=await readProfile();}catch(error){if(error.code==='ENOENT')throw Error('Bitte richte zuerst deinen Wetterort ein.');throw error;}
   const profile=readUserProfile(profileText);
   if(!profile.location)throw Error('Bitte richte zuerst deinen Wetterort ein.');
   let point=profile.point;
   if(!point){
    const {items}=await weather.search(profile.location);
    const exact=items.filter(p=>p.label.toLocaleLowerCase('de')===profile.location.toLocaleLowerCase('de')||p.label.split(',')[0].toLocaleLowerCase('de')===profile.location.toLocaleLowerCase('de'));
    if(exact.length!==1)throw Error('Bitte bestätige deinen Wetterort im Profil.');
    point=exact[0];
   }
   const forecast=await weather.forecast(point.latitude,point.longitude);
   result=await openBriefing({id,kind:'weather',title:`Wetter · ${plain(profile.location)}`,body:weatherReportText(profile.location,forecast),created_at:forecast.fetchedAt/1000,projectId},input.selection);
   chat=store.chat(result.thread.id);
   // Persist before dispatch: an ambiguous network failure must not auto-send twice.
   chat.weatherReportReady=true;
   chat.weatherSummaryError='Die persönliche Einordnung wurde noch nicht bestätigt. Du kannst im Wetterchat nachfragen.';
   await store.save();
   try{await sendTurn(chat.id,{text:weatherSummaryPrompt(profile.location)});chat.weatherSummaryError='';}
   catch{chat.weatherSummaryError='Der Wetterbericht ist da. Die persönliche Einordnung konnte nicht gestartet werden; du kannst im Wetterchat nachfragen.';}
   await store.save();
   return {...result,meta:chat,summaryError:chat.weatherSummaryError};
  })().finally(()=>pending.delete(id));
  pending.set(id,work);
  return work;
 };
}
