const dot = c => `<span class="qx-dot qx-${c}"></span>`;

export default {
  title: 'Farbreihen',
  tabs: [
    {
      id: 'regeln', label: 'Regeln', html: `
<h3>Ziel</h3>
<p>Jeder hat ein Blatt mit vier Farbreihen: ${dot('r')} Rot und ${dot('y')} Gelb von 2 bis 12, ${dot('g')} Grün und ${dot('b')} Blau von 12 bis 2. Kreuze möglichst viele Felder an – je mehr Kreuze in einer Reihe, desto mehr Punkte.</p>

<h3>Die wichtigste Regel</h3>
<p>In jeder Reihe wird <b>von links nach rechts</b> angekreuzt. Felder, die du überspringst, darfst du nie mehr ankreuzen.</p>

<h3>Ein Zug</h3>
<p>Der aktive Spieler wirft alle sechs Würfel: zwei weiße und je einen roten, gelben, grünen und blauen.</p>
<ol>
<li><b>Weiße Summe – für alle:</b> Jeder Spieler darf die Summe der beiden weißen Würfel in einer beliebigen Reihe ankreuzen.</li>
<li><b>Farbe – nur der Aktive:</b> Er darf zusätzlich <b>einen</b> weißen mit <b>einem</b> farbigen Würfel addieren und die Summe in der Reihe dieser Farbe ankreuzen.</li>
</ol>
<p>Beides ist freiwillig. Kreuzt der aktive Spieler in seinem Zug aber gar nichts an, bekommt er einen <b>Fehlwurf</b> (−5 Punkte).</p>

<h3>Reihe abschließen</h3>
<p>Das letzte Feld einer Reihe (rote/gelbe 12, grüne/blaue 2) darfst du nur ankreuzen, wenn du in dieser Reihe schon <b>mindestens fünf Kreuze</b> hast. Dann kreuzt du auch das Schloss an – es zählt als zusätzliches Kreuz. Die Reihe ist danach für <b>alle</b> geschlossen, der Würfel dieser Farbe fliegt raus.</p>

<h3>Spielende</h3>
<p>Das Spiel endet sofort, wenn zwei Reihen abgeschlossen sind oder ein Spieler seinen vierten Fehlwurf nimmt.</p>

<h3>Wertung</h3>
<table>
<tr><th>Kreuze</th><td class="num">1</td><td class="num">2</td><td class="num">3</td><td class="num">4</td><td class="num">5</td><td class="num">6</td></tr>
<tr><th>Punkte</th><td class="num">1</td><td class="num">3</td><td class="num">6</td><td class="num">10</td><td class="num">15</td><td class="num">21</td></tr>
<tr><th>Kreuze</th><td class="num">7</td><td class="num">8</td><td class="num">9</td><td class="num">10</td><td class="num">11</td><td class="num">12</td></tr>
<tr><th>Punkte</th><td class="num">28</td><td class="num">36</td><td class="num">45</td><td class="num">55</td><td class="num">66</td><td class="num">78</td></tr>
</table>
<p>Jede Reihe wird einzeln gewertet, dann zusammengezählt. Jeder Fehlwurf kostet 5 Punkte.</p>

<h3>Hausregeln (wählbar beim Start)</h3>
<ul>
<li><b>Kurzes Spiel:</b> Die Partie endet schon, wenn <b>eine</b> Reihe abgeschlossen ist oder jemand seinen <b>dritten</b> Fehlwurf nimmt. Ideal für zwischendurch.</li>
<li><b>Neuwurf-Joker:</b> Jeder hat einmal pro Partie einen Joker. Direkt nach deinem eigenen Wurf – bevor irgendwer ankreuzt – darfst du damit alle Würfel neu werfen. Das goldene „J“ neben deinem Namen zeigt, dass er noch frei ist.</li>
<li><b>Früh abschließen:</b> Das letzte Feld einer Reihe darfst du schon ab <b>drei</b> statt fünf Kreuzen ankreuzen. Das Spiel wird schneller und angriffslustiger.</li>
</ul>
<p>Die Regeln lassen sich frei kombinieren. Alle drei zusammen ergeben eine sehr kurze, wilde Partie.</p>`,
    },
    {
      id: 'tricks', label: 'Tricks', html: `
<h3>Lücken sind teuer</h3>
<p>Jedes übersprungene Feld ist ein Kreuz weniger – und Kreuze werden pro Reihe immer wertvoller (das zehnte bringt 10 Punkte!). Am Anfang solltest du höchstens ein bis zwei Felder auslassen.</p>
<h3>Die Mitte ist häufig, die Ränder selten</h3>
<p>Mit zwei Würfeln kommt die 7 am häufigsten (6 von 36), die 2 und die 12 am seltensten (je 1 von 36). Ein Kreuz auf einer roten 2 oder grünen 12 ist deshalb ein Glücksfall – nimm es!</p>
<h3>Fehlwurf oder Lücke?</h3>
<p>Ein Fehlwurf kostet 5 Punkte. Wer dafür vier Felder überspringen müsste, nimmt besser den Fehlwurf. Gegen Spielende, wenn Reihen bald schließen, sind Lücken dagegen billig.</p>
<h3>Konzentrieren</h3>
<p>Zwei, drei lange Reihen bringen mehr als vier kurze: 8 Kreuze in einer Reihe sind 36 Punkte, zweimal 4 Kreuze nur 20.</p>
<h3>Mit Hausregeln</h3>
<p><b>Kurzes Spiel</b> und <b>früh abschließen</b>: Lücken sind weniger schlimm, weil die Partie ohnehin bald endet – lieber schnell Kreuze sammeln. Wer vorne liegt, sollte die erste Reihe schließen und damit gewinnen. Den <b>Joker</b> hebst du dir für einen Wurf auf, der dich sonst einen Fehlwurf oder viele Felder kosten würde.</p>
<h3>Abschließen als Waffe</h3>
<p>Liegst du vorne, schließ Reihen ab, sobald du darfst – das beendet das Spiel schneller und nimmt den Gegnern Felder weg.</p>`,
    },
    {
      id: 'app', label: 'Bedienung', html: `
<h3>Ankreuzen</h3>
<p>Nach dem Wurf leuchten auf deinem Blatt alle Felder, die du gerade ankreuzen darfst. Tippe eines an – oder „Nicht ankreuzen“.</p>
<h3>Mehrere Spieler</h3>
<p>Über Menü → „Neues Spiel“ spielen 2 bis 5 Spieler, Menschen und Computer gemischt. Bei der weißen Summe fragt die App jeden Menschen nacheinander – über den Namen oben siehst du, wessen Blatt gerade gezeigt wird. Die Namensleiste zeigt alle Blätter.</p>
<h3>Tipp</h3>
<p>Die Glühbirne vergleicht alle Möglichkeiten und sagt dir, welches Kreuz am meisten bringt – oder ob du besser passt.</p>`,
    },
  ],
};
