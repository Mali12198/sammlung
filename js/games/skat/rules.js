const S = s => `<svg class="suit ${'HD'.includes(s) ? 'r' : 'b'}" viewBox="0 0 100 100"><use href="#s-${s}"/></svg>`;

export default {
  title: 'Skat',
  tabs: [
    {
      id: 'regeln', label: 'Regeln', html: `
<h3>Worum geht es?</h3>
<p>Drei Spieler, 32 Karten. In jedem Spiel spielt einer – der <b>Alleinspieler</b> – gegen die beiden anderen. Wer Alleinspieler wird, entscheidet das <b>Reizen</b>. Der Alleinspieler braucht in einem Farbspiel oder Grand mindestens <b>61 Augen</b> von 120.</p>

<h3>Kartenwerte (Augen)</h3>
<table>
<tr><th>Karte</th><th class="num">Augen</th></tr>
<tr><td>Ass</td><td class="num">11</td></tr>
<tr><td>Zehn</td><td class="num">10</td></tr>
<tr><td>König</td><td class="num">4</td></tr>
<tr><td>Dame</td><td class="num">3</td></tr>
<tr><td>Bube</td><td class="num">2</td></tr>
<tr><td>9, 8, 7</td><td class="num">0</td></tr>
</table>

<h3>Ablauf</h3>
<ol>
<li>Jeder bekommt 10 Karten, zwei liegen verdeckt im <b>Skat</b>.</li>
<li><b>Reizen</b>: Wer das höchste Gebot macht, wird Alleinspieler.</li>
<li>Der Alleinspieler nimmt den Skat auf und <b>drückt</b> zwei Karten zurück – oder spielt <b>Hand</b> (ohne Skat).</li>
<li>Er sagt sein Spiel an: eine Trumpffarbe, Grand oder Null.</li>
<li>Zehn Stiche werden gespielt. <b>Vorhand</b> spielt den ersten aus, danach der Gewinner des letzten Stichs.</li>
</ol>

<h3>Bedienen</h3>
<p>Die angespielte Farbe muss bedient werden (<b>Farbzwang</b>). Wer sie nicht hat, darf beliebig abwerfen oder mit Trumpf stechen. Es gibt <b>keinen Stichzwang</b>: Du musst nicht höher spielen.</p>
<div class="note"><b>Wichtig:</b> Die vier Buben gehören nicht zu ihrer Farbe, sie sind immer Trumpf (außer im Null). Wird ${S('H')} angespielt, darfst du den ${S('H')}-Buben nicht zum Bedienen nehmen.</div>

<h3>Die Spielarten</h3>
<h4>Farbspiel (Kreuz, Pik, Herz, Karo)</h4>
<p>Trumpf sind die vier Buben und die Karten der gewählten Farbe – insgesamt 11 Trümpfe. Reihenfolge:</p>
<p>${S('C')}B · ${S('S')}B · ${S('H')}B · ${S('D')}B · Ass · 10 · König · Dame · 9 · 8 · 7 der Trumpffarbe</p>
<p>In den anderen Farben gilt: Ass · 10 · König · Dame · 9 · 8 · 7. Die Zehn ist also die zweithöchste Karte!</p>
<h4>Grand</h4>
<p>Nur die vier Buben sind Trumpf. Sonst wie beim Farbspiel.</p>
<h4>Null</h4>
<p>Kein Trumpf. Der Alleinspieler darf <b>keinen einzigen Stich</b> bekommen. Reihenfolge wie früher üblich: Ass · König · Dame · Bube · 10 · 9 · 8 · 7 – die Zehn steht hier unter dem Buben. Bei <b>Null ouvert</b> legt der Alleinspieler seine Karten offen hin.</p>

<h3>Gewonnen oder verloren?</h3>
<ul>
<li><b>Farbspiel/Grand:</b> Der Alleinspieler gewinnt mit 61 Augen. Die gedrückten Karten zählen für ihn.</li>
<li><b>Schneider:</b> Eine Seite hat 30 Augen oder weniger.</li>
<li><b>Schwarz:</b> Eine Seite bekommt keinen Stich.</li>
<li><b>Null:</b> gewonnen, wenn der Alleinspieler keinen Stich bekommt.</li>
</ul>
<p>Gewonnene Spiele bringen ihren Spielwert, verlorene kosten den <b>doppelten</b> Wert. Ist das Spiel am Ende weniger wert als gereizt, ist es <b>überreizt</b> und verloren.</p>`,
    },
    {
      id: 'reizen', label: 'Reizen', html: `
<h3>Was wird gereizt?</h3>
<p>Man bietet Zahlen, nicht Spielarten. Jede Zahl ist ein möglicher Spielwert. Wer am meisten bietet, darf sein Spiel ansagen – es muss dann aber mindestens so viel wert sein.</p>

<h3>Spielwert = Grundwert × Stufen</h3>
<table>
<tr><th>Spiel</th><th class="num">Grundwert</th></tr>
<tr><td>${S('D')} Karo</td><td class="num">9</td></tr>
<tr><td>${S('H')} Herz</td><td class="num">10</td></tr>
<tr><td>${S('S')} Pik</td><td class="num">11</td></tr>
<tr><td>${S('C')} Kreuz</td><td class="num">12</td></tr>
<tr><td>Grand</td><td class="num">24</td></tr>
</table>
<p><b>Stufen</b> = Spitzen + 1 (Spiel) + je 1 für Hand, Schneider, Schneider angesagt, Schwarz, Schwarz angesagt, Ouvert.</p>

<h3>Spitzen zählen</h3>
<p>Schau dir die Trümpfe von oben an: ${S('C')}B, ${S('S')}B, ${S('H')}B, ${S('D')}B, dann Ass, 10, König … der Trumpffarbe.</p>
<ul>
<li>Hast du den ${S('C')}-Buben, spielst du <b>„mit“</b> so vielen, wie du lückenlos von oben hast. ${S('C')}B + ${S('S')}B, aber nicht ${S('H')}B: <b>mit 2</b>.</li>
<li>Fehlt dir der ${S('C')}-Bube, spielst du <b>„ohne“</b> so viele, wie dir von oben fehlen. Dein höchster Trumpf ist ${S('H')}B: <b>ohne 2</b>.</li>
</ul>
<div class="note">Beispiel: Herz mit 2 → 10 × (2 + 1) = <b>30</b>. Grand ohne 1, Hand → 24 × (1 + 1 + 1) = <b>72</b>.</div>
<p>Die Karten im Skat zählen am Ende mit. Wer „ohne 2“ reizt und dann einen Buben im Skat findet, kann plötzlich überreizt sein.</p>

<h3>Die Reizfolge</h3>
<p>18, 20, 22, 23, 24, 27, 30, 33, 35, 36, 40, 44, 45, 46, 48, 50, 54, 55, 59, 60 …</p>
<h3>Wer reizt wen?</h3>
<ol>
<li><b>Mittelhand</b> „sagt“ <b>Vorhand</b> Zahlen an. Vorhand antwortet „Ja“ (hält) oder „Passe“.</li>
<li>Danach sagt <b>Hinterhand</b> dem Sieger der ersten Runde weiter an.</li>
<li>Passen beide, darf Vorhand für 18 spielen oder auch passen – dann wird neu gegeben (eingepasst).</li>
</ol>
<p>Wer „hört“, muss nur halten; wer „sagt“, muss höher gehen. Bei Gleichstand gewinnt der Hörende.</p>
<h3>Null-Werte</h3>
<table>
<tr><td>Null</td><td class="num">23</td></tr>
<tr><td>Null Hand</td><td class="num">35</td></tr>
<tr><td>Null ouvert</td><td class="num">46</td></tr>
<tr><td>Null ouvert Hand</td><td class="num">59</td></tr>
</table>`,
    },
    {
      id: 'haus', label: 'Hausregeln', html: `
<p>Diese beliebten Kneipen-Regeln schaltest du beim Start einer neuen Liste ein oder aus.</p>
<h3>Ramsch</h3>
<p>Passen alle drei, wird nicht neu gegeben, sondern <b>Ramsch</b> gespielt:</p>
<ul>
<li>Jeder spielt für sich. Trumpf sind nur die vier <b>Buben</b> (wie im Grand).</li>
<li>Vorhand spielt aus. Der Skat geht an den, der den <b>letzten Stich</b> macht.</li>
<li>Wer die <b>meisten Augen</b> hat, verliert und bekommt sie als Minuspunkte. Bei Gleichstand verlieren beide.</li>
<li><b>Jungfrau:</b> Hat ein Spieler keinen einzigen Stich gemacht, zahlt der Verlierer doppelt.</li>
<li><b>Durchmarsch:</b> Wer alle zehn Stiche macht, bekommt +120.</li>
</ul>
<h3>Kontra und Re</h3>
<p>Glaubt ein Gegenspieler, dass der Alleinspieler verliert, sagt er <b>„Kontra“</b> – bevor er seine erste Karte spielt. Das Spiel zählt dann doppelt. Der Alleinspieler kann mit <b>„Re“</b> antworten (bis zu seiner zweiten Karte): Dann zählt es vierfach. Das gilt im Guten wie im Schlechten – ein verlorenes Re-Spiel ist teuer.</p>
<h3>Bockrunden</h3>
<p>Nach besonderen Spielen folgt eine <b>Bockrunde</b>: Die nächsten <b>drei Spiele</b> zählen doppelt (auch Ramsch). Auslöser hier:</p>
<ul>
<li>ein Spiel endet <b>60 zu 60</b>,</li>
<li>es wurde <b>Kontra</b> gesagt,</li>
<li>ein <b>Grand Hand</b> wurde gewonnen.</li>
</ul>
<p>Kommt während einer Bockrunde ein neuer Auslöser, verlängert sie sich um drei Spiele. Oben links am Tisch steht „Bock“, solange sie läuft.</p>
<h3>Tricks im Ramsch</h3>
<ul>
<li>Spiel kleine Karten an, die sicher überstochen werden.</li>
<li>Bleib beim Bedienen <b>unter</b> der höchsten Karte im Stich – so wirst du hohe Karten gefahrlos los.</li>
<li>Kannst du nicht bedienen, wirf <b>Asse und Zehnen</b> ab: Die Augen bekommt ein anderer.</li>
<li>Mach Farben früh blank – dann kannst du später abwerfen.</li>
<li>Vorsicht mit Buben: Wer viele hat, muss oft Stiche nehmen.</li>
</ul>`,
    },
    {
      id: 'tricks', label: 'Tricks', html: `
<h3>Wann reizen?</h3>
<p>Eine gute Faustregel für ein Farbspiel: <b>mindestens 5 Trümpfe</b> (Buben mitgezählt), davon zwei hohe, und dazu ein Ass oder eine Farbe, die du nicht hast. Für einen Grand brauchst du zwei Buben – am besten ${S('C')}B oder ${S('S')}B – und Asse mit Zehnen.</p>
<p>Vorhand hat einen Vorteil: Sie spielt den ersten Stich aus.</p>

<h3>Drücken</h3>
<ul>
<li><b>Blanke Zehnen</b> (Zehn ohne Ass in derselben Farbe) gehören in den Skat – sonst fängt sie das Ass.</li>
<li>Drücke so, dass du in einer Farbe <b>frei</b> wirst: Dann kannst du dort stechen.</li>
<li>Gedrückte Augen zählen sicher für dich. Eine gedrückte Zehn ist halb gewonnen.</li>
<li>Asse und Buben drückt man fast nie.</li>
</ul>

<h3>Als Alleinspieler</h3>
<ul>
<li><b>Trumpf ziehen:</b> Spiel Trumpf, bis die Gegner keine mehr haben. Dann sind deine Asse und Zehnen sicher.</li>
<li>Zähle die Trümpfe: 11 im Farbspiel, 4 im Grand. Weißt du, wie viele noch draußen sind, weißt du, wann du aufhören kannst.</li>
<li>Kannst du einen Stich nicht gewinnen, gib eine Karte <b>ohne Augen</b> ab.</li>
<li>Zähle mit: Mit 61 Augen ist das Spiel gewonnen.</li>
</ul>

<h3>Als Gegenspieler</h3>
<ul>
<li><b>Kurzer Weg – lange Farbe:</b> Sitzt der Alleinspieler direkt hinter dir, spiel deine lange Farbe an.</li>
<li><b>Langer Weg – kurze Farbe:</b> Sitzt er hinter deinem Partner, spiel eine kurze Farbe an, damit dein Partner bald stechen kann.</li>
<li><b>Schmieren:</b> Gewinnt dein Partner einen Stich sicher, gib ihm eine Zehn oder ein Ass dazu.</li>
<li><b>Asse abziehen:</b> Ein Ass im ersten Durchgang einer Farbe bringt meist sicher 11 Augen.</li>
<li>Spiel dem Alleinspieler keine Farbe an, die er nicht mehr hat – er sticht einfach.</li>
<li>Ihr braucht nur <b>60 Augen</b>. Bei 31 seid ihr aus dem Schneider.</li>
</ul>

<h3>Null spielen</h3>
<p>Sicher sind Farben, in denen du die niedrigen Karten hast: 7, 7-9, 7-9-Bube. Eine 8 ohne 7 ist gefährlich. Gegen einen Null spielt man kleine Karten an und bleibt beim Bedienen unter der Karte des Alleinspielers.</p>`,
    },
    {
      id: 'app', label: 'Bedienung', html: `
<h3>Am Tisch</h3>
<p>Lotte sitzt links, Karl rechts. Der goldene Punkt zeigt, wer dran ist. Oben links steht das aktuelle Spiel, oben rechts dein Stand im Skatblock (antippen für die Liste).</p>
<h3>Reizen</h3>
<p>Ist der Trainer an, rechnet dir die <b>Reizhilfe</b> im Kasten den Wert deines besten Spiels vor.</p>
<h3>Drücken und Ansagen</h3>
<p>Nach „Skat aufnehmen“ hast du 12 Karten. Tippe zwei an – sie rutschen nach oben – und wähle dann das Spiel. Jede Schaltfläche zeigt, was das Spiel wert ist. Rot markiert: zu wenig für dein Gebot.</p>
<h3>Ausspielen</h3>
<p>Tippe eine Karte an. Abgedunkelte Karten darfst du gerade nicht spielen; tippst du sie trotzdem, erklärt dir die App warum. Im Menü kannst du einstellen, dass eine Karte erst beim zweiten Tippen gespielt wird.</p>
<h3>Tipp und Trainer</h3>
<p>Die Glühbirne hilft in jeder Phase: beim Reizen, beim Drücken und beim Ausspielen (mit Begründung). Der Trainer meldet sich, wenn eine andere Karte deutlich besser gewesen wäre.</p>
<h3>Spielstärke</h3>
<p><b>Leicht</b> reizt gern zu hoch und spielt manchmal planlos. <b>Mittel</b> spielt nach bewährten Faustregeln. <b>Schwer</b> rechnet vor jeder Karte viele mögliche Verteilungen durch.</p>
<h3>Mit Freunden spielen</h3><p>Menü → „Neues Spiel“: Stell zwei oder alle drei Plätze auf <b>Mensch</b>. Freie Plätze übernimmt der Computer. Wer an der Reihe ist, sieht seine Karten unten; vorher erscheint ein Schirm „Gib das iPhone weiter an …“, damit niemand fremde Karten sieht.</p>`,
    },
  ],
};
