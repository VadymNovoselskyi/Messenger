import { ObjectId } from "mongodb";
import { ApiChat, ApiMessage, ApiUser } from "../types/apiTypes.js";
import { ChatDocument, MessageDocument } from "../types/mongoTypes.js";
import { NotificationApi, NotificationApiMessage } from "../types/notificationTypes.js";
import { RequestApi, RequestApiMessage, ResponseApiMessage } from "../types/requestTypes.js";
import { SystemApi, SystemApiMessage } from "../types/systemTypes.js";


export async function toApiChat(chat: ChatDocument, messages: MessageDocument[]): Promise<ApiChat> {
  return {
    _id: chat._id.toString(),
    users: chat.users.map(user => toApiUser(user)),
    messages: messages.map(message => toApiMessage(message)),
    lastSequence: chat.lastSequence,
    lastModified: chat.lastModified.toISOString(),
  };
}

export function toApiChatMetadata(chat: ChatDocument): ApiChat {
  return {
    _id: chat._id.toString(),
    users: chat.users.map(user => toApiUser(user)),
    messages: [],
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

export function isRequestApiMessage(message: any): message is RequestApiMessage {
  return Object.values(RequestApi).includes(message.api);
}

export function isResponseApiMessage(message: any): message is ResponseApiMessage {
  return Object.values(RequestApi).includes(message.api);
}

export function isNotificationApiMessage(message: any): message is NotificationApiMessage {
  return Object.values(NotificationApi).includes(message.api);
}

export function isSystemApiMessage(message: any): message is SystemApiMessage {
  return Object.values(SystemApi).includes(message.api);
}
