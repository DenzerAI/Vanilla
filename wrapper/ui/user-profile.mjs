export const userProfilePath = 'soul/USER.md';
export const emptyUserProfile = '# Dein Profil\n\nAnzeigename: \nWetterort: \n';
export function readUserProfile(source) {
 const coordinates=source.match(/^Wetterkoordinaten:[ \t]*(-?[\d.]+),[ \t]*(-?[\d.]+)[ \t]*$/m);
 const point=coordinates?{latitude:Number(coordinates[1]),longitude:Number(coordinates[2])}:null;
 return {...(point&&Number.isFinite(point.latitude)&&Math.abs(point.latitude)<=90&&Number.isFinite(point.longitude)&&Math.abs(point.longitude)<=180?{point}:{}),name:source.match(/^Anzeigename:[ \t]*(.*)$/m)?.[1]?.trim()||'',location:source.match(/^Wetterort:[ \t]*(.*)$/m)?.[1]?.trim()||''};
}
export function writeUserProfile(source,profile) {
 let result=source;
 for(const [key,label] of [['name','Anzeigename'],['location','Wetterort']]) {
  const value=String(profile[key]||'').trim();
  if(/[\r\n]/.test(value)||value.length>100)throw Error('Bitte verwende höchstens 100 Zeichen ohne Zeilenumbruch.');
  const line=label+': '+value,pattern=new RegExp('^'+label+':[^\\r\\n]*','m');
  result=pattern.test(result)?result.replace(pattern,()=>line):result.trimEnd()+'\n\n'+line+'\n';
 }
 const point=profile.point;
 if(point&&(!Number.isFinite(point.latitude)||Math.abs(point.latitude)>90||!Number.isFinite(point.longitude)||Math.abs(point.longitude)>180))throw Error('Ungültiger Wetterort.');
 result=result.replace(/^Wetterkoordinaten:[^\r\n]*(?:\r?\n|$)/m,'');
 if(profile.location&&point)result=result.trimEnd()+'\n\nWetterkoordinaten: '+point.latitude+', '+point.longitude+'\n';
 return result;
}
export async function saveUserProfile(api,source,profile) {
 const save=async()=>{
  const current=await api('/file/text?path='+encodeURIComponent(userProfilePath));
  if(current.text!==source)throw Error('Dein Profil wurde inzwischen geändert. Bitte lade den aktuellen Stand neu; dein Entwurf bleibt hier erhalten.');
  const text=writeUserProfile(source,profile);
  await api('/file/save',{path:userProfilePath,text});
  globalThis.window?.dispatchEvent(new Event('user-profile-saved'));
  return text;
 };
 return globalThis.navigator?.locks?globalThis.navigator.locks.request('agent-user-profile',save):save();
}
