# Dateisystem (Sidebar) bedienen

Die rechte Sidebar ist der gemeinsame Arbeitsbereich von Dir und dem Agenten. Alles, was der Agent lesen oder bearbeiten soll, muss hier liegen. Alles, was der Agent erzeugt, erscheint ebenfalls hier.

Der Workspace unterstützt einfache Ordner. Damit kannst Du Eingaben, Zwischenergebnisse und finale Dateien sauber voneinander trennen, ohne dass AgentBox zu einem vollwertigen Dateimanager wird.

## Dateien hinzufügen

**Ziehen und Ablegen:** Dateien aus dem Finder oder Explorer in die Sidebar ziehen. Mehrere gleichzeitig sind erlaubt. Wenn Du Dateien direkt auf einen Ordner ziehst, werden sie dort hochgeladen, sonst landen sie im Workspace-Root.

**Upload-Button** in der Aktionsleiste oben (Pfeil-nach-oben-Icon) öffnet den Datei-Dialog.

Während des Uploads zeigt eine Fortschrittsleiste den Stand. Existiert bereits eine Datei mit demselben Namen, fragt AgentBox einmal nach, ob überschrieben werden soll.

## Ordner erstellen und verwenden

Über das **Ordner-Plus-Icon** in der Aktionsleiste legst Du einen neuen Ordner im Workspace an. Im Drei-Punkt-Menü oder per Rechtsklick auf einen bestehenden Ordner erstellst Du Unterordner.

Ein Klick auf den Pfeil links neben einem Ordner klappt ihn auf oder zu. Ein Klick auf die Ordnerzeile selbst macht das Gleiche und markiert den Ordner zusätzlich.

## Suchen und Filtern

Das **Filter-Feld** oben in der Aktionsleiste durchsucht alle Dateien und Ordner im Workspace nach Namen. Treffer werden als flache Liste mit Pfad-Hinweis angezeigt; der gefundene Teil im Namen ist hervorgehoben. `Esc` leert das Feld wieder.

## Auswählen

Die Sidebar arbeitet wie der VS-Code-Explorer — kein eigener Auswahlmodus, einfach klicken:

- **Klick** auf eine Zeile — wählt nur diesen Eintrag aus.
- **Cmd-/Ctrl-Klick** — fügt zur Auswahl hinzu oder nimmt aus ihr heraus.
- **Shift-Klick** — wählt den Bereich zwischen letztem Anker und Klickpunkt aus.
- **Cmd/Ctrl + A** mit Fokus in der Liste — wählt alle sichtbaren Einträge.
- **Esc** — hebt die Auswahl auf, oder leert das Filterfeld, falls aktiv.

Sobald mindestens ein Eintrag gewählt ist, erscheint unten eine **Auswahl-Leiste** mit Anzahl und den Aktionen Herunterladen, Pfade kopieren und Löschen sowie einem X zum Aufheben.

## Verschieben

Zwei gleichberechtigte Wege:

**Drag & Drop:** Eintrag oder Auswahl auf einen Zielordner ziehen. Drop auf einen leeren Bereich der Liste verschiebt in den Workspace-Root. Während des Ziehens werden die ausgewählten Zeilen blasser angezeigt; das Drop-Ziel bekommt einen Akzent-Rahmen.

**Cut & Paste:**

1. Eintrag oder Auswahl markieren
2. **Cmd/Ctrl + X** — die Einträge werden als „ausgeschnitten" markiert (kursiv und etwas blasser dargestellt). In der Statuszeile oben steht die Anzahl.
3. Zielordner anklicken (oder eine Datei darin — dann gilt deren Eltern-Ordner als Ziel)
4. **Cmd/Ctrl + V** — die Einträge werden in den Ziel-Ordner verschoben

`Esc` bricht den Cut-Status ab. Existiert im Ziel bereits ein Eintrag mit demselben Namen, wird nicht überschrieben — der einzelne Eintrag bleibt am Ursprungsort.

## Pfad kopieren

Damit Du im Terminal oder Chat eine Datei eindeutig referenzieren kannst:

- **Cmd/Ctrl + C** kopiert den relativen Pfad des aktiven oder ausgewählten Eintrags.
- Drei-Punkt oder Rechtsklick → **Pfad kopieren** macht dasselbe für die geklickte Zeile.
- Bei Mehrfach-Auswahl werden die Pfade durch Zeilenumbrüche getrennt.

## Umbenennen (inline)

`F2` auf einem ausgewählten Eintrag oder Drei-Punkt → **Umbenennen** öffnet ein Eingabefeld direkt in der Zeile. Bei Dateien ist beim ersten Markieren nur der Basisname ausgewählt, die Endung bleibt erhalten. `Enter` speichert, `Esc` bricht ab.

## Aktionen pro Eintrag

Beim Hover über eine Zeile erscheint rechts ein Drei-Punkt-Menü; alternativ funktioniert auch **Rechtsklick** auf die Zeile. Verfügbare Aktionen:

- **Herunterladen** — Datei direkt, Ordner als ZIP
- **Pfad kopieren** — relativer Workspace-Pfad in die Zwischenablage
- **Umbenennen** — Inline-Eingabe in der Zeile
- **Unterordner** (nur bei Ordnern) — neuen Ordner darin erstellen
- **Löschen** — Datei oder Ordner mit Bestätigung

## Mehrere Einträge herunterladen

Bei Auswahl ≥ 2 Einträge bekommst Du ein einziges ZIP-Archiv `agent-files.zip` mit allen Dateien und Ordnerinhalten. Eine einzelne Datei lädt direkt herunter, ein einzelner Ordner als ZIP.

## Mehrere Einträge löschen

Aktion **Löschen** in der Auswahl-Leiste. Eine Bestätigung erscheint, danach werden alle ausgewählten Dateien und Ordner unwiderruflich entfernt. Schlägt das Löschen einzelner Einträge fehl, wird das nach Abschluss in einem Hinweis aufgelistet.

## Tastatur-Übersicht

Mit Fokus in der Datei-Liste:

| Taste | Wirkung |
|---|---|
| `↑` / `↓` | vorherige / nächste Zeile |
| `Home` / `End` | erste / letzte Zeile |
| `→` | Ordner aufklappen, oder ins erste Kind |
| `←` | Ordner zuklappen, oder zur Eltern-Zeile |
| `Enter` | Datei herunterladen, Ordner auf-/zuklappen |
| `Doppelklick` | Datei herunterladen |
| `Leertaste` | Auswahl ein-/ausschalten (additiv) |
| `Cmd/Ctrl + A` | alle sichtbaren auswählen |
| `Cmd/Ctrl + C` | Pfad(e) in die Zwischenablage kopieren |
| `Cmd/Ctrl + X` | Eintrag(e) zum Verschieben markieren |
| `Cmd/Ctrl + V` | markierte Einträge in den Zielordner verschieben |
| `F2` | umbenennen (inline) |
| `Entf` / `⌫` | Eintrag oder Auswahl löschen |
| `Esc` | Cut, Filter oder Auswahl aufheben (in dieser Reihenfolge) |

## Live-Sync

Die Sidebar aktualisiert sich automatisch, wenn der Agent Dateien anlegt, ändert oder löscht — kein Refresh nötig. Im Hintergrund hält ein Server-Sent-Event-Stream die Verbindung warm; bei Abbruch versucht der Browser automatisch, ihn neu aufzubauen.

## Workspace als Netzlaufwerk verbinden

Der Workspace ist zusätzlich zur Sidebar als SMB-Share verfügbar. Damit kannst Du ihn auf macOS und Windows als Netzlaufwerk einbinden, Dateien per Drag & Drop austauschen und Office-Dokumente direkt vom Mount aus öffnen.

Die Verbindungsdaten liegen im Header hinter dem Netzlaufwerk-Icon. Klicken öffnet ein Modal mit OS-Auswahl (macOS / Windows) und für jedes OS einer Schritt-für-Schritt-Anleitung:

- **macOS-URL** (`smb://agent@<host>/workspace`) — Klick öffnet Finder und fragt einmal nach dem Passwort.
- **Windows-UNC-Pfad** (`\\<host>\workspace`) — in die Adressleiste des Explorers einfügen oder unter *Dieser PC → Netzlaufwerk verbinden* eintragen.
- **Benutzer:** `agent` (fest, nicht änderbar).
- **Passwort:** beim ersten Start zufällig generiert und im `agent-home`-Volume persistiert. Per Reveal-Button anzeigen, per Copy-Button in die Zwischenablage.

Die Adresse ist immer die, über die Du gerade die Web-UI geladen hast (`window.location.hostname`). Wer die UI über `localhost` oder `127.0.0.1` aufruft, sieht zusätzlich eine Hinweis-Box: Mount auf demselben Computer scheitert mit Bordmitteln zuverlässig — macOS-Finder löst `smb://localhost/` nicht stabil auf, Windows-Explorer kollidiert mit dem lokalen `LanmanServer` auf Port 445, und der Standard-Dialog „Netzlaufwerk verbinden" akzeptiert keinen Port-Override. Die Anleitung bleibt trotzdem sichtbar, damit man den Ablauf vorab nachvollziehen kann; sobald die UI über LAN-IP, Hostname oder Domain erreichbar ist, klappt genau dieser Ablauf.

### Voraussetzungen

- Der SMB-Endpunkt muss aus Deinem Netz auf TCP-Port 445 erreichbar sein (Default-SMB-Port). Wer hinter einem Reverse Proxy mit nur HTTP/HTTPS sitzt, erreicht den Share so nicht und nutzt weiter die Sidebar.
- Auf macOS muss der Finder im Menü *Gehe zu → Mit Server verbinden* (Cmd-K) den eingegebenen URL annehmen — bei Erstverbindung erscheint dort die Passwort-Abfrage.
- Auf Windows: gleiche Anmeldedaten im Explorer-Dialog. Das Häkchen *Anmeldeinformationen speichern* ist optional.

### Hinweise zur Datenkonsistenz

- Wenn der Agent eine Datei schreibt, während Du sie in Word oder Excel parallel offen hast, sind die Office-Locks aus Linux-Sicht nur beratend. Konflikte sind in der Praxis selten, in solchen Fällen aber möglich. Bei intensivem Parallelbetrieb auf einer Datei: vorher schließen oder eine Kopie nutzen.
- Über SMB hinzugefügte Dateien erscheinen ohne Verzögerung auch in der Sidebar — der Workspace-Watcher pollt das Dateisystem.

### Sicherheit

Wer den SMB-Port erreicht, kann sich mit dem Passwort am Workspace anmelden — wie bei jedem Netzlaufwerk. Defaults beider Eingänge sind asymmetrisch:

- **Web-UI:** Loopback-only (`HOST_BIND=127.0.0.1`), Reverse Proxy mit Auth empfohlen.
- **SMB:** alle Interfaces (`SMB_BIND=0.0.0.0`), sonst wäre ein Mount aus dem LAN nicht möglich.

In Mehrbenutzer-Setups gehört SMB hinter VPN oder ein internes Netzsegment. `SMB_BIND=127.0.0.1` schränkt nur das veröffentlichte Host-Binding ein; der Samba-Prozess läuft im Container trotzdem weiter.

## Was nicht geht (bewusst)

- **Keine Inline-Bearbeitung von Dateiinhalten.** Editieren übernimmt der Agent oder Du auf dem Host.
- **Keine geteilte Ablage zwischen Nutzern.** Jeder Container hat sein eigenes Volume.
- **Kein Zugriff außerhalb des Workspace.** Pfade wie `../` oder absolute Systempfade sind gesperrt.

## Sicherheitsprinzip

Der Workspace ist die bewusste Übergabestelle. AgentBox greift nicht auf beliebige Ordner Deines Rechners zu; der Agent sieht nur die Dateien, die Du in diese Umgebung hochlädst. Prüfe deshalb vor dem Upload, ob die Dateien zur aktuell genutzten Modellumgebung passen.
