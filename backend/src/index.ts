import "dotenv/config";
import http from "node:http";
import { env } from "./config/env.js";
import { app } from "./app.js";
import { createSocketServer } from "./sockets/index.js";

const server = http.createServer(app);
const PORT = env.PORT;
createSocketServer(server);
server.listen(PORT);
