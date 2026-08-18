import type { Request, Response } from "express";
import type { ParamsDictionary } from "express-serve-static-core";
import { getUserFriends } from "../services/friends.service.js";

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
        throw new Error("Session error, session information is missing.");
    }
    const friends = await getUserFriends(user);
    console.log("friends:", friends);
    res.status(200).json({ friends });
}
