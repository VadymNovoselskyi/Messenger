import WebSocket, { WebSocketServer } from "ws";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { Binary, ObjectId } from "mongodb";
import * as mongoApi from "./mongodb/mongoApi.js";
import { generateJwtToken } from "./utils/jwtUtils.js";
import { base64ToBinary, binaryToBase64 } from "./utils/parserUtils.js";

import * as requestTypes from "./types/requestTypes.js";
import * as notificationTypes from "./types/notificationTypes.js";
import * as systemTypes from "./types/systemTypes.js";
import { PreKeyBundle } from "./types/signalTypes.js";

import {
  isRequestApiMessage,
  isSystemApiMessage,
  toApiChat,
  toApiChatMetadata,
  toApiMessage,
} from "./utils/apiUtils.js";
import { DeliveryService } from "./DeliveryService.js";
import { OnlineUsersService } from "./OnlineUsersService.js";
import { PreKeyType } from "@privacyresearch/libsignal-protocol-typescript";
import { ServerController } from "./ServerController.js";

dotenv.config(); // Load .env variables into process.env
const JWT_KEY = process.env.JWT_KEY || "";
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

  ws.on("message", async message => {
    let parsedMessage:
      | requestTypes.ResponseApiMessage
      | notificationTypes.NotificationApiMessage
      | systemTypes.SystemApiMessage;
    try {
      parsedMessage = JSON.parse(message.toString());
    } catch {
      deliveryService.sendError(ws, "", { message: "Invalid JSON format" });
      return;
    }

    if (isSystemApiMessage(parsedMessage)) {
      const { api, id } = parsedMessage as systemTypes.SystemApiMessage;
      if (api === systemTypes.SystemApi.PONG) return;
      if (api === systemTypes.SystemApi.ACK) {
        if (!ws.userId || !id) {
          deliveryService.sendError(ws, "", { message: `Invalid system message: ${api}` });
          return;
        }
        deliveryService.handleAck(ws.userId!, id);
        return;
      } else {
        deliveryService.sendError(ws, "", { message: `Invalid system message: ${api}` });
        return;
      }
    } else if (!isRequestApiMessage(parsedMessage)) {
      deliveryService.sendError(ws, "", {
        message: `Invalid message, not a system or request: ${parsedMessage?.api}`,
      });
      return;
    }

    const { id, api, token, payload } = parsedMessage as requestTypes.RequestApiMessage;
    console.log(`Received message: ${message}`);

    if (api === requestTypes.RequestApi.SEND_AUTH) {
      await serverController.handleAuth(ws, token ?? "", id);
      return;
    } else if (api === requestTypes.RequestApi.LOGIN) {
      await serverController.handleLogin(ws, payload as requestTypes.loginPayload, id);
      return;
    } else if (api === requestTypes.RequestApi.SIGNUP) {
      await serverController.handleSignup(ws, payload as requestTypes.signupPayload, id);
      return;
    }

    if (ws.isAuthenticated) {
      try {
        await serverController.handleAuthenticatedCall(ws, ws.userId ?? "", id, api, payload);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : "An unknown error occurred";
        deliveryService.sendError(ws, id, { message: errMsg });
      }
      return;
    }

    // For unverified connections return an error.
    else deliveryService.sendError(ws, id, { message: "Unauthenticated" });
  });

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
