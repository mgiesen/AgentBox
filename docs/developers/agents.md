# OpenCode

[OpenCode](https://opencode.ai) ist der integrierte KI-Agent. Er läuft als TUI-Prozess unter dem `agent`-User; ttyd hängt ihn direkt als PTY-Kommando an die WebSocket-Verbindung.

## Default-Konfiguration

AgentBox ist provider-agnostisch — es ist kein Anbieter fest verdrahtet. Die Seed-Config `config/opencode-default.json` liefert nur ein Gerüst; der Betreiber trägt seinen eigenen Provider ein (siehe [Modelle](../modelle.md)). Ein OpenAI-kompatibler Provider sieht z.B. so aus:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "mein-provider": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Mein Provider",
      "options": {
        "baseURL": "https://api.example.com/v1",
        "apiKey": ""
      },
      "models": {
        "modell-id": { "name": "Anzeigename", "limit": { "context": 131072, "output": 32768 } }
      }
    }
  }
}
```

Alternativ lässt sich ein OpenCode-nativer Provider (u.a. Anthropic, OpenAI, Google) direkt unter `provider` eintragen — Details in der [OpenCode-Doku](https://opencode.ai/docs/).

Beim ersten Container-Start kopiert der `entrypoint.sh` die Datei aus dem Image-Seed (`/opt/agentbox/seed/opencode/opencode.json`) nach `/home/agent/.config/opencode/opencode.json` — aber nur, wenn das `agent-home`-Volume noch keine eigene Config hat. Anwenderänderungen werden bei späteren Starts nicht überschrieben.

Der Anwender trägt seinen API-Key entweder via Zahnrad-Icon im Browser oder direkt im Modal-Editor der TUI ein.

## API-Key eintragen

Im Browser:

1. Zahnrad-Icon oben rechts klicken (mit Warn-Badge, wenn der Key fehlt).
2. `apiKey` im JSON-Feld setzen.
3. **Speichern und OpenCode neu starten** klicken.

Hinter den Kulissen:

- `PUT /api/config` schreibt die `opencode.json`.
- `POST /api/restart-agent` schickt `SIGTERM` an den laufenden Agent-Prozess.
- ttyd öffnet eine neue PTY-Verbindung, die OpenCode mit den neuen Settings neu startet.

Der Key persistiert im `agent-home`-Volume. Container-Restart oder Image-Rebuild ändern daran nichts; nur ein expliziter Volume-Wipe (`docker compose down -v`) löscht ihn.

## Persistenz

Vollständig persistent über das `agent-home`-Volume (siehe [Volumes](architecture/volumes.md)):

- `opencode.json` unter `/home/agent/.config/opencode/`
- Sessions, Logs und sonstiger OpenCode-State unter `/home/agent/.local/share/opencode/`
- OAuth-Auth via `opencode auth login <provider>` → `~/.local/share/opencode/auth.json`

Restart, Recreate und Image-Update lassen den Auth-Zustand unangetastet.

## Provider wechseln

Wer einen Provider hinzufügen oder wechseln will, ergänzt bzw. ändert ihn unter `provider` in der `opencode.json` — entweder über den Editor hinter dem Zahnrad-Icon oder direkt im Volume. OpenCode-Doku: <https://opencode.ai/docs/>.

## Was nicht offiziell unterstützt wird

- **Keine Workspace-Modifikation per Frontend außer über die Files-API.** OpenCodes interne Datei-Operationen sind davon abgekoppelt.
- **Kein OpenCode-Server-Modus.** Wir nutzen ausschließlich die TUI über ttyd.
- **Kein Plugin-Loading.** Plugins müssten ins Image, das ist nicht vorgesehen.
