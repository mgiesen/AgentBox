# Modelle und API-Konfiguration

AgentBox trennt die Arbeitsumgebung vom KI-Modell. Die Umgebung stellt Dateien, Werkzeuge und Isolation bereit; das Modell liefert die eigentliche Sprach- und Schlussfolgerungsfähigkeit.

AgentBox nutzt [OpenCode](https://opencode.ai) als Agentensystem und ist **provider-agnostisch**: Es ist kein Anbieter vorkonfiguriert. Der Betreiber trägt seinen eigenen LLM-Provider selbst über die OpenCode-Konfiguration ein. Das funktioniert mit jedem OpenAI-kompatiblen Endpoint (OpenAI, OpenRouter, Groq, Together, ein lokales Ollama/vLLM/LM Studio) und mit den OpenCode-nativen Providern (u.a. Anthropic, OpenAI, Google).

## Provider eintragen

Die Konfiguration erreichst Du über das **Zahnrad-Icon** oben in der Web-UI. Es öffnet den vollständigen OpenCode-Konfig-Editor (`opencode.json`).

1. Zahnrad-Icon oben klicken. Der Editor zeigt die aktuelle `opencode.json`.
2. Provider und Modelle im JSON eintragen (Beispiele unten).
3. Über den Button **Speichern und OpenCode neu starten** übernehmen.

Der Editor prüft beim Speichern auf gültiges JSON. Falls Du Kommentare im JSON nutzt — OpenCode unterstützt sie, der Editor entfernt sie nur zur Validierung.

## Beispiel: OpenAI-kompatibler Endpoint

Für jeden Endpoint, der die OpenAI-API spricht (OpenAI selbst, OpenRouter, Groq, Together, lokales Ollama/vLLM/LM Studio). Nötig sind `baseURL` und `apiKey` sowie die gewünschten Modelle:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "mein-provider": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Mein Provider",
      "options": {
        "baseURL": "https://api.example.com/v1",
        "apiKey": "DEIN-KEY-HIER"
      },
      "models": {
        "modell-id": { "name": "Anzeigename", "limit": { "context": 131072, "output": 32768 } }
      }
    }
  }
}
```

Für ein lokales Ollama wäre `baseURL` z.B. `http://localhost:11434/v1` und `apiKey` ein beliebiger Platzhalter.

## Beispiel: OpenCode-nativer Provider

OpenCode kennt einige Anbieter direkt (u.a. Anthropic, OpenAI, Google). Diese lassen sich ohne `openai-compatible`-Wrapper nutzen — häufig genügt der API-Key bzw. ein OAuth-Login:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "anthropic": {
      "options": {
        "apiKey": "DEIN-KEY-HIER"
      }
    }
  }
}
```

Alternativ meldet sich OpenCode bei nativen Providern per `opencode auth login <provider>` im Terminal an; der Auth-Zustand persistiert dann im `agent-home`-Volume.

Welche Provider unterstützt werden und welche Optionen sie erwarten, steht in der [OpenCode-Dokumentation](https://opencode.ai/docs/).

## Persistenz

Konfiguration und Key bleiben in einem persistenten Container-Volume gespeichert. Container-Neustart, Browser-Reload, Agent-Neustart und Image-Updates ändern nichts. Nur ein bewusstes Zurücksetzen des Volumes (passiert üblicherweise nicht im normalen Betrieb) löscht sie.

## Datenklasse beachten

Mit dem gewählten Provider ändert sich die zulässige Datenklasse. Selbst-gehostete/On-Prem-Modelle (z.B. lokales Ollama/vLLM) und externe Cloud-Anbieter sind organisatorisch und datenschutzrechtlich nicht gleich zu behandeln. Verarbeite nur Daten, deren Weitergabe an die aktuell konfigurierte Modellumgebung freigegeben ist.

## Wenn der Key falsch oder abgelaufen ist

Der Agent zeigt im Terminal eine Fehlermeldung des Backends — meist ein HTTP-401 oder eine API-spezifische Antwort. Lösung: Zahnrad öffnen, Key korrigieren und über den Speichern-Button übernehmen.
