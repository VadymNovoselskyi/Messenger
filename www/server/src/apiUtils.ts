import { ObjectId } from "mongodb";
import { ApiChat, ApiMessage, ApiUser } from "./types/apiTypes.mjs";
import { ChatDocument, MessageDocument, UserDocument } from "./types/mongoTypes.mjs";
import { messagesCollection } from "./mongodb/connect.mjs";

export async function toApiChat(chat: ChatDocument): Promise<ApiChat> {
  const messages = await messagesCollection.find({ chatId: chat._id }).toArray();
  return {
    _id: chat._id.toString(),
    users: chat.users.map(user => toApiUser(user)),
    messages: messages.map(message => toApiMessage(message)),
    messageCounter: chat.messageCounter,
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

export function toApiUser(user: { _id: ObjectId; username: string }): ApiUser {
  return {
    _id: user._id.toString(),
    username: user.username,
  };
}
