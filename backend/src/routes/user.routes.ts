import {Router} from "express";
import { createUserController, deleteUserController } from "../controllers/users.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";

const userRouter = Router();

userRouter.post("/", createUserController);
userRouter.delete("/", requireAuth, deleteUserController);

export default userRouter;