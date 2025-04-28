import WebSocket from "ws";

declare module "ws" {
  interface WebSocket {
    isAuthenticated?: boolean;
    isAlive?: boolean;
    userId?: string;
  }
}
