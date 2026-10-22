export default {
  title: 'Rommé',
  tabs: [
    {
      id: 'regeln', label: 'Regeln', html: `
<h3>Worum geht es?</h3>
<p>Rommé spielt man mit zwei französischen Blättern und sechs Jokern (110 Karten). Jeder bekommt 13 Karten. Ziel ist es, als Erster alle Karten loszuwerden – durch <b>Auslegen</b>, <b>Anlegen</b> und <b>Ablegen</b>.</p>

<h3>Meldungen</h3>
<ul>
<li><b>Satz:</b> drei oder vier Karten mit gleichem Wert in <b>verschiedenen</b> Farben, z. B. Herz-7, Pik-7, Kreuz-7.</li>
<li><b>Folge:</b> mindestens drei aufeinanderfolgende Karten <b>einer</b> Farbe, z. B. Karo 9, 10, Bube.</li>
<li>Das <b>Ass</b> darf unten (A-2-3) oder oben (D-K-A) liegen, aber nicht „um die Ecke“ (K-A-2).</li>
<li><b>Joker</b> ersetzen jede Karte. Jede Meldung braucht mindestens zwei echte Karten.</li>
</ul>

<h3>Ein Zug</h3>
<ol>
<li><b>Ziehen:</b> die oberste Karte vom Stapel – oder die oberste Karte der Ablage.</li>
<li><b>Auslegen und Anlegen</b> (freiwillig): neue Meldungen auslegen, Karten an liegende Meldungen anlegen (auch an die der anderen), Joker tauschen.</li>
<li><b>Ablegen:</b> eine Karte auf die Ablage. Damit endet der Zug.</li>
</ol>

<h3>Rauskommen</h3>
<p>Deine ersten Meldungen müssen zusammen mindestens <b>40 Punkte</b> wert sein. Erst danach darfst du anlegen und Joker tauschen. Die Ablagekarte darfst du vorher nur nehmen, wenn du mit ihr sofort rauskommst.</p>
<table>
<tr><th>Karte</th><th class="num">in der Meldung</th></tr>
<tr><td>Ass</td><td class="num">11 (in A-2-3: 1)</td></tr>
<tr><td>König, Dame, Bube, Zehn</td><td class="num">10</td></tr>
<tr><td>2 bis 9</td><td class="num">Zahlenwert</td></tr>
<tr><td>Joker</td><td class="num">Wert der ersetzten Karte</td></tr>
</table>

<h3>Joker tauschen</h3>
<p>Liegt ein Joker in einer Meldung, darf jeder, der draußen ist, ihn gegen die echte Karte austauschen, für die er steht. Der Joker kommt auf die Hand.</p>

<h3>Rundenende und Wertung</h3>
<p>Wer seine letzte Karte ablegt (oder auslegt), beendet die Runde. Alle anderen bekommen ihre Handkarten als <b>Strafpunkte</b>: Joker 20, Ass 11, Bilder und Zehnen 10, sonst der Zahlenwert.</p>
<p><b>Hand-Rommé:</b> Wer alle Karten auf einmal auslegt, ohne vorher draußen gewesen zu sein, lässt die anderen doppelt zahlen.</p>
<p>Gespielt wird über mehrere Runden, bis jemand die Grenze erreicht (z. B. 200 Strafpunkte). Es gewinnt, wer die <b>wenigsten</b> Strafpunkte hat.</p>`,
    },
    {
      id: 'tricks', label: 'Tricks', html: `
<h3>Joker sind Gold</h3>
<p>Mit einem Joker wird aus fast jedem Paar eine Meldung. Wirf nie einen Joker ab – und tausche Joker auf dem Tisch frei, sobald du die passende Karte hast.</p>
<h3>Hohe Karten zuerst loswerden</h3>
<p>Asse und Bilder zählen viele Strafpunkte. Passen sie zu nichts, leg sie früh ab. Kleine Karten sind am Ende weniger schlimm.</p>
<h3>Folgen sind flexibel</h3>
<p>Eine Folge kann an beiden Enden wachsen, ein Satz nur bis vier Karten. Zwei Karten im Abstand von eins (z. B. 5 und 7) brauchen nur noch eine Karte – oder einen Joker.</p>
<h3>Was nehmen die anderen?</h3>
<p>Nimmt jemand eine Karte von der Ablage, sammelt er offenbar diesen Wert oder diese Farbe. Gib ihm keine passenden Karten.</p>
<h3>Rauskommen oder warten?</h3>
<p>Wer früh rauskommt, kann anlegen und hat weniger Karten auf der Hand. Wer wartet, riskiert viele Strafpunkte, kann aber mit einem Hand-Rommé doppelt kassieren.</p>`,
    },
    {
      id: 'app', label: 'Bedienung', html: `
<h3>Ziehen</h3>
<p>Tippe auf den Stapel (oder „Karte ziehen“) bzw. auf die Ablage. Hast du die Ablagekarte genommen und kommst doch nicht raus, kannst du sie zurücklegen.</p>
<h3>Auslegen</h3>
<p>Tippe die Karten an (sie rutschen hoch) und dann <b>Auslegen</b>. Solange du noch nicht draußen bist, werden Meldungen vorgemerkt (gestrichelt), bis 40 Punkte zusammen sind.</p>
<h3>Anlegen und Joker tauschen</h3>
<p>Karte wählen, dann auf die Meldung am Tisch tippen. Passt die Karte genau an die Stelle eines Jokers, wird getauscht. Ohne Auswahl zeigt ein Tipp auf eine Meldung, wofür ihre Joker stehen.</p>
<h3>Sortieren</h3>
<p>Der Knopf „Nach Farbe“ / „Nach Wert“ sortiert deine Hand um – praktisch für Folgen bzw. Sätze.</p>
<h3>Mit Freunden spielen</h3>
<p>Zwei bis vier Spieler, Menschen und Computer gemischt. Vor jedem Wechsel zwischen Menschen erscheint „Gib das iPhone weiter an …“.</p>`,
    },
  ],
};
