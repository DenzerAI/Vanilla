import {useRef,useState} from 'react';
import {AttentionFan,type AttentionItem} from './components/ui/attention-fan';

const initial:AttentionItem[]=[
 {id:'example-reply',kind:'chat',title:'Reise planen',description:'Die drei Verbindungen sind verglichen. Am Vormittag bleibt mehr Zeit zum Umsteigen.'},
 {id:'weather',kind:'weather',title:'Dein Wetter',description:'Beispiel einer festen Dienstkarte.'},
];
export function LiveAnswerCardsPreview(){
 const [items,setItems]=useState(initial),[selected,setSelected]=useState(initial[0].id);
 const serial=useRef(0);
 const add=()=>{const n=++serial.current;setItems(old=>[{id:'example-'+n,kind:'chat',title:'Neue Antwort '+n,description:'Der Entwurf ist fertig. Die wichtigsten Änderungen stehen direkt am Anfang.'},...old]);};
 return <div>
  <div className="design-segments" role="group" aria-label="Live-Karten ausprobieren">
   <button type="button" onClick={add}>Antwort hinzufügen</button>
   <button type="button" disabled={selected==='weather'} onClick={()=>setItems(old=>old.filter(item=>item.id!==selected))}>Auswahl als gelesen entfernen</button>
   <button type="button" onClick={()=>setItems(initial)}>Zurücksetzen</button>
  </div>
  <AttentionFan items={items} onActiveChange={item=>setSelected(item.id)} onOpen={item=>{if(item.kind==='chat')setItems(old=>old.filter(card=>card.id!==item.id));}}/>
  <p className="page-note">Lokales Beispiel. Neue Antworten ergänzen den Fächer; die betrachtete Karte bleibt ausgewählt. Ein Klick auf eine Antwort simuliert das Lesen.</p>
 </div>;
}
