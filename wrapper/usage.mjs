/** Native counters stay separate from account allowance percentages. */
export const tokenFields=['totalTokens','inputTokens','outputTokens','cachedInputTokens','cacheCreationInputTokens','reasoningOutputTokens'];
export const count=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null;
export function tokens(value={}) {return Object.fromEntries(tokenFields.map(k=>[k,count(value?.[k])]));}
export function addTokens(a={},b={}) {return Object.fromEntries(tokenFields.map(k=>[k,count(a[k])===null&&count(b[k])===null?null:(count(a[k])??0)+(count(b[k])??0)]));}
export function claudeTurnUsage(result) {
 const q=result?._meta?.quota;
 const fromNative=v=>tokens({...v,cacheCreationInputTokens:v?.cachedWriteTokens??v?.cacheCreationInputTokens,reasoningOutputTokens:null});
 if(!q?.token_count)return null;
 return {total:fromNative(q.token_count),models:(q.model_usage||[]).slice(0,100).map(m=>({model:String(m.model).slice(0,150),tokens:fromNative(m.token_count)}))};
}
export function recordUsage(chat,p,workerId,now=Date.now()) {
 const prior=chat.tokenUsage?.total||chat.usageBaseline, total=tokens(p.tokenUsage?.total);
 if(p.turnId){
  const turns=chat.statisticsTurns??={}, turn=turns[p.turnId]??={};
  if(p.tokenUsage?.turn)turn.usage=p.tokenUsage.turn;
  else if(prior){
   const delta=Object.fromEntries(tokenFields.map(k=>[k,total[k]===null||prior&&count(prior[k])===null?null:total[k]-(prior?.[k]??0)]));
   if(Object.values(delta).every(n=>n===null||n>=0))turn.usage={total:addTokens(turn.usage?.total,delta),partial:turn.usagePartial===true};
   else turn.usagePartial=true;
  }
  if(!prior&&!p.tokenUsage?.turn)turn.usagePartial=true;
  turn.workerId=workerId;turn.usageUpdatedAt=now;
 }
 delete chat.usageBaseline;
 chat.tokenUsage={...p.tokenUsage,total,updatedAt:now,workerId};
}
const label=v=>String(v||'').slice(0,150);
function windowRow(id,name,value,now,claude=false,{primary=false,period=null}={}){
 if(!value)return null;
 const percent=count(claude?value.utilization:value.usedPercent);
 const raw=claude?Date.parse(value.resets_at):count(value.resetsAt)===null?NaN:value.resetsAt*1000;
 const resetAt=Number.isFinite(raw)?raw:null;
 if(percent===null)return null;
 return {id,label:name,usedPercent:percent,resetAt,expired:resetAt!==null&&resetAt<=now,primary,period};
}
export function codexAllowance(data,now=Date.now()) {
 const buckets=data.rateLimitsByLimitId||{codex:data.rateLimits};
 const rows=[];
 for(const [id,b] of Object.entries(buckets)){
  if(!b)continue;
  for(const key of ['primary','secondary']){
   const w=b[key];if(!w)continue;
   const minutes=count(w.windowDurationMins),period=minutes===10080?'Woche':minutes===300?'5 Stunden':minutes?`${minutes} Minuten`:key==='primary'?'Kontingent':'Weiteres Kontingent';
   const row=windowRow(`${id}:${key}`,`${label(b.limitName)||'Codex'} · ${period}`,w,now,false,{primary:id==='codex',period:minutes===10080?'week':minutes===300?'short':null});if(row)rows.push(row);
  }
 }
 const credits=Object.entries(buckets).filter(([,b])=>b?.credits).map(([id,b])=>({label:label(b.limitName)||label(id),balance:b.credits.balance==null?null:label(b.credits.balance),unlimited:b.credits.unlimited===true}));
 return {id:'codex',name:'Codex',status:rows.length?'ready':'unavailable',rows,credits,resetCredits:count(data.rateLimitResetCredits?.availableCount),updatedAt:now};
}
export function claudeAllowance(data,now=Date.now()) {
 const limits=data.rate_limits,rows=[];
 for(const [key,name,shape] of [['five_hour','Claude · 5 Stunden',{primary:true,period:'short'}],['seven_day','Claude · Woche',{primary:true,period:'week'}],['seven_day_oauth_apps','Claude · Apps',{}],['seven_day_opus','Opus · Woche',{period:'week'}],['seven_day_sonnet','Sonnet · Woche',{period:'week'}]]){
  if((limits?.model_scoped||[]).some(m=>`${label(m.display_name)} · Woche`===name))continue;
  const row=windowRow(key,name,limits?.[key],now,true,shape);if(row)rows.push(row);
 }
 for(const [i,m] of (limits?.model_scoped||[]).entries()){const row=windowRow(`model:${i}`,`${label(m.display_name)} · Woche`,m,now,true,{period:'week'});if(row)rows.push(row);}
 const extra=limits?.extra_usage;
 return {id:'claw-code',name:'Claude Code',status:data.rate_limits_available&&rows.length?'ready':'unavailable',rows,experimental:true,updatedAt:now,extra:extra?{enabled:extra.is_enabled===true,limit:count(extra.monthly_limit),used:count(extra.used_credits),percent:count(extra.utilization),currency:label(extra.currency)||null}:null};
}
/** Coalesce all panes. Failed refreshes retain the last observation, marked stale. */
export function allowanceReader({readCodex,readClaude,enabled,now=Date.now,ttl=60000}){
 let cached=null,at=0,pending=null;
 return async()=>{
  if(cached&&now()-at<ttl)return cached;
  if(pending)return pending;
  pending=(async()=>{
   const ids=['codex','claw-code'].filter(id=>enabled().includes(id));
   const providers=await Promise.all(ids.map(async id=>{
    try{return id==='codex'?codexAllowance(await readCodex(),now()):claudeAllowance(await readClaude(),now());}
    catch {const previous=cached?.providers.find(p=>p.id===id);return {...previous,id,name:id==='codex'?'Codex':'Claude Code',status:'error',stale:!!previous,rows:previous?.rows||[],message:'Kontingent konnte nicht aktualisiert werden.'};}
   }));at=now();cached={providers,updatedAt:at};return cached;
  })().finally(()=>pending=null);return pending;
 };
}

/** The compact card shows the allowances that carry real work: one main window
 * per provider, the week first. Side buckets stay in the details. */
export function featuredAllowances(providers=[],limit=3) {
 const picked=[];
 for(const provider of providers){
  const own=(provider.rows||[]).filter(r=>r.primary).map(r=>({...r,provider:provider.id}));
  const week=own.find(r=>r.period==='week'), short=own.find(r=>r.period==='short');
  for(const row of [week,short].filter(Boolean))picked.push(row);
 }
 const weeks=picked.filter(r=>r.period==='week'), rest=picked.filter(r=>r.period!=='week');
 return [...weeks,...rest].slice(0,limit);
}
export function remainingPercent(row,now=Date.now()) {
 if(!row || row.expired || (row.resetAt!==null&&row.resetAt<=now))return null;
 return Math.max(0,Math.min(100,100-row.usedPercent));
}
