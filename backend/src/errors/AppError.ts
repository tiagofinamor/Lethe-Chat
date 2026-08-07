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