import WebSocket, { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { getChats, getExtraMessages, sendMessage, findUser, createUser, createChat } from './mongodb/api.mjs';

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
          status: 'success',
          payload: {
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
            status: 'error',
            payload: {
              message: 'Invalid password'
            }
          }));
        }

        const token = generateToken(user._id.toString());
        ws.send(JSON.stringify({
          api,
          status: 'success',
          payload: {
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
            status: 'error',
            payload: {
              message: 'Invalid Token. Login again'
            }
          }));
        }
      }
    } catch (error) {
      ws.send(JSON.stringify({
        status: "error",
        payload: {
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
            status: 'success',
            payload: {
              chats
            }
          }));
          break;

        case "send_message": {
          const { tempMID } = payload;
          const { message, receivingUID } = await sendMessage(uid, payload.cid, payload.message);
          if (onlineUsers[receivingUID.toString()]) {
            onlineUsers[receivingUID.toString()].send(JSON.stringify({
              api: 'receive_message',
              status: 'success',
              payload: {
                cid: payload.cid,
                message
              }
            }));
          };
          ws.send(JSON.stringify({
            api: 'receive_message',
            status: 'success',
            payload: {
              cid: payload.cid,
              message,
              tempMID
            }
          }));
          break;
        }

        case "extra_messages":
          const { cid, currentIndex } = payload;
          const extraMessages = await getExtraMessages(cid, currentIndex)

          ws.send(JSON.stringify({
            api: 'extra_messages',
            status: 'success',
            payload: {
              cid,
              extraMessages
            }
          }));
          break;

        case "create_chat":
          const { createdChat, receivingUID } = await createChat(uid, payload.username);
          ws.send(JSON.stringify({
            api: 'create_chat',
            status: 'success',
            payload: {
              createdChat
            }
          }));

          if (onlineUsers[receivingUID.toString()]) {
            onlineUsers[receivingUID.toString()].send(JSON.stringify({
              api: 'create_chat',
              status: 'success',
              payload: {
                createdChat
              }
            }));
          };
          break;

        default:
          console.error(`Unknown api call: ${api}`);
          ws.send(JSON.stringify({
            api,
            status: 'error',
            payload: {
              message: 'Invalid api call'
            }
          }));
      }
    } catch (error) {
      throw error;
    }
  }

  ws.on('close', () => {
    if (onlineUsers[ws.uid]) delete onlineUsers[ws.uid];
    console.log('Client disconnected', Object.keys(onlineUsers));
  });

});