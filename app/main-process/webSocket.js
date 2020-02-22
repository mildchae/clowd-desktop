import WebSocket from 'ws';
import path from 'path';
import fs from 'fs';
import { machineIdSync } from 'node-machine-id';
import { SOCKETSERVER, FOLDERPATH } from '../constants/path';

async function setupSocket(systemVariable, mainwindow) {
  const mid = machineIdSync();
  const ws = new WebSocket(`${SOCKETSERVER}?mid=${mid}`);
  ws.on('open', function open() {
    // ws.send('something')
  });
  ws.on('message', async function incoming(data) {
    const res = JSON.parse(data);
    const date = new Date().valueOf();
    console.log(`type ${typeof res}`);
    console.log(`len: ${res.length}`);
    for (let i = 0; i < res.length; i += 1) {
      fs.writeFile(
        path.join(FOLDERPATH, `${date}-${i}`),
        res.data,
        { encoding: 'base64' },
        () => {
          // console.log('File created');
        }
      );
    }
    const obj = await systemVariable.checkSystemVariable(FOLDERPATH);
    mainwindow.webContents.send('file-update', obj);
  });
  ws.on('ping', function ping(data) {
    console.log(`ping data: ${data}`);
    const obj = {
      capacity: systemVariable.capacity * 1024 ** 3, // byte
      bandwidth: systemVariable.bandwidth
    };
    ws.send(JSON.stringify(obj)); // 정보 실어 보내기
  });

  ws.on('close', (code, reason) => {
    console.log(code);
    console.log(reason);
  });
  return ws;
}

export default setupSocket;
