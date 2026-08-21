import z from "zod";
import { usernameSchema } from "./user.model.js";

const encryptedPayloadSchema = z.object({
    cipherText: z.string().min(1).max(65536),
    nonce: z
        .string()
        .length(32)
        .regex(/^[A-Za-z0-9+/]+$/),
});

export const messageSchema = z.object({
    to: usernameSchema,
    encryptedPayload: encryptedPayloadSchema,
});
