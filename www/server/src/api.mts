import { ObjectId } from "mongodb";
import { chatsCollection, usersCollection, messagesCollection } from "./mongodb/connect.mjs";
import bcrypt from "bcrypt";
import {
  Chat,
  ChatDocument,
  Message,
  MessageDocument,
  User,
  UserDocument,
} from "./types/types.mjs";

const INIT_CHATS = 10;
const INIT_MESSAGES = 40;
const EXTRA_MESSAGES = 60;

export async function getChats(userId: ObjectId): Promise<Chat[]> {
  try {
    const chatDocuments: ChatDocument[] = await chatsCollection
      .find({ "users._id": userId })
      .sort({ lastModified: -1 })
      .limit(INIT_CHATS)
      .toArray();

    const chats: Chat[] = await Promise.all(
      chatDocuments.map(async (chatDocument: ChatDocument) => {
        const { lastSeen } = chatDocument.users.find((user: User) => user._id.equals(userId))!;

        const unreadCount = await messagesCollection.countDocuments({
          cid: chatDocument._id,
          from: { $ne: userId },
          sendTime: { $gt: lastSeen },
        });

        const unreadSkip = Math.max(unreadCount - INIT_MESSAGES, 0);

        const messages = await messagesCollection
          .find({ cid: chatDocument._id })
          .sort({ sendTime: -1 })
          .skip(unreadSkip)
          .limit(INIT_MESSAGES + Math.min(unreadCount, INIT_MESSAGES))
          .toArray();

        const chat: Chat = {
          _id: chatDocument._id,
          users: chatDocument.users,
          messages: messages.reverse(),
          latestMessages: [],
          unreadCount,
          receivedUnreadCount: Math.min(unreadCount, INIT_MESSAGES),
          receivedNewCount: 0,
          lastModified: chatDocument.lastModified,
        };
        return chat;
      })
    );

    return chats;
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    throw new Error(`Error fetching chats for user ID ${userId}: ${message}`);
  }
}

export async function sendMessage(
  userId: ObjectId,
  chatId: ObjectId,
  message: string
): Promise<{ message: Message; receivingUserId: ObjectId }> {
  try {
    const { acknowledged, insertedId } = await messagesCollection.insertOne({
      cid: chatId,
      from: userId,
      text: message,
      sendTime: new Date(),
    });
    const { modifiedCount } = await chatsCollection.updateOne(
      { _id: chatId },
      {
        $set: { lastModified: new Date() },
      }
    );

    if (!acknowledged || !insertedId || modifiedCount !== 1) {
      throw new Error(
        `Failed to send message in chat ID ${chatId}. 
              acknowledged: ${acknowledged}, 
              insertedId: ${insertedId}, 
              modifiedCount: ${modifiedCount}`
      );
    }

    const chat = await chatsCollection.findOne({ _id: chatId });
    if (!chat) throw new Error(`Couldnt find chat with chatId ${chatId}`);

    const receivingUserId = chat.users.find((user: User) => !user._id.equals(userId))!._id;
    const sentMessage: MessageDocument | null = await messagesCollection.findOne({
      _id: insertedId,
    });
    if (!sentMessage)
      throw new Error(`Couldnt find inserted message: ${message} for chatId: ${chatId}`);
    return {
      message: sentMessage,
      receivingUserId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    throw new Error(`Error sending message in chat ID ${chatId}: ${message}`);
  }
}

export async function readUpdate(
  userId: ObjectId,
  chatId: ObjectId,
  messageId: ObjectId
): Promise<{ sendTime: Date; receivingUserId: ObjectId }> {
  try {
    const message = await messagesCollection.findOne({ _id: messageId });
    if (!message) throw new Error(`Didnt find message ${messageId}`);

    const { sendTime } = message;
    await chatsCollection.updateOne(
      { _id: chatId },
      { $set: { "users.$[user].lastSeen": sendTime } },
      { arrayFilters: [{ "user._id": userId }] }
    );

    const chat = await chatsCollection.findOne({ _id: chatId });
    if (!chat) throw new Error(`Couldnt find chat for chatId ${chatId}`);

    const receivingUserId = chat.users.find((user: User) => !user._id.equals(userId))!._id;
    return { sendTime, receivingUserId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    throw new Error(`Error update readTime in chat ID ${chatId}: ${message}`);
  }
}

export async function getExtraMessages(chatId: ObjectId, currentIndex: number): Promise<Message[]> {
  try {
    const extraMessages = await messagesCollection
      .find({ cid: chatId })
      .sort({ sendTime: -1 })
      .skip(currentIndex)
      .limit(EXTRA_MESSAGES)
      .toArray();
    return extraMessages.reverse();
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    throw new Error(`Error getting extra messages in chat ID ${chatId}: ${message}`);
  }
}

export async function getExtraNewMessages(
  chatId: ObjectId,
  unreadCount: number
): Promise<Message[]> {
  try {
    const unreadSkip = Math.max(unreadCount - EXTRA_MESSAGES, 0);
    const extraNewMessages = await messagesCollection
      .find({ cid: chatId })
      .sort({ sendTime: -1 })
      .skip(unreadSkip)
      .limit(Math.min(unreadCount, EXTRA_MESSAGES))
      .toArray();
    return extraNewMessages.reverse();
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    throw new Error(`Error getting new messages in chat ID ${chatId}: ${message}`);
  }
}

export async function readAll(chatId: ObjectId, userId: ObjectId): Promise<void> {
  try {
    const lastMessage: Message[] = await messagesCollection
      .find({ cid: chatId })
      .sort({ sendTime: -1 })
      .limit(1)
      .toArray();
    
      const { sendTime } = lastMessage[0];
      await chatsCollection.updateOne(
        { _id: chatId },
        { $set: { "users.$[user].lastSeen": sendTime } },
        { arrayFilters: [{ "user._id": userId }] }
      );
      return
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    throw new Error(`Error readingAll: ${message}`);
  }
}

export async function createChat(
  creatingUID: ObjectId,
  receivingUsername: string
): Promise<{
  createdChat: Chat;
  receivingUserId: ObjectId;
}> {
  try {
    const creatingUser = await usersCollection.findOne({
      _id: creatingUID,
    });
    const receivingUser = await usersCollection.findOne({
      username: receivingUsername,
    });

    if (!creatingUser || !receivingUser) {
      throw new Error(`Receiving user "${receivingUsername}" not found.`);
    }

    const presentChat = await chatsCollection.findOne({
      users: {
        $all: [
          { $elemMatch: { username: creatingUser.username } },
          { $elemMatch: { username: receivingUser.username } },
        ],
      },
    });

    if (presentChat) {
      throw new Error(
        `Chat between "${creatingUser.username}" and "${receivingUser.username}" already exists.`
      );
    }

    const result = await chatsCollection.insertOne({
      users: [
        {
          _id: creatingUser._id,
          username: creatingUser.username,
          lastSeen: new Date(),
        },
        {
          _id: receivingUser._id,
          username: receivingUser.username,
          lastSeen: new Date(),
        },
      ],
      lastModified: new Date(),
    });

    if (!result.acknowledged || !result.insertedId) {
      throw new Error("Failed to create chat. Insert operation was not acknowledged.");
    }

    const createdChatDocument: ChatDocument | null = await chatsCollection.findOne({
      _id: result.insertedId,
    });
    if (!createdChatDocument) {
      throw new Error("Failed to retrieve the newly created chat.");
    }
    const createdChat: Chat = {
      _id: createdChatDocument._id,
      users: createdChatDocument.users,
      messages: [],
      latestMessages: [],
      unreadCount: 0,
      receivedUnreadCount: 0,
      receivedNewCount: 0,
      lastModified: createdChatDocument.lastModified,
    };
    return { createdChat, receivingUserId: receivingUser._id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    throw new Error(`Error creating chat: ${message}`);
  }
}

export async function createUser(username: string, password: string): Promise<ObjectId> {
  try {
    const existingUser = await usersCollection.findOne({ username });
    if (existingUser) {
      throw new Error(`User with username "${username}" already exists.`);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const { insertedId } = await usersCollection.insertOne({
      username,
      password: hashedPassword,
    });

    return insertedId;
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    throw new Error(`Error creating user "${username}": ${message}`);
  }
}

export async function findUser(username: string): Promise<UserDocument> {
  try {
    const user = await usersCollection.findOne({ username });
    if (!user) {
      throw new Error(`User with username "${username}" not found.`);
    }
    return user;
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    throw new Error(`Error finding user with username "${username}": ${message}`);
  }
}
