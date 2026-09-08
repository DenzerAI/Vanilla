#!/usr/bin/env node
import { createInterface } from 'node:readline';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const file = process.env.DELIVERY_FIXTURE_STATE;
let state = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { threads: {}, calls: [] };
const save = () => writeFileSync(file, JSON.stringify(state));
const output = obj => process.stdout.write(JSON.stringify(obj) + '\n');
const event = (method, params) => output({method,params});
function finish(thread, turn) {
  if(turn.status !== 'inProgress') return;
  turn.status='completed';save();event('item/completed',{threadId:thread.id,turnId:turn.id,item:{id:'tool-'+turn.id,type:'commandExecution',status:'completed',command:'fixture tool'}});
  event('turn/completed',{threadId:thread.id,turn});
}
setInterval(()=>{if(existsSync(file+'.release'))for(const thread of Object.values(state.threads))for(const turn of thread.turns)finish(thread,turn);},30).unref();
createInterface({input:process.stdin}).on('line',line=>{
  const {id,method,params:p={}}=JSON.parse(line); if(id===undefined)return;
  const reply=result=>output({id,result});
  if(method==='initialize')return reply({userAgent:'fixture'});
  if(method==='model/list')return reply({data:[{id:'fixture',model:'fixture',displayName:'Fixture',isDefault:true,supportedReasoningEfforts:[]}]});
  if(method==='thread/start') {const thread={id:'chat-'+Object.keys(state.threads).length,turns:[],model:'fixture',cwd:p.cwd};state.threads[thread.id]=thread;save();return reply({thread,model:'fixture'});}
  const thread=state.threads[p.threadId];
  if(method==='thread/read'||method==='thread/resume')return reply({thread});
  if(method==='turn/start'||method==='turn/steer') {
    state.calls.push({method,params:p});
    let turn;
    if(method==='turn/steer') {
      turn=thread.turns.find(t=>t.id===p.expectedTurnId&&t.status==='inProgress');
      if(!turn)return output({id,error:{code:-32602,message:'No active turn'}});
    } else {turn={id:'turn-'+state.calls.length,status:'inProgress',items:[]};thread.turns.push(turn);event('turn/started',{threadId:thread.id,turn});}
    const item={id:'input-'+state.calls.length,type:'userMessage',content:p.input};turn.items.push(item);save();event('item/completed',{threadId:thread.id,turnId:turn.id,item});
    const text=p.input.map(i=>i.text||'').join('');
    if(text==='disconnect')return process.exit(1);
    if(text==='tool')event('item/started',{threadId:thread.id,turnId:turn.id,item:{id:'tool-'+turn.id,type:'commandExecution',status:'inProgress',command:'fixture tool'}});
    if(text==='fast') {finish(thread,turn);return setTimeout(()=>reply({turn}),50);}
    reply(method==='turn/steer'?{turnId:turn.id}:{turn});
    if(method==='turn/start'&&text!=='tool')setTimeout(()=>finish(thread,turn),40);
    return;
  }
  reply({data:[]});
});
