# Spielesammlung

Fünf Klassiker gegen den Computer – als Web-App fürs iPhone:

| Spiel | Gegner | Besonderheiten |
|---|---|---|
| **Backgammon** | 1 Computer | Doppelwürfel, Gammon/Backgammon, Gewinnchance vor dem Wurf |
| **Schach** | 1 Computer | Alle Regeln (Rochade, en passant, Umwandlung, Remisregeln), deutsche Notation |
| **Kanaster** | 3 Computer (mit Partner) oder 1 Computer | Erstmeldung, eingefrorene Ablage, rote/schwarze Dreien, Canastas, Spiel bis 5000 |
| **Doppelkopf** | 3 Computer | DDV-Regeln mit Neunen, Hochzeit, alle Soli, Ansagen bis „schwarz“, Fuchs/Doppelkopf/Karlchen, Hausregel „zweite Dulle“ |
| **Skat** | 2 Computer | Reizen, Hand, Drücken, Farb-/Grand-/Nullspiele (auch ouvert), Spitzen, Schneider/Schwarz, Überreizen, Skatblock |

Jedes Spiel hat drei Spielstärken (leicht, mittel, schwer). Bei „schwer“ rechnen die Kartenspiele
vor jeder Karte viele mögliche Verteilungen durch.

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
npm test                      # Regel- und KI-Tests (Node 18+)
```

```
index.html            Startseite und Symbole (Kartenfarben, Schachfiguren)
css/                  Grundlayout und Spieltische
js/main.js            Startseite, Navigation
js/shell.js, ui.js    Spielbildschirm, Dialoge, Regelheft, Trainer
js/cards/             Kartendarstellung und gemeinsamer Kartentisch
js/games/<spiel>/     engine.js (Regeln + Computer), view.js (Oberfläche), rules.js (Regelheft)
tests/                Tests mit vielen Computer-gegen-Computer-Partien
sw.js                 Offline-Unterstützung
```

Schriften: Young Serif und Jost (SIL Open Font License, siehe `assets/fonts`).
