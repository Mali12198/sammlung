const S = s => `<svg class="suit ${'HD'.includes(s) ? 'r' : 'b'}" viewBox="0 0 100 100"><use href="#s-${s}"/></svg>`;

export default {
  title: 'Doppelkopf',
  tabs: [
    {
      id: 'regeln', label: 'Regeln', html: `
<h3>Worum geht es?</h3>
<p>Vier Spieler, 48 Karten: jede Karte von 9 bis Ass gibt es <b>zweimal</b>. Jeder bekommt 12 Karten. Es spielen zwei gegen zwei – aber wer zusammengehört, ist am Anfang geheim.</p>

<h3>Re und Kontra</h3>
<p>Wer eine <b>Kreuz-Dame</b> (${S('C')}D) hat, spielt <b>Re</b>. Die beiden anderen spielen <b>Kontra</b>. Wer die zweite Kreuz-Dame hat, merkt man, wenn sie gespielt wird – oder wenn jemand „Re“ ansagt.</p>
<p>Insgesamt gibt es 240 Augen. <b>Re gewinnt mit 121</b>, Kontra mit 120 Augen.</p>

<h3>Kartenwerte</h3>
<table>
<tr><td>Ass</td><td class="num">11</td><td>Zehn</td><td class="num">10</td></tr>
<tr><td>König</td><td class="num">4</td><td>Dame</td><td class="num">3</td></tr>
<tr><td>Bube</td><td class="num">2</td><td>Neun</td><td class="num">0</td></tr>
</table>

<h3>Trümpfe im Normalspiel (von hoch nach niedrig)</h3>
<ol>
<li>${S('H')}10 – die <b>Dulle</b></li>
<li>Damen: ${S('C')}D · ${S('S')}D · ${S('H')}D · ${S('D')}D</li>
<li>Buben: ${S('C')}B · ${S('S')}B · ${S('H')}B · ${S('D')}B</li>
<li>Karo: ${S('D')}A (der <b>Fuchs</b>) · ${S('D')}10 · ${S('D')}K · ${S('D')}9</li>
</ol>
<p>Das sind 26 Trümpfe. Die übrigen Karten heißen <b>Fehl</b>: ${S('C')} und ${S('S')} jeweils A, 10, K, 9 – ${S('H')} nur A, K, 9 (die Herz-Zehnen sind ja Trumpf).</p>

<h3>Bedienen</h3>
<p>Die angespielte Farbe muss bedient werden. Trumpf ist dabei eine eigene „Farbe“: Wird Trumpf gespielt, musst du Trumpf zugeben. Wird ${S('C')} gespielt, zählt die ${S('C')}-Dame <b>nicht</b> als Kreuz – sie ist Trumpf. Kannst du nicht bedienen, darfst du stechen oder abwerfen.</p>
<p>Liegen zwei gleiche Karten im Stich, gewinnt die <b>zuerst gespielte</b>. Beliebte Hausregel (im Menü schaltbar): Die zweite Dulle sticht die erste – außer im letzten Stich.</p>

<h3>Vorbehalte</h3>
<ul>
<li><b>Hochzeit:</b> Wer beide Kreuz-Damen hat, kann sie ansagen. Der erste Spieler, der in den ersten drei Stichen einen Stich gegen ihn gewinnt, wird sein Partner. Findet sich keiner, spielt er allein.</li>
<li><b>Stille Hochzeit:</b> Wer beide Kreuz-Damen hat und nichts sagt, spielt heimlich allein – gewertet wie ein Solo.</li>
<li><b>Solo:</b> Einer spielt allein gegen drei. Gewinn oder Verlust zählt für ihn dreifach.</li>
</ul>

<h3>Soli</h3>
<table>
<tr><th>Solo</th><th>Trumpf</th></tr>
<tr><td>Damensolo</td><td>nur die acht Damen</td></tr>
<tr><td>Bubensolo</td><td>nur die acht Buben</td></tr>
<tr><td>Farbsolo</td><td>wie Normalspiel, aber mit ${S('C')}, ${S('S')} oder ${S('H')} statt ${S('D')}</td></tr>
<tr><td>Fleischloser</td><td>gar kein Trumpf</td></tr>
</table>
<p>In Soli ohne Damen bzw. Buben als Trumpf ordnen sich diese in ihre Farbe ein: A, 10, K, D, B, 9.</p>`,
    },
    {
      id: 'wertung', label: 'Wertung', html: `
<h3>Ansagen</h3>
<p>Wer sich stark fühlt, sagt seine Partei an: <b>„Re“</b> bzw. <b>„Kontra“</b>. Das bringt dem Gewinner 2 Extrapunkte. Erlaubt ist das, solange du noch mindestens 11 Karten hast (also bis zu deiner zweiten Karte). Als Antwort auf eine Ansage der Gegner darfst du noch eine Karte später.</p>
<p>Danach kann man <b>absagen</b>, was die Gegner höchstens bekommen:</p>
<table>
<tr><th>Absage</th><th>Gegner bekommen weniger als</th><th class="num">ab Karten</th></tr>
<tr><td>keine 90</td><td>90 Augen</td><td class="num">10</td></tr>
<tr><td>keine 60</td><td>60 Augen</td><td class="num">9</td></tr>
<tr><td>keine 30</td><td>30 Augen</td><td class="num">8</td></tr>
<tr><td>schwarz</td><td>keinen Stich</td><td class="num">7</td></tr>
</table>
<p>Wer etwas absagt, muss es auch schaffen – sonst gewinnt die andere Seite, schon mit 90 (bzw. 60, 30 Augen oder einem Stich).</p>

<h3>Punkte</h3>
<table>
<tr><td>Gewonnen</td><td class="num">1</td></tr>
<tr><td>Gegen die Alten (Kontra gewinnt)</td><td class="num">1</td></tr>
<tr><td>Verlierer unter 90 / 60 / 30 Augen</td><td class="num">je 1</td></tr>
<tr><td>Verlierer schwarz (kein Stich)</td><td class="num">1</td></tr>
<tr><td>Re angesagt, Kontra angesagt</td><td class="num">je 2</td></tr>
<tr><td>Jede Absage (keine 90 …)</td><td class="num">je 1</td></tr>
</table>
<p>Die Gewinner bekommen die Punkte, die Verlierer genauso viele als Minus.</p>

<h3>Sonderpunkte (nicht im Solo)</h3>
<ul>
<li><b>Fuchs gefangen:</b> Ihr gewinnt einen Stich, in dem die Gegner einen ${S('D')}-Ass gespielt haben: +1.</li>
<li><b>Doppelkopf:</b> Ein Stich mit 40 Augen oder mehr: +1 für den Gewinner.</li>
<li><b>Karlchen:</b> Der ${S('C')}-Bube gewinnt den letzten Stich: +1.</li>
</ul>
<p>Sonderpunkte zählen auch für die Verlierer und werden verrechnet.</p>`,
    },
    {
      id: 'tricks', label: 'Tricks', html: `
<h3>Partner finden</h3>
<ul>
<li><b>Re spielt Trumpf, Kontra spielt Farbe.</b> So erkennt man sich und zwingt die Gegner, Trümpfe herzugeben.</li>
<li>Spielt jemand früh eine ${S('C')}-Dame, ist er Re – merk es dir.</li>
<li>Wer schmiert (viele Augen auf einen fremden Stich legt), zeigt meist: Das ist mein Partner.</li>
</ul>

<h3>Asse und Fehl</h3>
<ul>
<li>Ein Fehl-Ass geht im <b>ersten Durchgang</b> der Farbe meistens durch. Im zweiten wird oft gestochen.</li>
<li>${S('H')} gibt es nur sechs Karten (A, A, K, K, 9, 9). Das Herz-Ass wird daher schnell abgestochen.</li>
<li>Wer in einer Farbe frei ist, kann stechen. Drück dir früh eine Farbe weg.</li>
</ul>

<h3>Schmieren</h3>
<p>Gewinnt dein Partner einen Stich sicher, gib ihm Augen: eine Zehn, ein Ass – oder den <b>Fuchs</b> (${S('D')}A). Den Fuchs bitte nie in einen Stich der Gegner werfen: Dann ist er gefangen und kostet einen Punkt.</p>

<h3>Wann ansagen?</h3>
<p>Mit beiden Dullen oder Dulle plus ${S('C')}-Dame, dazu sieben oder mehr Trümpfen und einem Fehl-Ass, darf man „Re“ sagen. Kontra braucht etwas mehr, weil die Kreuz-Damen bei Re liegen.</p>

<h3>Solo – wann lohnt es sich?</h3>
<p>Ein Farbsolo braucht etwa neun Trümpfe, darunter die meisten hohen, und keine schwachen Fehlkarten. Ein Damensolo lohnt sich mit fünf oder mehr Damen und mehreren Assen. Lieber einmal zu wenig als einmal zu viel – ein verlorenes Solo kostet dreifach.</p>`,
    },
    {
      id: 'app', label: 'Bedienung', html: `
<h3>Am Tisch</h3>
<p>Lotte sitzt links, Karl gegenüber, Hanne rechts. Ihre Partei wird angezeigt, sobald sie bekannt ist. Oben links steht die Spielart mit Ansagen, oben rechts dein Kontostand.</p>
<h3>Vorbehalt</h3>
<p>Zu Beginn fragt die App, ob du „gesund“ spielst oder einen Vorbehalt hast (Hochzeit, Solo).</p>
<h3>Ansagen</h3>
<p>Solange es erlaubt ist, erscheint über deinen Karten ein Knopf „Re“ bzw. „Kontra“, danach „keine 90“ usw.</p>
<h3>Tipp und Trainer</h3>
<p>Die Glühbirne schlägt dir eine Karte vor und erklärt sie. Ist der Trainer an, siehst du deine Partei und eure Augen und bekommst Hinweise nach deinen Zügen.</p>
<h3>Mit Freunden spielen</h3><p>Menü → „Neues Spiel“: Bis zu vier Plätze auf <b>Mensch</b> stellen, der Rest spielt der Computer. Vor jedem Wechsel erscheint „Gib das iPhone weiter an …“ – erst dann werden die Karten aufgedeckt. Ansagen macht jeder, wenn er das iPhone hat.</p>`,
    },
  ],
};
