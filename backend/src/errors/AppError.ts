export class AppError extends Error {
    constructor(
        message: string,
        public statusCode: number,
    ) {
        super(message);
        this.name = "AppError";
    }
}

export class UserAlreadyExistsError extends AppError {
    constructor(username: string) {
        super(`User ${username} already exists.`, 409);
        this.name = "UserAlreadyExistsError";
    }
}

export class UserDoesNotExistError extends AppError {
    constructor(username: string) {
      super(`User ${username} does not exist.`, 404);
      this.name = "UserDoesNotExistError";
    }
}

export class AuthError extends AppError {
    constructor() {
        super("Invalid username or password.", 401);
        this.name = "AuthError";
    }
}

export class SelfRequestError extends AppError {
    constructor() {
        super("You can't send a friend request to yourself.", 400);
        this.name = "SelfRequestError";
    }
}

export class RequestNotFoundError extends AppError {
    constructor(notFoundSenderUsername: string) {
        super(`You don't have any friend requests from ${notFoundSenderUsername}.`, 404);
        this.name = "RequestNotFoundError";
    }
}

export class MalformedMsgInboxError extends AppError {
    constructor() {
        super("A malformed message couldn't be parsed while draining user inbox.", 500)
        this.name = "MalformedMsgInboxError";
    }
}
