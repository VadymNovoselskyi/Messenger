import { ObjectId } from "mongodb";
import { WebSocket } from "ws";
import { API, ApiChat, ApiMessage, ApiUser, responsePayload } from "./types/apiTypes.js";
import { ChatDocument, MessageDocument, UserDocument } from "./types/mongoTypes.js";
import { messagesCollection } from "./mongodb/connect.js";
import { deliveryService } from "./DeliveryService.js";

/**
 * Sends a standardized JSON response over the WebSocket.
 *
 * @param {WebSocket} ws - The WebSocket connection to send the response through.
 * @param {types.API} [api] - (Optional) The API endpoint identifier for the response.
 * @param {string} [id] - (Optional) The unique identifier of the API call.
 * @param {"SUCCESS" | "ERROR"} [status] - (Optional) The status of the response.
 * @param {types.response} [payload] - (Optional) The response payload data.
 * @returns {void}
 */

export async function toApiChat(chat: ChatDocument, messages: MessageDocument[]): Promise<ApiChat> {
  return {
    _id: chat._id.toString(),
    users: chat.users.map(user => toApiUser(user)),
    messages: messages.map(message => toApiMessage(message)),
    lastSequence: chat.lastSequence,
    lastModified: chat.lastModified.toISOString(),
  };
}

export function toApiMessage(message: MessageDocument): ApiMessage {
  return {
    _id: message._id.toString(),
    chatId: message.chatId.toString(),
    from: message.from.toString(),
    ciphertext: message.ciphertext,
    sequence: message.sequence,
    sendTime: message.sendTime.toISOString(),
  };
}

export function toApiUser(user: {
  _id: ObjectId;
  username: string;
  lastReadSequence: number;
}): ApiUser {
  return {
    _id: user._id.toString(),
    username: user.username,
    lastReadSequence: user.lastReadSequence,
  };
}
