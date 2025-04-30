import { ObjectId } from "mongodb";
import { StringifiedPreKeyBundle } from "./signalTypes.js";
import { MessageType } from "@privacyresearch/libsignal-protocol-typescript";
import { MessageDocument } from "./mongoTypes.js";

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
  lastSequence: number;
  lastModified: string; //ISO-Date
};

export type ApiUser = {
  _id: string;
  username: string;
  lastReadSequence: number;
};

export enum API {
  AUTHENTICATE = "authenticate",
  FETCH_UPDATES = "fetchUpdates",
  FETCH_CHATS_UPDATES = "fetchChatsUpdates",  
  RECEIVE_MESSAGE = "receiveMessage",
  RECEIVE_PRE_KEY_MESSAGE = "receivePreKeyMessage",
  READ_UPDATE = "readUpdate",
  EXTRA_MESSAGES = "extraMessages",
  EXTRA_NEW_MESSAGES = "extraNewMessages",
  READ_ALL = "readAll",
  CREATE_CHAT = "createChat",
  LOGIN = "login",
  SIGNUP = "signup",
  SEND_KEYS = "sendKeys",
  SEND_PRE_KEY_MESSAGE = "sendPreKeyMessage",
  SEND_ENC_MESSAGE = "sendEncMessage",
  PING = "ping",
  PONG = "pong",
  ACK = "ack",
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
  | fetchUpdatesPayload
  | fetchChatsUpdatesPayload
  | sendMessagePayload
  | readUpdatePayload
  | getExtraMessagesPayload
  | getExtraNewMessagesPayload
  | readAllPayload
  | createChatPayload
  | loginPayload
  | sendKeysPayload
  | sendPreKeyMessagePayload
  | sendEncMessagePayload;

/** Union type for response payloads */
export type responsePayload =
  | fetchUpdatesResponse
  | fetchChatsUpdatesResponse
  | sendMessageResponse
  | receiveMessageResponse
  | receivePreKeyMessageResponse
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

export type fetchUpdatesPayload = Record<string, never>;

export type fetchChatsUpdatesPayload = {
  chatIds: string[];
};

export type sendMessagePayload = {
  chatId: string;
  text: string;
  tempMessageId: string;
};

export type readUpdatePayload = {
  chatId: string;
  sequence: number;
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

export type sendPreKeyMessagePayload = {
  chatId: string;
  ciphertext: MessageType;
};

export type sendEncMessagePayload = {
  chatId: string;
  ciphertext: MessageType;
};

//Responses
export type fetchUpdatesResponse = {
  chats: ApiChat[];
};

export type fetchChatsUpdatesResponse = {
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

export type receivePreKeyMessageResponse = {
  chatId: string;
  ciphertext: MessageType;
};

export type readUpdateResponse = {
  chatId: string;
  sequence: number;
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

export type sendEncMessageResponse = { sentMessage: ApiMessage };

export type errorResponse = {
  message: string;
};
