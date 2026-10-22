export default {
  title: 'Zahlensteine',
  tabs: [
    {
      id: 'regeln', label: 'Regeln', html: `
<h3>Worum geht es?</h3>
<p>Gespielt wird mit 106 Steinen: den Zahlen <b>1 bis 13</b> in vier Farben (Rot, Blau, Orange, Schwarz), jede zweimal, dazu zwei <b>Joker</b>. Jeder bekommt 14 Steine. Wer zuerst alle Steine ablegt, gewinnt.</p>

<h3>Serien</h3>
<ul>
<li><b>Gruppe:</b> drei oder vier gleiche Zahlen in <b>verschiedenen</b> Farben, z. B. rote, blaue und schwarze 7.</li>
<li><b>Reihe:</b> mindestens drei aufeinanderfolgende Zahlen <b>einer</b> Farbe, z. B. orange 4-5-6. Die 1 folgt nicht auf die 13.</li>
<li>Ein <b>Joker</b> ersetzt jeden Stein.</li>
</ul>

<h3>Erstes Auslegen</h3>
<p>Dein erstes Auslegen muss aus eigenen Steinen bestehen und zusammen mindestens <b>30 Punkte</b> haben (der Wert eines Steins ist seine Zahl, ein Joker zählt wie der ersetzte Stein). Den Tisch darfst du dabei noch nicht benutzen.</p>

<h3>Ein Zug</h3>
<p>Entweder du legst mindestens einen Stein – oder du ziehst einen Stein vom Stapel, und der Zug ist vorbei.</p>

<h3>Anlegen und Umbauen</h3>
<p>Nach dem ersten Auslegen darfst du Steine an alle Serien auf dem Tisch anlegen und den Tisch beliebig <b>umbauen</b>: Serien teilen, Steine verschieben, neue Serien bilden. Am Ende deines Zugs müssen alle Serien wieder gültig sein, und kein Stein vom Tisch darf auf deinem Bänkchen landen.</p>
<p>Beispiel: Auf dem Tisch liegt Blau 3-4-5-6. Du hast Blau 4 und Blau 5 dazu? Dann teilst du in Blau 3-4-5 und Blau 4-5-6.</p>

<h3>Spielende</h3>
<p>Wer seinen letzten Stein legt, gewinnt. Alle anderen zählen ihre Steine zusammen (Joker 30) und bekommen sie als Minuspunkte, der Gewinner bekommt die Summe als Pluspunkte. Ist der Stapel leer und niemand kann mehr legen, gewinnt, wer die wenigsten Punkte übrig hat.</p>`,
    },
    {
      id: 'tricks', label: 'Tricks', html: `
<h3>Hohe Steine zuerst</h3>
<p>Steine mit hohen Zahlen kosten am Ende die meisten Punkte. Werde sie früh los – und halte kleine Steine für das Anlegen bereit.</p>
<h3>Joker nicht verschwenden</h3>
<p>Ein Joker auf dem Bänkchen kostet am Ende 30 Punkte, ist aber Gold wert, um schwierige Lücken zu füllen. Spiel ihn, wenn er viele Steine auf einmal möglich macht.</p>
<h3>Lange Reihen teilen</h3>
<p>Eine Reihe ab sechs Steinen lässt sich in zwei teilen. Hast du die passende Zahl doppelt, wird aus einer Reihe schnell zwei.</p>
<h3>Gruppen aufbrechen</h3>
<p>Eine Vierer-Gruppe gibt einen Stein ab, ohne ungültig zu werden. Den kannst du für eine Reihe nutzen.</p>
<h3>Beobachten</h3>
<p>Zieht jemand oft, fehlen ihm Steine für sein erstes Auslegen oder er sammelt. Hat jemand nur noch wenige Steine, leg so viel wie möglich ab.</p>`,
    },
    {
      id: 'app', label: 'Bedienung', html: `
<h3>Legen</h3>
<p>Tippe Steine auf deinem Bänkchen an und dann <b>Legen</b>. Die App sucht selbst den passenden Platz: zuerst als eigene neue Serie, dann als Anlegen an liegende Serien – und wenn nötig baut sie den Tisch für dich um. Was neu ist, ist hell umrandet.</p>
<h3>Zurück und Fertig</h3>
<p>Mit <b>Zurück</b> nimmst du alles aus diesem Zug zurück. Mit <b>Fertig</b> beendest du deinen Zug. Kannst oder willst du nicht legen, tippe <b>Ziehen</b>.</p>
<h3>Sortieren</h3>
<p>„Nach Farbe“ hilft bei Reihen, „Nach Zahl“ bei Gruppen.</p>
<h3>Tipp</h3>
<p>Die Glühbirne zeigt, welche Steine du legen kannst – auch mit Umbau – und legt sie auf Wunsch.</p>`,
    },
  ],
};
