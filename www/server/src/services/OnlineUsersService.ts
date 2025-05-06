import { WebSocket, WebSocketServer } from "ws";
import { SystemApi } from "../types/systemTypes.js";

export class OnlineUsersService {
  private static instance: OnlineUsersService;
  private static PING_INTERVAL = 30_000;

  private onlineUsers: Map<string, WebSocket> = new Map();

  private constructor() {}

  public static getInstance() {
    if (!OnlineUsersService.instance) {
      OnlineUsersService.instance = new OnlineUsersService();
    }
    return OnlineUsersService.instance;
  }

  public getUser(userId: string) {
    return this.onlineUsers.get(userId);
  }

  public hasUser(userId: string) {
    return this.onlineUsers.has(userId);
  }

  public addUser(ws: WebSocket) {
    if (!ws.userId) {
      throw new Error("User _id is not set");
    }
    this.onlineUsers.set(ws.userId, ws);
  }

  public deleteUser(userId: string) {
    this.onlineUsers.delete(userId);
  }

  public setPingInterval(wss: WebSocketServer) {
    setInterval(() => {
      wss.clients.forEach(ws => {
        if (!ws.isAlive) {
          console.log(`${ws.userId} timed out`);
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
        ws.send(JSON.stringify({ api: SystemApi.PING }));
      });
    }, OnlineUsersService.PING_INTERVAL);
  }
}
