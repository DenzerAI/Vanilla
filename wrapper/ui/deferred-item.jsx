import React, {useEffect,useState} from 'react';

export function DeferredItem({api,chatId,turnId,Item,...props}) {
  const [detail,setDetail]=useState(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
  const open=!!props.toolOpen?.[props.item.id];
  useEffect(()=>{
    if(!open||detail)return;
    let alive=true;
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),15000);
    setError('');
    api('/thread/item?id='+encodeURIComponent(chatId)+'&turnId='+encodeURIComponent(turnId)+'&itemId='+encodeURIComponent(props.item.id),undefined,true,controller.signal)
      .then(result=>{if(alive)setDetail(result.item);})
      .catch(()=>{if(alive)setError('Der Arbeitsschritt konnte nicht geladen werden.');})
      .finally(()=>clearTimeout(timer));
    return()=>{alive=false;clearTimeout(timer);controller.abort();};
  },[api,chatId,turnId,props.item.id,open,attempt,detail]);
  return <Item {...props} item={detail || props.item} detailLoading={open&&!detail&&!error} detailError={error} onDetailRetry={()=>setAttempt(value=>value+1)}/>;
}
