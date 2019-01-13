process.env.NTBA_FIX_319 = 1;
const telegramBot = require('node-telegram-bot-api');
const config = require('./config');
const helper = require('./helper');
const keyboard = require('./keyboard');
const kb = require('./keyboard-buttons');

helper.logStart()

const bot = new telegramBot(config.TOKEN, {
  polling: true
});

bot.on('message', msg => {
  console.log('Working', msg.from.first_name)

  const chatId = helper.getChatId(msg);

  switch (msg.text) {
    case kb.home.favourite:
      break
    case kb.home.films:
      bot.sendMessage(chatId, `Выберите жанр`, {
        reply_markup: {keyboard: keyboard.films}
      })
      break
    case kb.home.cinemas:
      break
    case kb.back:
      bot.sendMessage(chatId, `Что хотите посмотреть?`, {
        reply_markup: {keyboard: keyboard.home}
      })
      break
  }
})

bot.onText(/\/start/, msg => {
  const text = `Здравствуйте, ${msg.from.first_name}\nВыберете команду для начала работы:`

  bot.sendMessage(helper.getChatId(msg), text, {
    reply_markup: {
      keyboard: keyboard.home
    }
  })
})
