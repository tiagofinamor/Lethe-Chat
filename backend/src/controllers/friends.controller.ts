import type { Request, Response } from "express";
import type { ParamsDictionary } from "express-serve-static-core";
import { getUserFriends } from "../services/friends.service.js";
import { InvariantError } from "../errors/InvariantError.js";

interface FriendsRouteParams extends ParamsDictionary {
    username: string;
}

export async function friendsController(
    req: Request<FriendsRouteParams>,
    res: Response,
) {
    const user = req.session.userId;
    if (!user) {
        //this should never throw since this route is protected
        throw new InvariantError(
            "User without session is trying to access friends endpoint.",
            500,
        );
    }
    const friends = await getUserFriends(user);
    res.status(200).json({ friends });
}
