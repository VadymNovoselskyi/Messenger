import { MongoClient } from 'mongodb';


const client = new MongoClient("mongodb://root:12345@mongodb");
await client.connect();
const db = client.db('messenger');

console.log('HI')
const chats = db.collection('chats');

const userChats = chats.find({ users: uid });
console.log(userChats.toArray());


// await db.chats.updateOne(
//     { cid: '675970ff84e74a05569eac55' },
//     { 
//        $push: { messages: { from: 'me', text: 'test first', sendTime: new Date().toISOString() } },
//        $currentDate: { lastModified: true }
//     }
//  );

// console.log('Done')