import { redisKeys } from "../config/redis-keys.js";
import { redisClient } from "../config/redis.js";
import {
    RequestNotFoundError,
    SelfRequestError,
    UserDoesNotExistError,
} from "../errors/AppError.js";
import { InvariantError } from "../errors/InvariantError.js";
import type { AppServer } from "../sockets/index.js";
import { userRoom } from "../sockets/rooms.js";

type SendRequestArgs = {
    io: AppServer;
    to: string;
    from: string;
};

type AcceptRequestArgs = { io: AppServer; from: string; userAccepting: string };
type RejectRequestArgs = { io: AppServer; from: string; userRejecting: string };

export async function sendRequest({ io, to, from }: SendRequestArgs) {
    //adding to a redis set is idempotent
    if (from === to) {
        throw new SelfRequestError();
    }

    const remainingReceiverTTL = await redisClient.ttl(redisKeys.user(to));
    if (remainingReceiverTTL === -2) {
        throw new UserDoesNotExistError(to);
    }
    if (remainingReceiverTTL === -1) {
        //this error should never throw since it only happens if a user that exists doens't have a ttl
        throw new InvariantError("An error occurred.", 500, {
            username: from,
            receiver: to,
        });
    }

    await redisClient
        .multi()
        .sAdd(redisKeys.requests(to), from)
        .expire(redisKeys.requests(to), remainingReceiverTTL) //makes sure the requests set never outlives user
        .exec();

    io.to(userRoom(to)).emit("friend:incoming", { from });
}

export async function acceptRequest({
    io,
    from,
    userAccepting,
}: AcceptRequestArgs) {
    const isPending = await redisClient.sIsMember(
        redisKeys.requests(userAccepting),
        from,
    );
    if (!isPending) {
        throw new RequestNotFoundError(from);
    }

    const remainingAccepterTTL = await redisClient.ttl(
        redisKeys.user(userAccepting),
    );
    const remainingSenderTTL = await redisClient.ttl(redisKeys.user(from));
    await redisClient
        .multi()
        .sRem(redisKeys.requests(userAccepting), from)
        .sAdd(redisKeys.friends(userAccepting), from)
        .sAdd(redisKeys.friends(from), userAccepting)
        .expire(redisKeys.friends(userAccepting), remainingAccepterTTL)
        .expire(redisKeys.friends(from), remainingSenderTTL)
        .exec();
    io.to(userRoom(from)).emit("friend:accepted", { by: userAccepting });
}

export async function rejectRequest({
    io,
    from,
    userRejecting,
}: RejectRequestArgs) {
    const isPending = await redisClient.sIsMember(
        redisKeys.requests(userRejecting),
        from,
    );
    if (!isPending) {
        throw new RequestNotFoundError(from);
    }

    await redisClient.sRem(redisKeys.requests(userRejecting), from);
    io.to(userRoom(from)).emit("friend:rejected", { by: userRejecting });
}

export async function getRequests(username: string) {
    //assumes authed caller and therefore an existent user
    const requestsToUser = await redisClient.sMembers(
        redisKeys.requests(username),
    );
    return requestsToUser;
}
