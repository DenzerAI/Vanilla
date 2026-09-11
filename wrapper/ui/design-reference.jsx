import {ComposerCommandsPreview} from './composer-commands';
import {VoiceProfilesPreview} from './voice-profiles.jsx';
import {WorkspaceSettingsPreview} from './workspace-settings';

import {AIMaintenancePreview} from "./ai-maintenance.tsx";
import {CalendarPreview} from './calendar-card';
import {ChatStartPreview} from './chat-start-preview';

import {DeliveryChecks} from './delivery-checks';
import {FirmaPreview} from './firma';
import {StatisticsPreview} from './statistics-preview';
import {ChatArtifactsPreview} from './chat-artifacts.jsx';
import {ComposerQuestionPreview} from './composer-question';
import {LiveAnswerCardsPreview} from './live-answer-cards-preview';
import {ActivityPreview} from './chat-activity.jsx';
import {ChatPrivacyPreview} from './chat-privacy';
import {ComposerFocus} from './composer-focus';
import {WeatherPreview} from './weather-preview';
import { PaneDivider, ChatMenuPreview, MessageActions, ComposerHeading } from "./chat-controls.jsx";
import { jobFilters } from './jobs-view.mjs';
import { IconMotionPreview } from './icon-motion-preview';
import {VoiceWave,VoiceStatus} from "./voice-visual";
import { AvatarMotionSetting } from "./avatar-motion-setting.jsx";
import { AvatarChoices } from "./avatar-picker.jsx";
import { DefaultToggle } from "./components/ui/theme-toggle-demo";
import GlassButtonDemo from "./components/ui/glass-button-demo";
import { VanillaWordmark } from "./vanilla-wordmark";
import { AgentMenu } from "./agent-menu";
import {NotificationRow} from "./job-notifications.jsx";
import { ChapterScrubber } from "./components/ui/chapter-scrubber";
import { PlannerPatternPreview } from "./planner";
import { ModelPicker } from "./model-picker.jsx";
import { InboxPatternPreview } from "./inbox";
import { PanelLight } from "./panel-light";
import {LibraryThumbnail} from './library-thumbnail.jsx';
import {LibraryPreview,ResultCategoryPreview} from './library.jsx';
import {Skeleton} from './skeleton.tsx';
import React, {useState} from "react";
import { SettingsPatterns } from "./settings-patterns.jsx";
import {
  identity,
  fonts,
  typography,
  spacing,
  radii,
  resolveDesign,
  colorRoles,
} from "./design-system.mjs";
import interLicense from "./assets/fonts/Inter-LICENSE.txt";
import monoLicense from "./assets/fonts/IBMPlexMono-LICENSE.txt";

export function DesignReference({ theme, tone, accent }) {
  const [composerPreview, setComposerPreview] = useState(null);
  const [seamPreview, setSeamPreview] = useState(50);
  const [jobPreviewFilter, setJobPreviewFilter] = useState('all');
  const [modePreview, setModePreview] = useState("default");
  const [pickerWorkerPreview, setPickerWorkerPreview] = useState("codex"), [nativeFastPreview, setNativeFastPreview] = useState("off");
  const [modelPreview, setModelPreview] = useState(["gpt-6-astra", "medium"]);
  const [avatarPreview, setAvatarPreview] = useState("kibo");
  const [avatarMotionPreview, setAvatarMotionPreview] = useState("face");
  const [preview, setPreview] = useState(false);
  const [suggestionDraft, setSuggestionDraft] = useState("");
  const [section, setSection] = useState("components");
  const palette = resolveDesign(theme, tone, accent);
  return (
    <section className="ci-reference design-reference-page" aria-labelledby="ci-title">
      <div className="ci-heading">
        <h2 id="ci-title" aria-label="Vanilla"><VanillaWordmark /></h2>
        <span className="badge">CI {identity.version}</span>
      </div>
      <p className="ci-intro">
        {identity.description} Diese Vorgaben gelten im gesamten Arbeitsbereich.
      </p>
      <div className="design-segments" role="group" aria-label="Designbereich">{[['components','Bausteine'],['icons','Icons'],['colors','Farben'],['type','Schrift'],['layout','Formen'],['rules','Grundlage']].map(([id,label])=><button key={id} type="button" aria-pressed={section===id} onClick={()=>setSection(id)}>{label}</button>)}</div>
      {section === 'icons' && <><h3 className="section-heading">Systemicons</h3><IconMotionPreview/></>}
      {section === 'components' && <>
      <h3 className="section-heading">Bedienelemente & Seitenaufbau</h3>
      <section><h2>Firma</h2><FirmaPreview/><h3>Workspace und Auftragskategorien</h3><WorkspaceSettingsPreview/></section>
      <SettingsPatterns/>
      <h3 className="section-heading">Gespeicherte Stimmen · Beispiel</h3><VoiceProfilesPreview/>
      <h3 className="section-heading">Chat-Sperre · Beispiel</h3>
      <ChatPrivacyPreview/>
      <h3 className="section-heading">Rückfrage am Composer · Beispiel</h3>
      <ComposerQuestionPreview/>
      <h3 className="section-heading">Slash-Befehle · Beispiel</h3><ComposerCommandsPreview/>
      <h3 className="section-heading">Ergebnisse im Chat · Beispiel</h3>
      <ChatArtifactsPreview/>
      <h3 className="section-heading">Aufträge · Reiter</h3>
      <div className="tabs" aria-label="Auftragsfilter als Beispiel">{jobFilters.map(([id,label])=><button key={id} type="button" className={id===jobPreviewFilter?'selected':''} aria-pressed={id===jobPreviewFilter} onClick={()=>setJobPreviewFilter(id)}>{label}</button>)}</div>
      <p className="page-note">Nutzeraufträge nach Status; Systemwartung im eigenen Reiter. Die Auswahl öffnet die gemeinsamen Auftragsdetails.</p>

      <h3 className="section-heading">KI & Modelle · Beispiel</h3>
      <AIMaintenancePreview/>
      <h3 className="section-heading">Kalender · Dein Tag</h3><CalendarPreview/>
      <h3 className="section-heading">Glasbutton · Beispiel</h3>
      <GlassButtonDemo/>
      <h3 className="section-heading">Erscheinungsbild · Beispiel</h3>
      <DefaultToggle/>
      <h3 className="section-heading">Agent-Menü · Beispiel</h3>
      <div className="sidebar-topbar agent-menu-preview"><AgentMenu name="Vanilla" avatar="nori" connectionState="online" preview onNavigate={()=>{}} onRestart={()=>{}} /></div>
      <p className="page-note">Avatar und Name öffnen das gemeinsame Menü. Der Verbindungspunkt gehört zur Identität; Serverdetails stehen im geöffneten Menü. Die Vorschau verändert keine Einstellungen und startet keinen Server neu.</p>
      <h3 className="section-heading">Nachrichtenübergabe · Beispiel</h3>
      {[false,true].map(double=><div className="user-message-row" key={String(double)}>
        <div className="user-message"><p>{double?'Verarbeitung begonnen':'Sicher angekommen'}</p></div>
        <div className="message-actions user-actions"><span className="message-meta"><time>12:34</time><span className="message-delivery"><span role="img" aria-label={double?'Verarbeitung begonnen':'Sicher angekommen'}><DeliveryChecks double={double}/></span></span></span></div>
      </div>)}
      <h3 className="section-heading">Chat-Menü · Beispiel</h3>
      <ChatMenuPreview/>
      <h3 className="section-heading">Nachrichtenaktionen · Mobil</h3>
      <div className="agent-message"><p>Auf dem Handy öffnet das Mehr-Symbol die Aktionen.</p><MessageActions className="agent-actions"><button type="button">Beispielaktion</button><button type="button" disabled>Nicht verfügbar</button></MessageActions></div>
      <h3 className="section-heading">Arbeitsverlauf · Schritte und Änderungen</h3>
      <ActivityPreview/>
      <h3 className="section-heading">Agent-Gesichter · Beispiel</h3>
      <div data-avatar-style={avatarMotionPreview}>
        <AvatarChoices value={avatarPreview} onChange={setAvatarPreview} />
        <div className="settings-group"><AvatarMotionSetting value={avatarMotionPreview} onChange={setAvatarMotionPreview} avatar={avatarPreview} /></div>
      </div>
      <h3 className="section-heading">Benachrichtigung · Beispiel</h3>
      <div className="settings-group"><NotificationRow item={{title:'Tagesüberblick · Fertig',created_at:1788854400,read_at:null}} onClick={()=>{}}/></div>
      <h3 className="section-heading">Gesprächseinstieg · Fächer</h3>
      <ChatStartPreview/>
      <h3 className="section-heading">Antwortkarten · Live-Beispiel</h3>
      <LiveAnswerCardsPreview/>
      <h3 className="section-heading">Unsere Zusammenarbeit · Pixelstatistik</h3>
      <StatisticsPreview/>
      <h3 className="section-heading">Wetter · Himmel im Glasfächer</h3>
      <WeatherPreview/>
      <h3 className="section-heading">Sprache · Pegel und Erkennung</h3>
      <div className="composer-entry"><VoiceWave levels={Array.from({length:60},(_,i)=> i>18 && i<45 ? (1+Math.sin(i*.7))*.08 : 0)}/></div>
      <div className="composer-entry"><VoiceStatus label="Wird erkannt" busy/></div>
      <p className="page-note">Statischer Beispielpegel und gemeinsame Ladeanzeige. Kein Mikrofonzugriff.</p>
      <h3 className="section-heading">Composer · Glasfläche</h3>
      <p className="page-note">Mehrfachansicht · Beispiel: Klicke oder tabbe in eine Eingabe. Nur ihr Rand wird hervorgehoben; ein weicher Schimmer läuft langsam durchgehend um die gedämpfte Kontur. Ein größerer dunkler Abschnitt macht die Bewegung erkennbar.</p>
      <div className="composer-focus-preview">{[0,1,2,3].map(id=><ComposerFocus key={id} multiple active={composerPreview===id} onActivate={()=>setComposerPreview(id)}><textarea aria-label={`Beispieleingabe ${id+1}${composerPreview===id ? ', ausgewählt' : ''}`} placeholder={`Chat ${id+1}`} rows={1}/></ComposerFocus>)}</div>
      <div className="composer pill-composer"><ComposerHeading profile={{name:"Agent",avatar:"nori"}}><span className="model-trigger">Modell · Denkstufe</span></ComposerHeading><div className="composer-entry"><textarea aria-label="Nachricht · Designvorschau" placeholder="Nachricht" value={suggestionDraft} rows={1} readOnly/></div></div>
      <p className="page-note">Einzeilige Pille mit gedämpftem Platzhalter, transparenter Tönung, Hintergrundunschärfe und feiner innerer Glaskante. Mehrzeiliger Text erweitert die Schreibfläche; reduzierte Transparenz erhält einen deckenden Hintergrund.</p>
      <h3 className="section-heading" id="model-picker-preview">Modellwahl · Anbieter und Denkaufwand</h3>
      <ChapterScrubber chapters={[{id:"example-one",title:"Erste Eingabe",description:"Eine Frage im Gespräch",meta:"Beispiel"},{id:"example-two",title:"Zweite Eingabe",description:"Eine weitere Nachricht",meta:"Beispiel"}]} />
      <ModelPicker workerId={pickerWorkerPreview} planAvailable={pickerWorkerPreview === "codex"}
        workerSession={pickerWorkerPreview === "claw-code" ? {configOptions:[{id:"fast",type:"select",currentValue:nativeFastPreview,options:[{value:"on"},{value:"off"}]}]} : undefined}
        onSessionChange={async change => setNativeFastPreview(change.value)} mode={modePreview} onModeChange={setModePreview} serviceTier={modelPreview[2]} onSpeedChange={tier => setModelPreview(old => [old[0], old[1], tier])} model={modelPreview[0]} effort={modelPreview[1]} onChange={(model, effort) => setModelPreview(old => [model, effort, old[2]])}
        models={(pickerWorkerPreview === "codex"
          ? [{model:"gpt-6-astra",displayName:"GPT-6 Astra",serviceTiers:[{id:"priority",name:"Fast"}]}]
          : [{model:"default",displayName:"Claude Sonnet 5.0",resolvedModel:"claude-sonnet-5",isDefault:modelPreview[0] === "default"},
             {model:"sonnet",displayName:"Claude Sonnet 5.0",resolvedModel:"claude-sonnet-5"},
             {model:"sonnet[1m]",displayName:"Claude Sonnet 5.0 · 1M",resolvedModel:"claude-sonnet-5[1m]"},
             {model:"fable",displayName:"Claude Fable 5.1"}, {model:"opus",displayName:"Claude Opus 5.0"}])
          .map(item => ({...item,defaultReasoningEffort:"medium",supportedReasoningEfforts:
            (pickerWorkerPreview === "codex" ? ["low","medium","high","xhigh","max","ultra"] : ["low","medium","high","max"])
              .map(reasoningEffort => ({reasoningEffort}))}))}
        hasConversation onProviderChange={async worker => { setPickerWorkerPreview(worker); setModelPreview([worker === "codex" ? "gpt-6-astra" : "default", "medium"]); }}/>
      <p className="page-note">Kompakter Glasregler mit mittiger Stufe und Fast-Blitz. Klick auf die Mitte öffnet Modell- und Anbieterwahl mit Original-Icons. Das Terrakotta-Quadratfeld wird je nativer Stufe dichter, breiter und lebhafter und bleibt bei reduzierter Bewegung statisch. Keine Rücksetzung auf eine native Voreinstellung. Die Beispieldaten bleiben lokal; im Chat liefert der Anbieter seine verfügbaren Werte und Modellversionen.</p>
      <h3 className="section-heading">Inbox · Gesprächszeile</h3>
      <InboxPatternPreview/>
      <h3 className="section-heading">Heute · Terminzeile</h3>
      <PlannerPatternPreview/>
      <h3 className="section-heading">Chat-Trennung · Haarlinie</h3>
      <div className="pane-seam-preview"><div className="pane-divider-slot"><PaneDivider value={seamPreview} min={0} max={100} onResize={delta=>setSeamPreview(value=>Math.max(0,Math.min(100,value+delta)))} onReset={()=>setSeamPreview(50)}/></div></div>
      <p className="page-note">Leise Haarlinie mit weich auslaufenden Enden. Hover und Tastaturfokus zeigen den kurzen Griff. Beispielwert: {seamPreview} %.</p>
      <h3 className="section-heading">Flächenlicht</h3>
      <div className="panel-light-preview"><PanelLight mode="animated"/><span>Dezente Tiefe mit ruhiger Lichtbewegung</span></div>
      <h3 className="section-heading">Dateivorschau</h3>
      <p className="page-note">Quick Look verwendet die gemeinsame Glasfläche, einen kompakten Dateikopf und aufklappbare Informationen. Die Ergebnisansicht ergänzt kompakte Listen und ein Bildraster mit direkter Auswahlvorschau im rechten Workspace. Doppelklick oder Leertaste öffnen Quick Look.</p>
      <ResultCategoryPreview/><div className="library-entries-grid" aria-label="Dateisymbole">{['HTML','PDF','MP3','ZIP'].map(format=><div key={format}><LibraryThumbnail entry={{name:'Beispiel.'+format,path:'',missing:true,kind:format==='MP3'?'audio':'download'}}/></div>)}</div>
      <button onClick={()=>setPreview(true)}>Vorschau öffnen</button>
      {preview&&<LibraryPreview entry={{id:'example',name:'Dateivorschau',path:'output/beispiel',origin:'Designbeispiel'}} onClose={()=>setPreview(false)}><div className="library-preview"><p>Hier steht das Bild oder Dokument. Dateiaktionen bleiben im rechten Workspace; diese Großansicht zeigt ausschließlich den Inhalt.</p></div></LibraryPreview>}
      <h3 className="section-heading">HTML · gerenderte Dokumente</h3>
      <p className="page-note">HTML-Links öffnen eine responsive Vorschau im Workspace. Vergrößern und echtes Browser-Vollbild behalten denselben Inhalt. Präsentieren ergänzt Vor/Zurück und Folienstand für markierte Folien; gewöhnliches HTML bleibt scrollbar. Die Ergebnisansicht verwendet den gleichen Renderer in Quick Look. Bearbeiten bleibt eine separate Aktion. Skripte im Dokument bleiben von der App isoliert.</p>
      <h3 className="section-heading">Inhalte laden</h3>
      <p className="page-note">Platzhalter für Listen, Einstellungen, Gesprächsverläufe und Vorschauen. Vorhandene Inhalte bleiben beim Aktualisieren sichtbar. Reduzierte Bewegung zeigt ruhende Formen.</p>
      <p className="page-note">Dateiliste: Name, Art und Datum</p>
      <Skeleton layout="library-list" rows={3} announce={false}/>
      <p className="page-note">Bildraster</p>
      <Skeleton layout="library-grid" rows={3} announce={false}/>
      <p className="page-note">Verbindungen und Skills</p>
      <Skeleton layout="connections" rows={2} announce={false}/>
      <Skeleton layout="skills" rows={2} announce={false}/>
      <p className="page-note">Aufträge</p>
      <Skeleton layout="jobs" rows={2} announce={false}/>
      <Skeleton variant="settings" rows={2} announce={false}/>
      <Skeleton variant="chat" announce={false}/>
      <Skeleton variant="document" rows={2} announce={false}/>
      <Skeleton variant="media" announce={false}/>
      <Skeleton variant="attention" announce={false}/>
      </>}
      {section === "type" && <>
      <h3 className="section-heading">Schriften</h3>
      <div className="settings-group ci-fonts">
        {fonts.map((font, index) => (
          <div className="ci-font" key={font.token}>
            <div className="ci-row-label">
              <strong>{font.name}</strong>
              <span>{font.role}</span>
            </div>
            <p
              className="ci-specimen"
              style={{ fontFamily: `var(--${font.token})` }}
            >
              {font.specimen}
            </p>
            {font.system ? <p className="muted">Verwendet die vorhandene Serifenschrift deines Geräts. Kein zusätzlicher Font-Download.</p> : <details className="ci-license">
              <summary>Open Font License · lokal eingebunden</summary>
              <p>
                Ohne Lizenzgebühren, auch kommerziell nutzbar unter der SIL Open
                Font License 1.1. Die Originalschriften und ihre Lizenztexte
                werden mitgeliefert.
              </p>
              <a href={font.source} target="_blank" rel="noreferrer">
                Originalquelle von {font.name}
              </a>
              <pre>{font.name === "Inter" ? interLicense : monoLicense}</pre>
            </details>}
          </div>
        ))}
      </div>
      <div className="ci-details">
        <h3 className="section-heading">Schriftgrößen</h3>
        <div className="ci-types">
          {typography.map((type) => (
            <div className="ci-type" key={type.id}>
              <div>
                <strong
                  style={{
                    fontSize: `var(--text-${type.id})`,
                    lineHeight: type.line,
                    fontWeight: type.weight,
                  }}
                >
                  {type.label}
                </strong>
                <p>{type.use}</p>
              </div>
              <span className="ci-measure">
                {type.size} px{" "}
                <span>
                  Zeile {Number((type.size * type.line).toFixed(1))} ·{" "}
                  {type.weight}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
      </>}
      {section === "colors" && <div className="ci-details">
        <h3 className="section-heading">Aktive Farbwelt</h3>
        <p>Diese Farben folgen deiner Auswahl unter Aussehen.</p>
        <div className="ci-colors">
          {Object.entries(colorRoles).map(([token, label]) => (
            <div className="ci-color" key={token}>
              <span
                className="ci-swatch"
                style={{ background: `var(--${token})` }}
                aria-hidden="true"
              />
              <div>
                <strong>{label}</strong>
                <code>{palette[token].toUpperCase()}</code>
              </div>
            </div>
          ))}
        </div>
      </div>}
      {section === "layout" && <div className="ci-details">
        <h3 className="section-heading">Abstände & Formen</h3>
        <p>
          4-px-Raster; 2 px nur für optische Feinkorrekturen. 8 px innerhalb
          enger Gruppen, 16 px für Innenabstände, 24–32 px zwischen Gruppen und
          48–64 px für große Seitenränder.
        </p>
        <div className="ci-spaces">
          {spacing.map((value) => (
            <div key={value}>
              <span style={{ width: `var(--space-${value})` }} />
              <code>{value} px</code>
            </div>
          ))}
        </div>
        <div className="ci-radii">
          {Object.entries(radii).map(([name, value]) => (
            <div key={name}>
              <span style={{ borderRadius: `var(--radius-${name})` }} />
              <p>
                {
                  {
                    small: "Kleine Details",
                    control: "Eingabefelder & Menüs",
                    button: "Aktionsbuttons",
                    panel: "Gruppen",
                    large: "Große Flächen",
                    pill: "Schalter & Iconflächen",
                  }[name]
                }
                <code>{value === 999 ? "Vollrund" : `${value} px`}</code>
              </p>
            </div>
          ))}
        </div>
      </div>}
      {section === "rules" && <div className="ci-details">
        <h3 className="section-heading">Gemeinsame Grundlage</h3>
        <ul>
          <li>
            Inter für Navigation, Einstellungen und Inhalte. IBM Plex Mono für
            Code und technische Werte.
          </li>
          <li>
            Hierarchie durch Schriftgröße, Gewicht und Abstand. Neutrale
            Bedienelemente; Farbe für Links und verständliche Statusanzeigen.
          </li>
          <li>
            Flache, gruppierte Einstellungen, zurückhaltende Trennlinien und
            klare Beschriftungen.
          </li>
          <li>
            Helles und dunkles Erscheinungsbild verwenden dieselben Rollen mit
            angepassten Farbwerten.
          </li>
          <li>
            Textkontrast mindestens 4,5:1; sichtbarer Tastaturfokus. Status
            immer auch mit Text vermitteln.
          </li>
        </ul>
        <p>
          Die Werte dieser Ansicht und die CSS-Variablen entstehen aus derselben
          versionierten Designquelle. Änderungen gelten nach dem nächsten Build
          für die gesamte Oberfläche.
        </p>
        <code>ui/design-system.mjs</code>
      </div>}
    </section>
  );
}
