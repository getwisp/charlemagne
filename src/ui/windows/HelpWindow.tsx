export function HelpWindow() {
  return (
    <div style={{ lineHeight: 1.45, maxHeight: 420, overflow: 'auto', userSelect: 'text' }}>
      <h3 style={{ marginTop: 0 }}>Kaiser-Klon – Kurzanleitung</h3>
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
      <h4>Titel &amp; Kaiserwahl</h4>
      <p>
        Edler → Freiherr → Baron → Graf → Fürst → Herzog → Kurfürst → König → Kaiser. Alle Voraussetzungen müssen gleichzeitig erfüllt sein, max. eine Beförderung pro Jahr. Ist ein König
        im Besitz einer Kathedrale, wird der Reichstag einberufen: 7 Stimmen, 4 gewinnen.
      </p>
      <h4>Tastatur</h4>
      <p>
        <b>F2</b> – Boss-Taste (Tabellenkalkulation). <b>Esc</b> – zurück.
      </p>
      <h4>Mehrspieler</h4>
      <p>Hot-Seat: Alle Spieler nacheinander am selben Rechner. Asynchron: Spielstand über das Startmenü speichern und die Datei dem nächsten Spieler schicken.</p>
    </div>
  );
}
