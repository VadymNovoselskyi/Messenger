import { ObjectId } from 'mongodb';
import { chats, users } from './connect.mjs';
import bcrypt from 'bcrypt';

export async function getChats(uid) {
  try {
    const userChats = await chats.find({ "users.uid": new ObjectId(uid) });
    return userChats.toArray();
  } catch (error) {
    throw new Error(`Error fetching chats for user ID ${uid}: ${error.message}`);
  }
}

export async function sendMessage(uid, cid, message) {
  try {
    const result = await chats.updateOne(
      { "_id": new ObjectId(`${cid}`) },
      {
        $push: { "messages": { "from": uid, "text": message, "sendTime": new Date() } },
        $currentDate: { lastModified: true }
      }
    );
    if (result.modifiedCount === 0) {
      throw new Error(`Failed to send message in chat ID ${cid}.`);
    }
  } catch (error) {
    throw new Error(`Error sending message in chat ID ${cid}: ${error.message}`);
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
    throw new Error(`Error finding user with username "${username}": ${error.message}`);
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
      password: hashedPassword
    });

    return insertedId;
  } catch (error) {
    throw new Error(`Error creating user "${username}": ${error.message}`);
  }
}

export async function createChat(creatingUID, receivingUsername) {
  try {
    const creatingUser = await users.findOne({ _id: new ObjectId(creatingUID) });
    const receivingUser = await users.findOne({ username: receivingUsername });

    if (!creatingUser || !receivingUser) {
      throw new Error(`Receiving user "${receivingUsername}" not found.`);
    }

    const presentChat = await chats.findOne({
      users: {
        $all: [
          { $elemMatch: { username: creatingUser.username } },
          { $elemMatch: { username: receivingUser.username } }
        ]
      }
    });

    if (presentChat) {
      throw new Error(`Chat between "${creatingUser.username}" and "${receivingUser.username}"   already exists.`);
    }

    const result = await chats.insertOne({
      users: [
        { uid: creatingUser._id, username: creatingUser.username },
        { uid: receivingUser._id, username: receivingUser.username }
      ],
      messages: [],
      lastModified: new Date()
    });
    
    if (!result.acknowledged || !result.insertedId) {
      throw new Error("Failed to create chat. Insert operation was not acknowledged.");
    }
    
    const createdChat = await chats.findOne({ _id: result.insertedId });
    if (!createdChat) {
      throw new Error("Failed to retrieve the newly created chat.");
    }
    
    return createdChat;
  } catch (error) {
    throw new Error(`Error creating chat: ${error.message}`);
  }
}
