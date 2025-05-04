import { ObjectId } from "mongodb";
import { StringifiedPreKey, StringifiedPreKeyBundle } from "./signalTypes.js";
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
  SYNC_ALL_CHATS_METADATA = "syncAllChatsMetadata",
  SYNC_ACTIVE_CHATS = "syncActiveChats",  
  RECEIVE_MESSAGE = "receiveMessage",
  READ_UPDATE = "readUpdate",
  CREATE_CHAT = "createChat",
  LOGIN = "login",
  SIGNUP = "signup",
  SEND_PRE_KEY_BUNDLE = "sendPreKeyBundle",
  ADD_PRE_KEYS = "addPreKeys",
  SEND_PRE_KEY_WHISPER_MESSAGE = "sendPreKeyWhisperMessage",
  SEND_MESSAGE = "sendMessage",
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
  | syncAllChatsMetadataPayload
  | syncActiveChatsPayload
  | sendMessagePayload
  | readUpdatePayload
  | createChatPayload
  | loginPayload
  | sendPreKeyBundlePayload
  | addPreKeysPayload
  | sendPreKeyWhisperMessagePayload

/** Union type for response payloads */
export type responsePayload =
  | syncAllChatsMetadataResponse
  | syncActiveChatsResponse
  | sendMessageResponse
  | sendPreKeyWhisperMessageResponse
  | receiveMessageResponse
  | readUpdateResponse
  | createChatResponse
  | loginResponse
  | signupResponse
  | sendPreKeyBundleResponse
  | addPreKeysResponse
  | errorResponse

export type syncAllChatsMetadataPayload = Record<string, never>;

export type syncActiveChatsPayload = {
  chatIds: string[];
};

export type sendMessagePayload = {
  chatId: string;
  ciphertext: MessageType;
};

export type readUpdatePayload = {
  chatId: string;
  sequence: number;
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

export type sendPreKeyBundlePayload = {
  preKeyBundle: StringifiedPreKeyBundle;
};

export type addPreKeysPayload = {
  preKeys: StringifiedPreKey[];
};

export type sendPreKeyWhisperMessagePayload = {
  chatId: string;
  ciphertext: MessageType;
};

//Responses
export type syncAllChatsMetadataResponse = {
  chats: ApiChat[];
  newChats: ApiChat[];
  isComplete: boolean;
};

export type syncActiveChatsResponse = {
  chats: ApiChat[];
};

export type sendMessageResponse = { sentMessage: ApiMessage };

export type receiveMessageResponse = {
  chatId: string;
  message: MessageDocument;
};

export type sendPreKeyWhisperMessageResponse = {
  chatId: string;
  message: MessageDocument;
};

export type readUpdateResponse = {
  chatId: string;
  sequence: number;
};

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

export type sendPreKeyBundleResponse = Record<string, never>;

export type addPreKeysResponse = Record<string, never>;

export type errorResponse = {
  message: string;
};
