export class InvariantError extends Error {
    constructor(
        message: string,
        public statusCode: number,
        public context?: Record<string, unknown>,
    ) {
        super(message);
        this.name = "InvariantError";
        this.context = context;
    }
}