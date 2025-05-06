import { WebSocket } from "ws";
import { Binary, ObjectId } from "mongodb";

import * as requestTypes from "./types/requestTypes.js";
import * as notificationTypes from "./types/notificationTypes.js";
import * as systemTypes from "./types/systemTypes.js";
import * as mongoApi from "./mongodb/mongoApi.js";

import { DeliveryService } from "./services/DeliveryService.js";
import { OnlineUsersService } from "./services/OnlineUsersService.js";
import { AuthService } from "./services/AuthService.js";

import { PreKeyType } from "@privacyresearch/libsignal-protocol-typescript";
import { PreKeyBundle } from "./types/signalTypes.js";
import {
  toApiChatMetadata,
  toApiChat,
  toApiMessage,
  isSystemApiMessage,
  isRequestApiMessage,
  isNotificationApiMessage,
} from "./utils/apiUtils.js";
import { binaryToBase64, base64ToBinary } from "./utils/parserUtils.js";
import { ChatService } from "./services/ChatService.js";
import { MessageService } from "./services/MessageService.js";
import { UserService } from "./services/UserService.js";

export class ServerController {
  private static _instance: ServerController;
  private authService: AuthService;
  private chatService: ChatService;
  private messageService: MessageService;
  private userService: UserService;

  private constructor(
    private deliveryService: DeliveryService,
    private onlineUsers: OnlineUsersService
  ) {
    this.authService = AuthService.init(this.deliveryService, this.onlineUsers);
    this.chatService = ChatService.init(this.deliveryService, this.onlineUsers);
    this.messageService = MessageService.init(this.deliveryService, this.onlineUsers);
    this.userService = UserService.init(this.deliveryService);
  }

  public static init(deliveryService: DeliveryService, onlineUsers: OnlineUsersService) {
    if (!this._instance) this._instance = new ServerController(deliveryService, onlineUsers);
    return this._instance;
  }
  public static get instance(): ServerController {
    if (!this._instance)
      throw new Error("ServerController not initialised - call ServerController.init() first");
    return this._instance;
  }

  public async handleMessage(ws: WebSocket, message: WebSocket.RawData) {
    let parsedMessage: requestTypes.ResponseApiMessage | systemTypes.SystemApiMessage;
    console.log(`Received message: ${message}`);

    try {
      parsedMessage = JSON.parse(message.toString());
    } catch {
      this.deliveryService.sendError(ws, "", { message: "Invalid JSON format" });
      return;
    }

    if (isSystemApiMessage(parsedMessage)) {
      this.handleSystemMessage(ws, parsedMessage);
      return;
    } else if (!isRequestApiMessage(parsedMessage)) {
      this.deliveryService.sendError(ws, "", {
        message: `Invalid message, not a system or request: ${parsedMessage?.api}`,
      });
      return;
    }

    this.handleRequestMessage(ws, parsedMessage as requestTypes.RequestApiMessage);
  }

  private handleSystemMessage(ws: WebSocket, message: systemTypes.SystemApiMessage) {
    const { api, id } = message;
    if (api === systemTypes.SystemApi.PONG) return;
    if (api === systemTypes.SystemApi.ACK) {
      if (!ws.userId || !id) {
        this.deliveryService.sendError(ws, "", { message: `Invalid system message: ${api}` });
        return;
      }
      this.deliveryService.handleAck(ws.userId!, id);
      return;
    } else {
      this.deliveryService.sendError(ws, "", { message: `Invalid system message: ${api}` });
      return;
    }
  }

  private async handleRequestMessage(ws: WebSocket, message: requestTypes.RequestApiMessage) {
    const { id, api, token, payload } = message;

    if (api === requestTypes.RequestApi.SEND_AUTH) {
      this.authService.handleAuth(ws, token ?? "", id);
      return;
    } else if (api === requestTypes.RequestApi.LOGIN) {
      this.authService.handleLogin(ws, payload as requestTypes.loginPayload, id);
      return;
    } else if (api === requestTypes.RequestApi.SIGNUP) {
      this.authService.handleSignup(ws, payload as requestTypes.signupPayload, id);
      return;
    }

    if (!ws.isAuthenticated) {
      this.deliveryService.sendError(ws, id, { message: "Unauthenticated" });
      return;
    }

    try {
      await this.handleAuthenticatedCall(ws, ws.userId ?? "", id, api, payload);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "An unknown error occurred";
      this.deliveryService.sendError(ws, id, { message: errMsg });
    }
    return;
  }

  private async handleAuthenticatedCall(
    ws: WebSocket,
    userId: string,
    id: string,
    api: requestTypes.RequestApi,
    payload: requestTypes.RequestMessagePayload
  ): Promise<void> {
    switch (api) {
      /* Chat APIs */
      case requestTypes.RequestApi.SYNC_ACTIVE_CHATS: {
        await this.chatService.syncActiveChats(
          userId,
          id,
          payload as requestTypes.syncActiveChatsPayload
        );
        break;
      }
      case requestTypes.RequestApi.SYNC_ALL_CHATS_METADATA: {
        await this.chatService.syncAllChatsMetadata(userId, id);
        break;
      }
      case requestTypes.RequestApi.SEND_READ_UPDATE: {
        await this.chatService.sendReadUpdate(
          userId,
          id,
          payload as requestTypes.sendReadUpdatePayload
        );
        break;
      }
      case requestTypes.RequestApi.CREATE_CHAT: {
        await this.chatService.createChat(userId, id, payload as requestTypes.createChatPayload);
        break;
      }

      /* Message APIs */
      case requestTypes.RequestApi.SEND_MESSAGE: {
        await this.messageService.sendMessage(
          userId,
          id,
          payload as requestTypes.sendMessagePayload
        );
        break;
      }
      case requestTypes.RequestApi.SEND_PRE_KEY_WHISPER_MESSAGE: {
        await this.messageService.sendPreKeyWhisperMessage(
          userId,
          id,
          payload as requestTypes.sendPreKeyWhisperMessagePayload
        );
        break;
      }

      /* User APIs */
      case requestTypes.RequestApi.SEND_PRE_KEY_BUNDLE: {
        await this.userService.sendPreKeyBundle(
          userId,
          id,
          payload as requestTypes.sendPreKeyBundlePayload
        );
        break;
      }
      case requestTypes.RequestApi.ADD_PRE_KEYS: {
        await this.userService.addPreKeys(userId, id, payload as requestTypes.addPreKeysPayload);
        break;
      }

      default: {
        this.deliveryService.sendError(ws, id, { message: "Invalid api call" });
        break;
      }
    }
  }
}
