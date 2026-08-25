import client from "prom-client";

client.collectDefaultMetrics();

export const httpDuration = new client.Histogram({
    name: "http_request_duration_seconds",
    help: "HTTP request duration in seconds",
    labelNames: ["method", "route", "status"],
});

export const socketEventDuration = new client.Histogram({
    name: "socket_event_duration_seconds",
    help: "Socket.IO event handler duration in seconds",
    labelNames: ["event", "status"],
});

export const messageDeliveryDuration = new client.Histogram({
  name: "message_delivery_duration_seconds",
  help: "Time from message send to recipient ack or fallback to queue",
  labelNames: ["outcome"], //"delivered" or "queued"
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

export const registry = client.register;
