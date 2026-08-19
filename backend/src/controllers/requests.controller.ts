import type { Request, Response } from "express";
import { getRequests } from "../services/request.service.js";

export async function getRequestsController(req: Request, res: Response) {
    const username = req.session.userId!; 
    if (!username) {
        //should never throw since route is protected.
        throw new Error("Session error: session information is missing."); 
    }

    const requests = await getRequests(username);
    res.status(200).json(JSON.stringify(requests));
}
