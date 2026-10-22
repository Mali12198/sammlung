export default {
  title: 'Würfelpoker',
  tabs: [
    {
      id: 'regeln', label: 'Regeln', html: `
<h3>Ziel</h3>
<p>Mit fünf Würfeln in 13 Runden möglichst viele Punkte sammeln. Jede Runde füllst du genau ein Feld auf deinem Block – jedes Feld nur einmal.</p>

<h3>Ablauf einer Runde</h3>
<ol>
<li>Wirf alle fünf Würfel.</li>
<li>Behalte (halte) beliebige Würfel und wirf den Rest erneut – höchstens <b>dreimal</b> insgesamt. Gehaltene Würfel darfst du beim nächsten Wurf wieder freigeben.</li>
<li>Trag das Ergebnis in ein freies Feld ein. Passt nichts, musst du ein Feld <b>streichen</b> (0 Punkte).</li>
</ol>

<h3>Oberer Teil</h3>
<p>Einer bis Sechser: Es zählt die Summe der passenden Würfel. 4-4-4-2-6 bei den Vierern ergibt 12.</p>
<p><b>Bonus:</b> Hast du oben zusammen mindestens <b>63</b> Punkte, gibt es <b>35</b> Extrapunkte.</p>

<h3>Unterer Teil</h3>
<table>
<tr><th>Feld</th><th>Bedingung</th><th class="num">Punkte</th></tr>
<tr><td>Dreierpasch</td><td>mindestens drei gleiche</td><td class="num">alle Augen</td></tr>
<tr><td>Viererpasch</td><td>mindestens vier gleiche</td><td class="num">alle Augen</td></tr>
<tr><td>Full House</td><td>drei gleiche + zwei gleiche</td><td class="num">25</td></tr>
<tr><td>Kleine Straße</td><td>vier aufeinanderfolgende (z. B. 2-3-4-5)</td><td class="num">30</td></tr>
<tr><td>Große Straße</td><td>fünf aufeinanderfolgende</td><td class="num">40</td></tr>
<tr><td>Poker</td><td>fünf gleiche</td><td class="num">50</td></tr>
<tr><td>Chance</td><td>beliebig</td><td class="num">alle Augen</td></tr>
</table>

<h3>Extra-Poker (im Menü schaltbar)</h3>
<p>Würfelst du einen weiteren Poker, nachdem dein Poker-Feld schon mit 50 belegt ist, gibt es <b>50 Bonuspunkte</b>. Außerdem darf ein weiterer Poker als Joker für Full House, kleine oder große Straße mit vollen Punkten eingetragen werden.</p>

<h3>Mehrere Spieler</h3>
<p>Ihr spielt reihum, jeder hat seine eigene Spalte. Nach 13 Runden gewinnt die höchste Gesamtsumme. Allein spielst du gegen deinen Bestwert.</p>`,
    },
    {
      id: 'tricks', label: 'Tricks', html: `
<h3>Der Bonus ist Gold wert</h3>
<p>35 Punkte für 63 oben – das sind genau <b>drei gleiche</b> pro Zahl (3 + 6 + 9 + 12 + 15 + 18 = 63). Drei Sechser statt zwei gleichen viele Lücken wieder aus.</p>

<h3>Was halten?</h3>
<ul>
<li>Bei zwei oder drei gleichen hoher Augenzahl: halten und auf Pasch, Poker oder den oberen Teil spielen.</li>
<li>Vier aufeinanderfolgende (z. B. 2-3-4-5): sofort kleine Straße sicher, mit zwei Würfen hast du gute Chancen auf die große (an beiden Enden passt es – 1 oder 6).</li>
<li>Eine Lücke in der Straße (z. B. 1-2-4-5) ist viel schlechter: Nur eine Zahl passt.</li>
<li>Zwei Paare: Ein Wurf mit einem Würfel bringt mit 1 zu 3 ein Full House.</li>
</ul>

<h3>Chancen in Zahlen</h3>
<table>
<tr><th>Situation (2 Würfe übrig)</th><th class="num">Chance</th></tr>
<tr><td>Poker mit drei gleichen</td><td class="num">ca. 9 %</td></tr>
<tr><td>Poker mit vier gleichen</td><td class="num">ca. 31 %</td></tr>
<tr><td>Große Straße aus offener Viererreihe</td><td class="num">ca. 56 %</td></tr>
<tr><td>Full House aus zwei Paaren</td><td class="num">ca. 56 %</td></tr>
</table>

<h3>Klug streichen</h3>
<ul>
<li>Musst du eine 0 eintragen, nimm ein Feld, das wenig bringt: <b>Einer</b> (im Schnitt ~2 Punkte) oder einen hoffnungslosen <b>Poker</b> spät im Spiel.</li>
<li>Die <b>Chance</b> ist dein Rettungsring – nutze sie nicht zu früh für kleine Summen.</li>
<li>Im Dreier- und Viererpasch zählen alle Augen: Mit hohen Zahlen lohnt sich das mehr.</li>
</ul>`,
    },
    {
      id: 'app', label: 'Bedienung', html: `
<h3>Würfeln und halten</h3>
<p>„Würfeln“ wirft alle freien Würfel. Tippe Würfel an, um sie zu halten (sie rutschen hoch und bekommen einen goldenen Rand).</p>
<h3>Eintragen</h3>
<p>Nach dem Wurf erscheinen in deiner Spalte die möglichen Punkte. Tippe ein Feld an, um sie einzutragen. Eine graue 0 bedeutet: Streichen.</p>
<h3>Tipp und Trainer</h3>
<p>Die Glühbirne rechnet alle Möglichkeiten durch, hält die besten Würfel für dich fest oder sagt dir, wo du eintragen solltest – mit Begründung. Der Trainer meldet sich, wenn ein anderes Feld langfristig besser gewesen wäre.</p>
<h3>Mitspieler</h3>
<p>Über das Menü → „Neues Spiel“ stellst du bis zu sechs Spieler ein, Menschen und Computer gemischt. Das iPhone wird einfach weitergereicht.</p>`,
    },
  ],
};
