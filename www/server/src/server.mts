import WebSocket, { WebSocketServer } from "ws";
import jwt, { JwtPayload } from "jsonwebtoken";
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
} from "./api.mjs";
import * as _ from "./types/types.mjs";
import { ObjectId } from "mongodb";

const secretKey = "y8q6GA@0md8ySuNk";

// Generate a JWT token for a given user ID.
function generateToken(userId: string): string {
  return jwt.sign({ userId }, secretKey, { expiresIn: "7d" });
}

// Helper to send standardized responses.
function sendResponse(
  ws: WebSocket,
  api?: string,
  id?: string,
  status?: string,
  payload?: _.response
): void {
  return ws.send(JSON.stringify({ api, id, status, payload }));
}

const onlineUsers: Record<string, WebSocket> = {}; // Tracks active connections by user ID.

const wss = new WebSocketServer({ port: 5000 });
wss.on("connection", ws => {
  console.log("Client connected");
  ws.isAuthenticated = false;

  ws.on("message", async message => {
    console.log(`Received message: ${message}`);
    let parsedMessage: _.APICall;
    try {
      parsedMessage = JSON.parse(message.toString());
    } catch {
      sendResponse(ws, undefined, undefined, "error", { message: "Invalid JSON format" });
      return;
    }
    const { api, id, payload }: { api: _.API; id: string; payload: _.payload } = parsedMessage;

    // Login: Authenticate an existing user.
    if (api === _.API.LOGIN) {
      const { username, password } = payload as _.loginPayload;
      try {
        const user = await findUser(username);
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
          return sendResponse(ws, api, id, "error", { message: "Invalid password" });
        }
        const token = generateToken(user._id.toString());
        sendResponse(ws, api, id, "success", { userId: user._id, token });
        ws.isAuthenticated = true;
        ws.userId = user._id.toString();
        onlineUsers[ws.userId] = ws;
      } catch (error) {
        const message = error instanceof Error ? error.message : "An unknown error occurred";
        sendResponse(ws, api, id, "error", { message });
      }
      return;
    }

    // Signup: Create a new user.
    else if (api === _.API.SIGNUP) {
      const { username, password } = payload as _.signupPayload;
      try {
        const userId = await createUser(username, password);
        const token = generateToken(userId.toString());
        sendResponse(ws, api, id, "success", { userId, token });
        ws.isAuthenticated = true;
        ws.userId = userId.toString();
        onlineUsers[ws.userId] = ws;
      } catch (error) {
        const message = error instanceof Error ? error.message : "An unknown error occurred";
        sendResponse(ws, api, id, "error", { message });
      }
      return;
    }

    // If already authenticated, process API calls.
    if (ws.isAuthenticated) {
      return await handleAuthenticatedCall(api, id, payload, ws.userId ?? "");
    }

    //if not authenticated, check the jwt
    else {
      try {
        const { token } = parsedMessage;
        if (!token) throw new Error("No token provided");

        const decoded = jwt.verify(token, secretKey);
        if (typeof decoded === "string") {
          throw new Error("Decoded token is a string, expected an object.");
        }

        ws.isAuthenticated = true;
        const { userId } = decoded;
        ws.userId = userId;
        onlineUsers[ws.userId ?? ""] = ws;
        await handleAuthenticatedCall(api, id, payload, userId);
      } catch (error) {
        const message = error instanceof Error ? error.message : "An unknown error occurred";
        sendResponse(ws, api, id, "error", { message });
      }
    }
  });

  // Remove user from onlineUsers when the connection closes.
  ws.on("close", () => {
    if (ws.userId && onlineUsers[ws.userId]) {
      delete onlineUsers[ws.userId];
    }
  });

  // Handles authenticated API calls.
  async function handleAuthenticatedCall(
    api: _.API,
    id: string,
    payload: _.payload,
    userId: string
  ): Promise<void> {
    try {
      switch (api) {
        case _.API.GET_CHATS: {
          const chats = await getChats(new ObjectId(userId));
          sendResponse(ws, api, id, "success", { chats });
          break;
        }
        case _.API.SEND_MESSAGE: {
          const { chatId, text, tempMessageId } = payload as _.sendMessagePayload;
          const { message, receivingUserId } = await sendMessage(
            new ObjectId(userId),
            new ObjectId(chatId),
            text
          );
          // If the recipient is online, forward the message.
          if (onlineUsers[receivingUserId.toString()]) {
            sendResponse(
              onlineUsers[receivingUserId.toString()],
              "receive_message",
              undefined,
              "success",
              {
                chatId,
                message,
                tempMessageId, //delete
              }
            );
          }
          // Send confirmation to the sender.
          sendResponse(ws, "receive_message", id, "success", {
            chatId,
            message,
            tempMessageId,
          });
          break;
        }

        case _.API.READ_UPDATE: {
          const { chatId, messageId } = payload as _.readUpdatePayload;
          const { sendTime, receivingUserId } = await readUpdate(
            new ObjectId(userId),
            new ObjectId(chatId),
            new ObjectId(messageId)
          );
          if (onlineUsers[receivingUserId.toString()]) {
            sendResponse(onlineUsers[receivingUserId.toString()], api, undefined, "success", {
              chatId,
              lastSeen: sendTime,
            });
          }
          break;
        }

        case _.API.EXTRA_MESSAGES: {
          const { chatId, currentIndex } = payload as _.getExtraMessagesPayload;
          const extraMessages = await getExtraMessages(new ObjectId(chatId), currentIndex);
          sendResponse(ws, api, id, "success", { chatId, extraMessages });
          break;
        }

        case _.API.EXTRA_NEW_MESSAGES: {
          const { chatId, unreadCount } = payload as _.getExtraNewMessagesPayload;
          const extraNewMessages = await getExtraNewMessages(new ObjectId(chatId), unreadCount);
          sendResponse(ws, api, id, "success", { chatId, extraNewMessages });
          break;
        }

        case _.API.READ_ALL: {
          const { chatId } = payload as _.readAllPayload;
          await readAll(new ObjectId(chatId), new ObjectId(ws.userId));
          sendResponse(ws, api, id, "success", {});
          break;
        }

        case _.API.CREATE_CHAT: {
          const { username } = payload as _.createChatPayload;
          const { createdChat, receivingUserId } = await createChat(new ObjectId(userId), username);
          sendResponse(ws, api, id, "success", { createdChat });
          if (onlineUsers[receivingUserId.toString()]) {
            sendResponse(onlineUsers[receivingUserId.toString()], api, undefined, "success", {
              createdChat,
            });
          }
          break;
        }
        default: {
          console.error(`Unknown api call: ${api}`);
          sendResponse(ws, api, id, "error", { message: "Invalid api call" });
          break;
        }
      }
    } catch (error) {
      throw error;
    }
  }
});
