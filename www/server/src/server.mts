import WebSocket, { WebSocketServer } from "ws";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import {
  getChats,
  readUpdate,
  getExtraMessages,
  getExtraNewMessages,
  readAll,
  createChat,
  createUser,
  findUser,
  savePreKeys,
  sendEncMessage,
  findChat,
} from "./mongodb/mongoApi.mjs";
import { base64ToBinary, generateToken, sendResponse } from "./utils.mjs";

import * as apiTypes from "./types/apiTypes.mjs";
import { ObjectId } from "mongodb";
import { BinaryPreKeyBundle } from "./types/signalTypes.mjs";
import { toApiChat, toApiMessage } from "./apiUtils.js";

dotenv.config(); // Load .env variables into process.env
const JWT_KEY = process.env.JWT_KEY || "";
const PORT = process.env.PORT || 5000;
const wss = new WebSocketServer({ port: Number(PORT) });

const PING_INTERVAL = 30_000;
const onlineUsers: Record<string, WebSocket> = {};
setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws.isAlive) {
      console.log(`${ws.userId} timed out`);
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
    ws.send(JSON.stringify({ api: apiTypes.API.PING }));
  });
}, PING_INTERVAL);

wss.on("connection", ws => {
  console.log("Client connected");
  ws.isAuthenticated = false;
  ws.isAlive = true;

  ws.on("message", async message => {
    let parsedMessage: apiTypes.APIMessage;
    try {
      parsedMessage = JSON.parse(message.toString());
    } catch {
      sendResponse(ws, undefined, undefined, "ERROR", { message: "Invalid JSON format" });
      return;
    }

    const { api, id, payload } = parsedMessage as {
      api: apiTypes.API;
      id: string;
      payload: apiTypes.messagePayload;
    };

    if (api === apiTypes.API.PONG) return;
    if (api === apiTypes.API.AUTHENTICATE) {
      console.log("Authenticating");
      try {
        const { token } = parsedMessage;
        if (!token) throw new Error("No token provided");

        const decoded = jwt.verify(token, JWT_KEY);
        if (typeof decoded === "string") {
          throw new Error("Decoded token is a string, expected an object.");
        }

        const { userId } = decoded;
        ws.isAuthenticated = true;
        ws.userId = userId;
        onlineUsers[ws.userId ?? ""] = ws;
        sendResponse(ws, api, id, "SUCCESS", {});
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : "An unknown error occurred";
        sendResponse(ws, api, id, "ERROR", { message: errMsg });
      }
      return;
    }
    console.log(`Received message: ${message}`);

    // Handle login request.
    if (api === apiTypes.API.LOGIN) {
      const { username, password } = payload as apiTypes.loginPayload;
      try {
        const user = await findUser(username);
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
          return sendResponse(ws, api, id, "ERROR", { message: "Invalid password" });
        }
        const token = generateToken(user._id.toString());
        sendResponse(ws, api, id, "SUCCESS", { userId: user._id, token });
        ws.isAuthenticated = true;
        ws.userId = user._id.toString();
        onlineUsers[ws.userId] = ws;
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : "An unknown error occurred";
        sendResponse(ws, api, id, "ERROR", { message: errMsg });
      }
      return;
    }
    // Handle signup request.
    if (api === apiTypes.API.SIGNUP) {
      const { username, password, preKeyBundle } = payload as apiTypes.signupPayload;
      const preKeyBundleReconstructed: BinaryPreKeyBundle = {
        registrationId: preKeyBundle.registrationId,
        identityKey: base64ToBinary(preKeyBundle.identityKey),
        signedPreKey: {
          keyId: preKeyBundle.signedPreKey.keyId,
          publicKey: base64ToBinary(preKeyBundle.signedPreKey.publicKey),
          signature: base64ToBinary(preKeyBundle.signedPreKey.signature),
        },
        preKeys: [],
      };
      for (const preKey of preKeyBundle.preKeys) {
        preKeyBundleReconstructed.preKeys.push({
          keyId: preKey.keyId,
          publicKey: base64ToBinary(preKey.publicKey),
        });
      }

      try {
        const userId = await createUser(username, password, preKeyBundleReconstructed);
        const token = generateToken(userId.toString());
        sendResponse(ws, api, id, "SUCCESS", { userId, token });
        ws.isAuthenticated = true;
        ws.userId = userId.toString();
        onlineUsers[ws.userId] = ws;
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : "An unknown error occurred";
        sendResponse(ws, api, id, "ERROR", { message: errMsg });
      }
      return;
    }

    // If the connection is already authenticated, process the API call.
    if (ws.isAuthenticated) {
      try {
        await handleAuthenticatedCall(ws, api, id, payload, ws.userId ?? "");
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : "An unknown error occurred";
        sendResponse(ws, api, id, "ERROR", { message: errMsg });
      }
      return;
    }

    // For unverified connections return an error.
    else sendResponse(ws, api, id, "ERROR", { message: "Unauthenticated" });
  });

  ws.on("pong", () => {
    ws.isAlive = true;
  });
  ws.on("close", () => {
    ws.isAlive = false;
    if (ws.userId && onlineUsers[ws.userId]) {
      console.log(`${ws.userId} deleted from onlineUsers`);
      delete onlineUsers[ws.userId];
    }
    console.log(`${ws.userId} closed`);
  });
  ws.on("error", error => {
    ws.isAlive = false;
    if (ws.userId && onlineUsers[ws.userId]) {
      delete onlineUsers[ws.userId];
    }
    console.error(`WebSocket error: ${error}`);
  });
});

/**
 * Processes API calls that require authentication.
 */
async function handleAuthenticatedCall(
  ws: WebSocket,
  api: apiTypes.API,
  id: string,
  payload: apiTypes.messagePayload,
  userId: string
): Promise<void> {
  try {
    switch (api) {
      case apiTypes.API.GET_CHATS: {
        const chats = await getChats(new ObjectId(userId));
        sendResponse(ws, api, id, "SUCCESS", { chats });
        break;
      }

      case apiTypes.API.READ_UPDATE: {
        const { chatId, sequence } = payload as apiTypes.readUpdatePayload;
        const { receivingUserId } = await readUpdate(
          new ObjectId(userId),
          new ObjectId(chatId),
          sequence
        );
        if (onlineUsers[receivingUserId.toString()]) {
          sendResponse(onlineUsers[receivingUserId.toString()], api, undefined, "SUCCESS", {
            chatId,
            sequence,
          });
        }
        break;
      }
      case apiTypes.API.EXTRA_MESSAGES: {
        const { chatId, currentIndex } = payload as apiTypes.getExtraMessagesPayload;
        const extraMessages = await getExtraMessages(new ObjectId(chatId), currentIndex);
        sendResponse(ws, api, id, "SUCCESS", {
          chatId,
          extraMessages: extraMessages.map(message => toApiMessage(message)),
        });
        break;
      }
      case apiTypes.API.EXTRA_NEW_MESSAGES: {
        const { chatId, unreadCount } = payload as apiTypes.getExtraNewMessagesPayload;
        const extraNewMessages = await getExtraNewMessages(new ObjectId(chatId), unreadCount);
        sendResponse(ws, api, id, "SUCCESS", {
          chatId,
          extraNewMessages: extraNewMessages.map(message => toApiMessage(message)),
        });
        break;
      }
      case apiTypes.API.READ_ALL: {
        const { chatId } = payload as apiTypes.readAllPayload;
        await readAll(new ObjectId(chatId), new ObjectId(ws.userId));
        sendResponse(ws, api, id, "SUCCESS", {});
        break;
      }
      case apiTypes.API.CREATE_CHAT: {
        const { username } = payload as apiTypes.createChatPayload;
        const { createdChat, receivingUserId, preKeyBundle } = await createChat(
          new ObjectId(userId),
          username
        );
        const createdApiChat = await toApiChat(createdChat);
        sendResponse(ws, api, id, "SUCCESS", {
          createdChat: createdApiChat,
          preKeyBundle,
        });

        //Maybe return
        if (onlineUsers[receivingUserId.toString()]) {
          sendResponse(onlineUsers[receivingUserId.toString()], api, undefined, "SUCCESS", {
            createdChat: createdApiChat,
          });
        }
        break;
      }
      case apiTypes.API.SEND_KEYS: {
        let { preKeyBundle } = payload as apiTypes.sendKeysPayload;
        const preKeyBundleReconstructed: BinaryPreKeyBundle = {
          registrationId: preKeyBundle.registrationId,
          identityKey: base64ToBinary(preKeyBundle.identityKey),
          signedPreKey: {
            keyId: preKeyBundle.signedPreKey.keyId,
            publicKey: base64ToBinary(preKeyBundle.signedPreKey.publicKey),
            signature: base64ToBinary(preKeyBundle.signedPreKey.signature),
          },
          preKeys: [],
        };
        for (const preKey of preKeyBundle.preKeys) {
          preKeyBundleReconstructed.preKeys.push({
            keyId: preKey.keyId,
            publicKey: base64ToBinary(preKey.publicKey),
          });
        }

        await savePreKeys(new ObjectId(userId), preKeyBundleReconstructed);
        break;
      }
      case apiTypes.API.SEND_PRE_KEY_MESSAGE: {
        const { chatId, ciphertext } = payload as apiTypes.sendPreKeyMessagePayload;
        const chat = await findChat(new ObjectId(chatId));
        const receivingUserId = chat.users.find(user => user._id.toString() !== userId)?._id;
        if (!receivingUserId) throw new Error(`User with id ${userId} not found in chat ${chatId}`);

        if (onlineUsers[receivingUserId.toString()]) {
          sendResponse(
            onlineUsers[receivingUserId.toString()],
            apiTypes.API.RECEIVE_PRE_KEY_MESSAGE,
            undefined,
            "SUCCESS",
            { chatId, ciphertext }
          );
        }
        break;
      }

      case apiTypes.API.SEND_ENC_MESSAGE: {
        const { chatId, ciphertext } = payload as apiTypes.sendEncMessagePayload;
        const { sentMessage, receivingUserId } = await sendEncMessage(
          new ObjectId(userId),
          new ObjectId(chatId),
          ciphertext
        );

        if (onlineUsers[receivingUserId.toString()]) {
          sendResponse(
            onlineUsers[receivingUserId.toString()],
            apiTypes.API.RECEIVE_MESSAGE,
            undefined,
            "SUCCESS",
            { chatId, message: sentMessage }
          );
        }

        // Confirm message delivery to the sender.
        if (ciphertext.type !== 3) {
          sendResponse(ws, api, id, "SUCCESS", { sentMessage: toApiMessage(sentMessage) });
        }
        break;
      }

      default: {
        console.error(`Unknown api call: ${api}`);
        sendResponse(ws, api, id, "ERROR", { message: "Invalid api call" });
        break;
      }
    }
  } catch (error) {
    throw error;
  }
}
