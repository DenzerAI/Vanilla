import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const git=(...args)=>{const r=spawnSync('git',args,{encoding:'utf8'});if(r.status)throw Error(r.stderr||'Git check failed');return r.stdout.trim();};
const root=git('rev-parse','--show-toplevel');process.chdir(root);
const mode=process.argv[2]||'commit';
const paths=['wrapper','scripts/verify-design-adoption.mjs','.github/workflows/design.yml','.githooks'];
if(mode==='push'){
 const refs=readFileSync(0,'utf8').trim().split('\n').filter(Boolean);
 for(const ref of refs){const[,sha]=ref.split(' ');if(/^0+$/.test(sha))continue;if(sha!==git('rev-parse','HEAD'))throw Error('Design gate: push the checked-out revision so its exact source can be verified.');}
 if(git('status','--porcelain','--',...paths))throw Error('Design gate: commit or isolate outstanding UI changes before checking the revision to push.');
}else{
 const changed=git('diff','--cached','--name-only');
 if(!changed.split('\n').some(f=>/^(wrapper\/|\.githooks\/|\.github\/workflows\/design|scripts\/.*design)/.test(f)))process.exit(0);
 if(git('diff','--name-only','--',...paths))throw Error('Design gate: staged and working UI differ. Stage the intended complete change or use an isolated worktree before verification.');
}
const result=spawnSync('npm',['--prefix','wrapper','run','design:verify'],{stdio:'inherit',cwd:root});process.exit(result.status??1);
