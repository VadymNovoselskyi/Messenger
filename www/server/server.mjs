import WebSocket, { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { getChats, sendMessage, findUser, createUser } from './mongodb/api.mjs';

const generateToken = (uid) => {
  return jwt.sign({ uid }, secretKey, { expiresIn: '7d' });
};
const users = {};
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
        ws.isAuthenticated
      }
      else if (api === 'auth') {
        const { token } = payload;

        try {
          const decoded = jwt.verify(token, secretKey);
          const uid = decoded.uid;
          ws.send(JSON.stringify({
            api,
            payload: {
              status: 'success',
              uid,
              token
            }
          }));
        } catch (err) {
          ws.send(JSON.stringify({
            api,
            payload: {
              status: 'error',
              message: 'Invalid Token'
            }
          }));
        }
        ws.isAuthenticated = true;
      }
      else if (ws.isAuthenticated) {
        ws.send(JSON.stringify({ type: 'message', message: 'You are authenticated!' }));
      }
      else {
        ws.send(JSON.stringify({
          api,
          payload: {
            status: 'error',
            message: 'Invalid api call'
          }
        }));
      }
    }
    catch (err) {
      console.log(err);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  });


  // ws.on('message', message => {
  //   console.log(`The message is: ${message}`);
  //   const { api } = JSON.parse(message);

  //   switch (api) {

  //     case "get_chats":
  //       getChats(message.uid).then(chats => {
  //         ws.send(JSON.stringify({
  //           api: 'get_chats',
  //           chats
  //         }));
  //       });
  //       break;

  //     case "send_message":
  //       sendMessage(message.uid, message.cid, message.message)
  //       break;

  //     case "login":
  //       auth();
  //       break;

  //     case "signup":
  //       const id = createUser(message.username, message.password);
  //       const payload = { id, username };
  //       const token = jwt.sign(payload, secretKey, { expiresIn: '28d' });
  //       ws.send(JSON.stringify({
  //         api: "signup",
  //         type: 'auth-t  oken',
  //         token 
  //       }));
  //       break;

  //     default:
  //       console.error(`Unknown api call: ${api}`);
  //   }
  // });

  ws.on('close', () => {
    console.log('Client disconnected');
  });

});