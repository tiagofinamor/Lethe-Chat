export class AppError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = 'AppError';
  }
}

export class UserAlreadyExistsError extends AppError {
  constructor(username: string) {
    super(`User ${username} already exists`, 409);
    this.name = 'UserAlreadyExistsError';
  }
}

export class AuthError extends AppError {
  constructor() {
    super("Invalid username or password.", 401);
    this.name = "AuthError";
  }
}