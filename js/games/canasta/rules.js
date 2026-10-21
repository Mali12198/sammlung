export default {
  title: 'Kanaster',
  tabs: [
    {
      id: 'regeln', label: 'Regeln', html: `
<h3>Worum geht es?</h3>
<p>Kanaster (Canasta) wird mit zwei Blättern und vier Jokern gespielt – 108 Karten. Zu viert spielen je zwei Partner gegenüber zusammen: <b>du und Karl</b> gegen Lotte und Hanne. Ziel sind <b>5000 Punkte</b> über mehrere Runden.</p>
<p>Man sammelt Karten gleichen Rangs und legt sie als <b>Meldung</b> aus. Sieben Karten eines Rangs sind eine <b>Canasta</b> – sie bringt die meisten Punkte.</p>

<h3>Besondere Karten</h3>
<ul>
<li><b>Joker und Zweien</b> sind wild (Joker), sie ersetzen jede Karte in einer Meldung.</li>
<li><b>Rote Dreien</b> legst du sofort offen aus und ziehst eine Ersatzkarte. Jede bringt 100 Punkte, alle vier zusammen 800.</li>
<li><b>Schwarze Dreien</b> blockieren die Ablage. Melden darfst du sie nur beim Ausgehen.</li>
</ul>

<h3>Ein Zug</h3>
<ol>
<li><b>Ziehen:</b> die oberste Karte vom Talon – oder die <b>ganze Ablage</b> (siehe unten).</li>
<li><b>Melden</b> (freiwillig): neue Meldungen auslegen oder an eigene Meldungen anlegen.</li>
<li><b>Abwerfen:</b> eine Karte auf die Ablage.</li>
</ol>

<h3>Meldungen</h3>
<ul>
<li>Mindestens <b>drei Karten</b> eines Rangs.</li>
<li>Mindestens <b>zwei echte</b> Karten, höchstens <b>drei Joker/Zweien</b>.</li>
<li>Jedes Team hat pro Rang nur eine Meldung; man legt an die des Partners mit an.</li>
<li><b>Reine Canasta</b> (ohne Joker): 500 Punkte. <b>Gemischte Canasta</b>: 300 Punkte. An eine reine Canasta kommen hier keine Joker mehr.</li>
</ul>

<h3>Erstmeldung</h3>
<p>Die erste Meldung eines Teams muss zusammen eine Mindestpunktzahl haben – je nach Spielstand:</p>
<table>
<tr><th>Euer Stand</th><th class="num">Mindestens</th></tr>
<tr><td>unter 0</td><td class="num">15</td></tr>
<tr><td>0 bis 1495</td><td class="num">50</td></tr>
<tr><td>1500 bis 2995</td><td class="num">90</td></tr>
<tr><td>ab 3000</td><td class="num">120</td></tr>
</table>

<h3>Kartenwerte</h3>
<table>
<tr><td>Joker</td><td class="num">50</td></tr>
<tr><td>Zwei, Ass</td><td class="num">20</td></tr>
<tr><td>König bis Acht</td><td class="num">10</td></tr>
<tr><td>Sieben bis Vier, schwarze Drei</td><td class="num">5</td></tr>
</table>

<h3>Die Ablage nehmen</h3>
<p>Statt zu ziehen, kannst du den ganzen Ablagestapel nehmen. Dazu musst du die oberste Karte <b>sofort melden</b>:</p>
<ul>
<li>mit einem <b>Paar</b> gleichen Rangs aus deiner Hand,</li>
<li>oder mit einer gleichen Karte plus Joker/Zwei,</li>
<li>oder indem du sie an eure Meldung dieses Rangs anlegst.</li>
</ul>
<p><b>Eingefroren</b> ist die Ablage, wenn ein Joker oder eine Zwei darin liegt – und für ein Team, das noch keine Erstmeldung hat. Dann geht es nur mit einem <b>echten Paar</b>. Liegt oben ein Joker, eine Zwei oder eine schwarze Drei, darf niemand die Ablage nehmen.</p>

<h3>Ausgehen und Rundenende</h3>
<p>Ausgehen heißt: alle Handkarten melden (die letzte darf man abwerfen). Das ist erst erlaubt, wenn das eigene Team mindestens eine Canasta hat (zu zweit: zwei). Ausgehen bringt 100 Punkte, <b>verdeckt</b> (alles in einem Zug, ohne vorher gemeldet zu haben) 200. Ist der Talon leer, endet die Runde ebenfalls.</p>
<h3>Abrechnung</h3>
<p>Plus: Canastas, rote Dreien, Ausgehen und alle gemeldeten Karten. Minus: alle Karten, die noch auf der Hand sind (bei beiden Partnern). Hat ein Team gar nichts gemeldet, zählen seine roten Dreien minus.</p>

<h3>Zu zweit</h3>
<p>Jeder bekommt 15 Karten, zieht <b>zwei</b> Karten vom Talon und wirft eine ab. Zum Ausgehen braucht man <b>zwei Canastas</b>.</p>`,
    },
    {
      id: 'tricks', label: 'Tricks', html: `
<h3>Die Ablage ist das Wichtigste</h3>
<p>Wer große Stapel aufnimmt, gewinnt meistens. Halte deshalb <b>Paare</b> auf der Hand – mit ihnen kannst du die Ablage nehmen, sobald eine passende Karte darauf landet.</p>
<h3>Was abwerfen?</h3>
<ul>
<li><b>Schwarze Dreien</b> sind perfekte Abwürfe: Der nächste Spieler kann die Ablage nicht nehmen.</li>
<li>Wirf Karten, die die Gegner selbst schon abgeworfen haben – die sammeln sie offenbar nicht.</li>
<li>Wirf nie eine Karte, zu der die Gegner eine Meldung haben, solange die Ablage nicht eingefroren ist – sie legen an und nehmen alles.</li>
<li>Einzelne Karten sind bessere Abwürfe als Teile von Paaren.</li>
</ul>
<h3>Einfrieren</h3>
<p>Wird die Ablage groß und die Gegner haben ihre Erstmeldung schon, kann eine <b>Zwei</b> auf der Ablage sie einfrieren. Dann brauchen sie ein echtes Paar.</p>
<h3>Joker klug einsetzen</h3>
<ul>
<li>Ein Joker zählt 50 Punkte – ideal, um die Erstmeldung zu erreichen.</li>
<li>Mit einem Joker die sechste oder siebte Karte zu ersetzen macht aus einer Meldung eine Canasta.</li>
<li>Reine Canastas sind 200 Punkte mehr wert – verschwende keine Joker an Meldungen, die auch rein voll werden.</li>
</ul>
<h3>Nicht zu früh ausgehen</h3>
<p>Ausgehen beendet die Runde. Hat dein Partner noch viele Karten oder die Gegner nichts gemeldet, kann es sich lohnen, noch ein paar Runden Meldungen zu sammeln. Haben die Gegner dagegen große Meldungen kurz vor der Canasta, geh schnell aus.</p>`,
    },
    {
      id: 'app', label: 'Bedienung', html: `
<h3>Ziehen</h3>
<p>Tippe auf den Talon (oder „Karte ziehen“). Für die Ablage tippe auf den Stapel – die App zeigt dir, welche Karten dafür gemeldet werden, und erklärt, falls es nicht geht.</p>
<h3>Melden</h3>
<p>Tippe Karten in deiner Hand an (sie rutschen hoch) und dann <b>Melden</b>. Zum Anlegen tippe nach der Auswahl auf eine eurer Meldungen. Reicht eine Meldung noch nicht für die Erstmeldung, wird sie vorgemerkt (gestrichelt), bis die Punkte zusammen sind.</p>
<h3>Abwerfen</h3>
<p>Genau eine Karte wählen und <b>Abwerfen</b> tippen. Damit endet dein Zug.</p>
<h3>Tipp und Trainer</h3>
<p>Die Glühbirne schlägt dir in jeder Phase den nächsten Schritt vor (mit Begründung) und kann ihn auf Wunsch ausführen. Über das Menü startest du ein neues Spiel zu viert oder zu zweit.</p>
<h3>Mit Freunden spielen</h3><p>Menü → „Neues Spiel“ → zu viert oder zu zweit, dann die Plätze auf <b>Mensch</b> oder <b>Computer</b> stellen. Zu viert spielen Platz 1 & 3 gegen Platz 2 & 4 – ihr könnt also auch zu zweit als Team gegen zwei Computer antreten. Vor jedem Wechsel zwischen Menschen wird die Hand verdeckt.</p>`,
    },
  ],
};
