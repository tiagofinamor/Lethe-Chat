import "dotenv/config";
import http from "node:http";
import { env } from "./config/env.js";
import { app } from "./app.js";
import { createSocketServer } from "./sockets/index.js";
import { listenForUserExpiry } from "./sockets/expiry-listener.js";
import { connectRedis } from "./config/redis.js";

await connectRedis();
const server = http.createServer(app);
const PORT = env.PORT;
createSocketServer(server);
await listenForUserExpiry();
server.listen(PORT);
