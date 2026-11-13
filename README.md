# Zyklus – privater Periodentracker

Eine Web-App (PWA) zum Tracken von Periode, Schmerzen, Energie, Stimmung und mehr, mit Prognosen und nachvollziehbaren Analysen.

**Alle Daten bleiben auf deinem Gerät.** Es gibt keinen Server, kein Konto und kein Tracking. Die Einträge werden lokal im Browser gespeichert (IndexedDB).

## Funktionen

- **Heute:** Zyklustag, aktuelle Phase, Countdown bis zur nächsten Periode
- **Tageseintrag:** Blutung, Schmerzen (mit Intensität), Energie, Stimmung, Schlaf, Haut, Verdauung, Appetit, Zervixschleim, Lust, Sex, Medikamente, Basaltemperatur und Notizen
- **Anpassbar:** Kategorien und Optionen sortieren, ausblenden oder eigene anlegen
- **Kalender:** Perioden, Prognosen, fruchtbare Tage, Eisprung; vergangene Perioden nachtragen
- **Analyse** (jeweils mit „Wie wird das berechnet?“):
  - Ø Zyklus- und Periodenlänge, Regelmäßigkeit
  - Prognose der nächsten Periode mit Schwankungsbereich
  - Fruchtbares Fenster und Eisprung (geschätzt bzw. per Basaltemperatur)
  - Muster: welche Symptome in welcher Zyklusphase gehäuft auftreten
  - Befinden (Energie, Schlaf, Schmerzintensität) je Phase
  - Symptom-Verlauf je Zyklustag
  - Basaltemperatur-Kurve mit „3-über-6“-Regel
- **Backup:** Export/Import als JSON, Export als CSV-Tabelle
- Offline nutzbar, Hell- und Dunkelmodus

## Installation auf dem Smartphone

1. App-URL im Browser öffnen (`https://<github-name>.github.io/zyklus-app/`)
2. **iPhone (Safari):** Teilen-Symbol → „Zum Home-Bildschirm“
   **Android (Chrome):** Menü ⋮ → „App installieren“ / „Zum Startbildschirm hinzufügen“
3. Ab jetzt über das Icon starten

> Auf dem iPhone ist Schritt 2 wichtig: Safari kann Daten normaler Webseiten nach längerer Nichtnutzung löschen. Installierte Web-Apps sind davon ausgenommen.

## Veröffentlichen mit GitHub Pages

Repository → **Settings → Pages** → Source: „Deploy from a branch“ → Branch `main`, Ordner `/ (root)` → Save.

## Hinweis

Prognosen und fruchtbare Tage sind statistische Schätzungen. Die App ist kein Medizinprodukt und nicht zur Verhütung geeignet.
