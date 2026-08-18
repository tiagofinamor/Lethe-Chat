import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { friendsController } from "../controllers/friends.controller.js";

export const friendsRouter = Router();

friendsRouter.get("/", requireAuth, friendsController);