import {Router} from "express";
import { createUserController } from "../controllers/create-user.controller.js";

const userRouter = Router();

userRouter.post("/", createUserController);

export default userRouter;