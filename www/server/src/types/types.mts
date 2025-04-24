import type { Binary, ObjectId } from "mongodb";
import {
  BinaryPreKey,
  BinarySignedPreKey,
  StringifiedPreKey,
  StringifiedPreKeyBundle,
} from "./signalTypes.mjs";
import { MessageType } from "@privacyresearch/libsignal-protocol-typescript";

/** API endpoints enumeration */
export enum API {
  GET_CHATS = "getChats",
  SEND_MESSAGE = "sendMessage",
  RECEIVE_MESSAGE = "receiveMessage",
  READ_UPDATE = "readUpdate",
  EXTRA_MESSAGES = "extraMessages",
  EXTRA_NEW_MESSAGES = "extraNewMessages",
  READ_ALL = "readAll",
  CREATE_CHAT = "createChat",
  LOGIN = "login",
  SIGNUP = "signup",
  SEND_KEYS = "sendKeys",
  SEND_ENC_MESSAGE = "sendEncMessage",
}

/** Structure for API call messages */
export interface APIMessage {
  api: API;
  id: string;
  token?: string | null;
  payload: messagePayload;
}

/** Union type for request payloads */
export type messagePayload =
  | getChatsPayload
  | sendMessagePayload
  | readUpdatePayload
  | getExtraMessagesPayload
  | getExtraNewMessagesPayload
  | readAllPayload
  | createChatPayload
  | loginPayload
  | sendKeysPayload
  | sendEncMessagePayload;

/** Union type for response payloads */
export type responsePayload =
  | getChatsResponse
  | sendMessageResponse
  | receiveMessageResponse
  | readUpdateResponse
  | getExtraMessagesResponse
  | getExtraNewMessagesResponse
  | readAllResponse
  | createChatResponse
  | loginResponse
  | signupResponse
  | errorResponse
  | sendKeysResponse
  | sendEncMessageResponse;

/** Chat representation */
export type Chat = {
  _id: ObjectId;
  users: User[];
  messages: Message[];
  latestMessages: Message[];
  unreadCount: number;
  receivedUnreadCount: number;
  receivedNewCount: number;
  lastModified: Date;
};

/** User representation */
export type User = {
  _id: ObjectId;
  username: string;
  lastSeen: Date;
};

/** Message representation */
export type Message = {
  _id: ObjectId;
  from: ObjectId;
  text: string;
  sendTime: Date;
};

/** MongoDB document for a chat */
export type ChatDocument = {
  _id: ObjectId;
  users: User[];
  messageCounter: number;
  lastModified: Date;
};

/** MongoDB document for a user */
export type UserDocument = {
  _id: ObjectId;
  username: string;
  registrationId?: number; // B's registration id
  identityKey?: Binary; // B's identity public key
  signedPreKey?: BinarySignedPreKey; // B's signed pre-key
  preKeys?: BinaryPreKey[]; // A one-time pre-key from B
  password: string;
};

/** MongoDB document for a message */
export type MessageDocument = {
  _id: ObjectId;
  cid: ObjectId; // Chat identifier
  from: ObjectId;
  text: string;
  sendTime: Date;
};
export type getChatsPayload = Record<string, never>;

export type sendMessagePayload = {
  chatId: string;
  text: string;
  tempMessageId: string;
};

export type readUpdatePayload = {
  chatId: string;
  messageId: string;
};

export type getExtraMessagesPayload = {
  chatId: string;
  currentIndex: number;
};

export type getExtraNewMessagesPayload = {
  chatId: string;
  unreadCount: number;
};

export type readAllPayload = {
  chatId: string;
};

export type createChatPayload = {
  username: string;
};

export type loginPayload = {
  username: string;
  password: string;
};

export type signupPayload = {
  username: string;
  password: string;
};

export type sendKeysPayload = {
  preKeyBundle: StringifiedPreKeyBundle;
};

export type sendEncMessagePayload = {
  chatId: string;
  ciphertext: MessageType;
};

//Responses
export type getChatsResponse = {
  chats: Chat[];
};

export type sendMessageResponse = {
  chatId: string;
  message: Message;
  tempMessageId: string;
};

export type receiveMessageResponse = {
  chat?: Chat;
  chatId: string;
  message: Message;
};

export type readUpdateResponse = {
  chatId: string;
  lastSeen: Date;
};

export type getExtraMessagesResponse = {
  chatId: string;
  extraMessages: Message[];
};

export type getExtraNewMessagesResponse = {
  chatId: string;
  extraNewMessages: Message[];
};

export type readAllResponse = Record<string, never>;

export type createChatResponse = {
  createdChat: Chat;
  preKeyBundle?: StringifiedPreKeyBundle;
};

export type loginResponse = {
  userId: ObjectId;
  token: string; //JWT
};

export type signupResponse = {
  userId: ObjectId;
  token: string; //JWT
};

export type sendKeysResponse = Record<string, never>;

export type sendEncMessageResponse = { tempMessageId: string };

export type errorResponse = {
  message: string;
};
