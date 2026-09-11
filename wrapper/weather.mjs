// Public Open-Meteo APIs; city search uses GeoNames, not postal address validation.
export function createWeatherService({fetcher=fetch,now=Date.now}={}) {
 const cache=new Map(),pending=new Map();
 async function get(url,ttl) {
  const hit=cache.get(url);if(hit&&now()-hit.at<ttl)return hit.value;
  if(pending.has(url))return pending.get(url);
  const request=(async()=>{
   try {
    const response=await fetcher(url,{signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw Error('Dienst nicht erreichbar');
    const value=await response.json();if(value.error)throw Error('Ungültige Antwort');
    if(cache.size>=200)cache.delete(cache.keys().next().value);
    cache.set(url,{at:now(),value});return value;
   } catch {throw Error('Open-Meteo ist gerade nicht erreichbar. Bitte erneut versuchen.');}
   finally {pending.delete(url);}
  })();pending.set(url,request);return request;
 }
 return {
  async search(query) {
   const name=String(query||'').trim();if(name.length<2)return {items:[]};
   if(name.length>100)throw Error('Bitte einen kürzeren Ortsnamen eingeben.');
   const data=await get('https://geocoding-api.open-meteo.com/v1/search?'+new URLSearchParams({name,count:'8',language:'de',format:'json'}),3600000);
   return {items:(data.results||[]).filter(p=>Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)).map(p=>({id:p.id,label:[...new Set([p.name,p.admin1,p.country].filter(Boolean))].join(', '),latitude:p.latitude,longitude:p.longitude}))};
  },
  current: (latitude,longitude)=>forecast(latitude,longitude,1),
  forecast: (latitude,longitude)=>forecast(latitude,longitude,7),
 };
 async function forecast(latitude,longitude,days) {
   if(latitude===null||longitude===null||latitude===''||longitude==='')throw Error('Bitte einen Ort aus der Suche auswählen.');
   const lat=Number(latitude),lon=Number(longitude);
   if(!Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lon)||Math.abs(lon)>180)throw Error('Ungültiger Wetterort.');
   const query={latitude:String(lat),longitude:String(lon),current:'temperature_2m,weather_code,is_day,apparent_temperature,wind_speed_10m,wind_gusts_10m',daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_gusts_10m_max,sunrise,sunset',timezone:'auto',timeformat:'unixtime',forecast_days:String(days)};
   if(days===7)query.hourly='temperature_2m,weather_code,precipitation_probability,precipitation,wind_gusts_10m';
   const data=await get('https://api.open-meteo.com/v1/forecast?'+new URLSearchParams(query),days===7?0:600000);
   const c=data.current;
   if(!c||!Number.isFinite(c.temperature_2m)||!Number.isFinite(c.weather_code)||!Number.isFinite(c.time))throw Error('Die Wetterquelle liefert gerade keine vollständigen Daten.');
   if(Math.abs(now()-c.time*1000)>3600000)throw Error('Die Wetterquelle liefert gerade keine aktuellen Daten.');
   const optional=value=>Number.isFinite(value)?value:null;
   const current={sunrise:Number.isFinite(data.daily?.sunrise?.[0])?data.daily.sunrise[0]*1000:null,sunset:Number.isFinite(data.daily?.sunset?.[0])?data.daily.sunset[0]*1000:null,timezone:data.timezone||null,temperature:c.temperature_2m,code:c.weather_code,time:c.time*1000,source:'Open-Meteo',
    isDay:c.is_day===1?true:c.is_day===0?false:null,wind:optional(c.wind_speed_10m),gusts:optional(c.wind_gusts_10m),
    feelsLike:optional(c.apparent_temperature),high:optional(data.daily?.temperature_2m_max?.[0]),low:optional(data.daily?.temperature_2m_min?.[0])};
   if(days===1)return current;
   let timezone=data.timezone;
   try{if(!timezone)throw Error();new Intl.DateTimeFormat('de-DE',{timeZone:timezone}).format(0);}catch{throw Error('Die Wetterquelle liefert keine gültige Ortszeit.');}
   const d=data.daily,h=data.hourly;
   const daily=(d?.time||[]).slice(0,7).map((time,i)=>({time:time*1000,code:optional(d.weather_code?.[i]),high:optional(d.temperature_2m_max?.[i]),low:optional(d.temperature_2m_min?.[i]),probability:optional(d.precipitation_probability_max?.[i]),precipitation:optional(d.precipitation_sum?.[i]),gusts:optional(d.wind_gusts_10m_max?.[i]),sunrise:optional(d.sunrise?.[i])===null?null:d.sunrise[i]*1000,sunset:optional(d.sunset?.[i])===null?null:d.sunset[i]*1000}));
   if(daily.length!==7||daily.some((day,i)=>!Number.isFinite(day.time)||day.code===null||day.high===null||day.low===null||(i>0&&day.time<=daily[i-1].time)))throw Error('Die Sieben-Tage-Vorhersage ist gerade unvollständig. Bitte erneut versuchen.');
   const hourly=(h?.time||[]).map((time,i)=>({time:time*1000,temperature:optional(h.temperature_2m?.[i]),code:optional(h.weather_code?.[i]),probability:optional(h.precipitation_probability?.[i]),precipitation:optional(h.precipitation?.[i]),gusts:optional(h.wind_gusts_10m?.[i])})).filter(row=>Number.isFinite(row.time)&&row.time>=current.time).slice(0,24);
   return {...current,timezone,daily,hourly,fetchedAt:now()};
 }
}
export function installWeatherRoutes(route) {
 const weather=createWeatherService();
 route('GET','/api/weather/locations',(_,url)=>weather.search(url.searchParams.get('q')));
 route('GET','/api/weather/current',(_,url)=>weather.current(url.searchParams.get('latitude'),url.searchParams.get('longitude')));
 return weather;
}
