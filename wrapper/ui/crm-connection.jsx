import React, {useRef, useState} from 'react';
import {BrandIcon} from './brand-icon.jsx';
import {crmDefinition, crmDefaultMethod, crmFields, crmStatus} from '../crm-catalog.mjs';

export function CrmConnectionForm({connection, api, notify, Field, onSaved, onChanged}) {
  const provider = crmDefinition(connection.provider);
  const [method, setMethod] = useState(connection.config?.method || crmDefaultMethod(provider));
  const [busy, setBusy] = useState(false), [dirty, setDirty] = useState(false), [check, setCheck] = useState(connection.check);
  const pending = useRef(false);
  const fields = crmFields(provider, method);
  const keepCredentials = connection.secretId && method === connection.config?.method;
  const run = fn => async event => {
    event?.preventDefault();
    if (pending.current) return;
    pending.current = true; setBusy(true);
    try { await fn(event); } catch(error) { notify(error.message); }
    finally { pending.current = false; setBusy(false); }
  };
  const save = run(async event => {
    const form = new FormData(event.currentTarget), config = {method}, credentials = {};
    for (const field of fields) (field.secret ? credentials : config)[field.key] = form.get(field.key) || '';
    await api('/connections/save', {id:connection.id, revision:connection.revision, kind:'crm', provider:provider.id, name:form.get('name'), config, credentials});
    await onSaved('Zugangsdaten im Schlüsselbund gespeichert.');
  });
  return <form onSubmit={save} onChange={() => setDirty(true)}>
    <div className="connection-brand"><BrandIcon name={provider.name}/><strong>{provider.name}</strong></div>
    <Field label="Bezeichnung"><input name="name" defaultValue={connection.name || provider.name} required maxLength={100}/></Field>
    <Field label="Zugangsmethode">
      <select value={method} disabled={busy} onChange={event => setMethod(event.target.value)}>
        {provider.api.auth && <option value="api">{provider.api.check ? 'API-Zugang' : 'API-Zugang vorbereiten'}</option>}
        <option value="login">Login sicher hinterlegen</option>
      </select>
    </Field>
    <p className="form-help">{provider.api.note} <a href={provider.api.source} target="_blank" rel="noreferrer">Anbieterhinweise</a></p>
    <div key={method}>
      {fields.map(field => <Field key={field.key} label={field.label} hint={field.hint}>
        <input name={field.key} type={field.secret ? 'password' : field.type || 'text'}
          autoComplete={field.secret ? 'new-password' : 'off'} spellCheck={false} disabled={busy}
          required={field.required && !(field.secret && keepCredentials)} maxLength={field.secret ? 8000 : 2000}
          defaultValue={field.secret ? '' : connection.config?.method === method ? connection.config?.[field.key] ?? field.default ?? '' : field.default || ''}
          placeholder={field.secret && keepCredentials ? 'Hinterlegt · leer lassen zum Beibehalten' : field.placeholder}/>
      </Field>)}
    </div>
    <p className="form-help">{method === 'login'
      ? 'Benutzername und Passwort liegen im macOS-Schlüsselbund. Die Anmeldung und eine mögliche Zwei-Faktor-Freigabe erfolgen separat; es ist kein automatischer Login aktiv.'
      : provider.api.check ? 'Der Schlüssel liegt im macOS-Schlüsselbund. Nach dem Speichern kannst du den API-Zugang prüfen. Eine Synchronisierung wird separat eingerichtet.'
      : 'Die Zugangsdaten liegen im macOS-Schlüsselbund. Die API ist damit vorbereitet; Zugangsprüfung und Datenaustausch müssen noch eingerichtet werden.'}</p>
    {connection.id && <p className="form-help" role="status">{crmStatus({...connection, check})}</p>}
    <div className="crm-connection-actions">
      {connection.id && <button type="button" disabled={busy} onClick={run(async () => {
        await api('/connections/delete', {id:connection.id});
        await onSaved('Verbindung entfernt. Das Secret bleibt im Schlüsselbund.');
      })}>Verbindung entfernen</button>}
      {connection.id && method === 'api' && provider.api.check && <button type="button" disabled={busy || dirty}
        title={dirty ? 'Änderungen zuerst speichern' : undefined} onClick={run(async () => {
          const result = await api('/connections/test', {id:connection.id});
          setCheck(result); notify(result.message); await onChanged();
        })}>API-Zugang prüfen</button>}
      <button className="primary" disabled={busy}>{busy ? 'Wird bearbeitet …' : 'Sicher speichern'}</button>
    </div>
  </form>;
}
