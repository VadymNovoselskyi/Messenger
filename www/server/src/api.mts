import { ObjectId } from "mongodb";
import { chats, users, messages } from "./mongodb/connect.mjs";
import bcrypt from "bcrypt";

const INIT_CHATS = 10;
const INIT_MESSAGES = 40;
const EXTRA_MESSAGES = 60;

export async function getChats(userId: string) {
  try {
    let userChats = await chats
      .find({ "users._id": new ObjectId(userId) })
      .sort({ lastModified: -1 })
      .limit(INIT_CHATS)
      .toArray();

    userChats = await Promise.all(
      userChats.map(async chat => {
        const { lastSeen } = chat.users.find((user: any) => user._id.toString() === userId);
        
        const unreadCount = await messages.countDocuments({
          cid: chat._id,
          from: { $ne: new ObjectId(userId) },
          sendTime: { $gt: lastSeen },
        });

        const unreadSkip = Math.max(unreadCount - INIT_MESSAGES, 0);

        const chatMessages = await messages
          .find({ cid: new ObjectId(chat._id) })
          .sort({ sendTime: -1 })
          .skip(unreadSkip)
          .limit(INIT_MESSAGES + Math.min(unreadCount, INIT_MESSAGES))
          .toArray();

        chat.messages = chatMessages.reverse();
        chat.unreadCount = unreadCount;
        chat.receivedUnreadCount = Math.min(unreadCount, INIT_MESSAGES);
        chat.receivedNewCount = 0;
        chat.latestMessages = [];
        return chat;
      })
    );

    return userChats;
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    throw new Error(`Error fetching chats for user ID ${userId}: ${message}`);
  }
}

export async function getExtraMessages(chatId: string, currentIndex: number) {
  try {
    const extraMessages = await messages
      .find({ cid: new ObjectId(chatId) })
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

export async function getExtraNewMessages(chatId: string, unreadCount: number) {
  try {
    const unreadSkip = Math.max(unreadCount - EXTRA_MESSAGES, 0);
    const extraNewMessages = await messages
      .find({ cid: new ObjectId(chatId) })
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

export async function readUpdate(userId: string, chatId: string, messageId: string) {
  try {
    const message = await messages.findOne({ _id: new ObjectId(messageId) });
    if (!message) throw new Error(`Didnt find message ${messageId}`);
    const { sendTime } = message;
    await chats.updateOne(
      { _id: new ObjectId(chatId) },
      { $set: { "users.$[user].lastSeen": sendTime } },
      { arrayFilters: [{ "user._id": new ObjectId(userId) }] }
    );

    const chat = await chats.findOne({ _id: new ObjectId(chatId) });
    if (!chat) throw new Error(`Couldnt find chat for chatId ${chatId}`);
    const receivingUID = chat.users
      .find((user: any) => user._id.toString() !== userId)
      ._id.toString();
    return { sendTime, receivingUID };
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    throw new Error(`Error update readTime in chat ID ${chatId}: ${message}`);
  }
}

export async function sendMessage(userId: string, chatId: string, message: string) {
  try {
    const { acknowledged, insertedId } = await messages.insertOne({
      cid: new ObjectId(chatId),
      from: new ObjectId(userId),
      text: message,
      sendTime: new Date(),
    });
    const { modifiedCount } = await chats.updateOne(
      { _id: new ObjectId(chatId) },
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

    const chat = await chats.findOne({ _id: new ObjectId(chatId) });
    if (!chat) throw new Error(`Couldnt find chat with chatId ${chatId}`);
    const receivingUID = chat.users.find((user: any) => user._id.toString() !== userId)._id;
    const sentMessage = await messages.findOne({ _id: insertedId });
    return {
      message: sentMessage,
      receivingUID,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    throw new Error(`Error sending message in chat ID ${chatId}: ${message}`);
  }
}

export async function findUser(username: string) {
  try {
    const user = await users.findOne({ username });
    if (!user) {
      throw new Error(`User with username "${username}" not found.`);
    }
    return user;
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    throw new Error(`Error finding user with username "${username}": ${message}`);
  }
}

export async function createUser(username: string, password: string) {
  try {
    const existingUser = await users.findOne({ username });
    if (existingUser) {
      throw new Error(`User with username "${username}" already exists.`);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const { insertedId } = await users.insertOne({
      username,
      password: hashedPassword,
    });

    return insertedId;
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    throw new Error(`Error creating user "${username}": ${message}`);
  }
}

export async function createChat(creatingUID: string, receivingUsername: string) {
  try {
    const creatingUser = await users.findOne({
      _id: new ObjectId(creatingUID),
    });
    const receivingUser = await users.findOne({
      username: receivingUsername,
    });

    if (!creatingUser || !receivingUser) {
      throw new Error(`Receiving user "${receivingUsername}" not found.`);
    }

    const presentChat = await chats.findOne({
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

    const result = await chats.insertOne({
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

    const createdChat = await chats.findOne({ _id: result.insertedId });
    if (!createdChat) {
      throw new Error("Failed to retrieve the newly created chat.");
    }
    createdChat.messages = [];

    return { createdChat, receivingUID: receivingUser._id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    ("");
    throw new Error(`Error creating chat: ${message}`);
  }
}
