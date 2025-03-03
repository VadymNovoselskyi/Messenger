import { ObjectId } from "mongodb";
import { chats, users, messages } from "./connect.mjs";
import bcrypt from "bcrypt";

const INIT_CHATS = 10;
const INIT_MESSAGES = 40;
const EXTRA_MESSAGES = 60;

export async function getChats(uid) {
  try {
    let userChats = await chats
      .find({ "users._id": new ObjectId(uid) })
      .sort({ lastModified: -1 })
      .limit(INIT_CHATS)
      .toArray();

    userChats = await Promise.all(
      userChats.map(async chat => {
        const lastSeen = chat.users.find(
          user => user._id.toString() === uid
        ).lastSeen;
        const unreadCount = await messages.countDocuments({
          cid: chat._id,
          sendTime: { $gt: lastSeen },
        });

        const unreadSkip =
          unreadCount > INIT_MESSAGES
            ? unreadCount - INIT_MESSAGES
            : 0;
        const chatMessages = await messages
          .find({ cid: chat._id })
          .sort({ sendTime: -1 })
          .skip(unreadSkip)
          .limit(INIT_MESSAGES + Math.min(unreadCount, INIT_MESSAGES))
          .toArray();

        chat.messages = chatMessages.reverse();
        chat.unreadCount = unreadCount;
        chat.receivedUnreadCount = Math.min(
          unreadCount,
          INIT_MESSAGES
        );
        return chat;
      })
    );

    return userChats;
  } catch (error) {
    throw new Error(
      `Error fetching chats for user ID ${uid}: ${error.message}`
    );
  }
}

export async function getExtraMessages(cid, currentIndex) {
  try {
    const extraMessages = await messages
      .find({ cid: new ObjectId(cid) })
      .sort({ sendTime: -1 })
      .skip(currentIndex)
      .limit(EXTRA_MESSAGES)
      .toArray();
    return extraMessages.reverse();
  } catch (error) {
    throw new Error(
      `Error getting extra messages in chat ID ${cid}: ${error.message}`
    );
  }
}

export async function getExtraNewMessages(cid, unreadCount) {
  try {
    const unreadSkip =
      unreadCount > EXTRA_MESSAGES
        ? unreadCount - EXTRA_MESSAGES
        : 0;

    const extraNewMessages = await messages
      .find({ cid: new ObjectId(cid) })
      .sort({ sendTime: -1 })
      .skip(unreadSkip)
      .limit(Math.min(unreadCount, EXTRA_MESSAGES))
      .toArray();
    return extraNewMessages.reverse();
  } catch (error) {
    throw new Error(
      `Error getting new messages in chat ID ${cid}: ${error.message}`
    );
  }
}

export async function readUpdate(uid, cid, mid) {
  try {
    const lastSeen = await messages.find({ _id: new ObjectId(mid) }).sendTime;
    console.log(lastSeen); 
    const { modifiedCount } = await chats.updateOne(
      { _id: new ObjectId(cid) },
      { $set: { "users.$[user].lastSeen": lastSeen } },
      { arrayFilters: [{ "user._id": new ObjectId(uid) }] }
    );

    if (modifiedCount !== 1) {
      throw new Error(
        `Failed to update readTime in chat ID ${cid}`);
    }
    return lastSeen;
  } catch (error) {
    throw new Error(`Error update readTime in chat ID ${cid}: ${error.message}`)
  }
}

export async function sendMessage(uid, cid, message) {
  try {
    const { acknowledged, insertedId } = await messages.insertOne({
      cid: new ObjectId(cid),
      from: new ObjectId(uid),
      text: message,
      sendTime: new Date(),
    });
    const { modifiedCount } = await chats.updateOne(
      { _id: new ObjectId(cid) },
      {
        $set: { lastModified: new Date() },
      }
    );

    if (!acknowledged || !insertedId || modifiedCount !== 1) {
      throw new Error(
        `Failed to send message in chat ID ${cid}. 
              acknowledged: ${acknowledged}, 
              insertedId: ${insertedId}, 
              modifiedCount: ${result.modifiedCount}`
      );
    }

    const chat = await chats.findOne({ _id: new ObjectId(cid) });
    const receivingUID = chat.users.find(
      user => user._id.toString() !== uid
    )._id;
    const sentMessage = await messages.findOne({ _id: insertedId });
    return {
      message: sentMessage,
      receivingUID,
    };
  } catch (error) {
    throw new Error(
      `Error sending message in chat ID ${cid}: ${error.message}`
    );
  }
}

export async function findUser(username) {
  try {
    const user = await users.findOne({ username });
    if (!user) {
      throw new Error(`User with username "${username}" not found.`);
    }
    return user;
  } catch (error) {
    throw new Error(
      `Error finding user with username "${username}": ${error.message}`
    );
  }
}

export async function createUser(username, password) {
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
    throw new Error(`Error creating user "${username}": ${error.message}`);
  }
}

export async function createChat(creatingUID, receivingUsername) {
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
        { _id: creatingUser._id, username: creatingUser.username },
        { _id: receivingUser._id, username: receivingUser.username },
      ],
      lastModified: new Date(),
    });

    if (!result.acknowledged || !result.insertedId) {
      throw new Error(
        "Failed to create chat. Insert operation was not acknowledged."
      );
    }

    const createdChat = await chats.findOne({ _id: result.insertedId });
    if (!createdChat) {
      throw new Error("Failed to retrieve the newly created chat.");
    }
    createdChat.messages = [];

    return { createdChat, receivingUID: receivingUser._id };
  } catch (error) {
    throw new Error(`Error creating chat: ${error.message}`);
  }
}
