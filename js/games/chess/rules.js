export default {
  title: 'Schach',
  tabs: [
    {
      id: 'regeln', label: 'Regeln', html: `
<h3>Ziel</h3>
<p>Setze den gegnerischen König <b>matt</b>: Er steht im Schach (wird angegriffen) und kann sich mit keinem Zug mehr retten. Weiß zieht zuerst, danach abwechselnd je ein Zug.</p>

<h3>So ziehen die Figuren</h3>
<table>
<tr><th>Figur</th><th>Zug</th></tr>
<tr><td>König</td><td>Ein Feld in jede Richtung. Darf nie auf ein angegriffenes Feld.</td></tr>
<tr><td>Dame</td><td>Beliebig weit gerade und schräg.</td></tr>
<tr><td>Turm</td><td>Beliebig weit gerade (Reihen und Linien).</td></tr>
<tr><td>Läufer</td><td>Beliebig weit schräg – bleibt immer auf seiner Feldfarbe.</td></tr>
<tr><td>Springer</td><td>Im „L“: zwei Felder gerade, eins zur Seite. Darf als einzige Figur überspringen.</td></tr>
<tr><td>Bauer</td><td>Ein Feld vorwärts, aus der Grundstellung wahlweise zwei. Schlägt schräg vorwärts.</td></tr>
</table>
<p>Geschlagen wird, indem man auf das Feld einer gegnerischen Figur zieht. Nur Springer dürfen über andere Figuren springen.</p>

<h3>Sonderzüge</h3>
<h4>Rochade</h4>
<p>König zieht zwei Felder Richtung Turm, der Turm springt über den König auf das Nachbarfeld. Erlaubt nur, wenn König und Turm noch nicht gezogen haben, kein Feld dazwischen besetzt ist und der König weder im Schach steht noch über ein angegriffenes Feld zieht. Tippe dazu den König an und dann das Feld zwei Schritte weiter.</p>
<h4>En passant</h4>
<p>Zieht ein Bauer zwei Felder vor und landet neben einem gegnerischen Bauern, darf dieser ihn <b>im direkt folgenden Zug</b> so schlagen, als wäre er nur ein Feld gezogen.</p>
<h4>Umwandlung</h4>
<p>Erreicht ein Bauer die letzte Reihe, wird er in Dame, Turm, Läufer oder Springer umgewandelt – meist in eine Dame.</p>

<h3>Schach, Matt und Patt</h3>
<ul>
<li><b>Schach:</b> Der König wird angegriffen. Du musst das sofort beheben – wegziehen, dazwischenziehen oder den Angreifer schlagen.</li>
<li><b>Matt:</b> Schach, und nichts hilft mehr. Die Partie ist verloren.</li>
<li><b>Patt:</b> Wer am Zug ist, steht nicht im Schach, hat aber keinen erlaubten Zug. Das ist <b>Remis</b> (unentschieden).</li>
</ul>

<h3>Weitere Remisregeln</h3>
<ul>
<li>Dieselbe Stellung kommt zum dritten Mal vor.</li>
<li>50 Züge lang wurde weder geschlagen noch ein Bauer gezogen.</li>
<li>Kein Spieler hat genug Material zum Mattsetzen (z. B. König gegen König mit Läufer).</li>
</ul>`,
    },
    {
      id: 'tricks', label: 'Tricks', html: `
<h3>Figurenwerte</h3>
<p>Als Faustregel: Bauer 1, Springer 3, Läufer 3, Turm 5, Dame 9. Tausche nur, wenn du mindestens gleich viel bekommst.</p>

<h3>Die ersten zehn Züge</h3>
<ol>
<li><b>Zentrum besetzen:</b> Bauern nach e4/d4 (oder e5/d5) öffnen Wege für Läufer und Dame.</li>
<li><b>Leichtfiguren entwickeln:</b> Springer und Läufer raus, bevor die Dame losstürmt. Springer am Rand ist eine Schande.</li>
<li><b>Früh rochieren:</b> Der König steht hinter seinen Bauern sicher, und die Türme kommen zusammen.</li>
<li><b>Keine Figur zweimal ziehen</b>, solange andere noch zu Hause stehen.</li>
<li><b>Dame nicht zu früh:</b> Sie wird sonst gejagt und du verlierst Tempo.</li>
</ol>

<h3>Taktische Motive</h3>
<h4>Gabel</h4>
<p>Eine Figur greift zwei gegnerische gleichzeitig an. Der Springer ist der Meister darin – achte auf Felder, von denen er König und Dame zugleich trifft.</p>
<h4>Fesselung</h4>
<p>Eine Figur darf nicht wegziehen, weil dahinter eine wertvollere steht (oder der König – dann darf sie gar nicht). Läufer und Türme fesseln gern.</p>
<h4>Spieß</h4>
<p>Umgekehrte Fesselung: Die wertvolle Figur steht vorne, muss weichen, und die dahinter fällt.</p>
<h4>Abzugsangriff</h4>
<p>Eine Figur zieht weg und gibt dadurch die Linie einer anderen frei. Ist der Abzug mit Schach, nennt man das <b>Abzugsschach</b> – oft gewinnt das eine Figur.</p>
<h4>Grundreihenmatt</h4>
<p>Steht der König hinter drei eigenen Bauern eingesperrt, reicht ein Turm auf der Grundreihe zum Matt. Gegenmittel: rechtzeitig ein „Luftloch“ ziehen (z. B. h3).</p>

<h3>Vor jedem Zug drei Fragen</h3>
<ol>
<li>Was droht mein Gegner mit seinem letzten Zug?</li>
<li>Steht eine meiner Figuren ungedeckt?</li>
<li>Gibt es ein Schach, ein Schlagen oder einen Angriff für mich?</li>
</ol>

<h3>Endspiel-Wissen</h3>
<ul>
<li><b>Der König wird aktiv:</b> Im Endspiel ist er eine starke Figur – ab in die Mitte.</li>
<li><b>Opposition:</b> Stehen sich die Könige mit einem Feld Abstand gegenüber, muss der Ziehende weichen. Wer die Opposition hat, gewinnt oft das Bauernendspiel.</li>
<li><b>Quadratregel:</b> Zeichne vom Freibauern ein Quadrat bis zur Umwandlungsreihe. Kann der gegnerische König hineinziehen, holt er den Bauern ein.</li>
<li><b>Türme hinter Freibauern</b> – egal ob eigene oder gegnerische.</li>
<li><b>Matt mit Dame:</b> Den König mit der Dame im Springerabstand an den Rand drängen, dann den eigenen König holen. Vorsicht vor Patt!</li>
</ul>`,
    },
    {
      id: 'app', label: 'Bedienung', html: `
<h3>Ziehen</h3>
<p>Tippe eine deiner Figuren an. Punkte zeigen leere Zielfelder, Ringe zeigen Figuren, die du schlagen kannst. Tippe das Zielfeld an.</p>
<h3>Tipp</h3>
<p>Die Glühbirne oben oder die Taste „Tipp“ lässt den Computer für dich rechnen. Er markiert den besten Zug und erklärt, warum er gut ist – mit „Ausführen“ spielst du ihn direkt.</p>
<h3>Trainer</h3>
<p>Ist der Trainer an (Menü oben rechts), prüft er jeden deiner Züge. Verlierst du dadurch Material oder übersiehst ein Matt, meldet er sich und bietet an, den Zug zurückzunehmen. Er warnt dich außerdem, wenn eine deiner Figuren angegriffen und nicht gedeckt ist.</p>
<h3>Spielstärke</h3>
<p><b>Leicht</b> rechnet kaum voraus und macht absichtlich Fehler. <b>Mittel</b> rechnet etwa vier Halbzüge. <b>Schwer</b> rechnet so tief, wie es in gut zwei Sekunden geht.</p>
<p>Deine Partie wird automatisch gespeichert – du kannst die App jederzeit schließen.</p>`,
    },
  ],
};
