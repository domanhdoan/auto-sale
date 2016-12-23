'use strict';
const BootBot = require('bootbot');

const bot = new BootBot({
  accessToken: 'EAAZAVL7sm1s8BANL16ziFx5Jo9ubzjmt6GDAUOjauGvNRZABZC7iMki4UncSx3vYvNsgaPy9ZArlnlkVHQtYsuddGZBDSEObk9ZAOADImMcfCUN4tf7yYQuyc0xg302FhmXCWohhle3lgpI5mzLZAdXzzXxD7hvRjIFY0EHZAQpbigZDZD',
  verifyToken: 'verify_me',
  appSecret: 'FB_APP_SECRET'
});

bot.on('message', (payload, chat) => {
  const text = payload.message.text;
  chat.say(`Echo: ${text}`);
});

bot.start();
