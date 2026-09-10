import test from 'node:test';
import assert from 'node:assert/strict';
import {createWeatherService} from '../weather.mjs';
import {readUserProfile,writeUserProfile,emptyUserProfile} from '../ui/user-profile.mjs';
import {loadWeather} from '../ui/weather-client.mjs';
import {chatStartFeed} from '../ui/chat-start-feed.mjs';

test('coordinates survive reload, change with the city, and disappear when cleared',()=>{
 const source=emptyUserProfile+'\n## Notes\nKeep this.\n';
 const point={latitude:0,longitude:12};
 const text=writeUserProfile(source,{name:'Testperson',location:'Teststadt',point});
 assert.deepEqual(readUserProfile(text).point,point);
 assert.ok(text.includes('Keep this.'));
 assert.equal(readUserProfile(writeUserProfile(text,{name:'Testperson',location:''})).point,undefined);
 assert.throws(()=>writeUserProfile(source,{location:'Teststadt',point:{latitude:91,longitude:0}}));
});
test('upstream requests coalesce and expire; current data is validated',async()=>{
 let calls=0,now=1800000000000;
 const service=createWeatherService({now:()=>now,fetcher:async()=>{calls++;return {ok:true,json:async()=>({current:{temperature_2m:0,weather_code:0,time:now/1000}})};}});
 const pair=await Promise.all([service.current(0,0),service.current(0,0)]);
 assert.equal(calls,1);assert.equal(pair[0].temperature,0);
 await service.current(0,0);assert.equal(calls,1);
 now+=600001;await service.current(0,0);assert.equal(calls,2);
 await assert.rejects(service.current(null,null));await assert.rejects(service.current('abc',0));
 const broken=createWeatherService({fetcher:async()=>({ok:true,json:async()=>({current:{temperature_2m:null}})})});
 await assert.rejects(broken.current(0,0),/vollständigen/);
 const offline=createWeatherService({fetcher:async()=>{throw Error('network');}});
 await assert.rejects(offline.current(0,0),/nicht erreichbar/);
});
test('legacy location resolves only an unambiguous exact match; confirmed points skip search',async()=>{
 let paths=[];
 const api=async path=>{paths.push(path);return path.includes('locations')?{items:[{label:'Teststadt, Region, Land',latitude:1,longitude:2}]}:{temperature:10,code:3,time:Date.now()};};
 assert.equal((await loadWeather(api,{location:'Teststadt'})).status,'ready');
 assert.equal(paths.length,2);paths=[];
 assert.equal((await loadWeather(api,{location:'Teststadt',point:{latitude:0,longitude:0}})).status,'ready');assert.equal(paths.length,1);
 assert.equal((await loadWeather(async()=>({items:[{label:'Teststadt, A'},{label:'Teststadt, B'}]}),{location:'Teststadt'})).status,'unresolved');
 assert.equal((await loadWeather(async()=>{throw Error('offline');},{location:'Teststadt'})).status,'error');
 assert.equal((await loadWeather(api,{location:''})).status,'unset');
});
test('weather card distinguishes measurements, loading, errors and missing city',()=>{
 const card=weather=>chatStartFeed({includeWeather:true,userProfile:{location:'Teststadt'},weather}).find(i=>i.kind==='weather');
 assert.equal(card({status:'ready',temperature:0,code:3,time:Date.now()}).description,'0 °C · Bedeckt');
 assert.match(card({status:'error'}).description,/nicht geladen/);
 assert.match(card({status:'loading'}).description,/wird geladen/);
 assert.match(card({status:'unresolved'}).description,/bestätige/);
});

test('scene selection distinguishes precipitation, dry frost, night and unknown data',async()=>{
 const {weatherScene,weatherLabel}=await import('../ui/weather-client.mjs');
 const scene=(code,temperature=15,isDay=true)=>weatherScene({status:'ready',code,temperature,isDay});
 assert.equal(scene(0),'sunny');assert.equal(scene(2),'partly');assert.equal(scene(3),'cloudy');
 for(const c of [61,63,65,80,81,82])assert.equal(scene(c),'rain');
 for(const c of [71,73,75,77,85,86])assert.equal(scene(c,-4),'snow');
 for(const c of [56,57,66,67]){assert.equal(scene(c,-1),'ice');assert.equal(weatherLabel(c),'Gefrierender Regen');}
 assert.equal(scene(0,-5),'frost');assert.equal(scene(3,-5),'cloudy');
 assert.equal(scene(95),'storm');assert.equal(scene(45),'fog');
 assert.equal(scene(0,15,false),'sunny');assert.equal(scene(999),'unavailable');
 assert.equal(weatherScene({status:'error',code:0}),'unavailable');
});
test('day/night and daily extremes preserve zero and do not invent missing measurements',async()=>{
 const now=1800000000000;
 let requested;
 const service=createWeatherService({now:()=>now,fetcher:async url=>{requested=new URL(url);return {ok:true,json:async()=>({current:{temperature_2m:0,weather_code:0,is_day:0,apparent_temperature:-3,time:now/1000},daily:{temperature_2m_max:[0],temperature_2m_min:[-8]}})};}});
 const result=await service.current(0,0);
 assert.equal(result.isDay,false);assert.equal(result.high,0);assert.equal(result.low,-8);
 assert.ok(requested.searchParams.get('current').includes('is_day'));
 const missing=createWeatherService({now:()=>now,fetcher:async()=>({ok:true,json:async()=>({current:{temperature_2m:0,weather_code:0,time:now/1000}})})});
 const minimal=await missing.current(0,0);assert.equal(minimal.high,null);assert.equal(minimal.low,null);assert.equal(minimal.isDay,null);
 assert.equal(result.warning,undefined);
});
