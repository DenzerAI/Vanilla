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
  async current(latitude,longitude) {
   if(latitude===null||longitude===null||latitude===''||longitude==='')throw Error('Bitte einen Ort aus der Suche auswählen.');
   const lat=Number(latitude),lon=Number(longitude);
   if(!Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lon)||Math.abs(lon)>180)throw Error('Ungültiger Wetterort.');
   const data=await get('https://api.open-meteo.com/v1/forecast?'+new URLSearchParams({latitude:String(lat),longitude:String(lon),current:'temperature_2m,weather_code',timezone:'auto',timeformat:'unixtime',forecast_days:'1'}),600000);
   const c=data.current;
   if(!c||!Number.isFinite(c.temperature_2m)||!Number.isFinite(c.weather_code)||!Number.isFinite(c.time))throw Error('Die Wetterquelle liefert gerade keine vollständigen Daten.');
   if(Math.abs(now()-c.time*1000)>3600000)throw Error('Die Wetterquelle liefert gerade keine aktuellen Daten.');
   return {temperature:c.temperature_2m,code:c.weather_code,time:c.time*1000,source:'Open-Meteo'};
  }
 };
}
export function installWeatherRoutes(route) {
 const weather=createWeatherService();
 route('GET','/api/weather/locations',(_,url)=>weather.search(url.searchParams.get('q')));
 route('GET','/api/weather/current',(_,url)=>weather.current(url.searchParams.get('latitude'),url.searchParams.get('longitude')));
}
