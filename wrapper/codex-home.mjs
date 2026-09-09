import {mkdir,realpath} from 'node:fs/promises';

// Native profiles are provisioned by the installation-scoped login command.
// Keeping this boundary explicit prevents a future caller from reviving the old
// host-account, plugin and rollout import path.
export async function prepareCodexHome({home,sourceHome=null}) {
  if(sourceHome)throw Error('Fremde Codex-Profile werden nicht importiert. Den Worker für diese Installation anmelden.');
  await mkdir(home,{recursive:true,mode:0o700});
  return {home:await realpath(home),config:{},imported:[]};
}
