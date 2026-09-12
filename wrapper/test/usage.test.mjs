import test from 'node:test';
import assert from 'node:assert/strict';
import {codexAllowance,claudeAllowance,allowanceReader,claudeTurnUsage,recordUsage,addTokens,featuredAllowances,remainingPercent} from '../usage.mjs';
import {summarizeStatistics} from '../ui/statistics-data.mjs';
import {readClaudeUsage} from '../claude-usage.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('Claude allowance control uses its installation profile and closes without sending a prompt',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'allowance-installation-'));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 let received,closed=false;
 const environment={PATH:'/bin',HOME:'/foreign-home',CLAUDE_CONFIG_DIR:'/foreign-claude',ANTHROPIC_API_KEY:'synthetic-foreign-key',HTTPS_PROXY:'synthetic-foreign-proxy'};
 const response={rate_limits_available:false};
 const queryFactory=input=>{received=input;return {initializationResult:async()=>({}),usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET:async()=>response,close:()=>{closed=true;}};};
 assert.equal(await readClaudeUsage({dataRoot:dir,cwd:dir,environment,queryFactory}),response);
 const {options,prompt}=received;
 assert.ok(options.env.CLAUDE_CONFIG_DIR.endsWith('/claude'));
 assert.notEqual(options.env.CLAUDE_CONFIG_DIR,environment.CLAUDE_CONFIG_DIR);
 assert.ok(options.env.HOME.endsWith('/worker-home'));
 assert.equal(options.env.ANTHROPIC_API_KEY,undefined);assert.equal(options.env.HTTPS_PROXY,undefined);
 assert.equal(options.env.PATH,'/bin');assert.equal(options.persistSession,false);
 assert.deepEqual(options.tools,[]);assert.deepEqual(options.mcpServers,{});
 assert.equal((await prompt.next()).done,true);assert.equal(options.abortController.signal.aborted,true);assert.equal(closed,true);
});
test('keeps native percentages, all buckets, reset times and earned credits; excludes account identity',()=>{
 const d=codexAllowance({accountId:'private',rateLimitsByLimitId:{a:{limitName:'A',primary:{usedPercent:30,windowDurationMins:10080,resetsAt:900}},b:{limitName:'B',primary:{usedPercent:0,windowDurationMins:300,resetsAt:1200}}},rateLimitResetCredits:{availableCount:1,credits:[{id:'private'}]}},1000000);
 assert.equal(d.rows.length,2);assert.equal(d.rows[0].expired,true);assert.equal(d.rows[1].usedPercent,0);assert.equal(d.resetCredits,1);assert.ok(!JSON.stringify(d).includes('private'));
});
test('Claude preserves named model windows, nullable limits and extra usage without inventing an allowance',()=>{
 const d=claudeAllowance({rate_limits_available:true,rate_limits:{five_hour:{utilization:0,resets_at:'2026-09-12T00:00:00Z'},seven_day_opus:{utilization:55,resets_at:null},model_scoped:[{display_name:'Fable',utilization:24,resets_at:null}],extra_usage:{is_enabled:true,monthly_limit:null,used_credits:0}}});
 assert.deepEqual(d.rows.map(r=>r.usedPercent),[0,55,24]);assert.equal(d.extra.limit,null);assert.equal(claudeAllowance({rate_limits_available:false}).status,'unavailable');
});
test('shared reader coalesces requests and keeps stale observations on independent provider failure',async()=>{
 let now=100,calls=0,fail=false;
 const read=allowanceReader({now:()=>now,ttl:60,enabled:()=>['codex','claw-code'],readCodex:async()=>{calls++;if(fail)throw Error('secret');return {rateLimits:{primary:{usedPercent:7}}};},readClaude:async()=>({rate_limits_available:false})});
 const [a,b]=await Promise.all([read(),read()]);assert.equal(a,b);assert.equal(calls,1);await read();assert.equal(calls,1);now=170;fail=true;
 const c=await read();assert.equal(c.providers[0].rows[0].usedPercent,7);assert.equal(c.providers[0].status,'error');assert.equal(c.providers[1].status,'unavailable');assert.ok(!JSON.stringify(c).includes('secret'));
});
test('native counters count updates once and do not turn missing fields or rewinds into spend',()=>{
 const c={tokenUsage:{total:{inputTokens:0,outputTokens:0,totalTokens:0}}};recordUsage(c,{turnId:'one',tokenUsage:{total:{inputTokens:10,outputTokens:2,totalTokens:12}}},'codex');
 recordUsage(c,{turnId:'one',tokenUsage:{total:{inputTokens:20,outputTokens:4,totalTokens:24}}},'codex');
 recordUsage(c,{turnId:'one',tokenUsage:{total:{inputTokens:20,outputTokens:4,totalTokens:24}}},'codex');
 assert.equal(c.statisticsTurns.one.usage.total.totalTokens,24);assert.equal(c.statisticsTurns.one.usage.total.cacheCreationInputTokens,null);
 recordUsage(c,{turnId:'two',tokenUsage:{total:{totalTokens:5}}},'codex');assert.equal(c.statisticsTurns.two.usage,undefined);
});
test('Claude model accounting stays separate from the main loop; reasoning is unknown not zero',()=>{
 const u=claudeTurnUsage({_meta:{quota:{token_count:{totalTokens:10,inputTokens:1,outputTokens:2,cachedInputTokens:3,cachedWriteTokens:4,reasoningOutputTokens:0},model_usage:[{model:'Fable',token_count:{totalTokens:30}}]}}});
 assert.equal(u.total.cacheCreationInputTokens,4);assert.equal(u.total.reasoningOutputTokens,null);assert.equal(u.models[0].tokens.totalTokens,30);assert.equal(u.total.totalTokens,10);assert.equal(claudeTurnUsage({}),null);
 const c={};const p={turnId:'one',tokenUsage:{total:u.total,turn:u}};recordUsage(c,p,'claw-code');recordUsage(c,p,'claw-code');assert.equal(c.statisticsTurns.one.usage.total.totalTokens,10);
});
test('dated turn usage supports period totals without fabricating legacy historical spend',()=>{
 const data={generatedAt:Date.parse('2026-09-11T12:00:00Z'),timeZone:'Europe/Berlin',tokens:500,usage:{totalTokens:500},events:[{day:'2026-09-11',hour:10,session:'x',messages:2,model:'A',workerId:'codex',usage:{total:{totalTokens:20,inputTokens:15,outputTokens:5}}},{day:'2026-01-01',hour:10,session:'x',messages:2,model:'B'}]};
 const week=summarizeStatistics(data,7);assert.equal(week.tokens,20);assert.equal(week.usageTurns,1);assert.equal(summarizeStatistics(data).tokens,500);assert.equal(week.usageModels[0].name,'A');assert.equal(addTokens({},{}).inputTokens,null);
});

test('a legacy session without a baseline does not attribute its historical cumulative total to today',()=>{
 const chat={};recordUsage(chat,{turnId:'now',tokenUsage:{total:{totalTokens:1000000,inputTokens:800000,outputTokens:200000}}},'codex');
 assert.equal(chat.statisticsTurns.now.usage,undefined);assert.equal(chat.tokenUsage.total.totalTokens,1000000);
});

test('the real ACP adapter forwards native turn counters and preserves context updates',async()=>{
 const {ACPWorker}=await import('../acp-worker.mjs');const {EventEmitter}=await import('node:events');
 const rpc=new EventEmitter();rpc.call=async()=>({_meta:{quota:{token_count:{totalTokens:12,inputTokens:10,outputTokens:2},model_usage:[]}},stopReason:'end_turn'});
 const thread={id:'t',workerId:'claw-code',workerSession:{sessionId:'s'},turns:[]};
 const worker=new ACPWorker({id:'claw-code',name:'Claude Code',rpc,readThread:async()=>thread,persist:async()=>{}});
 worker.start=async()=>{};worker.threads.set('t',thread);worker.sessions.set('s','t');
 const events=[];worker.on('notification',e=>events.push(e));
 const done=new Promise(resolve=>worker.on('notification',e=>{if(e.method==='turn/completed')resolve();}));
 await worker.call('turn/start',{threadId:'t',input:[{type:'text',text:'fixture'}]});await done;
 assert.equal(events.find(e=>e.method==='thread/tokenUsage/updated').params.tokenUsage.turn.total.inputTokens,10);
 assert.equal(thread.turns[0].usage.total.totalTokens,12);
 worker.receive({method:'session/update',params:{sessionId:'s',update:{sessionUpdate:'usage_update',used:45,size:100,cost:{amount:1.2,currency:'USD'}}}});
 assert.equal(thread.workerSession.usage.contextUsed,45);assert.equal(thread.workerSession.usage.cost,1.2);
});

test('the card features the working allowances, week first, then fills spare rows with additional windows',()=>{
 const now=Date.now();
 const codex=codexAllowance({rateLimitsByLimitId:{
  codex:{limitName:'Codex',primary:{usedPercent:73,resetsAt:now/1000+600,windowDurationMins:10080},secondary:{usedPercent:12,resetsAt:now/1000+600,windowDurationMins:300}},
  codex_bengalfox:{limitName:'GPT-5.3-Codex-Spark',primary:{usedPercent:0,resetsAt:now/1000+600,windowDurationMins:300}}}},now);
 const claude=claudeAllowance({rate_limits_available:true,rate_limits:{seven_day:{utilization:40,resets_at:new Date(now+600000).toISOString()},seven_day_oauth_apps:{utilization:90,resets_at:new Date(now+600000).toISOString()}}},now);
 const featured=featuredAllowances([codex,claude]);
 assert.deepEqual(featured.map(r=>r.label),['Codex · Woche','Claude · Woche','Codex · 5 Stunden','GPT-5.3-Codex-Spark · 5 Stunden']);
 assert.ok(!featured.some(r=>/Apps/.test(r.label)));
 assert.equal(remainingPercent(featured[0],now),27);
 assert.equal(remainingPercent({...featured[0],expired:true},now),null);
 const legacy=featuredAllowances([{id:'codex',rows:[{id:'codex_x:primary',label:'Spark · Woche',usedPercent:0},{id:'codex:primary',label:'Codex · Woche',usedPercent:50}]}]);
 assert.deepEqual(legacy.map(r=>r.label),['Codex · Woche','Spark · Woche']);
});

test('Claude reports the missing subscription profile without exposing authentication data',()=>{
 const result=claudeAllowance({rate_limits_available:false,unavailableReason:'profile_required'});
 assert.equal(result.unavailableReason,'profile_required');
 assert.equal(result.status,'unavailable');
 assert.deepEqual(result.rows,[]);
});

test('four main windows keep both providers visible ahead of model-specific allowances',()=>{
 const now=Date.now(),reset=new Date(now+600000).toISOString();
 const codex=codexAllowance({rateLimitsByLimitId:{codex:{primary:{usedPercent:20,windowDurationMins:300},secondary:{usedPercent:40,windowDurationMins:10080}},spark:{primary:{usedPercent:0,windowDurationMins:300}}}},now);
 const claude=claudeAllowance({rate_limits_available:true,rate_limits:{five_hour:{utilization:12,resets_at:reset},seven_day:{utilization:55,resets_at:reset}}},now);
 const rows=featuredAllowances([codex,claude]);
 assert.deepEqual(rows.map(r=>[r.provider,r.period]),[['codex','week'],['claw-code','week'],['codex','short'],['claw-code','short']]);
 assert.deepEqual(rows.map(r=>remainingPercent(r,now)),[60,45,80,88]);
});
