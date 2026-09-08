import React, {useEffect, useRef, useState} from 'react';
import {SettingRow} from './settings-row.jsx';
import {Modal} from './modal.jsx';
import {Skeleton} from './skeleton.tsx';
import './system-settings.css';
import './privacy-settings.css';

type Review = {status: 'open' | 'documented' | 'not_applicable'; note: string};
type Values = {pause_handoffs: boolean; block_secrets: boolean; block_contacts: boolean; block_attachments: boolean; audit_days: number; reviews: Record<string, Review>};
type Policy = {version: number; values: Values};
type Status = {
  settings: Policy; checkedAt: number; legalDate: string;
  documentation: {completed: number; total: number; percent: number};
  handoffs: {total: number; blocked: number; allowed: number; blockedPercent: number | null; days: number};
  data: {documents: number; lastScan: number; searchLocal: boolean; capture: boolean; maintenance: boolean; sharedNotes: boolean};
  requirements: {id: string; title: string; description: string; law: string; source: string}[];
  limits: string[];
};
type Props = {api: (path: string, body?: unknown) => Promise<any>; onSettings: (section: string) => void; onSearch: () => void};
const when = (value: number) => value ? new Date(value * 1000).toLocaleString('de-DE') : 'Noch nicht geprüft';
const reasonNames: Record<string, string> = {allowed:'Nach den gespeicherten Regeln zugelassen', paused:'Neue Übergaben pausiert', credentials:'Zugangsdaten erkannt', contacts:'E-Mail-Adresse oder IBAN-Muster erkannt', attachments:'Anhänge gesperrt', uninspectable:'Inhalt nicht vorab prüfbar'};
function Group({title, children}: {title: string; children: React.ReactNode}) {return <><h3 className="section-heading">{title}</h3><div className="settings-group">{children}</div></>;}

export function PrivacySettings({api, onSettings, onSearch}: Props) {
  const [status, setStatus] = useState<Status | null>(null), [draft, setDraft] = useState<Policy | null>(null);
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const [details, setDetails] = useState(false), [limits, setLimits] = useState(false), [testing, setTesting] = useState(false);
  const [sample, setSample] = useState(''), [preview, setPreview] = useState<any>(null);
  const alive = useRef(true), requestId = useRef(0);
  const dirty = !!status && !!draft && JSON.stringify(status.settings) !== JSON.stringify(draft);
  useEffect(() => {
    alive.current = true;
    api('/privacy/status').then((result: Status) => {if(alive.current) {setStatus(result); setDraft(result.settings);}}).catch((e: Error) => {if(alive.current) setError(e.message);});
    return () => {alive.current = false; requestId.current++;};
  }, [api]);
  async function action(fn: () => Promise<void>) {
    setBusy(true); setError(''); setMessage('');
    try {await fn();} catch(e: any) {if(alive.current) setError(e.message);} finally {if(alive.current) setBusy(false);}
  }
  async function refresh(reset = false) {
    const result: Status = await api('/privacy/status');
    if (!alive.current) return;
    setStatus(result);
    if (reset || !draft) setDraft(result.settings);
    setMessage('Stand aktualisiert.');
  }
  function change<K extends keyof Values>(key: K, value: Values[K]) {
    setDraft(old => old ? {...old, values: {...old.values, [key]: value}} : old);
    setMessage(''); setPreview(null);
  }
  async function save() {
    const saved = await api('/privacy/settings', draft);
    if (alive.current) setDraft(saved);
    await refresh();
    if (alive.current) setMessage('Datenschutz gespeichert. Gilt für neue Übergaben.');
  }
  async function download() {
    const report = await api('/privacy/export');
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], {type:'application/json'}));
    const link = document.createElement('a'); link.href = url; link.download = 'vanilla-datenschutz.json';
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
    setMessage('Auswertung heruntergeladen. Enthält deine Prüfanmerkungen, keine Nachrichteninhalte.');
  }
  function closeTest() {requestId.current++; setTesting(false); setSample(''); setPreview(null);}
  async function testSample() {
    const id = ++requestId.current;
    const result = await api('/privacy/preview', {kind:'worker', text:sample});
    if (alive.current && id === requestId.current) setPreview(result);
  }
  if(!status || !draft) return error ? <p role="alert">{error} <button onClick={() => action(() => refresh(true))}>Erneut laden</button></p> : <Skeleton variant="settings" label="Datenschutz wird geladen …"/>;
  const v = draft.values;
  const toggle = (key: 'pause_handoffs' | 'block_secrets' | 'block_contacts' | 'block_attachments', title: string, description: string) => <SettingRow title={title} description={description}><button type="button" role="switch" className="apple-switch" aria-label={title} aria-checked={v[key]} onClick={() => change(key, !v[key])}><span/></button></SettingRow>;
  return <div className="system-settings privacy-settings" data-capability="settings.privacy" aria-busy={busy}>
    <div className="settings-save-row"><span role="status">{dirty ? 'Ungespeicherte Änderungen' : message || 'Keine Änderungen'}</span><button type="button" className="primary" disabled={!dirty || busy} onClick={() => action(save)}>Speichern</button></div>
    {error && <p className="form-error" role="alert">{error} <button disabled={busy} onClick={() => action(() => refresh(true))}>Entwurf verwerfen und neu laden</button></p>}
    <fieldset disabled={busy}>
      <Group title="Dein Datenschutzstand">
        <SettingRow title="Prüfpunkte dokumentiert" description={`${status.documentation.completed} von ${status.documentation.total} Punkten mit Nachweis oder Begründung. Selbstauskunft, keine Konformitätsbewertung.`}><span className="privacy-value">{status.documentation.percent} %</span></SettingRow>
        <SettingRow title="Geprüfte Übergabeversuche" description={`Letzte ${status.handoffs.days} Tage: ${status.handoffs.allowed} zugelassen, ${status.handoffs.blocked} blockiert. Eine Freigabe bestätigt keinen Versand.`}><span className="privacy-value">{status.handoffs.total}</span></SettingRow>
        <SettingRow title="Davon blockiert" description={status.handoffs.total ? 'Anteil blockierter Versuche an allen erfassten Versuchen im Zeitraum.' : 'Noch keine Übergaben über die neuen Prüfstellen erfasst.'}><span className="privacy-value">{status.handoffs.blockedPercent === null ? 'Noch keine Daten' : `${status.handoffs.blockedPercent.toLocaleString('de-DE')} %`}</span></SettingRow>
        <SettingRow title="Auswertung" description={`Stand: ${when(status.checkedAt)}. Export enthält Regeln, Prüfanmerkungen und Übergabezähler ohne Nachrichteninhalte.`}><div className="row"><button onClick={() => action(() => refresh())}>Aktualisieren</button><button onClick={() => action(download)}>Exportieren</button></div></SettingRow>
      </Group>
      <Group title="Vor der Übergabe">
        {toggle('pause_handoffs', 'Neue KI- und Dienstübergaben pausieren', 'Pausiert die unten beschriebenen Wrapper-Übergaben. Lokale Suche und Memory-Pflege bleiben nutzbar. Laufende Worker werden nicht gestoppt.')}
        {toggle('block_secrets', 'Erkannte Zugangsdaten blockieren', 'Prüft übergebene Texte einschließlich ausgewähltem Kontext auf bekannte Schlüsselmuster. Keine vollständige Erkennung.')}
        {toggle('block_contacts', 'E-Mail- und IBAN-Muster blockieren', 'Zusätzlicher Textfilter. Namen und andere personenbezogene Angaben können unerkannt bleiben. Unprüfbares Cloud-Audio wird gesperrt.')}
        {toggle('block_attachments', 'Neue Anhänge blockieren', 'Verhindert die Übergabe von angehängten Dateien und Cloud-Audio an den Prüfstellen. Kein Schutz vor späteren Dateizugriffen des Workers.')}
        <SettingRow title="Übergabeprotokoll aufbewahren" description="Nur Zeitpunkt, Prüfstelle, Regelversion, Entscheidung und Mengen. Kürzere Fristen entfernen ältere Einträge beim Speichern. Frühere Backups bleiben bestehen."><select aria-label="Übergabeprotokoll aufbewahren" value={v.audit_days} onChange={e => change('audit_days', Number(e.target.value))}>{[...new Set([1,7,14,30,60,90,v.audit_days])].sort((a,b)=>a-b).map(n => <option key={n} value={n}>{n} {n === 1 ? 'Tag' : 'Tage'}</option>)}</select></SettingRow>
        <SettingRow title="Textprüfung ausprobieren" description="Prüft nur lokal nach den gespeicherten Regeln. Der Testtext wird nicht gespeichert oder an eine KI gesendet."><button disabled={dirty} onClick={() => {setTesting(true); setPreview(null);}}>Ausprobieren</button></SettingRow>
        <SettingRow title="Was wird geschützt?" description="Neue Chat- und Auftragsübergaben, Titelanfragen sowie angebundene Sprach-, Bild- und Dienstaktionen. Native Worker-Zugriffe bleiben eine offene Grenze."><button aria-expanded={limits} onClick={() => setLimits(!limits)}>{limits ? 'Schließen' : 'Grenzen ansehen'}</button></SettingRow>
        {limits && status.limits.map(text => <SettingRow key={text} title={text}/>)}
      </Group>
      <Group title="Gemeinsame Daten">
        <SettingRow title="Lokale Suche" description={`${status.data.documents} Textdateien im gemeinsamen Index. Letzter Indexlauf: ${when(status.data.lastScan)}. Geänderte oder entfernte Quellen liefern keine alten Textausschnitte.`}><button onClick={onSearch}>Suchen</button></SettingRow>
        <SettingRow title="Automatische Memory-Pflege" description={`Gesprächsaufnahme ${status.data.capture ? 'an' : 'aus'}, lokale Pflege ${status.data.maintenance ? 'an' : 'aus'}. Dieselben Dateien für unterstützte Worker; keine zweite Wissensablage.`}><button onClick={() => onSettings('memory')}>Verwalten</button></SettingRow>
        <SettingRow title="Projektübergreifende Notizen" description={status.data.sharedNotes ? 'Notizen im freigegebenen gemeinsamen Ordner werden in andere Projekte einbezogen.' : 'Automatische Kontextauswahl bleibt auf das jeweilige Projekt begrenzt. Gemeinsame Notizen sind nicht zusätzlich freigegeben.'}><span>{status.data.sharedNotes ? 'Freigegeben' : 'Getrennt'}</span></SettingRow>
        <SettingRow title="Zugang und Aufbewahrung" description="Anmeldung, Chats, Memory, Versionsverlauf und Sicherungen getrennt prüfen. Memory entfernen ist keine vollständige Löschung."><div className="row"><button onClick={() => onSettings('access')}>Zugang</button><button onClick={() => onSettings('storage')}>Speicher</button></div></SettingRow>
      </Group>
      <Group title="Im Betrieb klären">
        <SettingRow title="Betriebliche Prüfpunkte" description={`Recherche vom ${new Date(status.legalDate + 'T12:00:00').toLocaleDateString('de-DE')}. Anforderungen hängen von Daten, Anbieter und Einsatzzweck ab. Nachweise bitte ohne Zugangsdaten oder Kundendaten eintragen.`}><button aria-expanded={details} onClick={() => setDetails(!details)}>{details ? 'Schließen' : 'Prüfpunkte öffnen'}</button></SettingRow>
        {details && status.requirements.map(item => {
          const review = v.reviews[item.id] || {status:'open', note:''};
          const update = (patch: Partial<Review>) => change('reviews', {...v.reviews, [item.id]: {...review, ...patch}});
          return <React.Fragment key={item.id}><SettingRow title={item.title} description={<>{item.description} <a href={item.source} target="_blank" rel="noreferrer">{item.law}</a></>}><select aria-label={item.title} value={review.status} onChange={e => update({status:e.target.value as Review['status']})}><option value="open">Offen</option><option value="documented">Dokumentiert</option><option value="not_applicable">Nicht einschlägig</option></select></SettingRow><div className="privacy-evidence"><label htmlFor={`privacy-${item.id}`}>Nachweis oder Begründung</label><textarea id={`privacy-${item.id}`} rows={2} maxLength={2000} value={review.note} placeholder="Verweis auf Dokument, Prüfdatum und zuständige Person" onChange={e => update({note:e.target.value})}/></div></React.Fragment>;
        })}
      </Group>
    </fieldset>
    {testing && <Modal wide={false} title="Textprüfung ausprobieren" onClose={closeTest}><div className="privacy-test"><label htmlFor="privacy-sample">Beispieltext</label><textarea id="privacy-sample" rows={5} maxLength={20000} value={sample} onChange={e => {requestId.current++; setSample(e.target.value); setPreview(null);}}/><p className="form-help">Nach gespeicherten Regeln. Auch ein unauffälliger Text kann personenbezogene Daten enthalten.</p><button disabled={busy || !sample.trim()} onClick={() => action(testSample)}>Lokal prüfen</button>{preview && <p role="status">{reasonNames[preview.reason] || 'Prüfung abgeschlossen'}. Gefundene Muster: {Object.values(preview.findings as Record<string, number>).reduce((a, b) => a + b, 0)}.</p>}{error && <p role="alert" className="form-error">{error}</p>}</div></Modal>}
  </div>;
}
