import {Router} from "express";
import { createUserController } from "../controllers/users.controller.js";

const userRouter = Router();

userRouter.post("/", createUserController);

export default userRouter;