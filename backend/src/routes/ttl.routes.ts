import { Router } from "express";
import { getTtlController } from "../controllers/ttl.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const ttlRouter = Router();

ttlRouter.get("/", requireAuth, getTtlController);