---
name: report-result
description: Prüft Ergebnisse eines bearbeiteten Auftrags und meldet Erfolg, Fehler und offene Punkte mit Belegen zurück. Verwenden beim Abschluss eines Auftrags.
---

# Ergebnis melden

## Eingabe

Ein reservierter Auftrag und der gemeinsame Bootstrap.

## Ablauf

1. Prüfe Ziel und Grenzen des Auftrags.
2. Führe die Arbeit aus und verifiziere das Ergebnis angemessen.
3. Trenne Ergebnis, Fehler und wiederverwendbare Erkenntnisse.
4. Melde den Lauf über den vorgesehenen Complete- oder Fail-Endpunkt zurück.

## Ausgabe

- `result`: kurze, eigenständig verständliche Ergebnisbeschreibung
- `learnings`: nur dauerhaft nützliche, nicht geheime Erkenntnisse
- `error`: bei Fehlschlag eine konkrete, handlungsfähige Beschreibung

## Verwendung außerhalb des Order-Protokolls

Es gelten ../AGENTS.md und ../FIRMA.md. Benötigt werden der konkrete Auftrag,
seine Ergebnisdateien und vorhandene Werkzeugbelege. Prüfe das Ergebnis gegen
das angefragte Ziel; benenne fehlende Belege als offen. Im Wrapper antworte im
aktuellen Gespräch und verlinke vorhandene Ausgabedateien. Ohne reservierten
Order-Lauf keinen Complete-Endpunkt aufrufen. Bei Order-Läufen gelten die
Endpunkte und das Artefaktformat des aktuellen Bootstrap. Übernimm nur belegte
Firmendaten aus der gemeinsamen Quelle. Ein ausreichend gutes Ergebnis benennt
Ergebnis, Prüfung und verbleibende Grenzen eigenständig verständlich.
