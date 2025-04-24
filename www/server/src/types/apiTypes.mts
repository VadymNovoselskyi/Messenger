import { ObjectId } from "mongodb";
import { StringifiedPreKeyBundle } from "./signalTypes.mjs";
import { MessageType } from "@privacyresearch/libsignal-protocol-typescript";
import { MessageDocument } from "./mongoTypes.mjs";

export type ApiMessage = {
  _id: string;
  chatId: string;
  from: string;
  ciphertext: MessageType;
  sequence: number;
  sendTime: string; //ISO-date
};

export type ApiChat = {
  _id: string;
  users: ApiUser[];
  messages: ApiMessage[];
  messageCounter: number;
  lastModified: string; //ISO-Date
};

export type ApiUser = {
  _id: string;
  username: string;
};

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
  preKeyBundle: StringifiedPreKeyBundle;
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
  chats: ApiChat[];
};

export type sendMessageResponse = {
  chatId: string;
  message: ApiMessage;
  tempMessageId: string;
};

export type receiveMessageResponse = {
  chatId: string;
  message: MessageDocument;
};

export type readUpdateResponse = {
  chatId: string;
  lastSeen: Date;
};

export type getExtraMessagesResponse = {
  chatId: string;
  extraMessages: ApiMessage[];
};

export type getExtraNewMessagesResponse = {
  chatId: string;
  extraNewMessages: ApiMessage[];
};

export type readAllResponse = Record<string, never>;

export type createChatResponse = {
  createdChat: ApiChat;
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
