export function voiceOptions(profiles=[], voices=[], selected='') {
  const options=new Map();
  for(const v of [...profiles,...voices]) if(!options.has(v.id)) options.set(v.id,v);
  if(selected && !options.has(selected)) options.set(selected,{id:selected,name:selected});
  return [...options.values()];
}
