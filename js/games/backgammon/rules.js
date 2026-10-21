export default {
  title: 'Backgammon',
  tabs: [
    {
      id: 'regeln', label: 'Regeln', html: `
<h3>Ziel</h3>
<p>Bring alle 15 Steine in dein <b>Heimfeld</b> (unten rechts, Punkte 1–6) und trage sie von dort ab. Wer zuerst alle Steine abgetragen hat, gewinnt.</p>

<h3>Das Brett</h3>
<p>Die 24 Zungen heißen Punkte. Du ziehst die hellen Steine von Punkt 24 (oben rechts) über die obere Reihe nach links, dann unten von links nach rechts bis Punkt 1 – also gegen den Uhrzeigersinn. Der Computer zieht genau entgegengesetzt. Die Mittelleiste ist die <b>Bar</b>.</p>

<h3>Wer beginnt?</h3>
<p>Jeder wirft einen Würfel. Die höhere Zahl beginnt und spielt beide Würfel als ersten Wurf.</p>

<h3>Ziehen</h3>
<ul>
<li>Jeder Würfel ist ein eigener Zug: Bei 5 und 3 ziehst du einen Stein 5 Punkte und einen (auch denselben) 3 Punkte.</li>
<li>Bei einem <b>Pasch</b> (zwei gleiche Zahlen) ziehst du die Zahl viermal.</li>
<li>Ein Stein darf nur auf einen Punkt, der leer ist, eigene Steine trägt oder auf dem genau <b>ein</b> gegnerischer Stein steht.</li>
<li>Punkte mit zwei oder mehr gegnerischen Steinen sind gesperrt.</li>
<li>Du musst so viele Würfel nutzen wie möglich. Geht nur einer, musst du – wenn möglich – den höheren spielen.</li>
</ul>

<h3>Schlagen und die Bar</h3>
<p>Ein einzelner Stein heißt <b>Blot</b>. Ziehst du auf einen gegnerischen Blot, ist er geschlagen und kommt auf die Bar. Wer Steine auf der Bar hat, muss sie zuerst wieder ins gegnerische Heimfeld einwürfeln, bevor er irgendetwas anderes ziehen darf. Deine Steine kommen oben rechts wieder herein (Würfel 1 = Punkt 24, Würfel 6 = Punkt 19).</p>

<h3>Abtragen</h3>
<p>Sobald alle deine Steine im Heimfeld sind, darfst du abtragen: Eine 4 trägt einen Stein vom 4er-Punkt ab. Ist dort keiner, musst du mit der 4 innerhalb des Heimfelds ziehen. Ist die Zahl höher als dein höchster Stein, darfst du diesen abtragen. Wird ein Stein geschlagen, musst du ihn erst wieder ganz herumbringen.</p>

<h3>Gewinn und Doppelwürfel</h3>
<table>
<tr><th>Ergebnis</th><th class="num">Punkte</th></tr>
<tr><td>Normaler Sieg</td><td class="num">1</td></tr>
<tr><td><b>Gammon:</b> Gegner hat noch keinen Stein abgetragen</td><td class="num">2</td></tr>
<tr><td><b>Backgammon:</b> wie Gammon, und er hat noch Steine auf der Bar oder in deinem Heimfeld</td><td class="num">3</td></tr>
</table>
<p>Der Wert wird mit dem <b>Doppelwürfel</b> malgenommen. Vor deinem Wurf darfst du verdoppeln. Der Gegner nimmt an (es geht um das Doppelte, er bekommt den Würfel und darf als Nächster zurückdoppeln) oder gibt auf und zahlt den bisherigen Wert.</p>`,
    },
    {
      id: 'tricks', label: 'Tricks', html: `
<h3>Die besten Eröffnungszüge</h3>
<table>
<tr><th>Wurf</th><th>Zug</th><th>Warum</th></tr>
<tr><td>3-1</td><td>8/5 6/5</td><td>Macht den wichtigen 5er-Punkt</td></tr>
<tr><td>4-2</td><td>8/4 6/4</td><td>Macht den 4er-Punkt</td></tr>
<tr><td>6-1</td><td>13/7 8/7</td><td>Macht den Bar-Punkt</td></tr>
<tr><td>5-3</td><td>8/3 6/3</td><td>Macht den 3er-Punkt</td></tr>
<tr><td>6-5</td><td>24/13</td><td>„Lover’s Leap“: ein hinterer Stein flüchtet</td></tr>
<tr><td>6-4</td><td>24/14 oder 8/2 6/2</td><td>Flucht oder Punkt</td></tr>
<tr><td>5-1</td><td>13/8 6/5</td><td>Baustein für den 5er-Punkt</td></tr>
<tr><td>2-1</td><td>13/11 6/5</td><td>Riskant, aber aufbauend</td></tr>
</table>

<h3>Die wichtigsten Punkte</h3>
<p>Der <b>5er-Punkt</b> ist der wertvollste: Er blockiert den Gegner und ist schwer zu erreichen. Danach kommen der 4er-Punkt und der <b>Bar-Punkt</b> (7). Mehrere Punkte am Stück bilden eine <b>Mauer (Prime)</b> – sechs in Folge kann der Gegner gar nicht überspringen.</p>

<h3>Blots: wie riskant?</h3>
<p>Ein Stein, der 1–6 Punkte vor einem Gegner steht, wird <b>direkt</b> getroffen – bei 6 Punkten Abstand in 17 von 36 Würfen. Ab 7 Punkten Abstand braucht der Gegner beide Würfel; das Risiko sinkt deutlich (bei 11 nur noch 2 von 36).</p>
<p>Faustregel: Blots im eigenen Heimfeld sind gefährlicher als weit hinten – ein dort geschlagener Stein verliert fast seinen ganzen Weg.</p>

<h3>Augenzählen</h3>
<p>Die Augenzahl (Pip-Count) ist die Summe aller Felder, die deine Steine noch laufen müssen. Am Anfang hat jeder 167. Sie steht oben rechts. Liegst du im Rennen vorne, vermeide Kontakt; liegst du hinten, halte Ankerpunkte und warte auf einen Treffer.</p>

<h3>Ankern</h3>
<p>Zwei eigene Steine im gegnerischen Heimfeld (ein Anker, am besten auf dem 20er- oder 21er-Punkt) können nicht geschlagen werden und lauern auf Blots.</p>

<h3>Verdoppeln – Faustregeln</h3>
<ul>
<li><b>Anbieten</b> ab etwa 70 % Gewinnchance, solange du noch nicht so überlegen bist, dass ein Gammon wahrscheinlich ist.</li>
<li><b>Annehmen</b>, wenn du mindestens etwa 25 % Gewinnchance hast.</li>
<li>Im reinen Wettrennen: Führst du um mehr als 8 % deiner Augenzahl, verdopple. Liegt der Gegner mehr als 12 % vorne, gib auf.</li>
</ul>
<p>Die Glühbirne vor dem Würfeln schätzt deine aktuelle Gewinnchance.</p>

<h3>Abtragen ohne Risiko</h3>
<p>Hat der Gegner noch Steine in deinem Heimfeld, trage so ab, dass keine Blots entstehen – lieber einen Stein mehr im Feld lassen als einen schlagen lassen.</p>`,
    },
    {
      id: 'app', label: 'Bedienung', html: `
<h3>Würfeln und ziehen</h3>
<p>Tippe „Würfeln“. Mögliche Steine sind golden umrandet. Tippe einen Stein (bzw. seinen Punkt), dann ein grün markiertes Ziel. Ein Ziel kann auch die Summe beider Würfel sein – dann zieht der Stein beide Schritte. Hat ein Stein nur ein Ziel, zieht er sofort.</p>
<p>Zum Abtragen tippst du auf die Ablage ganz rechts. Steht ein Stein auf der Bar, ist er automatisch gewählt.</p>
<h3>Fertig und Rückgängig</h3>
<p>Nach dem letzten Teilzug bestätigst du mit „Fertig“. Bis dahin kannst du alles rückgängig machen.</p>
<h3>Tipp und Trainer</h3>
<p>Die Glühbirne zeigt dir den besten Zug (grün umrandet) mit Begründung. Der Trainer prüft deinen Zug beim Bestätigen und bietet an, nochmal zu ziehen, wenn es klar Besseres gibt.</p>
<h3>Spielstärke</h3>
<p><b>Leicht</b> zieht oft nur ordentlich. <b>Mittel</b> wählt den besten Zug nach Stellungsbewertung. <b>Schwer</b> rechnet zusätzlich alle 21 möglichen Antwortwürfe durch.</p>`,
    },
  ],
};
