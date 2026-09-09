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
