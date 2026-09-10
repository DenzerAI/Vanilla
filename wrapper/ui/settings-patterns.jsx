import React, { useState } from 'react';
import { SettingRow } from './settings-row.jsx';
import { ChevronRight, Settings, FileText } from './icons.jsx';
import './settings-patterns.css';

export function SettingsHeader({icon, title, children}) {
  return <div className="settings-feature-header">{icon && <span className="settings-feature-icon" aria-hidden="true">{icon}</span>}<h3>{title}</h3>{children && <p>{children}</p>}</div>;
}

/** @param {{icon?: import('react').ReactNode, title: import('react').ReactNode, description?: import('react').ReactNode, value?: import('react').ReactNode, onClick: () => void}} props */
export function SettingsNavigationRow({icon, title, description, value, onClick}) {
  return <button type="button" className="settings-navigation-row" onClick={onClick}>{icon}<span className="settings-navigation-copy"><strong>{title}</strong>{description && <span>{description}</span>}</span>{value && <span className="muted">{value}</span>}<ChevronRight size={16}/></button>;
}

// Interactive specimens use the production components; state stays in this preview.
export function SettingsPatterns() {
  const [enabled, setEnabled] = useState(true);
  const [mode, setMode] = useState('Automatisch');
  const [value, setValue] = useState(60);
  const [detail, setDetail] = useState(false);
  return <div className="settings-patterns">
    <SettingsHeader icon={<Settings size={32}/>} title="Bausteine für Einstellungen">Kompakte Zeilen, gemeinsame Gruppen und ruhige Bedienelemente. Diese Vorschau speichert keine Einstellungen.</SettingsHeader>
    <div className="settings-group">
      <SettingRow title="Schalter" description="Ein Zustand, eine direkte Steuerung."><button type="button" className="apple-switch" role="switch" aria-label="Beispiel einschalten" aria-checked={enabled} onClick={()=>setEnabled(!enabled)}><span/></button></SettingRow>
      <SettingRow title="Auswahl"><select aria-label="Beispielauswahl" value={mode} onChange={e=>setMode(e.target.value)}><option>Automatisch</option><option>Manuell</option></select></SettingRow>
      <SettingRow title="Regler"><div className="settings-range"><input type="range" aria-label="Beispielwert" min="0" max="100" value={value} onChange={e=>setValue(Number(e.target.value))}/><output>{value} %</output></div></SettingRow>
      <SettingRow title="Aktionen"><div className="row"><button onClick={()=>{setEnabled(true);setMode('Automatisch');setValue(60);setDetail(false);}}>Zurücksetzen</button><button disabled>Gespeichert</button></div></SettingRow>
    </div>
    <div className="settings-group">
      <SettingsNavigationRow icon={<FileText size={20}/>} title="Detailansicht" description="Die gesamte Zeile öffnet den zugehörigen Inhalt." value={detail?'Offen':undefined} onClick={()=>setDetail(!detail)}/>
      {detail && <SettingRow title="Beispieldetails" description="Zusammengehörige Inhalte bleiben innerhalb derselben Gruppe."/>}
    </div>
    <p className="form-help">Neue Seiten: Seitentitel → optionale sachliche Illustration → benannte Gruppen → passende Zeilen. Ein Schalter ändert einen Zustand, eine Auswahl wählt einen Wert, ein Button führt eine Aktion aus.</p>
  </div>;
}
