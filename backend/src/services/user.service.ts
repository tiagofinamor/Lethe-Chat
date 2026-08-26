import { env } from "../config/env.js";
import { redisKeys } from "../config/redis-keys.js";
import { redisClient } from "../config/redis.js";
import { UserAlreadyExistsError } from "../errors/AppError.js";

export async function redisCreateUser(
    username: string,
    hashedPassword: string,
) {
    if (await userExists(username)) {
        throw new UserAlreadyExistsError(username);
    }
    await redisClient.hSet(redisKeys.user(username), {
        password: hashedPassword,
    });
}

export async function redisSetTTL(username: string) {
    //should only be called after session is set
    await redisClient
        .multi()
        .expire(redisKeys.user(username), env.USER_TTL_SECONDS)
        .expire(redisKeys.sessions(username), env.USER_TTL_SECONDS)
        .exec();
}

export async function redisDeleteUser(username: string) {
    //this could throw an error if somehow someone manages to send a request to /delete without a session
    const sessions = await redisClient.sMembers(redisKeys.sessions(username));
    const sessionKeys = sessions.map((id) => `sess:${id}`);

    //these delete operations are naturally idempotent.
    await redisClient.del(sessionKeys);
    await redisClient.del(redisKeys.sessions(username));
    await redisClient.del(redisKeys.user(username));

    const hasFriendRequests = await redisClient.exists(
        redisKeys.requests(username),
    );
    if (hasFriendRequests !== 0) {
        await redisClient.del(redisKeys.requests(username));
    }

    const hasFriends = await redisClient.exists(redisKeys.friends(username));
    if (hasFriends !== 0) {
        await redisClient.del(redisKeys.friends(username));
    }
}

export async function userExists(username: string) {
    const userExists: number = await redisClient.EXISTS(
        redisKeys.user(username),
    );
    return userExists === 1;
}
