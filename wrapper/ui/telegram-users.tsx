import {useId} from 'react';
import {Plus, Trash2} from './icons.jsx';
import './telegram-users.css';

type User = {id: string; name: string};

export function TelegramUsers({users, onChange, disabled = false}: {
  users: User[]; onChange: (users: User[]) => void; disabled?: boolean;
}) {
  const heading = useId();
  const hint = useId();
  function update(index: number, field: keyof User, value: string) {
    onChange(users.map((user, at) => at === index ? {...user, [field]: value} : user));
  }
  return <section className="telegram-users" aria-labelledby={heading} aria-describedby={hint}>
    <p id={heading}>Zugelassene Nutzer</p>
    <p id={hint} className="page-note">Nur eingetragene IDs erhalten Zugang zum gewählten Arbeitsbereich.</p>
    {!users.length && <p className="page-note" role="status">Noch niemand freigegeben.</p>}
    {users.map((user, index) => <div className="telegram-user-row" key={index}>
      <label className="field"><span>Name (optional)</span><input aria-label={`Name für Nutzer ${index + 1}`} value={user.name} maxLength={100} disabled={disabled} onChange={event => update(index, 'name', event.target.value)}/></label>
      <label className="field"><span>Telegram-ID</span><input aria-label={`Telegram-ID für Nutzer ${index + 1}`} value={user.id} inputMode="numeric" pattern="[1-9][0-9]{0,15}" maxLength={16} required disabled={disabled} onChange={event => update(index, 'id', event.target.value)}/></label>
      <button type="button" className="icon-button" aria-label={`Nutzer ${user.name || user.id || index + 1} entfernen`} disabled={disabled} onClick={() => onChange(users.filter((_, at) => at !== index))}><Trash2 size={16} strokeWidth={1.6}/></button>
    </div>)}
    <button type="button" disabled={disabled || users.length >= 200} onClick={() => onChange([...users, {id: '', name: ''}])}><Plus size={16} strokeWidth={1.6}/> Nutzer hinzufügen</button>
  </section>;
}
