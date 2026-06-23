import { createServer } from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { initSocket } from "./lib/socket";
import { startTcpServer } from "./lib/tcpServer";
import { startSignalLostMonitor } from "./lib/alertService";

const isVercel = process.env.VERCEL === "1";

if (!isVercel) {
  const rawPort = process.env["PORT"];

  if (!rawPort) {
    throw new Error("PORT environment variable is required but was not provided.");
  }

  const port = Number(rawPort);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  const httpServer = createServer(app);

  initSocket(httpServer);

  httpServer.listen(port, (err?: Error) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "HTTP + Socket.IO server listening");
  });

  const tcpPort = parseInt(process.env["TCP_PORT"] ?? "5001");
  startTcpServer(tcpPort);
  startSignalLostMonitor();
}

export default app;
