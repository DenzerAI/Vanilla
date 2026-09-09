export const weatherInterval=600000;
export function weatherLabel(code) {
 if(code===0)return 'Klar';
 if(code===1)return 'Überwiegend klar';
 if(code===2)return 'Teilweise bewölkt';
 if(code===3)return 'Bedeckt';
 if([45,48].includes(code))return 'Nebel';
 if([51,53,55,56,57].includes(code))return 'Nieselregen';
 if([61,63,65,66,67].includes(code))return 'Regen';
 if([71,73,75,77,85,86].includes(code))return 'Schnee';
 if([80,81,82].includes(code))return 'Regenschauer';
 if([95,96,99].includes(code))return 'Gewitter';
 return 'Wetter';
}
export async function loadWeather(api,profile) {
 if(!profile.location)return Promise.resolve({status:'unset'});
 let point=profile.point;
 if(!point){
  try {
   const {items}=await api('/weather/locations?q='+encodeURIComponent(profile.location));
   const exact=items.filter(p=>p.label.toLocaleLowerCase('de')===profile.location.toLocaleLowerCase('de')||p.label.split(',')[0].toLocaleLowerCase('de')===profile.location.toLocaleLowerCase('de'));
   if(exact.length!==1)return {status:'unresolved'};
   point=exact[0];
  }catch{return {status:'error'};}
 }
 const {latitude,longitude}=point;
 return api('/weather/current?'+new URLSearchParams({latitude,longitude})).then(value=>({status:'ready',...value})).catch(()=>({status:'error'}));
}
export function weatherDescription(weather) {
 if(weather?.status==='ready')return `${Math.round(weather.temperature)} °C · ${weatherLabel(weather.code)}`;
 if(weather?.status==='error')return 'Wetter konnte nicht geladen werden. Bitte erneut versuchen.';
 if(weather?.status==='unresolved')return 'Bitte bestätige deinen Ort in der Ortssuche.';
 return 'Wetter wird geladen …';
}
