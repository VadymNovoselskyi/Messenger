import WebSocket, { WebSocketServer } from "ws";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import * as mongoApi from "./mongodb/mongoApi.js";
import { base64ToBinary, generateToken } from "./utils.js";

import * as apiTypes from "./types/apiTypes.js";
import { ObjectId } from "mongodb";
import { BinaryPreKey, BinaryPreKeyBundle } from "./types/signalTypes.js";
import {
  isRequestApiMessage,
  isSystemApiMessage,
  toApiChat,
  toApiChatMetadata,
  toApiMessage,
} from "./apiUtils.js";
import { DeliveryService } from "./DeliveryService.js";
import { OnlineUsersService } from "./OnlineUsersService.js";

dotenv.config(); // Load .env variables into process.env
const JWT_KEY = process.env.JWT_KEY || "";
const PORT = process.env.PORT || 5000;

const onlineUsers = OnlineUsersService.getInstance();
const deliveryService = DeliveryService.getInstance();

const wss = new WebSocketServer({ port: Number(PORT) });
onlineUsers.setPingInterval(wss);
wss.on("connection", ws => {
  console.log("Client connected");
  ws.isAuthenticated = false;
  ws.isAlive = true;

  ws.on("message", async message => {
    let parsedMessage:
      | apiTypes.ResponseApiMessage
      | apiTypes.NotificationApiMessage
      | apiTypes.SystemApiMessage;
    try {
      parsedMessage = JSON.parse(message.toString());
    } catch {
      deliveryService.sendError(ws, "", { message: "Invalid JSON format" });
      return;
    }

    if (isSystemApiMessage(parsedMessage)) {
      const { api, id } = parsedMessage as apiTypes.SystemApiMessage;
      if (api === apiTypes.SystemApi.PONG) return;
      if (api === apiTypes.SystemApi.ACK) {
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

    const { id, api, token, payload } = parsedMessage as apiTypes.RequestApiMessage;
    console.log(`Received message: ${message}`);

    if (api === apiTypes.RequestApi.SEND_AUTH) {
      console.log("Authenticating");
      try {
        if (!token) throw new Error("No token provided");

        const decoded = jwt.verify(token, JWT_KEY);
        if (typeof decoded === "string") {
          throw new Error("Decoded token is a string, expected an object.");
        }

        const { userId } = decoded;
        const user = await mongoApi.findUserById(new ObjectId(userId));
        if (!user) throw new Error("JWT expired");
        ws.isAuthenticated = true;
        ws.userId = userId;
        onlineUsers.addUser(ws);
        deliveryService.sendMessage(userId, {
          id,
          api,
          payload: {},
        });
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : "An unknown error occurred";
        deliveryService.sendError(ws, id, { message: errMsg });
      }
      return;
    }

    if (api === apiTypes.RequestApi.LOGIN) {
      const { username, password } = payload as apiTypes.loginPayload;
      try {
        const user = await mongoApi.findUserByName(username);

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
          return deliveryService.sendError(ws, id, { message: "Invalid password" });
        }
        const token = generateToken(user._id.toString());
        ws.isAuthenticated = true;
        ws.userId = user._id.toString();
        onlineUsers.addUser(ws);
        deliveryService.sendMessage(ws.userId ?? "", {
          id,
          api,
          payload: { userId: user._id.toString(), token },
        });
        return;
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : "An unknown error occurred";
        deliveryService.sendError(ws, id, { message: errMsg });
      }
      return;
    }

    if (api === apiTypes.RequestApi.SIGNUP) {
      const { username, password } = payload as apiTypes.signupPayload;
      try {
        const userId = await mongoApi.createUser(username, password);
        const token = generateToken(userId.toString());
        ws.isAuthenticated = true;
        ws.userId = userId.toString();
        onlineUsers.addUser(ws);
        deliveryService.sendMessage(ws.userId ?? "", {
          id,
          api,
          payload: { userId: userId.toString(), token },
        });
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : "An unknown error occurred";
        deliveryService.sendError(ws, id, { message: errMsg });
      }
      return;
    }

    if (ws.isAuthenticated) {
      try {
        await handleAuthenticatedCall(ws, ws.userId ?? "", id, api, payload);
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

/* Processes API calls that require authentication */
async function handleAuthenticatedCall(
  ws: WebSocket,
  userId: string,
  id: string,
  api: apiTypes.RequestApi,
  payload: apiTypes.RequestMessagePayload
): Promise<void> {
  try {
    switch (api) {
      case apiTypes.RequestApi.SYNC_ACTIVE_CHATS: {
        const { chatIds } = payload as apiTypes.syncActiveChatsPayload;
        const chats = await mongoApi.syncActiveChatsUpdates(
          new ObjectId(userId),
          chatIds.map(id => new ObjectId(id))
        );

        deliveryService.sendMessage(
          userId,
          {
            id,
            api,
            payload: { chats },
          },
          () => {
            for (const chat of chats) {
              const otherUserMetadata = chat.users.find(user => user._id.toString() !== userId)!;
              mongoApi.updateLastAckSequence(
                new ObjectId(chat._id),
                new ObjectId(userId),
                chat.messages.at(-1)?.sequence ?? 0
              );
              mongoApi.updateLastAckReadSequence(
                new ObjectId(chat._id),
                new ObjectId(userId),
                otherUserMetadata.lastReadSequence
              );
              if (!chat.messages.at(-1)) return;
              mongoApi.deletePreviousMessages(
                new ObjectId(chat._id),
                chat.messages.at(-1)!.sequence
              );
            }
          }
        );
        break;
      }

      case apiTypes.RequestApi.SYNC_ALL_CHATS_METADATA: {
        const { chats, unacknowledgedChats, isComplete } = await mongoApi.syncAllChatsMetadata(
          new ObjectId(userId)
        );
        deliveryService.sendMessage(
          userId,
          {
            id,
            api,
            payload: {
              chats,
              newChats: unacknowledgedChats.map(chat => toApiChatMetadata(chat)),
              isComplete,
            },
          },
          () => {
            const metadataSyncDate = isComplete
              ? new Date().toISOString()
              : chats.at(-1)?.lastModified ?? new Date().toISOString();
            mongoApi.updateLastMetadataSync(new ObjectId(userId), metadataSyncDate);
            for (const chat of unacknowledgedChats) {
              mongoApi.markChatAsAcknowledged(new ObjectId(chat._id), new ObjectId(userId));
            }
          }
        );
        break;
      }

      case apiTypes.RequestApi.SEND_READ_UPDATE: {
        const { chatId, sequence } = payload as apiTypes.sendReadUpdatePayload;
        const { receivingUserId } = await mongoApi.readUpdate(
          new ObjectId(userId),
          new ObjectId(chatId),
          sequence
        );

        const receivingUserWs = onlineUsers.getUser(receivingUserId.toString());
        if (receivingUserWs) {
          deliveryService.sendMessage(
            receivingUserId.toString(),
            {
              id,
              api: apiTypes.NotificationApi.INCOMING_READ,
              payload: { chatId, sequence },
            },
            () => {
              mongoApi.updateLastAckReadSequence(
                new ObjectId(chatId),
                new ObjectId(receivingUserId),
                sequence
              );
            }
          );
        }
        break;
      }

      case apiTypes.RequestApi.CREATE_CHAT: {
        const { username } = payload as apiTypes.createChatPayload;
        const { createdChat, receivingUserId, preKeyBundle } = await mongoApi.createChat(
          new ObjectId(userId),
          username
        );
        const createdApiChat = await toApiChat(createdChat, []);
        deliveryService.sendMessage(userId, {
          id,
          api,
          payload: { createdChat: createdApiChat, preKeyBundle },
        });

        const receivingUserWs = onlineUsers.getUser(receivingUserId.toString());
        if (receivingUserWs) {
          deliveryService.sendMessage(
            receivingUserId.toString(),
            {
              id,
              api: apiTypes.NotificationApi.INCOMING_CHAT,
              payload: { createdChat: createdApiChat },
            },
            () => {
              mongoApi.markChatAsAcknowledged(
                new ObjectId(createdChat._id),
                new ObjectId(receivingUserId)
              );
            }
          );
        }
        break;
      }

      case apiTypes.RequestApi.SEND_PRE_KEY_BUNDLE: {
        let { preKeyBundle } = payload as apiTypes.sendPreKeyBundlePayload;
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

        await mongoApi.savePreKeyBundle(new ObjectId(userId), preKeyBundleReconstructed);
        deliveryService.sendMessage(userId, {
          id,
          api,
          payload: {},
        });
        break;
      }

      case apiTypes.RequestApi.ADD_PRE_KEYS: {
        const { preKeys } = payload as apiTypes.addPreKeysPayload;
        const preKeysReconstructed: BinaryPreKey[] = [];
        for (const preKey of preKeys) {
          preKeysReconstructed.push({
            keyId: preKey.keyId,
            publicKey: base64ToBinary(preKey.publicKey),
          });
        }
        await mongoApi.addPreKeys(new ObjectId(userId), preKeysReconstructed);
        deliveryService.sendMessage(userId, {
          id,
          api,
          payload: {},
        });
        break;
      }

      case apiTypes.RequestApi.SEND_PRE_KEY_WHISPER_MESSAGE: {
        const { chatId, ciphertext } = payload as apiTypes.sendPreKeyWhisperMessagePayload;
        const { sentMessage, receivingUserId } = await mongoApi.sendPreKeyWhisperMessage(
          new ObjectId(userId),
          new ObjectId(chatId),
          ciphertext
        );

        const receivingUserWs = onlineUsers.getUser(receivingUserId.toString());
        if (receivingUserWs) {
          deliveryService.sendMessage(receivingUserId.toString(), {
            id,
            api: apiTypes.NotificationApi.INCOMING_MESSAGE,
            payload: { chatId, message: toApiMessage(sentMessage) },
          });
        }

        deliveryService.sendMessage(userId, {
          id,
          api,
          payload: {},
        });
        break;
      }

      case apiTypes.RequestApi.SEND_MESSAGE: {
        const { chatId, ciphertext } = payload as apiTypes.sendMessagePayload;
        const { sentMessage, receivingUserId } = await mongoApi.sendMessage(
          new ObjectId(userId),
          new ObjectId(chatId),
          ciphertext
        );

        const receivingUserWs = onlineUsers.getUser(receivingUserId.toString());
        if (receivingUserWs) {
          deliveryService.sendMessage(
            receivingUserId.toString(),
            {
              id,
              api: apiTypes.NotificationApi.INCOMING_MESSAGE,
              payload: { chatId, message: toApiMessage(sentMessage) },
            },
            () => {
              mongoApi.updateLastAckSequence(
                new ObjectId(chatId),
                new ObjectId(receivingUserId),
                sentMessage.sequence
              );
              mongoApi.updateLastAckReadSequence(
                new ObjectId(chatId),
                new ObjectId(receivingUserId),
                sentMessage.sequence
              );
              mongoApi.deletePreviousMessages(new ObjectId(chatId), sentMessage.sequence);
            }
          );
        }

        deliveryService.sendMessage(
          userId,
          {
            id,
            api,
            payload: { sentMessage: toApiMessage(sentMessage) },
          },
          () => {
            mongoApi.updateLastAckSequence(
              new ObjectId(chatId),
              new ObjectId(userId),
              sentMessage.sequence
            );
          }
        );
        break;
      }

      default: {
        console.error(`Unknown api call: ${api}`);
        deliveryService.sendError(ws, id, { message: "Invalid api call" });
        break;
      }
    }
  } catch (error) {
    throw error;
  }
}
