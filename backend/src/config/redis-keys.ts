export const redisKeys = {
    user: (username: string) => `user:${username}` as `user:${string}`,
    sessions: (username: string) => `user:${username}:sessions` as `user:${string}:sessions`,
    requests: (username: string) => `requests:${username}` as `requests:${string}`,
    friends: (username: string) => `friends:${username}` as `friends:${string}`,
    inbox: (username: string) => `inbox:${username}` as `inbox:${string}`
}