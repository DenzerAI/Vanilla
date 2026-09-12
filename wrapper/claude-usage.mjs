import {installationEnvironment,workerEnvironment} from './worker-environment.mjs';
/** Native, read-only control request. No prompt, model call, tools or stored chat. */
export async function readClaudeUsage({dataRoot,cwd,queryFactory,environment=process.env}) {
 const query=queryFactory || (await import('@anthropic-ai/claude-agent-sdk')).query;
 // SDK launches must use the same installation profile as the ACP worker.
 // Explicitly unset inherited keys as SDK versions may merge their environment.
 const env={...Object.fromEntries(Object.keys(environment).map(key=>[key,undefined])),
  ...workerEnvironment(environment),...await installationEnvironment(dataRoot, 'claw-code', environment)};
 async function read(env){
 let release;const idle=new Promise(resolve=>release=resolve);
 async function* input(){await idle;}
 const abortController=new AbortController();
 const q=query({prompt:input(),options:{cwd,env,persistSession:false,settingSources:[],tools:[],mcpServers:{},abortController}});
 let timer;
 try{return await Promise.race([(async()=>{await q.initializationResult();const result=await q.usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET();return result;})(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Nutzungsabfrage hat zu lange gedauert.')),15000);})]);}
 finally{clearTimeout(timer);release();abortController.abort();q.close();}
 }
 const result=await read(env);
 if(result.rate_limits_available||!env.CLAUDE_CODE_OAUTH_TOKEN)return result;
 // A service token can run models without user:profile. Read the explicitly
 // signed-in installation profile for allowances without changing model auth.
 const profile=await read({...env,CLAUDE_CODE_OAUTH_TOKEN:undefined});
 return profile.rate_limits_available?profile:{...profile,unavailableReason:'profile_required'};
}
