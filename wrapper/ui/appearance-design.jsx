import {ThemeToggle} from "./components/ui/theme-toggle";
import React, {useState} from 'react';
import {designTones, designAccents, designVariables} from './design-system.mjs';
import {SettingRow} from './settings-row.jsx';
import './appearance-design.css';

export function AppearanceDesign({settings, onChange}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function change(value) {setBusy(true);setError('');try {await onChange(value);} catch(e) {setError(e.message || 'Aussehen konnte nicht gespeichert werden.');} finally {setBusy(false);}}
  return <section className="appearance-design" aria-label="Farbwelt">
    <fieldset disabled={busy}>
      <div className="settings-group"><SettingRow title="Erscheinungsbild"><ThemeToggle theme={settings.theme} onThemeChange={theme=>onChange({theme})} disabled={busy}/></SettingRow></div>
      <h3 className="section-heading">Farbwelt</h3>
      <div className="design-tone-options" role="radiogroup" aria-label="Farbwelt">
        {designTones.map(tone=><label className="design-tone-option" key={tone.id}>
          <input type="radio" name="design-tone" value={tone.id} checked={(settings.designTone || 'balanced')===tone.id} onChange={()=>change({designTone:tone.id})}/>
          <span className="design-miniature" style={designVariables(settings.theme,tone.id,settings.highlightColor)} aria-hidden="true"><span className="design-mini-sidebar"><i/><i/><i/></span><span className="design-mini-content"><b/><i/><i/><span/></span></span>
          <strong>{tone.label}</strong><small>{tone.description}</small>
        </label>)}
      </div>
      <div className="settings-group">
        <SettingRow title="Hervorhebungsfarbe" description="Für bewusste Auswahlen. Schalter bleiben neutral.">
          <div className="design-accent-options" role="radiogroup" aria-label="Hervorhebungsfarbe">{designAccents.map(accent=><label title={accent.label} key={accent.id}><input type="radio" name="design-accent" aria-label={accent.label} checked={(settings.highlightColor || 'terracotta')===accent.id} onChange={()=>change({highlightColor:accent.id})}/><span style={{background:accent[settings.theme==='light'?'light':'dark']}} aria-hidden="true"/></label>)}</div>
        </SettingRow>
        <SettingRow title="Ausgewählt"><span className="muted">{designAccents.find(a=>a.id===(settings.highlightColor || 'terracotta'))?.label}</span></SettingRow>
      </div>
    </fieldset>
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>;
}
