import { chats } from './connect.mjs';

export async function getChats(uid) {
   const userChats = await chats.find({ users: uid });
   return userChats.toArray();
}