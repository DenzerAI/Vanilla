# Benutzer

Modul `users`, Version **1.0.0**, Datenformat **3** (SQLite `users`, `sessions.user_id`, `chats.owner_id`).
Einstieg: Einstellungen → Konto. Anmeldung über die vorhandene Login-Seite und den Dialog „Erneut anmelden“.

## Vertrag

Eine Installation hat Personen mit eigenem Konto: Name, Passwort, Rolle. Zwei Rollen reichen.
**Eigentümer** verwalten Konten und sehen alle Chats. **Mitglieder** sehen nur die Chats, die sie
selbst begonnen haben. Kanalgespräche, Aufträge und Firma-Arbeitschats gehören der Installation und
damit den Eigentümern. Die Chat-PIN bleibt der Schutz für persönliche Inhalte, auch gegenüber
Eigentümern. Memory, CRM, Firmenbasis und Ergebnisse bleiben je Installation gemeinsam; Benutzer
trennen Chats, nicht das Wissen. Das ist keine Mandantenfähigkeit und keine Sandbox.

Solange kein Konto existiert, gilt allein der Rückweg-Schlüssel der Installation (bisher
„Zugangscode“); er meldet als Eigentümer an. Das erste Konto ist ein Eigentümer und setzt den
Rückweg-Schlüssel im selben Schritt (`accessKey`, mindestens 8 Zeichen, ein Schlüssel je
Installation), falls noch keiner existiert; die Oberfläche schlägt einen zufälligen vor. Der
Schlüssel bleibt der Weg hinein, falls der letzte Eigentümer sein Passwort verliert, und dient
Skripten als Bearer. Ändern unter Benutzer meldet alle Geräte ab. Eine Schlüssel-Sitzung
erscheint als „Zugangscode“ mit Rolle Eigentümer.

## Schnittstellen im Kern

- `POST /api/auth/login` mit `{name, password}` für ein Konto oder `{token}` für den Zugangscode.
- `GET /api/auth/session` liefert zusätzlich `user` und `accounts` (ob Konten existieren).
- `GET /api/users`: alle Konten für Eigentümer, nur das eigene für Mitglieder, plus `me` und
  `accessConfigured`.
- `POST /api/users` `{name, password, role, accessKey?}`: nur Eigentümer. Name 2 bis 60 Zeichen,
  eindeutig ohne Groß-/Kleinschreibung, Passwort mindestens 8 Zeichen. Ohne konfigurierten
  Schlüssel ist `accessKey` Pflicht und die Rolle Eigentümer.
- `POST /api/users/{id}/password` `{password, current?}`: Eigentümer für alle, Mitglieder für
  sich selbst mit aktuellem Passwort. Beendet alle Sitzungen der Person.
- `POST /api/users/{id}/role`, `POST /api/users/{id}/remove`: nur Eigentümer. Der letzte
  Eigentümer bleibt; niemand entfernt sich selbst. Entfernen beendet die Sitzungen sofort.

Passwörter liegen als scrypt-Hash mit Salz in `users`; Sitzungen tragen `user_id`. Ein entferntes
oder gesperrtes Konto verliert seine Sitzung bei der nächsten Anfrage.

## Durchsetzung

Der Kern setzt Besitz an drei Stellen durch: die Middleware weist Anfragen von Mitgliedern mit
fremder Chat-Kennung (`id`, `chatId`, `threadId`, `sourceChatId`) mit 403 ab; der Ereignisstrom
`/api/events` verwirft für Mitglieder Ereignisse fremder Chats, auch Rückfragen, und kürzt `active`;
Dateiwege unter `chats/<id>/` (`path`, `file`, `directory`) unterliegen demselben Besitz, und
`/api/respond` prüft den Chat der Rückfrage; der Adapter bekommt
je Anfrage `x-agent-user-id` und `x-agent-user-role` und filtert Chatliste, Bootstrap, Suche,
Rückfragen und aktive Chats. Neue Chats erhalten `ownerId` der anfragenden Person; Chats ohne
Besitzer gehören der Installation. Der Adapter kennt keine Namen und keine Passwörter.

## Migration

Additiv. Bestehende Chats haben keinen Besitzer und bleiben für Eigentümer sichtbar. Bestehende
Sitzungen ohne `user_id` laufen als Zugangscode-Sitzungen mit Eigentümerrolle weiter, bis sie
ablaufen. Ältere Codestände ignorieren die neuen Spalten; ein Rückweg löscht keine Konten. Sicherungen enthalten
die Benutzertabelle mit Hashes, nie Klartext.

## Grenzen

Ein Worker mit Hostzugriff kann Dateien anderer Chats lesen; Benutzer sind eine Anwendungsregel,
keine Betriebssystemgrenze. Firma-Arbeitschats sind gemeinschaftlich. Einladungslinks, Anmeldung
per Handy-App und Zwei-Faktor sind nicht Teil dieser Fassung.
