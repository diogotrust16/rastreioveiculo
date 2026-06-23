---
name: FleetWatch Socket.IO proxy path
description: Socket.IO WebSocket upgrades require the /socket.io path in artifact.toml
---

The Replit reverse proxy uses path-based routing. WebSocket upgrade requests to `/socket.io` will 404 unless `/socket.io` is listed in the API server's `artifact.toml` `paths` array.

**Why:** The proxy only forwards requests for registered paths. WebSocket handshakes go through `/socket.io/?EIO=4&transport=websocket` — if the proxy doesn't know to forward that path, it returns 404 and Socket.IO falls back to polling or fails.

**How to apply:** In `artifacts/api-server/.replit-artifact/artifact.toml`:
```toml
[[services]]
paths = ["/api", "/socket.io"]
```
Use `verifyAndReplaceArtifactToml` to apply changes, then restart the API server workflow.
