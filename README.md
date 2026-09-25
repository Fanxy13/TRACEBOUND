# TRACEBOUND

Ein Action-Puzzle für den Browser, gebaut für Poki. Jeder Versuch in einem Raum wird aufgezeichnet, und beim nächsten Versuch läuft dein früheres Ich als **Echo** exakt dieselbe Spur ab. Du löst die Räume nicht allein, sondern mit deinen vergangenen Aktionen.

- 48 handgebaute Level in 6 Welten, jedes automatisch auf Lösbarkeit geprüft
- Echo-Replay-System: deterministisch, mehrere Echos gleichzeitig, Paradox-Regeln
- 5 Upgrades, die das Lösen verändern, und 7 kosmetische Skins
- Poki SDK (Events, Ads, measure), Desktop und Touch, responsiv, Speichern mit Fallback
- Keine externen Assets: Figur, Icons, Grafiken, Musik und Sounds entstehen im Code

---

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


## Assets und Lizenzen

- **Phaser 3.90**: MIT, siehe `lib/PHASER-LICENSE.md` bzw. `dist/licenses/`.
- **Fredoka SemiBold**: SIL Open Font License 1.1, siehe `assets/fonts/OFL-Fredoka.txt`. Die Schrift wird lokal geladen, im Build ist sie eingebettet.
- **Alles andere entsteht im Code**: die Figur „Tracer“ mit Skins, Icons, Raum-Grafik, Partikel, Hintergründe, Soundeffekte und Musik (Web Audio).
- **Kenney-Assets wurden bewusst nicht verwendet.** Von dieser Umgebung aus war kenney.nl nicht erreichbar, und Kopien aus inoffiziellen Quellen scheiden aus. Die Roguelike Characters sind außerdem frontal gezeichnete 16-px-Sprites ohne Laufzyklen und passen nicht zu einer Seitenansicht. Die eigene Figur hat alle geforderten Animationen (idle, walk, run, interact, success, fail) und kein Lizenzrisiko.

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
