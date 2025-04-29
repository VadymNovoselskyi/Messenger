import { OrderedMap } from "@js-sdsl/ordered-map";
import { WebSocket } from "ws";
import { API, responsePayload } from "./types/apiTypes.mjs";
import { sendResponse } from "./apiUtils.js";

export class UnackService {
  private static instance: UnackService;
  private unacknowledgedRequests: Record<
    string,
    OrderedMap<string, { api?: API; status?: "SUCCESS" | "ERROR"; payload?: responsePayload }>
  > = {};

  private constructor() {}

  public static getInstance() {
    if (!UnackService.instance) {
      UnackService.instance = new UnackService();
    }
    return UnackService.instance;
  }

  public addRequest(
    userId: string,
    request: { api?: API; id: string; status?: "SUCCESS" | "ERROR"; payload?: responsePayload }
  ) {
    if (!this.unacknowledgedRequests[userId]) {
      this.unacknowledgedRequests[userId] = new OrderedMap<
        string,
        {
          api?: API;
          status?: "SUCCESS" | "ERROR";
          payload?: responsePayload;
        }
      >();
    }
    this.unacknowledgedRequests[userId].setElement(request.id, {
      api: request.api,
      status: request.status,
      payload: request.payload,
    });
  }

  public handleAck(ws: WebSocket, id: string) {
    if (!ws.userId) {
      console.error("User not authenticated");
      return;
    } else if (
      !this.unacknowledgedRequests[ws.userId] ||
      this.unacknowledgedRequests[ws.userId].empty()
    )
      return;
    this.unacknowledgedRequests[ws.userId].eraseElementByKey(id);
    this.sendQueuedResponse(ws);
  }

  private sendQueuedResponse(ws: WebSocket) {
    const request = this.unacknowledgedRequests[ws.userId!].front();
    if (!request) return;
    const { api, status, payload } = request[1];
    sendResponse(ws, request[0], api, status, payload);
  }

  public deleteUser(ws: WebSocket) {
    delete this.unacknowledgedRequests[ws.userId!];
  }
}

export const unackService = UnackService.getInstance();
