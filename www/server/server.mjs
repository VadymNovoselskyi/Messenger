import WebSocket, { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { getChats, sendMessage, findUser, createUser, createChat } from './mongodb/api.mjs';

const secretKey = 'y8q6GA@0md8ySuNk';
const generateToken = (uid) => {
  return jwt.sign({ uid }, secretKey, { expiresIn: '7d' });
};

const onlineUsers = {};

const wss = new WebSocketServer({ port: 5000 });
wss.on('connection', ws => {
  console.log('Client connected');
  ws.isAuthenticated = false;

  ws.on('message', async (message) => {
    console.log(`The message is: ${message}`);
    try {
      const { api, payload } = JSON.parse(message);

      if (api === 'signup') {
        const { username, password } = payload;
        const uid = await createUser(username, password);
        const token = generateToken(uid.toString());
        ws.send(JSON.stringify({
          api,
          payload: {
            status: 'success',
            uid,
            token
          }
        }));
        ws.isAuthenticated = true;
        ws.uid = uid.toString();
        onlineUsers[ws.uid] = ws;
      }

      else if (api === 'login') {
        const { username, password } = payload;

        const user = await findUser(username);
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
          return ws.send(JSON.stringify({
            api,
            payload: {
              status: 'error',
              message: 'Invalid password'
            }
          }));
        }

        const token = generateToken(user._id.toString());
        ws.send(JSON.stringify({
          api,
          payload: {
            status: 'success',
            uid: user._id,
            token
          }
        }));
        ws.isAuthenticated = true;
        ws.uid = user._id.toString();
        onlineUsers[ws.uid] = ws;
      }
      else if (ws.isAuthenticated) {
        await handleAuthenticatedCall(api, payload, ws.uid);
      }
      else {
        const { token } = JSON.parse(message);

        try {
          const decoded = jwt.verify(token, secretKey);
          const uid = decoded.uid;
          ws.isAuthenticated = true;
          ws.uid = uid;
          onlineUsers[ws.uid] = ws;

          await handleAuthenticatedCall(api, payload, uid);
        } catch (err) {
          console.log(err)
          ws.send(JSON.stringify({
            api,
            payload: {
              status: 'error',
              message: 'Invalid Token. Login again'
            }
          }));
        }
      }
    } catch (error) {
      ws.send(JSON.stringify({
        payload: {
          status: "error",
          message: error.message
        }
      }));
    }
  });

  async function handleAuthenticatedCall(api, payload, uid) {
    try {
      switch (api) {
        case "get_chats":
          const chats = await getChats(uid);

          ws.send(JSON.stringify({
            api: 'get_chats',
            payload: {
              status: 'success',
              chats
            }
          }));
          break;
  
        case "send_message":
          const receivingUID = await sendMessage(uid, payload.cid, payload.message);
          if(!onlineUsers[receivingUID.toString()]) return;
          console.log("Receiver found:", receivingUID.toString(), uid);

          onlineUsers[receivingUID.toString()].send(JSON.stringify({
            api: 'receive_message',
            payload: {
              status: 'success',
              cid: payload.cid,
              message: payload.message
            }
          }));
          break;
  
        case "create_chat":
          const createdChat = await createChat(uid, payload.username);
          ws.send(JSON.stringify({
            api: 'create_chat',
            payload: {
              status: 'success',
              createdChat
            }
          }));
          break;
  
        default:
          console.error(`Unknown api call: ${api}`);
          ws.send(JSON.stringify({
            api,
            payload: {
              status: 'error',
              message: 'Invalid api call'
            }
          }));
      }
    } catch (error) {
      throw error;
    }
  }

  ws.on('close', () => {
    console.log('Client disconnected');
  });

});