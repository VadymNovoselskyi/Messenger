import type { ObjectId } from "mongodb";

export enum API {
  GET_CHATS = "getChats",
  SEND_MESSAGE = "sendMessage",
  READ_UPDATE = "readUpdate",
  EXTRA_MESSAGES = "extraMessages",
  EXTRA_NEW_MESSAGES = "extraNewMessages",
  READ_ALL = 'readAll',
  CREATE_CHAT = "createChat",
  LOGIN = "login",
  SIGNUP = "signup",
}

export interface APICall {
  api: API;
  id: string;
  token?: string | null;
  payload: payload;
}

export type payload =
	| getChatsPayload
	| sendMessagePayload
	| readUpdatePayload
	| getExtraMessagesPayload
	| getExtraNewMessagesPayload
	| readAllPayload
	| createChatPayload
	| loginPayload
	| signupPayload;

export type response =
  | getChatsResponse
  | sendMessageResponse
  | readUpdateResponse
  | getExtraMessagesResponse
  | getExtraNewMessagesResponse
  | readAllResponse
  | createChatResponse
  | loginResponse
  | signupResponse
  | errorResponse;

export type Chat = {
  _id: ObjectId;
  users: User[];
  messages: Message[];
  latestMessages: Message[]
  unreadCount: number;
  receivedUnreadCount: number;
  receivedNewCount: number;
  lastModified: Date;
};

export type User = {
  _id: ObjectId;
  username: string;
  lastSeen: Date;
};

export type Message = {
  _id: ObjectId;
  from: ObjectId;
  text: string;
  sendTime: Date;
};

export type ChatDocument = {
  _id: ObjectId;
  users: User[];
  lastModified: Date;
};

export type UserDocument = {
  _id: ObjectId;
  username: string;
  password: string;
};

export type MessageDocument = {
  _id: ObjectId;
  cid: ObjectId; //change to chatId
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

//Responses
export type getChatsResponse = {
  chats: Chat[];
};

export type sendMessageResponse = {
  chatId: string;
  message: Message;
  tempMessageId: string;
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
};

export type loginResponse = {
  userId: ObjectId;
  token: string; //JWT
};

export type signupResponse = {
  userId: ObjectId;
  token: string; //JWT
};

export type errorResponse = {
  message: string;
};
