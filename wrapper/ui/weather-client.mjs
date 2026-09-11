export const weatherInterval=600000;
export function weatherLabel(code) {
 if(code===0)return 'Klar';
 if(code===1)return 'Überwiegend klar';
 if(code===2)return 'Teilweise bewölkt';
 if(code===3)return 'Bedeckt';
 if(code===45)return 'Nebel';
 if(code===48)return 'Reifnebel';
 if([56,57,66,67].includes(code))return 'Gefrierender Regen';
 if([51,53,55].includes(code))return 'Nieselregen';
 if([61,63,65].includes(code))return 'Regen';
 if([71,73,75,77,85,86].includes(code))return 'Schnee';
 if([80,81,82].includes(code))return 'Regenschauer';
 if([96,99].includes(code))return 'Gewitter mit Hagel';
 if(code===95)return 'Gewitter';
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

/** Weather codes describe conditions, never an official warning. */
export function weatherScene(weather) {
 if(weather?.status!=='ready')return 'unavailable';
 const c=weather.code;
 if([95,96,99].includes(c))return 'storm';
 if([71,73,75,77,85,86].includes(c))return 'snow';
 if([56,57,66,67].includes(c))return 'ice';
 if([51,53,55,61,63,65,80,81,82].includes(c))return 'rain';
 if([45,48].includes(c))return 'fog';
 if(![0,1,2,3].includes(c))return 'unavailable';
 if(weather.temperature<=0&&c<=1)return 'frost';
 if(c===3)return 'cloudy';
 if(c===1||c===2)return 'partly';
 return 'sunny';
}

/** Solar times are UTC milliseconds for the selected location, not the device timezone. */
export function weatherDaylight(weather, now=Date.now()) {
 const {sunrise, sunset}=weather||{};
 if(Number.isFinite(sunrise)&&Number.isFinite(sunset)&&sunset>sunrise&&now>sunrise-12*3600000&&now<sunset+12*3600000){
  const hour=3600000, progress=Math.max(0,Math.min(1,(now-sunrise)/(sunset-sunrise)));
  const phase=now<sunrise-hour?'night':now<sunrise?'dawn':now<sunrise+hour?'morning':now<sunset-hour?'day':now<sunset?'sunset':now<sunset+hour?'dusk':'night';
  return {phase,night:now<sunrise||now>=sunset,sunX:22+progress*62,sunY:58-Math.sin(progress*Math.PI)*50};
 }
 return {phase:weather?.isDay===false?'night':weather?.isDay===true?'day':'unknown',night:weather?.isDay===false,sunX:76,sunY:12};
}
