import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { getRequestsController } from "../controllers/requests.controller.js";

export const requestsRouter = Router();

requestsRouter.get("/", requireAuth, getRequestsController);