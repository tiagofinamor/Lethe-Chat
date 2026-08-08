import { Router } from "express";
import { loginController } from "../controllers/login.controller.js";

export const authRouter = Router();

authRouter.post("/login", loginController);