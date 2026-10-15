# Projekt Kaiser-Klon

Rundenbasierte Wirtschaftssimulation im Heiligen Römischen Reich (18. Jh.) mit Retro-Windows-95/98-Oberfläche.
Einzelspieler gegen KI sowie Hot-Seat- bzw. asynchroner Mehrspieler für bis zu 9 Spieler.

```bash
npm install
npm run dev        # Entwicklungsserver (http://localhost:5173)
npm test           # Engine- und KI-Tests
npm run build      # Typecheck + Produktions-Build nach dist/
SIM_REPORT=1 npm run sim   # Balancing-Report: 5 komplette KI-Partien
SIM_SUMMARY=30 npm run sim # Siege und Ø-Endtitel je Archetyp über 30 Seeds
SIM_ECON=30 npm run sim:econ # Einnahmen, Sold, Taverne-Rendite, Kriege je Archetyp
SIM_INCOME=30 npm run sim:econ # Steuern nach Art, Kornhandel, Landkauf, Bauten, Beute, Endbestand
```

## Architektur

```
src/engine/   Reine Spiellogik, kein DOM – vollständig per Vitest getestet
  types.ts        Serialisierbarer GameState (= Spielstand)
  constants.ts    Alle Balancing-Werte (Preise, Titel, Einheiten, Archetypen …)
  economy.ts      Pure Functions, u. a. calculateEconomyTurn (Live-Vorschau im UI)
  actions.ts      Spieleraktionen – identisch für Mensch und KI (keine Cheats)
  turn.ts         State-Machine: beginYear → Befehle → resolveYear (onTurnEnd)
  events.ts       Zufallsereignisse als Shuffle-Bag (20 Karten mit Bedingungen)
  bank.ts         Kredite, Zinsen, 3-stufige Insolvenz-Kaskade
  military.ts     Garde/Heer, Kampf-Algorithmus, Manöver
  covert.ts       Taverne: Spionage, Raub, Sabotage, Attentat, Casus Belli
  titles.ts       Adelstitel, Beförderung, Degradierung
  election.ts     Reichstag / Kaiserwahl mit verdeckter Bestechung
  ai.ts           Utility-KI: 4 Archetypen, 4-Schritte-Budget, Groll-Gedächtnis
  intel.ts        Öffentliche (gerundete) Rivalen-Infos – für Mensch und KI gleich
src/ui/       React-Oberfläche im Win95-Stil
  Desktop.tsx     Statusleiste, Desktop-Icons, Fenster-Manager, Taskleiste, Herold
  windows/        Kornkammer, Marktplatz, Bauamt, Schatzamt, Bank, Kaserne, Taverne, Thronsaal, Statistik …
  screens/        Setup, Hot-Seat-Übergabe, KI-Berechnung (künstl. Ladezeit), Spielende
  BossScreen.tsx  Boss-Taste (F2): Tarnung als Tabellenkalkulation
```

## Umsetzung der Design-Entscheidungen

| GDD | Umsetzung |
| --- | --- |
| Asynchroner Runden-Loop | Eigene Aktionen (Handel, Bau, Bank, Rekrutierung) wirken sofort zu den fixen Jahrespreisen; Angriffe, Intrigen und Bestechung landen in `state.queue` und werden in `resolveYear` aufgelöst. |
| Event-Deck | `events.ts`: 20 Karten, Bedingungen (Pest nur ab 3.000 Einwohnern), neu gemischt erst wenn leer. |
| Pure Functions | `calculateEconomyTurn` speist die Vorschau in Statusleiste, Kornkammer und Schatzamt. |
| Stadt-Formel | `cityCount()` – abgeleitet, kein eigenes Gebäude: 5 Märkte + 3 Mühlen = 1 Stadt (+10 % Steuern). |
| Insolvenz | Pfändung Sparkonto → Zwangsversteigerung zum halben Preis → Schuldturm (1 Runde aussetzen, keine Kornausgabe, wehrlos, Rückstufung). |
| Sicherer Hafen | Diebstahl-Ereignis greift nur die Kasse an, nie das Sparkonto. |
| Lehnswesen | Ritter: 0 Sold, 50 ha Lehen; landlose Ritter fordern Strafsold oder desertieren. Nur per Knappe → Manöver → Ritterschlag (ab Graf). |
| Taverne | Chance = Gold ÷ (Gold + Garde × Justiz), Attentat max. 25 %, Folter → Casus Belli (Moralbonus, keine Marschkosten). |
| KI | Gleiche Aktionen wie der Mensch; Überleben → Spekulation → Titel-Engpass → Militär/Sabotage; Groll (Diebstahl 35, Angriff 50) + Neid auf den Führenden. |
| Kaiserwahl | König + Kathedrale ruft den Reichstag aus; 7 Sitze (Kurfürsten + Kirchenfürsten), 4 Stimmen gewinnen; Patt → alle Gelder verfallen. |
| UI | Draggable Fenster, Herold-Alertboxen, klickbare 10-Jahres-Graphen, Boss-Taste, 0,8–1,5 s KI-Bedenkzeit. |

Spielstände werden automatisch im Browser gesichert und lassen sich über das Startmenü als Datei
speichern/laden – so funktioniert auch asynchroner Mehrspieler per Dateiaustausch.
