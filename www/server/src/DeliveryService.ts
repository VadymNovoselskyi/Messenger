import { OrderedMap } from "@js-sdsl/ordered-map";
import { WebSocket } from "ws";
import { API, responsePayload } from "./types/apiTypes.js";

type Message = {
  api?: API;
  id: string;
  status?: "SUCCESS" | "ERROR";
  payload?: responsePayload;
  callback?: () => void;
};

export class DeliveryService {
  private static instance: DeliveryService;
  private stackedMessages: Map<string, OrderedMap<string, Message>> = new Map();

  private constructor() {}

  public static getInstance() {
    if (!DeliveryService.instance) {
      DeliveryService.instance = new DeliveryService();
    }
    return DeliveryService.instance;
  }

  public sendMessage(ws: WebSocket, message: Message): void {
    ws.send(JSON.stringify(message));
    if (ws.userId && message.status === "SUCCESS" && message.api !== API.PONG) {
      this.addMessage(ws.userId!, message);
    }
  }

  public addMessage(userId: string, message: Message) {
    if (!this.stackedMessages.has(userId)) {
      this.stackedMessages.set(userId, new OrderedMap<string, Message>());
    }
    this.stackedMessages.get(userId)!.setElement(message.id, message);
  }

  public handleAck(ws: WebSocket, id: string) {
    if (!ws.userId) {
      console.error("User not authenticated");
      return;
    } else if (!this.stackedMessages.has(ws.userId) || this.stackedMessages.get(ws.userId)!.empty())
      return;
    const request = this.stackedMessages.get(ws.userId)!.getElementByKey(id);
    if (request?.callback) request.callback();

    this.stackedMessages.get(ws.userId)!.eraseElementByKey(id);
    this.sendQueuedResponse(ws);
  }

  private sendQueuedResponse(ws: WebSocket) {
    const request = this.stackedMessages.get(ws.userId!)!.front();
    if (!request) return;
    const { api, status, payload } = request[1];
    ws.send(JSON.stringify({ id: request[0], api, status, payload }));
  }

  public deleteUser(userId: string) {
    this.stackedMessages.delete(userId);
  }
}

export const deliveryService = DeliveryService.getInstance();
