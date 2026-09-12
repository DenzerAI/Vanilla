import React, { useEffect, useState } from "react";
import {
  agentAvatars,
  agentAvatar,
  agentAvatarColors,
  avatarColor,
  avatarBackground,
} from "./agent-avatars.mjs";
import { Avatar } from "./avatar.jsx";
import { Check } from "./icons.jsx";
import { Modal } from "./modal.jsx";
import { companionSetLabel } from "./companion-state.mjs";

const previewSets = ["ruhe", "denkt", "arbeitet", "fertig", "ruhe", "liest", "ruft", "tanzt", "schlaeft"];

export function AvatarChoices({ value, color, onChange }) {
  return (
    <fieldset className="avatar-choices">
      <legend className="sr-only">Figur auswählen</legend>
      {agentAvatars.map((avatar) => (
        <label
          className="avatar-choice"
          key={avatar.id}
          title={avatar.description}
        >
          <input
            type="radio"
            name="agent-avatar"
            value={avatar.id}
            checked={value === avatar.id}
            onChange={() => onChange(avatar.id)}
          />
          <span className="avatar-choice-content">
            <Avatar avatar={avatar.id} color={color} large />
            <span>{avatar.name}</span>
            <span className="avatar-choice-check" aria-hidden="true">
              <Check size={13} strokeWidth={2} />
            </span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

export function AvatarColors({ value, onChange }) {
  return (
    <fieldset className="avatar-colors">
      <legend>Hintergrund</legend>
      <div className="avatar-color-options">
        {agentAvatarColors.map((color) => (
          <label
            className="avatar-color-choice"
            key={color.id}
            title={color.name}
          >
            <input
              type="radio"
              name="avatar-color"
              aria-label={color.name}
              value={color.id}
              checked={value === color.id}
              onChange={() => onChange(color.id)}
            />
            <span
              style={{ background: avatarBackground(color.id) }}
              aria-hidden="true"
            >
              {value === color.id ? (
                <Check size={15} strokeWidth={2} />
              ) : color.id === "neutral" ? (
                "×"
              ) : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function AvatarPicker({ value, color, name, onSelect, onClose }) {
  const [selected, setSelected] = useState(agentAvatar(value).id);
  const [background, setBackground] = useState(avatarColor(color));
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setStep((value) => value + 1), 2600);
    return () => clearInterval(timer);
  }, []);
  const set = previewSets[step % previewSets.length];
  return (
    <Modal title="Figur wählen" onClose={onClose}>
      <div className="avatar-picker-preview">
        <Avatar avatar={selected} color={background} large stage set={set} />
        <strong>{name.trim() || "Agent"}</strong>
        <span className="avatar-picker-state" role="status">{companionSetLabel(set)}</span>
      </div>
      <AvatarChoices
        value={selected}
        color={background}
        onChange={setSelected}
      />
      <AvatarColors value={background} onChange={setBackground} />
      <div className="row end avatar-picker-actions">
        <button type="button" onClick={onClose}>
          Abbrechen
        </button>
        <button
          type="button"
          className="primary"
          onClick={() =>
            onSelect({ avatar: selected, avatarColor: background })
          }
        >
          Übernehmen
        </button>
      </div>
    </Modal>
  );
}

export function AgentWelcome({ api, initialName, onSaved, onClose }) {
  const [avatar, setAvatar] = useState(agentAvatars[0].id);
  const [background, setBackground] = useState("neutral");
  const [name, setName] = useState(initialName || "Agent");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal
      title="Dein Agent"
      onClose={() => {
        if (!saving) onClose();
      }}
    >
      <p className="agent-welcome-copy">
        Gib deinem Assistenten eine Figur und einen Namen. Die Figur lebt auf
        der Schreibzeile und zeigt dir, was gerade passiert. Beides kannst du
        später in den Einstellungen ändern.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          setError("");
          try {
            const profile = await api("/identity");
            const saved = await api("/identity", {
              ...profile,
              name,
              avatar,
              avatarColor: background,
            });
            onSaved(saved);
          } catch (e) {
            setError(e.message);
          } finally {
            setSaving(false);
          }
        }}
      >
        <fieldset className="agent-form-fields" disabled={saving}>
          <AvatarChoices
            value={avatar}
            color={background}
            onChange={setAvatar}
          />
          <AvatarColors value={background} onChange={setBackground} />
          <label className="field">
            <span>Name deines Agenten</span>
            <input
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        </fieldset>
        {error && (
          <p role="alert" className="inline-error">
            {error}
          </p>
        )}
        <div className="row end avatar-picker-actions">
          <button type="button" disabled={saving} onClick={onClose}>
            Später
          </button>
          <button className="primary" disabled={saving || !name.trim()}>
            {saving ? "Wird gespeichert …" : "Los geht’s"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
