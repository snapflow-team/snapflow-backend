import { createApp } from './main';

export default async function handler(req, res) {
  const app = await createApp();
  await app.init();

  const server = app.getHttpServer();
  server.emit('request', req, res);
}
