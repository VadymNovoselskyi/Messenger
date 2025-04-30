import WebSocket, { WebSocketServer } from "ws";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import {
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
  updateLastAckSequence,
  updateLastAckReadSequence,
  deleteMessages,
  fetchChatsUpdates,
} from "./mongodb/mongoApi.js";
import { base64ToBinary, generateToken } from "./utils.js";

import * as apiTypes from "./types/apiTypes.js";
import { ObjectId } from "mongodb";
import { BinaryPreKeyBundle } from "./types/signalTypes.js";
import { toApiChat, toApiMessage } from "./apiUtils.js";
import { DeliveryService } from "./DeliveryService.js";

dotenv.config(); // Load .env variables into process.env
const JWT_KEY = process.env.JWT_KEY || "";
const PORT = process.env.PORT || 5000;
const wss = new WebSocketServer({ port: Number(PORT) });
const deliveryService = DeliveryService.getInstance();

const PING_INTERVAL = 30_000;
const onlineUsers: Map<string, WebSocket> = new Map();

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
      deliveryService.sendMessage(ws, {
        id: "",
        status: "ERROR",
        payload: { message: "Invalid JSON format" },
      });
      return;
    }

    const { id, api, payload } = parsedMessage as {
      api: apiTypes.API;
      id: string;
      payload: apiTypes.messagePayload;
    };

    if (api === apiTypes.API.PONG) return;
    if (api === apiTypes.API.ACK) {
      deliveryService.handleAck(ws, id);
      return;
    }

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
        onlineUsers.set(userId ?? "", ws);
        deliveryService.sendMessage(ws, {
          id,
          api,
          status: "SUCCESS",
          payload: {},
        });
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : "An unknown error occurred";
        deliveryService.sendMessage(ws, {
          id,
          api,
          status: "ERROR",
          payload: { message: errMsg },
        });
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
          return deliveryService.sendMessage(ws, {
            id,
            api,
            status: "ERROR",
            payload: { message: "Invalid password" },
          });
        }
        const token = generateToken(user._id.toString());
        ws.isAuthenticated = true;
        ws.userId = user._id.toString();
        onlineUsers.set(ws.userId, ws);
        deliveryService.sendMessage(ws, {
          id,
          api,
          status: "SUCCESS",
          payload: { userId: user._id, token },
        });
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : "An unknown error occurred";
        deliveryService.sendMessage(ws, {
          id,
          api,
          status: "ERROR",
          payload: { message: errMsg },
        });
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
        ws.isAuthenticated = true;
        ws.userId = userId.toString();
        onlineUsers.set(ws.userId, ws);
        deliveryService.sendMessage(ws, {
          id,
          api,
          status: "SUCCESS",
          payload: { userId, token },
        });
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : "An unknown error occurred";
        deliveryService.sendMessage(ws, {
          id,
          api,
          status: "ERROR",
          payload: { message: errMsg },
        });
      }
      return;
    }

    // If the connection is already authenticated, process the API call.
    if (ws.isAuthenticated) {
      try {
        await handleAuthenticatedCall(ws, id, api, payload, ws.userId ?? "");
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : "An unknown error occurred";
        deliveryService.sendMessage(ws, {
          id,
          status: "ERROR",
          payload: { message: errMsg },
        });
      }
      return;
    }

    // For unverified connections return an error.
    else
      deliveryService.sendMessage(ws, {
        id,
        status: "ERROR",
        payload: { message: "Unauthenticated" },
      });
  });

  ws.on("pong", () => {
    ws.isAlive = true;
  });
  ws.on("close", () => {
    ws.isAlive = false;
    if (ws.userId && onlineUsers.has(ws.userId)) {
      console.log(`${ws.userId} deleted from onlineUsers`);
      onlineUsers.delete(ws.userId);
      deliveryService.deleteUser(ws.userId);
    }
    console.log(`${ws.userId} closed`);
  });
  ws.on("error", error => {
    ws.isAlive = false;
    if (ws.userId && onlineUsers.has(ws.userId)) {
      onlineUsers.delete(ws.userId);
      deliveryService.deleteUser(ws.userId);
    }
    console.error(`WebSocket error: ${error}`);
  });
});

/**
 * Processes API calls that require authentication.
 */
async function handleAuthenticatedCall(
  ws: WebSocket,
  id: string,
  api: apiTypes.API,
  payload: apiTypes.messagePayload,
  userId: string
): Promise<void> {
  try {
    switch (api) {
      case apiTypes.API.FETCH_CHATS_UPDATES: {
        const { chatIds } = payload as apiTypes.fetchChatsUpdatesPayload;
        const chats = await fetchChatsUpdates(
          new ObjectId(userId),
          chatIds.map(id => new ObjectId(id))
        );

        deliveryService.sendMessage(ws, {
          id,
          api,
          status: "SUCCESS",
          payload: { chats },
          // callback: () => {
          //   console.log("Chats sent ACK");
          // },
        });
        break;
      }
      case apiTypes.API.READ_UPDATE: {
        const { chatId, sequence } = payload as apiTypes.readUpdatePayload;
        const { receivingUserId } = await readUpdate(
          new ObjectId(userId),
          new ObjectId(chatId),
          sequence
        );

        const receivingUserWs = onlineUsers.get(receivingUserId.toString());
        if (receivingUserWs) {
          deliveryService.sendMessage(receivingUserWs, {
            id,
            api,
            status: "SUCCESS",
            payload: { chatId, sequence },
            callback: () => {
              updateLastAckReadSequence(
                new ObjectId(chatId),
                new ObjectId(receivingUserId),
                sequence
              );
            },
          });
        }
        break;
      }
      case apiTypes.API.EXTRA_MESSAGES: {
        const { chatId, currentIndex } = payload as apiTypes.getExtraMessagesPayload;
        const extraMessages = await getExtraMessages(new ObjectId(chatId), currentIndex);
        deliveryService.sendMessage(ws, {
          id,
          api,
          status: "SUCCESS",
          payload: { chatId, extraMessages: extraMessages.map(message => toApiMessage(message)) },
        });
        break;
      }
      case apiTypes.API.EXTRA_NEW_MESSAGES: {
        const { chatId, unreadCount } = payload as apiTypes.getExtraNewMessagesPayload;
        const extraNewMessages = await getExtraNewMessages(new ObjectId(chatId), unreadCount);
        deliveryService.sendMessage(ws, {
          id,
          api,
          status: "SUCCESS",
          payload: {
            chatId,
            extraNewMessages: extraNewMessages.map(message => toApiMessage(message)),
          },
        });
        break;
      }
      case apiTypes.API.READ_ALL: {
        const { chatId } = payload as apiTypes.readAllPayload;
        await readAll(new ObjectId(chatId), new ObjectId(ws.userId));
        deliveryService.sendMessage(ws, {
          id,
          api,
          status: "SUCCESS",
          payload: {},
        });
        break;
      }
      case apiTypes.API.CREATE_CHAT: {
        const { username } = payload as apiTypes.createChatPayload;
        const { createdChat, receivingUserId, preKeyBundle } = await createChat(
          new ObjectId(userId),
          username
        );
        const createdApiChat = await toApiChat(createdChat, []);
        deliveryService.sendMessage(ws, {
          id,
          api,
          status: "SUCCESS",
          payload: { createdChat: createdApiChat, preKeyBundle },
        });

        const receivingUserWs = onlineUsers.get(receivingUserId.toString());
        if (receivingUserWs) {
          deliveryService.sendMessage(receivingUserWs, {
            id,
            api,
            status: "SUCCESS",
            payload: { createdChat: createdApiChat },
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

        const receivingUserWs = onlineUsers.get(receivingUserId.toString());
        if (receivingUserWs) {
          deliveryService.sendMessage(receivingUserWs, {
            id,
            api: apiTypes.API.RECEIVE_PRE_KEY_MESSAGE,
            status: "SUCCESS",
            payload: { chatId, ciphertext },
          });
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

        const receivingUserWs = onlineUsers.get(receivingUserId.toString());
        if (receivingUserWs) {
          deliveryService.sendMessage(receivingUserWs, {
            id,
            api: apiTypes.API.RECEIVE_MESSAGE,
            status: "SUCCESS",
            payload: { chatId, message: sentMessage },
            callback: () => {
              deleteMessages(new ObjectId(chatId), sentMessage.sequence);
              updateLastAckSequence(
                new ObjectId(chatId),
                new ObjectId(receivingUserId),
                sentMessage.sequence
              );
            },
          });
        }

        // Confirm message delivery to the sender.
        if (ciphertext.type !== 3) {
          deliveryService.sendMessage(ws, {
            id,
            api,
            status: "SUCCESS",
            payload: { sentMessage: toApiMessage(sentMessage) },
          });
        }
        break;
      }

      default: {
        console.error(`Unknown api call: ${api}`);
        deliveryService.sendMessage(ws, {
          id,
          api,
          status: "ERROR",
          payload: { message: "Invalid api call" },
        });
        break;
      }
    }
  } catch (error) {
    throw error;
  }
}
