import { Router } from "express";
import {
    loginController,
    logoutController,
} from "../controllers/login.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const authRouter = Router();

authRouter.post("/login", loginController);
authRouter.post("/logout", requireAuth, logoutController);