import { OrderedMap } from "@js-sdsl/ordered-map";
import { OnlineUsersService } from "./OnlineUsersService.js";
import { WebSocket } from "ws";
import {
  ErrorApi,
  ErrorApiMessage,
  ErrorApiPayload,
  NotificationApiMessage,
  ResponseApiMessage,
} from "./types/apiTypes.js";
import { isNotificationApiMessage, isResponseApiMessage } from "./apiUtils.js";

export type PendingMessage = ResponseApiMessage | NotificationApiMessage;
export type PendingMesssageMetadata = {
  retryAt: number;
  callback?: () => void;
};

export class DeliveryService {
  private static instance: DeliveryService;
  private static SEND_MESSAGE_INTERVAL = 30_000;
  private static ACK_TIMEOUT = 5_000;
  private onlineUsers = OnlineUsersService.getInstance();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private pendingMessages: Map<
    string,
    OrderedMap<string, PendingMessage & PendingMesssageMetadata>
  > = new Map();

  public static getInstance() {
    if (!DeliveryService.instance) {
      DeliveryService.instance = new DeliveryService();
    }
    return DeliveryService.instance;
  }

  public sendError(ws: WebSocket, id: string = "", message: ErrorApiPayload) {
    ws.send(JSON.stringify({ id, api: ErrorApi.ERROR, payload: message }));
  }

  public sendMessage(userId: string, message: PendingMessage, callback?: () => void): void {
    const ws = this.onlineUsers.getUser(userId);
    if (!ws) {
      console.error(`User ${userId} not found`);
      return;
    }

    ws.send(JSON.stringify(message));

    if (!ws.userId) return;
    this.addMessage(ws.userId!, message, {
      retryAt: Date.now() + DeliveryService.ACK_TIMEOUT,
      callback,
    });
  }

  public addMessage(userId: string, message: PendingMessage, metadata: PendingMesssageMetadata) {
    if (!this.pendingMessages.has(userId)) {
      this.pendingMessages.set(
        userId,
        new OrderedMap<string, PendingMessage & PendingMesssageMetadata>()
      );
      this.intervals.set(
        userId,
        setInterval(() => this.sendQueuedResponse(userId), DeliveryService.SEND_MESSAGE_INTERVAL)
      );
    }
    this.pendingMessages.get(userId)!.setElement(message.id, { ...message, ...metadata });
  }

  public handleAck(userId: string, id: string) {
    if (!this.pendingMessages.has(userId) || this.pendingMessages.get(userId)!.empty()) {
      return;
    }
    const request = this.pendingMessages.get(userId)!.getElementByKey(id);
    if (request?.callback) request.callback();

    this.pendingMessages.get(userId)!.eraseElementByKey(id);
    this.sendQueuedResponse(userId);
  }

  private sendQueuedResponse(userId: string) {
    const userPendingMessages = this.pendingMessages.get(userId);
    if (!userPendingMessages || userPendingMessages.empty()) return;

    const now = Date.now();
    for (const [id, message] of userPendingMessages) {
      if (isResponseApiMessage(message)) {
        const { api, payload, retryAt } = message;
        if (now < retryAt) continue;
        this.sendMessage(userId, { id, api, payload }, message.callback);
        return;
      }
      if (isNotificationApiMessage(message)) {
        const { api, payload, retryAt } = message;
        if (now < retryAt) continue;
        this.sendMessage(userId, { id, api, payload }, message.callback);
        return;
      }
    }
  }

  public deleteUser(userId: string) {
    clearInterval(this.intervals.get(userId)!);
    this.intervals.delete(userId);
    this.pendingMessages.delete(userId);
  }
}

export const deliveryService = DeliveryService.getInstance();
