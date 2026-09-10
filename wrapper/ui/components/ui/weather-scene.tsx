import {useEffect,useRef,useState,useId} from 'react';
import {motion,useReducedMotion,useMotionValue,useSpring,useTransform} from 'motion/react';
import {weatherParallaxMotion,weatherDepth} from '../../design-system.mjs';
import {ArrowUpRight} from '../../icons.jsx';
import {useWeatherMotion} from '../../weather-motion';
import {weatherLabel,weatherScene,weatherDaylight} from '../../weather-client.mjs';
import './weather-scene.css';

export function WeatherScene({weather,active=true,reduceMotion=false}:{weather:any;active?:boolean;reduceMotion?:boolean}) {
 const scene=weatherScene(weather);
 const [clock,setClock]=useState(Date.now);
 useEffect(()=>{const tick=()=>setClock(Date.now());const timer=setInterval(tick,60000);document.addEventListener('visibilitychange',tick);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',tick);};},[]);
 const daylight=weatherDaylight(weather,weather.preview?weather.time:clock),{night,phase}=daylight;
 const id=useId().replace(/:/g,''),ref=useRef<HTMLSpanElement>(null);
 const [visible,setVisible]=useState(false),[appReduced,setAppReduced]=useState(false),enabled=useWeatherMotion(),reduced=useReducedMotion();
 useEffect(()=>{let onscreen=false;const update=()=>setVisible(onscreen&&!document.hidden);const observer=new IntersectionObserver(([entry])=>{onscreen=entry.isIntersecting;update();});if(ref.current)observer.observe(ref.current);document.addEventListener('visibilitychange',update);return()=>{observer.disconnect();document.removeEventListener('visibilitychange',update);};},[]);
 useEffect(()=>{const update=()=>setAppReduced(document.documentElement.dataset.reduceMotion==='on');const observer=new MutationObserver(update);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-reduce-motion']});update();return()=>observer.disconnect();},[]);
 const running=visible&&enabled&&!reduced&&!reduceMotion&&!appReduced;
 const x=useMotionValue(0),y=useMotionValue(0),sx=useSpring(x,weatherParallaxMotion),sy=useSpring(y,weatherParallaxMotion);
 const backX=useTransform(sx,v=>v*weatherDepth.back),backY=useTransform(sy,v=>v*weatherDepth.back);
 const frontX=useTransform(sx,v=>v*weatherDepth.front),frontY=useTransform(sy,v=>v*weatherDepth.front);
 const nearX=useTransform(sx,v=>v*weatherDepth.near),nearY=useTransform(sy,v=>v*weatherDepth.near);
 const lightX=useTransform(sx,v=>v*weatherDepth.light),lightY=useTransform(sy,v=>v*weatherDepth.light);
 useEffect(()=>{
  const card=ref.current?.closest('button');
  if(!card||!running||!active){x.set(0);y.set(0);return;}
  const reset=()=>{x.set(0);y.set(0);};
  const move=(e:PointerEvent)=>{if(e.pointerType!=='mouse')return;const rect=card.getBoundingClientRect();x.set(Math.max(-1,Math.min(1,(e.clientX-rect.left)/rect.width*2-1)));y.set(Math.max(-1,Math.min(1,(e.clientY-rect.top)/rect.height*2-1)));};
  card.addEventListener('pointermove',move);card.addEventListener('pointerleave',reset);card.addEventListener('pointercancel',reset);card.addEventListener('blur',reset);
  return()=>{reset();card.removeEventListener('pointermove',move);card.removeEventListener('pointerleave',reset);card.removeEventListener('pointercancel',reset);card.removeEventListener('blur',reset);};
 },[running,active,x,y]);
 const heavy=[65,75,82,86,99].includes(weather.code),drizzle=[51,53,55].includes(weather.code),hail=[96,99].includes(weather.code);
 const clouds=['partly','cloudy','rain','snow','storm','ice'].includes(scene);
 const precipitation=['rain','snow','storm','ice'].includes(scene);
 return <span ref={ref} className="weather-scene" data-scene={scene} data-night={night} data-phase={phase} data-running={running} data-day-known={phase!=='unknown'} data-intensity={heavy?'heavy':drizzle?'light':'normal'} data-windy={weather.wind>=30} aria-hidden="true">
  <motion.span className="weather-depth weather-depth-back" style={{x:running?backX:0,y:running?backY:0}}>
  <span className="weather-sky"/><span className="weather-horizon"/>
  {phase!=='unknown'&&['sunny','partly','frost'].includes(scene)&&<span className={night?'weather-moon':'weather-sun'} style={{left:night?undefined:daylight.sunX+'%',top:night?undefined:daylight.sunY+'%'}}><span/></span>}
  {night&&['sunny','partly','frost'].includes(scene)&&<svg className="weather-stars" viewBox="0 0 230 224">{Array.from({length:19},(_,i)=><circle key={i} cx={(i*67+9)%230} cy={(i*31+12)%180} r={i%3===0?1.1:0.65}/>)}</svg>}
  </motion.span>
  <motion.span className="weather-depth" style={{x:running?frontX:0,y:running?frontY:0}}>
  {clouds&&<svg className="weather-clouds" viewBox="0 0 300 224" preserveAspectRatio="xMidYMid slice">
   <defs>
    <linearGradient id={id+'cloud'} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--weather-cloud)"/><stop offset="1" stopColor="var(--weather-cloud-shadow)"/></linearGradient>
    <filter id={id+'soft'} x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="6"/></filter>
   </defs>
   <g fill={'url(#'+id+'cloud)'} filter={'url(#'+id+'soft)'}>
    <g className="weather-cloud-back"><ellipse cx="245" cy="56" rx="92" ry="23"/><ellipse cx="245" cy="37" rx="41" ry="25"/><ellipse cx="203" cy="48" rx="33" ry="21"/></g>
    <g className="weather-cloud-front"><ellipse cx="177" cy="111" rx="92" ry="24"/><ellipse cx="184" cy="85" rx="43" ry="34"/><ellipse cx="137" cy="100" rx="36" ry="24"/><ellipse cx="223" cy="99" rx="38" ry="26"/></g>
   </g>
  </svg>}
  </motion.span>
  <motion.span className="weather-depth" style={{x:running?nearX:0,y:running?nearY:0}}>
  {precipitation&&<svg className="weather-precipitation" viewBox="0 0 230 224" preserveAspectRatio="none"><g className={scene==='snow'?'weather-flakes':hail?'weather-hail':'weather-drops'}>{[0,-224].map(offset=><g key={offset} transform={`translate(0 ${offset})`}>{Array.from({length:heavy?52:drizzle?18:32},(_,i)=>scene==='snow'||hail?<circle key={i} cx={(i*71+19)%250} cy={(i*47)%224} r={i%4===0?2:1} opacity={i%3===0?0.9:0.5}/>:<path key={i} d={`M${(i*71+19)%260} ${(i*47)%224}l-5 16`} opacity={i%3===0?0.65:0.3}/>)}</g>)}</g></svg>}
  {(['frost','ice'].includes(scene)||weather.code===48)&&<svg className="weather-frost" viewBox="0 0 230 224"><g>{[0,1,2,3,4,5].map(i=><g key={i} transform={`translate(${i*48-5} 224) rotate(${i%2?18:-18})`}><path d="M0 0V-73M0-20L-16-36M0-20L17-38M0-40L-14-55M0-40L14-56M0-58L-8-68M0-58L8-70"/></g>)}</g></svg>}
  {scene==='fog'&&<span className="weather-mist"/>}
  {scene==='storm'&&<svg className="weather-lightning" viewBox="0 0 230 224"><path d="m183 42-15 37 15-5-21 42 37-51-17 6 17-29Z"/></svg>}
  {weather.wind>=30&&<svg className="weather-wind" viewBox="0 0 230 224"><path d="M10 138Q70 118 128 138T246 138M-12 155Q50 135 108 155T240 155"/></svg>}
  </motion.span>
  <span className="weather-legibility"/>
  <motion.span className="weather-glass-light" style={{x:running?lightX:0,y:running?lightY:0}}/>
  <span className="weather-glass-edge"/>
 </span>;
}

export function WeatherCardContent({item,active,reduceMotion}:{item:any;active:boolean;reduceMotion:boolean}) {
 const w=item.weather,scene=weatherScene(w);
 const condition=weatherLabel(w.code)+(scene==='frost'?' · Frost':'');
 const range=Number.isFinite(w.high)&&Number.isFinite(w.low);
 return <>
  <WeatherScene weather={w} active={active} reduceMotion={reduceMotion}/>
  <span className="weather-card-content">
   <span className="weather-place" title={item.title}>{item.title}</span>
   <span className="weather-temperature" aria-label={`${Math.round(w.temperature)} Grad Celsius`}>{Math.round(w.temperature)}°</span>
   <span className="weather-condition">{condition}</span>
   {range&&<span className="weather-range">H: {Math.round(w.high)}° · T: {Math.round(w.low)}°</span>}
   {w.previewWarning&&<span className="weather-warning">⚠ {w.previewWarning}</span>}
   <span className="weather-card-footer">
    {w.preview&&<span>Beispieldaten</span>}
    <span className="weather-card-action">Heute & 7 Tage <ArrowUpRight size={16} aria-hidden="true"/></span>
   </span>
  </span>
 </>;
}
