import React, {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MotionConfig} from 'motion/react';
import {PageHeading} from './page-heading';
import {DesignReference} from './design-reference.jsx';
import {ChatStartPreview} from './chat-start-preview';
import {designVariables} from './design-system.mjs';
import {installIconMotion} from './icon-motion';
import './tailwind.css';
import './styles.css';
import './chat.css';
import './appearance-design.css';
import './library-connections.css';
import './icon-motion.css';
import './blueprint.css';

declare const __UI_VERSION__: string;
function Blueprint() {
  const [theme,setTheme]=useState<'dark'|'light'>('dark');
  const [section,setSection]=useState('chat'),[compact,setCompact]=useState(false);
  useEffect(()=>{
    document.documentElement.dataset.theme=theme;
    for(const [key,value] of Object.entries(designVariables(theme,'balanced','terracotta'))) document.documentElement.style.setProperty(key,value);
  },[theme]);
  useEffect(()=>installIconMotion(),[]);
  return <MotionConfig reducedMotion="user"><main className="blueprint-shell">
    <div className="blueprint-content">
      <PageHeading title="UI-Bauplan"/>
      <p className="page-note">Die Produktionsbausteine von Vanilla mit neutralen Beispielen. Auswahl und Eingaben bleiben in dieser Vorschau.</p>
      <div className="blueprint-controls">
        <div className="design-segments" role="group" aria-label="Erscheinungsbild">{(['dark','light'] as const).map(value=><button type="button" key={value} aria-pressed={theme===value} onClick={()=>setTheme(value)}>{value==='dark'?'Dunkel':'Hell'}</button>)}</div>
        <div className="design-segments" role="group" aria-label="Referenzbereich">{[['chat','Chatstart'],['components','Alle Bausteine']].map(([value,label])=><button type="button" key={value} aria-pressed={section===value} onClick={()=>setSection(value)}>{label}</button>)}</div>
        <button type="button" aria-pressed={compact} onClick={()=>setCompact(!compact)}>Handybreite</button>
      </div>
      <div className={'blueprint-specimen'+(compact?' is-compact':'')}>{section==='chat'?<ChatStartPreview/>:<DesignReference theme={theme} tone="balanced" accent="terracotta"/>}</div>
      <p className="page-note blueprint-version">UI-Stand: <code>{__UI_VERSION__}</code></p>
    </div>
  </main></MotionConfig>;
}
createRoot(document.getElementById('root')!).render(<Blueprint/>);
