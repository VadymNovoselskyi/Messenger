import WebSocket, { WebSocketServer } from 'ws';
import { getChats } from './mongodb/api.mjs';

const wss = new WebSocketServer({ port:5000 });

wss.on('connection', ws => {
  console.log('Client connected');

  ws.on('message', data => {
    console.log(`The message is: ${data}`);
    data = JSON.parse(data);

    switch(data.api) {

      case "get_chats":
        getChats(data.uid).then(chats => {
          ws.send(JSON.stringify({
            api: 'get_chats',
            chats
          }));
        }); 
        break;

      default:
        console.error(`Unknown api call: ${data.api}`);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected'); 
  });

});