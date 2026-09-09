import { useEffect, useRef, useState } from "react";
import { iconCatalog, iconByName } from "./icon-catalog.mjs";
import { MotionGlyph } from "./motion-glyph";
import { animateIcon } from "./icon-motion";
import { IconButton } from "./icon-button";
import { CopyButton } from "./copy-button";
import { NotificationBell } from "./notification-bell";
import frameworkLicense from "./assets/icons/Framework7-LICENSE.txt";
import lucideLicense from "./assets/icons/Lucide-LICENSE.txt";

/** This reference uses the production driver and respects the actual motion preference. */
export function IconMotionPreview() {
  const [selected, setSelected] = useState("Bell");
  const [search, setSearch] = useState("");
  const [signal, setSignal] = useState(0);
  const detail = useRef<HTMLDivElement>(null);
  const item = iconByName[selected];
  const query = search.trim().toLocaleLowerCase("de-DE");
  const visible = iconCatalog.filter((icon) =>
    `${icon.name} ${icon.label}`.toLocaleLowerCase("de-DE").includes(query),
  );
  const replay = () =>
    detail.current
      ?.querySelectorAll("svg")
      .forEach((svg) => animateIcon(svg, "preview"));
  useEffect(() => {
    detail.current
      ?.querySelectorAll("svg")
      .forEach((svg) => animateIcon(svg, "preview"));
  }, [selected]);
  return (
    <section
      className="icon-reference"
      aria-label="Systemicons und Animationen"
    >
      <div className="icon-reference-detail" ref={detail} data-icon-preview>
        <IconButton label={`${item.label} abspielen`} onClick={replay}>
          <MotionGlyph name={selected} size={32} />
        </IconButton>
        <div>
          <strong>{item.label}</strong>
          <p>{item.description}</p>
        </div>
      </div>
      <label className="icon-reference-search">
        <span className="sr-only">Icons durchsuchen</span>
        <input
          type="search"
          placeholder="Icon suchen …"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <span>{visible.length} Icons</span>
      </label>
      <div
        className="icon-reference-grid"
        role="group"
        aria-label="Alle Systemicons"
        data-icon-preview
      >
        {visible.map((icon) => (
          <IconButton
            key={icon.name}
            label={icon.label}
            active={selected === icon.name}
            onClick={() => setSelected(icon.name)}
          >
            <MotionGlyph name={icon.name} size={20} />
          </IconButton>
        ))}
      </div>
      {!visible.length && (
        <p className="page-note" role="status">
          Kein passendes Icon gefunden.
        </p>
      )}
      <p className="page-note">
        Hover oder Klick spielt die Vorschau ab. Die Einstellung unter Aussehen
        gilt auch hier. Kopier-Haken in der Sammlung sind Beispiele.
      </p>
      <div className="icon-motion-preview">
        <CopyButton
          text="Iconanimation · Designbeispiel"
          label="Beispieltext kopieren"
        />
        <IconButton
          label="Beispielbenachrichtigung"
          onClick={() => setSignal((n) => n + 1)}
        >
          <NotificationBell preview signal={signal} />
        </IconButton>
      </div>
      <p className="page-note">
        Kopieren schreibt diesen Beispieltext in die Zwischenablage. Die Glocke
        zeigt einen lokalen Beispielhinweis.
      </p>
      <details className="icon-reference-licenses">
        <summary>Iconquellen und Lizenzen</summary>
        <p>
          Framework7 Icons, Lucide und die vorhandenen Spaltensymbole. Eigene
          Animationen nach der freigegebenen Bewegungsstudie.
        </p>
        <pre>{frameworkLicense}</pre>
        <pre>{lucideLicense}</pre>
      </details>
    </section>
  );
}
