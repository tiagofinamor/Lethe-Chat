import "dotenv/config";
import express from "express";
import http from "node:http";
import type { Request, Response, NextFunction } from "express";

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT;

app.get("/", (req: Request, res: Response, next: NextFunction) => {
    res.send("hello world!");
});

server.listen(PORT);
