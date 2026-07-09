# AgentBox nutzen

KI wird in der täglichen Arbeit zunehmend vom Formulierungswerkzeug zum aktiven Arbeitsmittel. Chatbots helfen beim Schreiben, Strukturieren und Nachdenken. Sobald aber Dateien gelesen, Recherchen durchgeführt, Daten umgebaut oder fertige Dokumente erzeugt werden sollen, reichen klassische Chats schnell nicht mehr aus.

AgentBox stellt dafür eine geschützte Arbeitsumgebung bereit. Ein KI-Agent läuft nicht direkt auf Deinem Laptop, sondern in einer isolierten Umgebung mit eigenem Dateibereich. Du gibst bewusst Dateien hinein, der Agent bearbeitet sie dort, und Du lädst die Ergebnisse anschließend wieder herunter.

## Warum Agenten mehr können als Chatbots?

Ein Agent ist eine Ausführungsumgebung für ein KI-Modell. Er kann mit Dateien arbeiten, Befehle ausführen, Werkzeuge nutzen, im Internet recherchieren und daraus neue Artefakte erzeugen. Dadurch entstehen nicht nur Textbausteine, die Du manuell kopieren musst, sondern vollständige Ergebnisse: Markdown-Berichte, Tabellen, Auswertungen, Briefings, strukturierte Datensätze oder vorbereitete Dokumente.

Diese Stärke braucht aber Grenzen. Ein Agent, der direkt auf Deinem Rechner läuft, hätte grundsätzlich Zugriff auf alles, was Dein Benutzerkonto sieht. AgentBox setzt deshalb eine Schutzschicht dazwischen: Der Agent sieht nur den Workspace der AgentBox, nicht Deinen Desktop, Deine Downloads, Netzlaufwerke oder persönlichen Dateien.

!!! warning "Datenklassifizierung beachten"
    Welche Daten Du in AgentBox verarbeiten darfst, hängt vom angebundenen Modell und den Freigaben Deiner Organisation ab. Für externe Cloud-Anbieter wie OpenAI, Anthropic oder Google gelten andere Grenzen als für selbst-gehostete/On-Prem-Modelle. Lade nur Daten hoch, deren Verarbeitung für die aktuell konfigurierte Modellumgebung freigegeben ist.

## Wofür AgentBox gedacht ist

AgentBox ist das zentrale Übergabeelement zwischen Dir und dem Agenten:

- Du lädst die Arbeitsdateien in den AgentBox-Workspace.
- Der Agent liest, verändert, ergänzt oder erzeugt Dateien ausschließlich dort.
- Internetrecherche, Datenaufbereitung und Dokumentenerstellung passieren innerhalb der AgentBox.
- Ergebnisse erscheinen in der Sidebar und können von dort heruntergeladen werden.

Die Umgebung kann lokal per Docker auf dem eigenen Gerät laufen oder zentral auf einem Server bereitgestellt werden. In zentralen Setups kann die IT für Personen oder Projektteams eigene Instanzen erstellen, aktualisieren und voneinander trennen. Diese Instanzen lassen sich **vorkonfigurieren** — mit passenden Skills und Agenten sowie voreingestellter OpenCode-Konfiguration (Provider, Modell, Berechtigungen). Anwender öffnen dann nur noch eine Browser-Adresse und arbeiten sofort agentisch, ohne lokale Installation und ohne Vorerfahrung. Für Anwender bleibt das Prinzip gleich: Jede AgentBox ist ein eigener, isolierter Arbeitsraum.

## Was Du im Browser siehst

Beim Aufruf der URL teilt sich der Bildschirm in zwei Bereiche:

- **KI-Agent (links)** — ein Web-Terminal mit dem laufenden Agenten. Beim Öffnen ist er bereits gestartet; kein Shell-Prompt davor.
- **Agent-Dateisystem (rechts)** — eine Sidebar, in die Du Dateien durch Ziehen und Ablegen hochladen kannst und in der die vom Agenten erzeugten Dateien automatisch erscheinen.

## Typischer Arbeitsablauf

1. Dateien in die rechte Sidebar ziehen oder über den **Hochladen**-Button auswählen.
2. Aufgabe links im Terminal in normaler Sprache formulieren.
3. Der Agent liest die bereitgestellten Dateien, recherchiert bei Bedarf im Internet und erstellt oder verändert Dateien im Workspace.
4. Ergebnisse erscheinen automatisch in der Sidebar und sind von dort herunterladbar.

## Weiter lesen

- [Dateisystem (Sidebar) bedienen](workspace.md) — Ordner, Hochladen, Verschieben, Auswahl, Live-Sync
- [Mit dem Agenten arbeiten](agent.md) — Terminal nutzen, Neustart-Verhalten
- [Modelle und API-Konfiguration](modelle.md) — Provider eintragen, Modelle, API-Key
