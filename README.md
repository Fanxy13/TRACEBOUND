# TRACEBOUND

Ein Action-Puzzle für den Browser, gebaut für Poki. Jeder Versuch in einem Raum wird aufgezeichnet, und beim nächsten Versuch läuft dein früheres Ich als **Echo** exakt dieselbe Spur ab. Du löst die Räume nicht allein, sondern mit deinen vergangenen Aktionen.

- 48 handgebaute Level in 6 Welten, jedes automatisch auf Lösbarkeit geprüft
- Echo-Replay-System: deterministisch, mehrere Echos gleichzeitig, Paradox-Regeln
- 5 Upgrades, die das Lösen verändern, und 7 kosmetische Skins
- Poki SDK (Events, Ads, measure), Desktop und Touch, responsiv, Speichern mit Fallback
- Keine externen Assets: Figur, Icons, Grafiken, Musik und Sounds entstehen im Code

---

## Schnellstart

**Spielen (fertiger Build):** `dist/index.html` direkt im Browser öffnen. Das geht auch per Doppelklick über `file://`, ganz ohne Server.

**Entwickeln (Quellcode, ES-Module):**

```bash
npm install          # nur esbuild + phaser (für Build und Vendoring)
npm run serve        # http://localhost:8080 (http-server)
npm test             # prüft alle 48 Level headless (Lösbarkeit, Determinismus, Fuzz, Bonus)
npm run build        # erzeugt dist/ (eine HTML- und eine JS-Datei)
npm run vendor       # kopiert Phaser aus node_modules nach lib/ (nach einem Phaser-Update)
```

Optionale Browser-Tests (brauchen Playwright und laufenden `npm run serve`):

```bash
node tests/e2e.mjs          # spielt alle 48 Level in der echten GameScene durch
node tests/poki-e2e.mjs     # prüft die Poki-Event-Reihenfolge mit gemocktem SDK
```

## Steuerung

| Aktion | Tastatur | Touch |
|---|---|---|
| Laufen | A / D oder ← / → | Steuerkreuz links |
| Springen | Leertaste / W / ↑ | großer Knopf rechts |
| Benutzen (Hebel, Knopf, Kern) | E / F | Hand-Knopf |
| Zurückspulen (Versuch wird zum Echo) | R | ↺-Knopf |
| Letztes Echo verwerfen | Z / Backspace | ↶ im HUD |
| Pause | ESC / P | ‖ im HUD |
| Menüs | Maus, Pfeiltasten + Enter | Tippen |

Die Eingabeart wird automatisch erkannt und wechselt bei Hybrid-Geräten sofort. Touch-Knöpfe liegen immer außerhalb der Spielfläche: im Querformat seitlich, auf Tablets und im Hochformat unten.

## So funktioniert das Spiel

1. Ein Raum hat eine Loop-Zeit (Zeitleiste im HUD) und eine Anzahl **Echo-Slots**.
2. Die Zeit startet erst mit deinem ersten Input.
3. **Zurückspulen** (R oder Timer-Ende) macht aus dem Versuch ein Echo. Die Szene spult sichtbar zurück, und das Echo erscheint.
4. Echos wiederholen ihre Spur exakt: Sie drücken Platten, legen Hebel um und tragen Kerne. Nach dem Ende ihrer Spur bleiben sie stehen und halten weiter.
5. Sind alle Slots voll, verschwindet beim nächsten Echo das älteste (FIFO). Ältere Echos werden deshalb blasser.
6. **Paradox:** Wird die Spur eines Echos unmöglich, etwa weil eine Tür jetzt zu ist oder die Plattform fehlt, zerbricht es sichtbar an genau dieser Stelle.
7. Tod bedeutet sofortigen Retry desselben Loops. Es gibt kein Game Over.

### Welten

| Welt | Thema | Neue Idee |
|---|---|---|
| 1 Signal (blau) | Grundlagen | Hebel, Platte, erstes Echo, Lichtbrücken, UND-Türen, Timing-Fenster |
| 2 Machine (orange) | Maschinen | Lifte, Fähren, Energiekerne und Sockel, Gegengewichte |
| 3 Clock (violett) | Zeit | Timer-Knöpfe, Uhr-Türen, Laser, **Verzögerungsleitungen** (der Impuls wandert sichtbar durch das Kabel) |
| 4 Grove (grün) | Mehrere Echos | 2–3 Echos gleichzeitig, Abhängigkeitsketten, Choreografien |
| 5 Mirror (rot) | Spiegelung | Echos laufen **gespiegelt**. Die Spiegelung muss auch die andere Raumhälfte überleben. |
| 6 Cosmos | Finale | Alles kombiniert, bis zu 4 Echos, Unterstützung der eigenen Spiegelung |

### Progression (eine einzige Währung)

- **Shards** ◆: +2 beim ersten Abschluss, +1 bei Wiederholung, +3 pro abgeschlossener Welt, +1 pro Bonus-Shard im Level.
- **Upgrades** (Labor), jeweils mit sichtbarem Effekt:
  - **Memory**: +3 s Loop-Zeit pro Stufe
  - **Focus**: größere Interaktionsreichweite, z. B. Hebel hinter Glas
  - **Speed**: +7 % Tempo pro Stufe
  - **Echo+**: +1 Echo-Slot pro Stufe
  - **Sync**: Stufe 1 lässt dich auf Echos stehen, Stufe 2 gibt einen höheren Sprung vom Echo
- Kein Level braucht ein Upgrade. Einige **Bonus-Shards** sind aber gezielt nur mit Sync, Focus oder Echo+ erreichbar, als Grund zum Wiederkommen. Das prüfen die Tests.
- **Skins**: 7 Varianten (Tracer, Ghost, Robot, Shadow, Crystal, Energy, Cosmic). Jede abgeschlossene Welt schaltet eine frei. Sie sind rein kosmetisch, es gibt keine Echtgeldkäufe.
- **Freischaltung in kleinen Gruppen**: Nach dem Tutorial darf man jeweils ein Level überspringen.

## Projektstruktur

```
index.html              Entwicklungs-Einstieg (lädt lib/phaser.min.js + src/main.js als ES-Modul)
styles/main.css         Ladebildschirm, Touch-Steuerung, lokale Schrift
lib/phaser.min.js       Phaser 3.90 (MIT), lokal gebündelt
assets/fonts/           Fredoka SemiBold (OFL) + Lizenz
src/
  main.js               Boot: Poki-Init, Layout, Phaser-Konfiguration
  app.js                geteilte Dienste (Fortschritt, Audio, Input, Event-Bus)
  sim/                  reine Spiellogik ohne Phaser (deterministisch, headless testbar)
    world.js            ein Loop: Physik, Mechanismen, Echo-Wiedergabe, Paradoxe
    session.js          ein Level-Versuch: Echo-Liste (FIFO), Loop-Wechsel
    recording.js        Zeitleiste pro Versuch (Position, Flags, Aktionen je Tick)
    level.js            ASCII-Parser für Räume
    bot.js              Skript-Eingaben für die Level-Tests
  levels/world1..6.js   48 Räume mit Lösungsskripten
  game/                 Konfiguration (Welten, Upgrades, Skins), Fortschritt/Save
  platform/             Poki-Wrapper, localStorage-Fallback, Input, Layout
  audio/audio.js        Web-Audio-SFX + generative Musik je Welt
  render/               Figur/Skins, Raum-Grafik, Mechanismen, Partikel, Icons
  scenes/               Boot, Hintergrund, Spiel, UI (HUD + Menüs)
  ui/                   Buttons/Keycaps, DOM-Touch-Steuerung
tests/                  run.mjs (headless), checks.mjs, e2e.mjs, poki-e2e.mjs
tools/build.mjs         Release-Build (esbuild), tools/checkmaps.mjs
dist/                   Poki-Upload: index.html + game.js + Lizenzen
```

## Replay-System

- Die Simulation läuft mit festen **60 Ticks/s**, unabhängig von der Bildrate. Gerendert wird interpoliert, damit nichts ruckelt.
- Pro Tick speichert eine Aufnahme Position (x, y), Blickrichtung, Bodenkontakt, Tragezustand und sprunghafte Aktionen (Hebel, Knopf, Aufnehmen, Ablegen).
- Echos sind **an ihre Spur gebunden**: Sie werden exakt an die aufgezeichneten Positionen gesetzt, mit Float64-Präzision und ohne Drift. Ihre Aktionen wirken aber auf die **aktuelle** Welt. Ein Echo, das einen Kern aufheben will, der nicht mehr da ist, greift ins Leere.
- **Paradox-Regeln:** Überlappt eine Echo-Spur eine jetzt feste Tür oder Brücke, einen aktiven Laser oder eine Gefahr, oder fehlt der Boden, den das Echo damals hatte, zerbricht das Echo.
- Spiegel-Level: Die Spur wird an der Spiegelachse gespiegelt, und Aktionen werden dort neu aufgelöst, wo die Spiegelung steht.
- Die Tests prüfen Determinismus: Gleiche Eingaben ergeben bitgleiche Welten. Außerdem folgt ein Echo in unveränderter Welt seiner Spur exakt.

## Level hinzufügen

Räume sind ASCII (maximal 32×18 Tiles à 40 px):

```
#  Wand    =  Einweg-Kante   |  Glas   ^ / v  Stacheln
P  Start   X  Ausgang        *  Bonus-Shard  o  Energiekern
a–z Auslöser (plate, lever, button, socket) · A–Z Empfänger (door, bridge, lift, laser)
```

```js
{
  id: '7-1', name: 'Idee', time: 10, echoes: 1,
  map: [ '#####...', ... ],
  obj: { a: { t: 'plate', to: 'A' }, A: { t: 'door', delay: 2 } },
  sol: ['<3.5 s r', '>20.5 .'],          // ein Skript pro Loop, siehe src/sim/bot.js
  bonus: [{ up: { sync: 1 }, sol: [...] }],
}
```

Zusätzliche Optionen sind `all` (UND), `inv` (invertiert), `cycle: [periode, offen, versatz]`, `delay`, Lift `move/mode/speed/floor/wait` und Button `dur`. `npm test` meldet jedes Level, das nicht lösbar ist, ohne Echos lösbar wäre oder einen unerreichbaren Bonus-Shard hat.

## Poki-Integration

`src/platform/poki.js` kapselt das SDK robust:

- `PokiSDK.init()` wird mit Timeout aufgerufen. Fehlt das SDK (Adblocker, offline, `file://`), läuft das Spiel normal weiter.
- `gameLoadingFinished()` wird genau einmal gesendet, wenn die Texturen erzeugt sind und das UI bereit ist.
- `gameplayStart()` kommt erst beim **ersten echten Input** in einem Level und erneut beim Fortsetzen aus der Pause.
- `gameplayStop()` bei Pause, Level-Abschluss, Menüs, Tab-Wechsel und vor jeder Werbung. Doppelte Events sind ausgeschlossen, und während einer Werbung wird nichts gesendet.
- `commercialBreak()` nur an natürlichen Pausen: beim Wechsel zum nächsten Level und beim Neustart. Während der Werbung sind Audio und Input gesperrt.
- `rewardedBreak()` ist rein **opt-in**:
  - „+1 Echo“ im Pausenmenü oder als kleiner Chip, wenn man länger feststeckt
  - „×2 Shards“ auf der Abschluss-Karte
  - Der Reward-Knopf ist lila mit Video-Symbol. „Weiter“ ist immer verfügbar, und es gibt keinen eigenen Ad-Timer.
- `measure()` sendet sparsam:
  - `level/<id>/start|complete|fail` (fail einmal pro Versuch)
  - `tutorial/basics|echo/complete`
  - `world/<n>/start|complete`
  - `upgrade/<id>-<stufe>/complete`
  - `cosmetic/<skin>/complete|interact`
  - `booster/extra-echo|double-shards/complete`

**Upload:** Den Inhalt von `dist/` hochladen. Der einzige externe Request ist das Poki-SDK-Skript, alles andere ist lokal.

## Assets und Lizenzen

- **Phaser 3.90**: MIT, siehe `lib/PHASER-LICENSE.md` bzw. `dist/licenses/`.
- **Fredoka SemiBold**: SIL Open Font License 1.1, siehe `assets/fonts/OFL-Fredoka.txt`. Die Schrift wird lokal geladen, im Build ist sie eingebettet.
- **Alles andere entsteht im Code**: die Figur „Tracer“ mit Skins, Icons, Raum-Grafik, Partikel, Hintergründe, Soundeffekte und Musik (Web Audio).
- **Kenney-Assets wurden bewusst nicht verwendet.** Von dieser Umgebung aus war kenney.nl nicht erreichbar, und Kopien aus inoffiziellen Quellen scheiden aus. Die Roguelike Characters sind außerdem frontal gezeichnete 16-px-Sprites ohne Laufzyklen und passen nicht zu einer Seitenansicht. Die eigene Figur hat alle geforderten Animationen (idle, walk, run, interact, success, fail) und kein Lizenzrisiko.

## Originalität

TRACEBOUND steht in der Tradition von Replay- und Zeitschleifen-Puzzlern, hat aber eigene Regeln und Werkzeuge:

- Echos sind **spurgebunden** mit sichtbarer Spur und brechen bei Widersprüchen als Paradox.
- Eine **Zeitleiste** zeigt, wann welches Echo handelt.
- **FIFO-Slots**, die man über Upgrades erweitert.
- **Gespiegelte Echos**, die die andere Raumhälfte bestehen müssen.
- **Verzögerungsleitungen**: Signale wandern sichtbar durch Kabel und machen „vorprogrammierte“ Türen möglich.
- **Sync**: Man kann auf der eigenen Vergangenheit stehen.
- Keine fremden Namen, Figuren oder Marken.

## QA-Stand

| Prüfung | Ergebnis |
|---|---|
| Alle 48 Level headless lösbar (Basiswerte, Loop-Zeit, Echo-Kapazität) | ✅ `npm test` |
| Level ohne Echos nicht lösbar, Determinismus, Fuzz (keine NaN, kein Clipping) | ✅ `npm test` |
| Bonus-Shards erreichbar, Upgrade-Shards ohne Upgrade unerreichbar | ✅ `npm test` |
| Alle 48 Level im echten Browser durchgespielt, ohne Fehler | ✅ `tests/e2e.mjs` |
| Poki-Events: Reihenfolge, keine Duplikate, nichts während Ads, Audio/Input gesperrt | ✅ `tests/poki-e2e.mjs` |
| SDK blockiert (Adblock/offline): Spiel startet und ist voll spielbar | ✅ |
| localStorage gesperrt oder Save beschädigt: keine Fehler, Spiel läuft | ✅ |
| Speichern/Laden (Level, Shards, Upgrades, Skins, Einstellungen) | ✅ |
| Externe Requests: nur das Poki-SDK | ✅ |
| Release-Build läuft über `file://` | ✅ |
| Layouts: Desktop, Phone quer/hoch, Tablet, Touch-Knöpfe nie über der Spielfläche | ✅ |

Build-Größe: `dist/game.js` ≈ 1,2 MB (davon Phaser 1,06 MB, gzip insgesamt ≈ 330 KB), `dist/index.html` ≈ 27 KB mit eingebetteter Schrift. Es werden keine Bild- oder Audiodateien geladen.
