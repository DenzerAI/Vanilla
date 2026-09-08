import React, { useState } from "react";
import { FileText } from "./icons.jsx";
import { FilterPicker } from "./filter-picker.jsx";
import { jobCategories, filterJobTemplates } from "../job-templates.mjs";
import "./job-templates.css";
import { SettingsNavigationRow } from "./settings-patterns.jsx";

export function JobTemplateList({ query, onChoose }) {
  const [category, setCategory] = useState("all");
  const templates = filterJobTemplates(query, category);
  return <>
    <div className="job-template-controls">
      <p className="form-help">16 Hermes-Vorlagen und ein Interviewbeispiel. Auswahl öffnet einen bearbeitbaren Entwurf.</p>
      <FilterPicker label="Vorlagenkategorie" value={category} onChange={setCategory}
        options={[{ value: "all", label: "Alle Kategorien" }, ...jobCategories.map(value => ({ value, label: value }))]} />
    </div>
    {jobCategories.map(group => {
      const entries = templates.filter(t => t.category === group);
      return entries.length ? <section key={group} aria-label={group}>
        <h2 className="section-heading">{group}</h2>
        <div className="settings-group">{entries.map(t => <SettingsNavigationRow key={t.id}
          icon={<FileText size={19}/>} title={t.name}
          description={<>{t.description}<br/>{t.cadence}{t.note ? " · Hier zunächst manuell" : ""}</>}
          onClick={() => onChoose(t)}/>)}</div>
      </section> : null;
    })}
    {!templates.length && <p role="status">Keine passenden Vorlagen. Ändere die Kategorie oder den Suchbegriff.</p>}
  </>;
}
