// Deliver each optional result as soon as it arrives. A slow source cannot hide others.
export function loadStartData(api, enabled, receive) {
  const sources=[['jobs','/jobs'],['profile','/file/text?path=soul%2FUSER.md']];
  if(enabled)sources.push(['reports','/planner/results']);
  return Promise.all(sources.map(async([key,url])=>{
    try {receive(key,{value:await api(url)});}
    catch(error) {receive(key,{error});}
  }));
}
