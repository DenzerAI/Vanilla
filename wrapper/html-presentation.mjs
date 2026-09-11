// Versioned, deliberately small channel between an opaque preview and its viewer.
export const presentationProtocol = 'vanilla-presentation-v1';
export function presentationState(message, channel) {
  if (!message || message.protocol !== presentationProtocol || message.channel !== channel || message.type !== 'state') return null;
  const {count,index,presenting} = message;
  if (!Number.isInteger(count) || count < 0 || count > 500 || !Number.isInteger(index) || index < 0 || index >= Math.max(1,count) || typeof presenting !== 'boolean') return null;
  return {count,index,presenting};
}

// Runs only inside the existing sandbox. No network, parent DOM or app API access.
export function presentationBridge(channel) {
  const protocol = 'vanilla-presentation-v1';
  let slides=[], index=0, presenting=false, scroll={x:0,y:0}, saved=[];
  const send=()=>parent.postMessage({protocol,channel,type:'state',count:slides.length,index,presenting},'*');
  const editable=target=>target instanceof Element && !!target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])');
  function show() {
    slides.forEach((slide,n)=>{
      slide.toggleAttribute('data-vanilla-inactive',presenting && n!==index);
      if(presenting)slide.hidden=n!==index;
    });
    if(presenting && slides.length)window.scrollTo(0,0);
    send();
  }
  function mode(value) {
    if(value===presenting){send();return;}
    if(value){
      scroll={x:window.scrollX,y:window.scrollY};
      saved=slides.map(slide=>({hidden:slide.hidden,inactive:slide.hasAttribute('data-vanilla-inactive')}));
    }
    presenting=value;
    if(!value){
      slides.forEach((slide,n)=>{slide.hidden=saved[n].hidden;slide.toggleAttribute('data-vanilla-inactive',saved[n].inactive);});
      window.scrollTo(scroll.x,scroll.y);
      send();
    } else show();
  }
  function navigate(action) {
    if(!presenting || !slides.length)return;
    const next=action==='first'?0:action==='last'?slides.length-1:index+(action==='next'?1:-1);
    index=Math.max(0,Math.min(slides.length-1,next));show();
  }
  function setup() {
    const marked=Array.from(document.querySelectorAll('[data-presentation-slide]')).filter(slide=>!slide.parentElement?.closest('[data-presentation-slide]'));
    slides=marked.length<=500?marked:[];
    const style=document.createElement('style');
    style.textContent='[data-vanilla-inactive]{display:none!important}';document.head.append(style);
    window.addEventListener('message',event=>{
      const data=event.data;
      if(event.source!==parent || !data || data.protocol!==protocol || data.channel!==channel)return;
      if(data.type==='hello')send();
      else if(data.type==='mode' && typeof data.presenting==='boolean')mode(data.presenting);
      else if(data.type==='navigate' && ['next','previous','first','last'].includes(data.action))navigate(data.action);
    });
    document.addEventListener('keydown',event=>{
      if(!presenting || editable(event.target) || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)return;
      if(event.key==='Escape'){event.preventDefault();mode(false);parent.postMessage({protocol,channel,type:'exit'},'*');return;}
      const action=({ArrowRight:'next',PageDown:'next',' ':'next',ArrowLeft:'previous',PageUp:'previous',Home:'first',End:'last'})[event.key];
      if(action && slides.length){event.preventDefault();navigate(action);}
    });
    send();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
}
export function addPresentationBridge(content,channel) {
  if(!/^[a-zA-Z0-9_-]{8,80}$/.test(channel || ''))throw new Error('Ungültiger Vorschaukanal.');
  const html=content.toString('utf8');
  const script='<script>('+presentationBridge.toString()+')('+JSON.stringify(channel)+');</script>';
  const doctype=html.match(/^\uFEFF?\s*<!doctype[^>]*>/i);
  return Buffer.from(doctype?html.slice(0,doctype[0].length)+script+html.slice(doctype[0].length):'<!doctype html>'+script+html);
}
