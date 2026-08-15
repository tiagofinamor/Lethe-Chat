import { redisKeys } from "../config/redis-keys.js";
import { redisClient } from "../config/redis.js";
import { AuthError } from "../errors/AppError.js";
import bcrypt from "bcrypt";
import { getIo } from "../sockets/index.js";
import { userRoom } from "../sockets/rooms.js";

export async function authenticate(username: string, password: string) {
    const rightPassword = await redisClient.hGet(
        redisKeys.user(username),
        "password",
    );
    if (!rightPassword) {
        //catch cases where user doesnt exist
        throw new AuthError();
    }
    const doMatch = await bcrypt.compare(password, rightPassword);
    if (!doMatch) {
        throw new AuthError();
    }
}

export async function clearOldConnections(
    username: string,
    currentSessionId: string,
) {
    //this function enforces temporary one-device constraints for MVP.
    //for now you can only log in using one device, and when you do, your sessions elsewhere
    //are discarded, and the old websocket is disconnected.

    const hasOldSession = await redisClient.exists(
        redisKeys.sessions(username),
    );
    if (hasOldSession === 0) {
        return;
    }

    const sessionId = await redisClient.sPop(redisKeys.sessions(username)); //the set always has only 1 member
    console.log(sessionId, currentSessionId);

    if (!sessionId || sessionId === currentSessionId) {
        //this prevents the user from starting a new session in the same device without logging out
        //which could cause some bugs, since it'd be impossible to delete user:<user>:sessions
        await redisClient.sAdd(redisKeys.sessions(username), currentSessionId);
        return;
    }

    await redisClient.del(`sess:${sessionId}`);
    const io = getIo();
    const oldSockets = await io.in(userRoom(username)).fetchSockets();
    for (const socket of oldSockets) {
        socket.disconnect(true);
    }
}
