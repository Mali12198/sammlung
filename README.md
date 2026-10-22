# Spielesammlung

Neun Spiele gegen den Computer oder mit Freunden an einem Gerät – als Web-App fürs iPhone:

| Spiel | Mitspieler | Besonderheiten |
|---|---|---|
| **Backgammon** | Computer oder zu zweit | Doppelwürfel, Gammon/Backgammon, Gewinnchance vor dem Wurf, Match bis 3/5/7 mit Crawford-Regel |
| **Schach** | Computer oder zu zweit | Alle Regeln (Rochade, en passant, Umwandlung, Remisregeln), deutsche Notation, Rätsel „Matt in 1/2“ |
| **Kanaster** | zu viert (Teams) oder zu zweit, Menschen und Computer gemischt | Erstmeldung, eingefrorene Ablage, rote/schwarze Dreien, Canastas, Spiel bis 5000 |
| **Doppelkopf** | 1–4 Menschen, Rest Computer | DDV-Regeln mit Neunen, Hochzeit, alle Soli, Ansagen bis „schwarz“, Fuchs/Doppelkopf/Karlchen; Hausregeln: zweite Dulle, Schweinchen, Armut, Bockrunden |
| **Skat** | 1–3 Menschen, Rest Computer | Reizen, Hand, Drücken, Farb-/Grand-/Nullspiele (auch ouvert), Spitzen, Schneider/Schwarz, Überreizen, Skatblock; Hausregeln: Ramsch, Kontra/Re, Bockrunden |
| **Würfelpoker** | 0–5 Computer | Drei Würfe, Würfel halten, Spielblock mit Bonus, Extra-Poker/Joker (schaltbar), Bestwert im Solospiel, Variante Dreifach (×1/×2/×3) |
| **Farbreihen** | 1–4 Computer | Vier Farbreihen, weiße Summe für alle, Farbkombination für den Aktiven, Fehlwürfe, Reihen abschließen; Hausregeln: kurzes Spiel, Neuwurf-Joker, früh abschließen |
| **Rommé** | 2–4 Spieler, Menschen und Computer gemischt | Sätze und Folgen, Rauskommen mit 40, Anlegen, Joker tauschen, Hand-Rommé, Spiel bis 200/500 |
| **Zahlensteine** | 2–4 Spieler, Menschen und Computer gemischt | Gruppen und Reihen, erstes Auslegen mit 30, Tisch umbauen (die App findet die Aufteilung selbst) |

Jedes Spiel hat drei Spielstärken (leicht, mittel, schwer). Bei „schwer“ rechnen die Kartenspiele
vor jeder Karte viele mögliche Verteilungen durch; beim Würfelpoker prüft der Computer alle Halte-Möglichkeiten
über die verbleibenden Würfe.

## Mit Freunden spielen

Beim Öffnen eines Spiels erscheint zuerst der Startbildschirm (auch über Menü → **Neues Spiel**):
*Weiterspielen*, *Gegen Computer* oder *Nur Menschen* – jeden Platz kannst du auf *Mensch* oder
*Computer* stellen und Namen eingeben.
Gespielt wird an einem iPhone, das reihum weitergereicht wird. Bei Kartenspielen erscheint vor jedem
Wechsel ein Schirm „Gib das iPhone weiter an …“ – erst nach dem Antippen werden die Karten des
nächsten Spielers aufgedeckt, und der Tisch dreht sich in seine Sicht.

## Lernen im Spiel

- **Regelheft** (Buch-Symbol): Regeln, Tricks und Bedienung für jedes Spiel.
- **Tipp** (Glühbirne): schlägt dir den nächsten Zug vor und erklärt ihn – beim Reizen,
  Drücken, Ausspielen, Melden oder Ziehen. Mit „Ausführen“ wird er gespielt.
- **Trainer** (im Menü an/aus): meldet sich, wenn ein deutlich besserer Zug möglich war,
  erklärt Fachbegriffe beim ersten Auftauchen und rechnet beim Skat den Reizwert vor.

Alles wird lokal gespeichert: Du kannst die App jederzeit schließen und später weiterspielen.

## Aufs iPhone

1. Auf GitHub im Repository **Settings → Pages** öffnen.
2. Bei **Build and deployment** als Quelle „Deploy from a branch“, Branch **main** und Ordner **/ (root)** wählen, speichern.
3. Nach ein bis zwei Minuten ist die Seite unter `https://<dein-name>.github.io/sammlung/` erreichbar.
4. Die Adresse in **Safari** öffnen, auf **Teilen** tippen und **„Zum Home-Bildschirm“** wählen.

Danach startet die Sammlung wie eine App im Vollbild und funktioniert auch offline.

## Entwicklung

Reines HTML, CSS und JavaScript (ES-Module) ohne Build-Schritt.

```bash
python3 -m http.server 8000   # dann http://localhost:8000 öffnen
# Nach jeder Änderung CACHE in sw.js hochzählen, damit das Update auf dem iPhone ankommt.
npm test                      # Regel- und KI-Tests (Node 18+)
```

```
index.html            Startseite und Symbole (Kartenfarben, Schachfiguren)
css/                  Grundlayout und Spieltische
js/main.js            Startseite, Navigation
js/shell.js, ui.js    Spielbildschirm, Dialoge, Regelheft, Trainer
js/players.js         Spielerauswahl und Übergabe-Schirm für mehrere Menschen
js/cards/             Kartendarstellung und gemeinsamer Kartentisch
js/games/<spiel>/     engine.js (Regeln + Computer), view.js (Oberfläche), rules.js (Regelheft)
tests/                Tests mit vielen Computer-gegen-Computer-Partien
sw.js                 Offline-Unterstützung
```

Schriften: Young Serif und Jost (SIL Open Font License, siehe `assets/fonts`).
