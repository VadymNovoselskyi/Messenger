import WebSocket, { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { getChats, sendMessage, findUser, createUser } from './mongodb/api.mjs';

const generateToken = (uid) => {
  return jwt.sign({ uid }, secretKey, { expiresIn: '7d' });
};
const secretKey = 'y8q6GA@0md8ySuNk';

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
        const { status, uid } = await createUser(username, password);

        if (status === 'error') {
          ws.send(JSON.stringify({
            api,
            payload: {
              status,
              message: "Username already exists"
            }
          }));
          return;
        }

        const token = generateToken(uid);
        ws.send(JSON.stringify({
          api,
          payload: {
            status,
            uid,
            token
          }
        }));
        ws.isAuthenticated = true;
        ws.uid = uid;
      }

      else if (api === 'login') {
        const { username, password } = payload;

        const user = await findUser(username);
        if (!user) {
          return ws.send(JSON.stringify({
            api,
            payload: {
              status: 'error',
              message: 'User not found'
            }
          }));
        }

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

        const token = generateToken(user._id);
        ws.send(JSON.stringify({
          api,
          payload: {
            status: 'success',
            uid: user._id,
            token
          }
        }));
        ws.isAuthenticated;
        ws.uid = user._id;
      }
      else if (!ws.isAuthenticated) {
        const { token } = JSON.parse(message);

        try {
          const decoded = jwt.verify(token, secretKey);
          const uid = decoded.uid;
          ws.isAuthenticated = true;
          ws.uid = uid;

          await handleAuthenticatedCall(api, payload, uid);
        } catch (err) {
          console.log(err)
          ws.send(JSON.stringify({
            api,
            payload: {
              status: 'error',
              message: 'Invalid Token'
            }
          }));
        }
      }
      else {
        console.log(uid)
        await handleAuthenticatedCall(api, payload, uid);
      }
    }
    catch (err) {
      console.log(err);
      ws.send(JSON.stringify({
        api,
        payload: {
          status: 'error',
          message: 'Invalid api call'
        }
      }));
    }
  });

  async function handleAuthenticatedCall(api, payload, uid) {
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
        sendMessage(uid, payload.cid, payload.message);
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
  }

  ws.on('close', () => {
    console.log('Client disconnected');
  });

});