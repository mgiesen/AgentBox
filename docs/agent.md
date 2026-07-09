# Mit dem Agenten arbeiten

Der linke Bereich ist das laufende Agenten-Terminal. Beim Aufruf der URL ist der Agent bereits gestartet — Du kannst direkt eine Aufgabe formulieren.

Anders als ein Chatbot antwortet der Agent nicht nur mit Text. Er kann Dateien im Workspace lesen, neue Dateien anlegen, bestehende Dateien verändern, Recherchen durchführen und Werkzeuge aufrufen. Seine Arbeit bleibt auf die AgentBox beschränkt.

## Eingabe

Ganz normal in das Terminal tippen oder Text aus der Zwischenablage einfügen. Der Agent versteht natürliche Sprache; Aufgaben kannst Du ähnlich formulieren wie in einem Chat. Hilfreich ist, Ziel, Eingabedateien und gewünschtes Ausgabeformat konkret zu nennen.

Beispiele:

- *„Lies `Literaturrecherche_Stand.pdf` und erstelle eine Zusammenfassung der wichtigsten Aussagen als `Literatur_Zusammenfassung.md`."*
- *„Konsolidiere `Messreihe_Temperatur_Probe_A.xlsx`, `Messreihe_Druck_Probe_B.xlsx` und `Statistische_Auswertung.xlsx` zu einer einzigen CSV mit den jeweiligen Mittelwerten."*
- *„Recherchiere den aktuellen Stand zum Thema des Förderantrags und erstelle daraus ein Markdown-Briefing mit Quellenliste."*

Während der Agent arbeitet, siehst Du seine Schritte und Tool-Aufrufe live. Erzeugte oder geänderte Dateien erscheinen automatisch rechts in der Sidebar.

## Gute Aufgaben formulieren

Kurze Aufgaben funktionieren, präzise Aufgaben funktionieren besser. Nenne insbesondere:

- welche Dateien der Agent verwenden soll
- was am Ende entstehen soll
- welches Format gewünscht ist, zum Beispiel Markdown, CSV, DOCX oder PDF
- ob Internetrecherche erlaubt oder gewünscht ist
- welche inhaltlichen Grenzen gelten, etwa Sprache, Länge oder Quellenart

Beispiel: *„Nutze `Rohdaten_Export_2025-03-15.csv` und `Versuchsprotokoll_Versuch_12.pdf`, erstelle daraus eine deutschsprachige Markdown-Auswertung mit maximal zwei Seiten und speichere sie als `Auswertung_Versuch_12.md`."*

## Agenten neu starten

In der Kopfzeile oben rechts: **Pfeil-im-Kreis-Icon**. Ein Klick startet den Agenten neu.

Nutze diese Funktion nur, wenn der Agent eingefroren ist, nicht mehr reagiert oder die Sitzung offensichtlich nicht weiterläuft. Ein Neustart ist kein normales Mittel, um Kontext zu bereinigen, ein anderes Modell zu wählen oder eine Aufgabe „sauberer“ neu zu beginnen.

!!! warning "Sitzung geht verloren"
    Der Neustart beendet die laufende Sitzung. **Nicht gespeicherte Eingaben im Terminal sind danach weg.** Dateien im Workspace bleiben erhalten — alles, was im Sidebar-Bereich sichtbar ist, überlebt den Neustart.

Vor dem Neustart erscheint ein Bestätigungsdialog.

## Verbindung verloren?

Das Terminal hängt an einer WebSocket-Verbindung. Bei Netzwerkproblemen oder einem Container-Neustart bricht die Verbindung kurz ab. Meistens reicht ein Browser-Reload, um die Verbindung neu aufzubauen.

Wenn der Reload nicht hilft, ist der Container vermutlich nicht erreichbar — wende Dich an die Person, die AgentBox für Dich aufgesetzt hat.

## Welche Modelle nutzt der Agent?

Standardmäßig die in der Konfiguration eingetragenen — siehe [Modelle](modelle.md).
