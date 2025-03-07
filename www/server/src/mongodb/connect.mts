import { MongoClient, Db, Collection } from "mongodb";

const client = new MongoClient("mongodb://root:12345@mongodb");

await client.connect();

const db: Db = client.db("messenger");

export const chats: Collection = db.collection("chats");
export const users: Collection = db.collection("users");
export const messages: Collection = db.collection("messages");
