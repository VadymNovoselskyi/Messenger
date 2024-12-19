import { ObjectId } from 'mongodb';
import { chats } from './connect.mjs';

export async function getChats(uid) {
   const userChats = await chats.find({ users: uid });
   return userChats.toArray();
}

export async function sendMessage(uid, cid, message) {
   chats.updateOne(
      { "_id": new ObjectId(`${cid}`) },
      {
         $push: { "messages": { "from": uid, "text": message, "sendTime": new Date().toISOString() } },
         $currentDate: { lastModified: true }
      }
   );
}