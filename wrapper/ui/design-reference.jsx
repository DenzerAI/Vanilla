import React from "react";
import {TelegramUsers} from "./telegram-users";
import {
  identity,
  fonts,
  typography,
  spacing,
  radii,
  themes,
  colorRoles,
} from "./design-system.mjs";
import interLicense from "./assets/fonts/Inter-LICENSE.txt";
import monoLicense from "./assets/fonts/IBMPlexMono-LICENSE.txt";

export function DesignReference({ theme }) {
  const palette = themes[theme] || themes.dark;
  return (
    <section className="ci-reference" aria-labelledby="ci-title">
      <details className="ci-details"><summary>Nutzerfreigabe für Telegram</summary><TelegramUsers users={[{id:"123456789",name:"Beispielperson"}]} onChange={()=>{}} disabled/></details>
      <div className="ci-heading">
        <h2 id="ci-title">Unser Design</h2>
        <span className="badge">CI {identity.version}</span>
      </div>
      <p className="ci-intro">
        {identity.description} Diese Vorgaben gelten im gesamten Arbeitsbereich.
      </p>
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
      <details className="ci-details" open>
        <summary>
          Schriftgrößen <span>Feste Rollen für jede Ansicht</span>
        </summary>
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
      </details>
      <details className="ci-details" open>
        <summary>
          Farben{" "}
          <span>
            {theme === "light" ? "Helles" : "Dunkles"} Erscheinungsbild
          </span>
        </summary>
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
      </details>
      <details className="ci-details">
        <summary>
          Abstände & Formen <span>Ein gemeinsamer Rhythmus</span>
        </summary>
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
                    control: "Bedienelemente",
                    panel: "Gruppen",
                    large: "Große Flächen",
                    pill: "Pillen",
                  }[name]
                }
                <code>{value === 999 ? "Vollrund" : `${value} px`}</code>
              </p>
            </div>
          ))}
        </div>
      </details>
      <details className="ci-details">
        <summary>
          Gestaltungsregeln <span>Verbindlich für neue Ansichten</span>
        </summary>
        <ul>
          <li>
            Inter für Navigation, Einstellungen und Inhalte. IBM Plex Mono für
            Code und technische Werte.
          </li>
          <li>
            Hierarchie durch Schriftgröße, Gewicht und Abstand. Orange sparsam
            für Identität und Hervorhebung.
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
      </details>
    </section>
  );
}
