import { ObjectId } from 'mongodb';
import { chats, users } from './connect.mjs';
import bcrypt from 'bcrypt';

export async function getChats(uid) {
   const userChats = await chats.find({ "users.uid": uid });
   return userChats.toArray();
}

export async function sendMessage(uid, cid, message) {
   chats.updateOne (
      { "_id": new ObjectId(`${cid}`) },
      {
         $push: { "messages": { "from": uid, "text": message, "sendTime": new Date().toISOString() } },
         $currentDate: { lastModified: true }
      }
   );
}

export async function findUser(username) {
   const user = await users.findOne({ username });
   return user
}

export async function createUser(username, password) {
   const user = await users.findOne({ username });
   if (user) {return { status: 'error', uid: 0 }}

   const hashedPassword = await bcrypt.hash(password, 10)
   const { insertedId } = await users.insertOne ({
      username,
      password: hashedPassword
   });
   return { status: 'success', uid: insertedId.toString() };
}

export async function createChat(creatingUID, receivingUsername) {
   const creatingUser = await users.findOne({ _id: new ObjectId(creatingUID) });
   const receivingUser = await users.findOne({ username: receivingUsername });
   if(!creatingUser || !receivingUser) return {};

   const { insertedId } = await chats.insertOne ({
      users: [{ 
         uid: creatingUser._id,
         username: creatingUser.username
      },
      { 
         uid: receivingUser._id,
         username: receivingUser.username 
      }],
      messages: [],
      $currentDate: { lastModified: true }
   });
   return await chats.findOne({ _id: insertedId });
}
