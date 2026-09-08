import {Skeleton} from './skeleton.tsx';
import React, { useState, useEffect } from "react";
import { DEFAULT_AGENT_PREFERENCES } from "../identity-preferences.mjs";
import { Avatar } from "./avatar.jsx";
import { AvatarPicker } from "./avatar-picker.jsx";
import { SettingRow } from "./settings-row.jsx";

export function AgentPreferences({ api, onSaved }) {
  const [data, setData] = useState(null),
    [saved, setSaved] = useState(null);
  const [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [picker, setPicker] = useState(false);
  useEffect(() => {
    let cancelled = false;
    api("/identity")
      .then((profile) => {
        if (!cancelled) {
          setData(profile);
          setSaved(profile);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [api]);
  if (!data)
    return error ? <p role="alert">{error}</p> : <Skeleton variant="settings" label="Dein Agent wird geladen …"/>;
  const dirty =
    data.name !== saved.name ||
    data.avatar !== saved.avatar ||
    data.avatarColor !== saved.avatarColor ||
    data.avatarConfigured !== saved.avatarConfigured ||
    data.preferences !== saved.preferences;
  return (
    <>
      <form
        className="agent-preferences"
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          setError("");
          try {
            const profile = await api("/identity", data);
            setData(profile);
            setSaved(profile);
            setMessage("Dein Agent wurde gespeichert.");
            onSaved(profile);
          } catch (e) {
            setError(e.message);
          } finally {
            setSaving(false);
          }
        }}
      >
        {error && (
          <p role="alert" className="inline-error">
            {error}
          </p>
        )}
        <div className="settings-save-row">
          <span role="status">{dirty ? "Ungespeicherte Änderungen" : message || "Keine Änderungen"}</span>
          <button
            type="submit"
            className="primary"
            disabled={saving || !dirty || !data.name.trim()}
          >
            {saving ? "Wird gespeichert …" : "Speichern"}
          </button>
        </div>
        <fieldset className="agent-form-fields" disabled={saving}>
          <h3 className="section-heading">Profil</h3>
          <div className="settings-group">
            <div className="agent-profile-row">
              <button
                type="button"
                className="agent-profile-picture"
                aria-label="Profilbild ändern"
                onClick={() => setPicker(true)}
              >
                <Avatar avatar={data.avatar} color={data.avatarColor} large />
              </button>
              <div>
                <strong>{data.name.trim() || "Agent"}</strong>
                <p>Dein persönlicher Assistent</p>
              </div>
              <button type="button" onClick={() => setPicker(true)}>
                Bild ändern …
              </button>
            </div>
            <SettingRow title={<label htmlFor="agent-name">Name</label>}>
              <input
                id="agent-name"
                className="agent-name-input"
                value={data.name}
                maxLength={100}
                required
                onChange={(e) => setData({ ...data, name: e.target.value })}
              />
            </SettingRow>
          </div>
          <h3 className="section-heading">
            <label htmlFor="agent-working-style">
              Wie soll dein Agent arbeiten?
            </label>
          </h3>
          <div className="settings-group agent-working-style">
            <textarea
              id="agent-working-style"
              rows={9}
              maxLength={12000}
              value={data.preferences}
              onChange={(e) =>
                setData({ ...data, preferences: e.target.value })
              }
            />
            <SettingRow
              title="Persönliche Arbeitsweise"
              description="Wird bei neu gestarteten Gesprächen berücksichtigt."
            >
              <button
                type="button"
                disabled={data.preferences === DEFAULT_AGENT_PREFERENCES}
                onClick={() =>
                  setData({ ...data, preferences: DEFAULT_AGENT_PREFERENCES })
                }
              >
                Standard verwenden
              </button>
            </SettingRow>
          </div>
        </fieldset>

      </form>
      {picker && (
        <AvatarPicker
          value={data.avatar}
          color={data.avatarColor}
          name={data.name}
          onClose={() => setPicker(false)}
          onSelect={(selection) => {
            setData({ ...data, ...selection, avatarConfigured: true });
            setPicker(false);
          }}
        />
      )}
    </>
  );
}
