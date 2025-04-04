import WebSocket, { WebSocketServer } from "ws";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import {
  getChats,
  readUpdate,
  sendMessage,
  getExtraMessages,
  getExtraNewMessages,
  readAll,
  createChat,
  createUser,
  findUser,
  savePreKeys,
} from "./api.mjs";
import { base64ToBinary, generateToken, sendResponse } from "./utils.mjs";

import * as types from "./types/types.mjs";
import { ObjectId } from "mongodb";
import { BinaryPreKeyBundle } from "./types/signalTypes.mjs";

dotenv.config(); // Load .env variables into process.env
const JWT_KEY = process.env.JWT_KEY || "";
const PORT = process.env.PORT || 5000;

// Object to track currently online users by their ID.
const onlineUsers: Record<string, WebSocket> = {};

const wss = new WebSocketServer({ port: Number(PORT) });
wss.on("connection", ws => {
  console.log("Client connected");
  ws.isAuthenticated = false;

  ws.on("message", async message => {
    console.log(`Received message: ${message}`);
    let parsedMessage: types.APIMessage;
    try {
      parsedMessage = JSON.parse(message.toString());
    } catch {
      sendResponse(ws, undefined, undefined, "ERROR", { message: "Invalid JSON format" });
      return;
    }

    const { api, id, payload } = parsedMessage as {
      api: types.API;
      id: string;
      payload: types.messagePayload;
    };

    // Handle login request.
    if (api === types.API.LOGIN) {
      const { username, password } = payload as types.loginPayload;
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
    else if (api === types.API.SIGNUP) {
      const { username, password } = payload as types.signupPayload;
      try {
        const userId = await createUser(username, password);
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
    else if (ws.isAuthenticated) {
      try {
        await handleAuthenticatedCall(api, id, payload, ws.userId ?? "");
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : "An unknown error occurred";
        sendResponse(ws, api, id, "ERROR", { message: errMsg });
      }
      return;
    }

    // For unverified connections, try to verify the JWT.
    else {
      try {
        const { token } = parsedMessage;
        if (!token) throw new Error("No token provided");

        const decoded = jwt.verify(token, JWT_KEY);
        if (typeof decoded === "string") {
          throw new Error("Decoded token is a string, expected an object.");
        }

        ws.isAuthenticated = true;
        const { userId } = decoded;
        ws.userId = userId;
        onlineUsers[ws.userId ?? ""] = ws;
        await handleAuthenticatedCall(api, id, payload, userId);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : "An unknown error occurred";
        sendResponse(ws, api, id, "ERROR", { message: errMsg });
      }
      return;
    }
  });

  // Clean up the online users list when the connection closes.
  ws.on("close", () => {
    if (ws.userId && onlineUsers[ws.userId]) {
      delete onlineUsers[ws.userId];
    }
  });

  /**
   * Processes API calls that require authentication.
   */
  async function handleAuthenticatedCall(
    api: types.API,
    id: string,
    payload: types.messagePayload,
    userId: string
  ): Promise<void> {
    try {
      switch (api) {
        case types.API.GET_CHATS: {
          const chats = await getChats(new ObjectId(userId));
          sendResponse(ws, api, id, "SUCCESS", { chats });
          break;
        }
        case types.API.SEND_MESSAGE: {
          const { chatId, text, tempMessageId } = payload as types.sendMessagePayload;
          const { message, receivingUserId } = await sendMessage(
            new ObjectId(userId),
            new ObjectId(chatId),
            text
          );
          // Forward the message if the recipient is online.
          if (onlineUsers[receivingUserId.toString()]) {
            sendResponse(
              onlineUsers[receivingUserId.toString()],
              types.API.RECEIVE_MESSAGE,
              undefined,
              "SUCCESS",
              { chatId, message }
            );
          }
          // Confirm message delivery to the sender.
          sendResponse(ws, types.API.RECEIVE_MESSAGE, id, "SUCCESS", {
            chatId,
            message,
            tempMessageId,
          });
          break;
        }
        case types.API.READ_UPDATE: {
          const { chatId, messageId } = payload as types.readUpdatePayload;
          const { sendTime, receivingUserId } = await readUpdate(
            new ObjectId(userId),
            new ObjectId(chatId),
            new ObjectId(messageId)
          );
          if (onlineUsers[receivingUserId.toString()]) {
            sendResponse(onlineUsers[receivingUserId.toString()], api, undefined, "SUCCESS", {
              chatId,
              lastSeen: sendTime,
            });
          }
          break;
        }
        case types.API.EXTRA_MESSAGES: {
          const { chatId, currentIndex } = payload as types.getExtraMessagesPayload;
          const extraMessages = await getExtraMessages(new ObjectId(chatId), currentIndex);
          sendResponse(ws, api, id, "SUCCESS", { chatId, extraMessages });
          break;
        }
        case types.API.EXTRA_NEW_MESSAGES: {
          const { chatId, unreadCount } = payload as types.getExtraNewMessagesPayload;
          const extraNewMessages = await getExtraNewMessages(new ObjectId(chatId), unreadCount);
          sendResponse(ws, api, id, "SUCCESS", { chatId, extraNewMessages });
          break;
        }
        case types.API.READ_ALL: {
          const { chatId } = payload as types.readAllPayload;
          await readAll(new ObjectId(chatId), new ObjectId(ws.userId));
          sendResponse(ws, api, id, "SUCCESS", {});
          break;
        }
        case types.API.CREATE_CHAT: {
          const { username } = payload as types.createChatPayload;
          const { createdChat, receivingUserId, preKeyBundle } = await createChat(new ObjectId(userId), username);
          sendResponse(ws, api, id, "SUCCESS", { createdChat, preKeyBundle });
          if (onlineUsers[receivingUserId.toString()]) {
            sendResponse(onlineUsers[receivingUserId.toString()], api, undefined, "SUCCESS", {
              createdChat,
            });
          }
          break;
        }
        case types.API.SEND_KEYS: {
          let { preKeyBundle } = payload as types.sendKeysPayload;
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
          console.log(base64ToBinary(preKeyBundle.identityKey));
          for (const preKey of preKeyBundle.preKeys) {
            preKeyBundleReconstructed.preKeys.push({
              keyId: preKey.keyId,
              publicKey: base64ToBinary(preKey.publicKey),
            });
          }

          await savePreKeys(new ObjectId(userId), preKeyBundleReconstructed);
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
});
