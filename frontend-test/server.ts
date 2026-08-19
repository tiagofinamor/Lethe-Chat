import dotenv from "dotenv";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import os from "node:os";
import type { Duplex } from "node:stream";
import next from "next";
import { createProxyServer } from "http-proxy";

const parsedEnv = dotenv.config().parsed ?? {};

/**
 * Interface the frontend binds to. Default `0.0.0.0` (all interfaces) so the
 * server is reachable from other devices on the local network — see the
 * "Accessing from other devices" section in the README.
 */
const HOST = parsedEnv.HOST ?? process.env.HOST ?? "0.0.0.0";
const PORT = Number(parsedEnv.PORT ?? process.env.PORT ?? 3001);
const BACKEND_URL =
    parsedEnv.BACKEND_URL ?? process.env.BACKEND_URL ?? "http://localhost:3000";
const dev = !process.argv.includes("--production");

/** Non-loopback IPv4 addresses of this machine, for the startup banner. */
function lanAddresses(): string[] {
    const addresses: string[] = [];
    for (const ifaces of Object.values(os.networkInterfaces())) {
        for (const iface of ifaces ?? []) {
            if (iface.family === "IPv4" && !iface.internal) {
                addresses.push(iface.address);
            }
        }
    }
    return addresses;
}

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    // Allow all local network sources
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }
});

const app = next({ dev, hostname: HOST, port: PORT, httpServer: server });
const handle = app.getRequestHandler();

const proxy = createProxyServer({
    target: BACKEND_URL,
    changeOrigin: true,
    ws: true,
    xfwd: true,
});

proxy.on("error", (err, _req, res: ServerResponse | Duplex) => {
    console.error("[proxy] error:", err.message);
    if ("writeHead" in res) {
        if (!res.headersSent) {
            res.writeHead(502, { "Content-Type": "application/json" });
        }
        res.end(JSON.stringify({ error: "Backend unreachable" }));
    } else if (typeof res.destroy === "function") {
        res.destroy();
    }
});

server.on("request", (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? "";
    if (url.startsWith("/api/") || url.startsWith("/socket.io/")) {
        proxy.web(req, res, { target: BACKEND_URL });
        return;
    }
    void handle(req, res);
});

server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    if ((req.url ?? "").startsWith("/socket.io/")) {
        proxy.ws(req, socket, head, { target: BACKEND_URL });
    }
});

app.prepare().then(() => {
    server.listen(PORT, HOST, () => {
        console.log(
            `> Frontend ready on http://${HOST}:${PORT} (${dev ? "development" : "production"})`,
        );
        console.log(`> Proxying /api and /socket.io to ${BACKEND_URL}`);
        if (HOST === "0.0.0.0") {
            for (const addr of lanAddresses()) {
                console.log(`> LAN: http://${addr}:${PORT}`);
            }
        }
    });
});

const shutdown = () => {
    console.log("\nShutting down…");
    server.close();
    void app.close().then(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
