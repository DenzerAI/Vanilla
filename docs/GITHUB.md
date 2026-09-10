# GitHub einrichten

GitHub gehört unter **Einstellungen → Verbindungen → Weitere Dienste einrichten**.
Jede Installation meldet ihr eigenes Konto an. Vanilla liest keine vorhandene
`gh`- oder Worker-Anmeldung aus. Der Dialog zeigt echten Konto-, Repository- und
Prüfstatus; ein gespeicherter Link allein ist keine Verbindung.

## Einmal beim Herausgeber

Eine GitHub App registrieren, Device Flow aktivieren und die Installation für
andere Konten zulassen. Homepage ist das öffentliche Vanilla-Repository. Es ist
kein Callback- oder zentraler Tokenserver erforderlich. Die öffentliche Client-ID
im Verbindungsdialog hinterlegen oder über `VANILLA_GITHUB_CLIENT_ID` ausliefern.
Client-Secret und private App-Schlüssel werden nicht an Installationen verteilt.

Repositoryrechte der App: **Contents: read/write**, **Metadata: read**,
**Actions: read**. Weil neutrale Codebeiträge auch `.github/workflows/` enthalten,
benötigt dieser vollständige Austausch **Workflows: write**. Diese Berechtigung
ist bewusst stärker als reines Lesen. App ausschließlich für die vereinbarten
Repositorys installieren; keine Organisationsverwaltung oder Repositorylöschung.
Die Registrierung und ihre Client-ID sind installationsabhängig und werden
nicht durch einen Clone dieses Projekts automatisch angelegt.

GitHub dokumentiert [Device Flow](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app)
und [Erneuerung der User-Token](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/refreshing-user-access-tokens).
Access- und Refresh-Token liegen im vorhandenen ProviderVault. Ablauf und Widerruf
führen zu erneuter Anmeldung; Token erscheinen weder im UI noch in Codebeiträgen.

## Kundeninstallation

1. Ein **eigenständiges privates Repository** anlegen. Ein öffentlicher Fork ist
   dafür ungeeignet. Eine geprüfte öffentliche Vanilla-Ausgangsbasis darin sichern.
   Vorhandene Kundenhistorie niemals ungeprüft spiegeln; Erstübernahme führt
   [CODE-SYNC.md](CODE-SYNC.md). Gemeinsame Basis muss sowohl öffentlich in Vanilla
   als auch im privaten Repository vorhanden sein.
2. Dem vereinbarten Betreuer `DenzerAI` Zugriff auf dieses Repository geben.
   Einladung und Rechte werden außerhalb der App eingerichtet. Die App erteilt
   selbst keine neuen Rechte. Auch der Betreuer installiert die GitHub App für
   die freigegebenen Kundenrepositorys und meldet sein eigenes Konto an.
3. GitHub im Verbindungsdialog öffnen, **Verbinden**, den angezeigten Einmalcode
   auf GitHub bestätigen und anschließend das private Repository auswählen.
4. **Updates → Beiträge → Codeaustausch** öffnen. Rolle Kundeninstallation und
   den vereinbarten Umfang des neutralen Codeaustauschs bestätigen. Der Server
   prüft Repository-ID, Kontoinhaber, Schreibrecht und Betreuerzugriff erneut.
5. **Teilen** ausprobieren. Erst die bestätigte Remote-Referenz ergibt „Geteilt“.
   Beim Vorbereiten eines betreuten Updates ist derselbe Schritt enthalten.

Der neutrale Stand wird ohne Elternhistorie unter
`vanilla-share/<Quellbaumhash>` gespeichert. Seine neutrale Commitnachricht
nennt den gemeinsamen öffentlichen Vanilla-Basiscommit. Die private Hauptbranch
wird weder ersetzt noch automatisch mit einem Update überschrieben. Unklare
Übermittlungen zuerst anhand des gespeicherten Auftrags und der Remote-Referenz
klären; keine Force-Pushes oder blinden Wiederholungen.

Workflowdefinitionen im privaten Repository können auf neue Branches reagieren.
Für `vanilla-share/**` **keine automatisch ausgeführten Workflows mit Secrets oder
Schreibrechten** zulassen. Die App legt keine Pull Requests an und führt beim
Empfang keine Workflowdatei aus; bestehende GitHub-Repositoryregeln gehören zur
Einrichtung und müssen diesen Austauschzweig ausschließen.

## Ursprungsinstallation

Eigenes Konto verbinden, `DenzerAI/Vanilla` auswählen und unter Codeaustausch die
Rolle **Ursprung** speichern. Dafür wird tatsächlicher Schreibzugriff geprüft.
Eine Rolle im lokalen Datensatz allein reicht nicht. Der Beitragseingang liest
nur über die App und dieses Konto erreichbare private Repositorys.

**Prüfen** erklärt einen Beitrag. **Übernehmen** bereitet die Zusammenführung in
`data/control/contributions/<ID>/candidate` auf einem getrennten Entwicklungszweig
vor. Erst nach Datenschutzprüfung, Funktionstests und gezielter Veröffentlichung
wird daraus öffentlicher Vanilla-Code. Die laufende Installation bleibt erhalten.

**Trennen** entfernt die lokalen GitHub-Token und verhindert danach neue Zugriffe.
Bereits geteilter Code bleibt im privaten Repository. Rollenvereinbarung und
Quellstände sind kein Lizenzersatz; öffentliche Downloads werden durch den
betreuten Updateablauf technisch nicht eingeschränkt.
