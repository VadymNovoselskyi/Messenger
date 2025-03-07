import WebSocket, { WebSocketServer } from "ws";
import jwt, { JwtPayload } from 'jsonwebtoken';
import bcrypt from "bcrypt";
import {
  getChats,
  getExtraMessages,
  getExtraNewMessages,
  readUpdate,
  sendMessage,
  findUser,
  createUser,
  createChat,
} from "./api.mjs";
import { API } from "./types/types.mjs";

const secretKey = "y8q6GA@0md8ySuNk";

// Generate a JWT token for a given user ID.
function generateToken(userId: string): string {
  return jwt.sign({ userId }, secretKey, { expiresIn: "7d" });
}

// Helper to send standardized responses.
function sendResponse(ws: WebSocket, api?: string, id?: string, status?: string, payload?: any): void {
  return ws.send(JSON.stringify({ api, id, status, payload }));
};

const onlineUsers: Record<string, WebSocket> = {}; // Tracks active connections by user ID.

const wss = new WebSocketServer({ port: 5000 });
wss.on("connection", ws => {
  console.log("Client connected");
  ws.isAuthenticated = false;

  ws.on("message", async message => {
    console.log(`Received message: ${message}`);
    let parsedMessage;
    try {
      parsedMessage = JSON.parse(message.toString());
    } catch {
      sendResponse(ws, undefined, undefined, "error", { message: "Invalid JSON format" });
      return
    }
    const { api, id, payload }: { api: API, id: string, payload: any } = parsedMessage;

    // Signup: Create a new user.
    if (api === API.SIGNUP) {
      const { username, password } = payload;
      try {
        const uid = await createUser(username, password);
        const token = generateToken(uid.toString());
        sendResponse(ws, api, id, "success", { uid, token });
        ws.isAuthenticated = true;
        ws.userId = uid.toString();
        onlineUsers[ws.userId] = ws;
      } catch (error) {
        const message = error instanceof Error ? error.message : "An unknown error occurred";
        sendResponse(ws, api, id, "error", { message });
      }
      return;
    }

    // Login: Authenticate an existing user.
    if (api === API.LOGIN) {
      const { username, password } = payload;
      try {
        const user = await findUser(username);
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
          return sendResponse(ws, api, id, "error", { message: "Invalid password" });
        }
        const token = generateToken(user._id.toString());
        sendResponse(ws, api, id, "success", { uid: user._id, token });
        ws.isAuthenticated = true;
        ws.userId = user._id.toString();
        onlineUsers[ws.userId] = ws;
      } catch (error) {
        const message = error instanceof Error ? error.message : "An unknown error occurred";
        sendResponse(ws, api, id, "error", { message });
      }
      return;
    }

    // If already authenticated, process API calls.
    if (ws.isAuthenticated) {
      return await handleAuthenticatedCall(api, id, payload, ws.userId ?? '');
    }

    //if not authenticated, check the jwt
    else {
      const { token } = parsedMessage;
      try {
        const decoded = jwt.verify(token, secretKey);
        if (typeof decoded === 'string') {
          throw new Error("Decoded token is a string, expected an object.");
        }
        
        ws.isAuthenticated = true;
        const { userId } = decoded;
        ws.userId = userId;
        onlineUsers[ws.userId ?? ''] = ws;
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
  async function handleAuthenticatedCall(api: API, id: string, payload: any, userId: string): Promise<void> {
    try {
      switch (api) {
        case "get_chats": {
          const chats = await getChats(userId);
          sendResponse(ws, api, id, "success", { chats });
          break;
        }
        case "send_message": {
          const { tempMID } = payload;
          const { message, receivingUID } = await sendMessage(userId, payload.cid, payload.message);
          // If the recipient is online, forward the message.
          if (onlineUsers[receivingUID.toString()]) {
            onlineUsers[receivingUID.toString()].send(
              JSON.stringify({
                api: "receive_message",
                status: "success",
                payload: { cid: payload.cid, message },
              })
            );
          }
          // Send confirmation to the sender.
          sendResponse(ws, "receive_message", id, "success", { cid: payload.cid, message, tempMID });
          break;
        }
        case "extra_messages": {
          const { cid, currentIndex } = payload;
          const extraMessages = await getExtraMessages(cid, currentIndex);
          sendResponse(ws, api, id, "success", { cid, extraMessages });
          break;
        }
        case "extra_new_messages": {
          const { cid, unreadCount } = payload;
          const extraNewMessages = await getExtraNewMessages(cid, unreadCount);
          sendResponse(ws, api, id, "success", { cid, extraNewMessages });
          break;
        }
        case "read_update": {
          const { cid, mid } = payload;
          const { sendTime, receivingUID } = await readUpdate(userId, cid, mid);
          if (onlineUsers[receivingUID]) {
            onlineUsers[receivingUID].send(
              JSON.stringify({
                api,
                status: "success",
                payload: { cid, lastSeen: sendTime },
              })
            );
          }
          break;
        }
        case "create_chat": {
          const { createdChat, receivingUID } = await createChat(userId, payload.username);
          sendResponse(ws, api, id, "success", { createdChat });
          if (onlineUsers[receivingUID.toString()]) {
            onlineUsers[receivingUID.toString()].send(
              JSON.stringify({
                api: "create_chat",
                id,
                status: "success",
                payload: { createdChat },
              })
            );
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
