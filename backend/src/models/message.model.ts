import z from "zod";
import { usernameSchema } from "./user.model.js";

export const messageSchema = z.object({
    to: usernameSchema,
    cipherText: z.string().min(1).max(65536),
});
