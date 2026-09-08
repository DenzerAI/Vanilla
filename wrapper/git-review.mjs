import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const execute = promisify(execFile);
async function git(cwd, args) {
  const {stdout} = await execute('/usr/bin/git', ['--no-pager', ...args], {cwd,timeout:10000,maxBuffer:2*1024*1024,env:{...process.env,GIT_OPTIONAL_LOCKS:'0'}});
  return stdout;
}
export async function gitReview(cwd) {
  try { await git(cwd,['rev-parse','--show-toplevel']); }
  catch(e) { if(e.stderr?.includes('not a git repository')) return {repository:false,files:[]}; throw e; }
  const branch = (await git(cwd,['branch','--show-current'])).trim() || 'HEAD (losgelöst)';
  const status = await git(cwd,['status','--porcelain=v1','-z','--untracked-files=normal','--','.']);
  const entries = status.split('\0'), files = [];
  let truncated = false, remaining = 250000;
  for(let i=0; i<entries.length; i++) {
    if(!entries[i]) continue;
    const state=entries[i].slice(0,2), name=entries[i].slice(3);
    if(/[RC]/.test(state)) i++;
    if(files.length>=100) {truncated=true;break;}
    const file={status:state,path:name};
    const literal=':(top,literal)'+name;
    if(state!=='??' && remaining>0) {
      for(const [key,args] of [['staged',['--cached']],['unstaged',[]]]) {
        const output=await git(cwd,['diff','--no-ext-diff','--no-textconv','--no-color',...args,'--',literal]);
        file[key]=output.slice(0,remaining);
        if(output.length>remaining) truncated=true;
        remaining=Math.max(0,remaining-output.length);
      }
    } else if(state!=='??') truncated=true;
    files.push(file);
  }
  return {repository:true,branch,files,truncated};
}
