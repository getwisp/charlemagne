export function HelpWindow() {
  return (
    <div className="scroll-area" style={{ lineHeight: 1.45, maxHeight: 420, userSelect: 'text' }}>
      <h3 style={{ marginTop: 0 }}>Karl 98 – Kurzanleitung</h3>
      <p>
        Jede Runde ist ein Jahr. Zu Jahresbeginn bestimmen Wetter und Zufall Ernte und Preise. Dann gebt Ihr Eure Befehle – Handel, Bau, Bank und Rekrutierung wirken sofort, Angriffe,
        Intrigen und Bestechungen werden verdeckt in eine Warteschlange gelegt. Haben alle Spieler ihren Zug beendet, rechnen die Computergegner, und der Jahreswechsel löst alles auf.
      </p>
      <h4>Wirtschaft</h4>
      <ul>
        <li>Jeder Bürger braucht 2 Scheffel Korn (100 %). Weniger führt zu Hunger und Abwanderung, mehr lockt Zuwanderer.</li>
        <li>Ratten fressen 5–20 % des Lagers – Kornspeicher schützen.</li>
        <li>Pilger spenden je 1.000 Einwohner – umso mehr, je mehr Kathedralen und Paläste Ihr besitzt und je milder Eure Justiz ist.</li>
        <li>Jedes Gebäude braucht 1.000 ha freies Land. 5 Märkte + 3 Mühlen ergeben automatisch eine Stadt: Die ersten drei bringen je +10 % Steuern, jede weitere +5 %.</li>
        <li>Steuern kosten ab dem ersten Prozentpunkt: Einkommensteuer treibt Bürger fort, Mehrwertsteuer und Zölle lassen den Handel ausweichen (Ertragsmaximum um 11 %). Das Schatzamt zeigt den Haushalt als Vorschau.</li>
      </ul>
      <h4>Bank</h4>
      <ul>
        <li>Das Sparkonto bringt Zinsen und ist vor Dieben sicher. Kredite haben feste Laufzeiten und Zinsen.</li>
        <li>Rutscht die Kasse ins Minus: Pfändung → Zwangsversteigerung zum halben Preis → Schuldturm (1 Jahr aussetzen, Rückstufung).</li>
      </ul>
      <h4>Militär &amp; Lehnswesen</h4>
      <ul>
        <li>Die Garde schützt vor Intrigen, das Heer kämpft. Kampfkraft = Basiskraft × Moral × Ausbildung × Defensivbonus.</li>
        <li>Ritter kosten keinen Sold, binden aber je 50 ha Lehnsland. Werden sie landlos, verlangen sie Strafsold oder desertieren.</li>
        <li>Ritter entstehen nur aus Knappen: anwerben, zwei Manöver, dann ab Graf zum Ritter schlagen.</li>
      </ul>
      <h4>Taverne</h4>
      <p>Ausspähen (ab Baron), Raub (Graf), Sabotage (Fürst), Attentat (Herzog). Gefasste Spione können unter der Folter reden – das Opfer erhält einen Casus Belli.</p>
      <h4>Diplomatie</h4>
      <ul>
        <li>Im Thronsaal (Diplomatie) entsendet Ihr Gesandte, auf Wunsch mit Mitgift. Der Empfänger antwortet im nächsten Jahr; lehnt er ab oder schweigt er, kehrt die Mitgift zurück.</li>
        <li>Nichtangriffspakt: kein Krieg. Handelsabkommen: +5 % Mehrwertsteuer und Zölle für beide (höchstens drei zählen). Verteidigungsbündnis: enthält den Pakt, und bei einem Angriff kämpfen 25 % des Partnerheeres mit.</li>
        <li>Verträge laufen fest 5 Jahre. Wer trotzdem angreift, bricht sein Wort: Skandal, Casus Belli für das Opfer, Groll aller Herrscher. Fliegt ein Dieb, Saboteur oder Attentäter beim Partner auf, platzen die Verträge.</li>
      </ul>
      <h4>Titel &amp; Kaiserwahl</h4>
      <p>
        Edler → Freiherr → Baron → Graf → Fürst → Herzog → Kurfürst → König → Kaiser. Alle Voraussetzungen müssen gleichzeitig erfüllt sein, max. eine Beförderung pro Jahr. Ist ein König
        im Besitz einer Kathedrale, wird der Reichstag einberufen: 7 Stimmen, 4 gewinnen.
      </p>
      <h4>Desktop &amp; Tastatur</h4>
      <ul>
        <li>Doppelklick auf ein Symbol öffnet es (am Handy genügt ein Tipp). Pfeiltasten wählen ein Symbol, <b>Enter</b> öffnet es.</li>
        <li>Doppelklick auf die Titelleiste maximiert ein Fenster. Rechtsklick auf Desktop oder Taskleiste ordnet die Fenster an; unter „Eigenschaften" wählt Ihr die Hintergrundfarbe.</li>
        <li>
          <b>Strg+Esc</b> – Startmenü. In Menüs löst der unterstrichene Buchstabe den Eintrag aus. <b>F2</b> – Boss-Taste (Tabellenkalkulation). <b>Esc</b> – zurück bzw. Menü schließen.
        </li>
        <li>Klänge sind anfangs aus; der Lautsprecher in der Taskleiste schaltet sie ein. Den Bildschirmschoner stellt Ihr unter Rechtsklick → Eigenschaften ein.</li>
      </ul>
      <h4>Danksagung</h4>
      <p>
        Schrift: <b>WIN95FA</b> von Alina Sava, lizenziert unter der SIL Open Font License 1.1 (siehe <code>licenses/WIN95FA-OFL.txt</code>). Alle Symbole sind eigene Pixelgrafiken.
      </p>
      <h4>Mehrspieler</h4>
      <p>Hot-Seat: Alle Spieler nacheinander am selben Rechner. Asynchron: Spielstand über das Startmenü speichern und die Datei dem nächsten Spieler schicken.</p>
    </div>
  );
}
