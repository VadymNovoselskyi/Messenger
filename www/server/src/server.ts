import { WebSocketServer } from "ws";
import dotenv from "dotenv";

import { DeliveryService } from "./services/DeliveryService.js";
import { OnlineUsersService } from "./services/OnlineUsersService.js";
import { ServerController } from "./ServerController.js";

dotenv.config(); // Load .env variables into process.env
const PORT = process.env.PORT || 5000;

const deliveryService = DeliveryService.getInstance();
const onlineUsers = OnlineUsersService.getInstance();
const serverController = ServerController.init(deliveryService, onlineUsers);

const wss = new WebSocketServer({ port: Number(PORT) });
onlineUsers.setPingInterval(wss);
wss.on("connection", ws => {
  console.log("Client connected");
  ws.isAuthenticated = false;
  ws.isAlive = true;

  ws.on("message", message => serverController.handleMessage(ws, message));

  ws.on("pong", () => {
    ws.isAlive = true;
  });
  ws.on("close", () => {
    ws.isAlive = false;
    if (ws.userId && onlineUsers.hasUser(ws.userId)) {
      console.log(`${ws.userId} deleted from onlineUsers`);
      onlineUsers.deleteUser(ws.userId);
      deliveryService.deleteUser(ws.userId);
    }
    console.log(`${ws.userId} closed`);
  });
  ws.on("error", error => {
    ws.isAlive = false;
    if (ws.userId && onlineUsers.hasUser(ws.userId)) {
      onlineUsers.deleteUser(ws.userId);
      deliveryService.deleteUser(ws.userId);
    }
    console.error(`WebSocket error: ${error}`);
  });
});
