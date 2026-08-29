import "dotenv/config";
import http from "node:http";
import { env } from "./config/env.js";
import { buildApp } from "./app.js";
import { createSocketServer } from "./sockets/index.js";
import { listenForUserExpiry } from "./sockets/expiry-listener.js";
import { connectRedis } from "./config/redis.js";
import { logger } from "./config/logger.js";

await connectRedis();
const app = buildApp();
const server = http.createServer(app);
const PORT = env.PORT;
createSocketServer(server);

try {
    await listenForUserExpiry();
} catch (err) {
    logger.warn({ err }, "Failed to start Redis expiry listener.");
}

server.listen(PORT);
