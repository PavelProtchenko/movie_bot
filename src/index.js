process.env.NTBA_FIX_319 = 1;
const telegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const config = require('./config');
const geolib = require('geolib');
const _ = require('lodash');
const helper = require('./helper');
const keyboard = require('./keyboard');
const kb = require('./keyboard-buttons');
const database = require('../database.json');

helper.logStart()

mongoose.connect(config.DB_URL, {
  promiseLibrary: global.Promise
})
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.log(err))

require('./models/film.model')
require('./models/cinema.model')

const Film = mongoose.model('films')
const Cinema = mongoose.model('cinemas')

//database.films.forEach(f => new Film(f).save().catch(e => console.log(e)))
//database.cinemas.forEach(c => new Cinema(c).save().catch(e => console.log(e)))

//==============================================

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
    case kb.film.comedy:
      sendFilmsByQuery(chatId, {type: 'comedy'})
      break
    case kb.film.action:
      sendFilmsByQuery(chatId, {type: 'action'})
      break
    case kb.film.random:
      sendFilmsByQuery(chatId, {})
      break
    case kb.home.cinemas:
      bot.sendMessage(chatId, `Отправить местоположение`, {
        reply_markup: {
          keyboard: keyboard.cinemas
        }
      })
      break
    case kb.back:
      bot.sendMessage(chatId, `Что хотите посмотреть?`, {
        reply_markup: {keyboard: keyboard.home}
      })
      break
  }
  if (msg.location) {
    console.log(msg.location);
    getCinemasInCoord(chatId, msg.location);
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

bot.onText(/\/f(.+)/, (msg, [source, match]) => {
  const filmUuid = helper.getItemUuid(source)
  const chatId = helper.getChatId(msg)

  Film.findOne({uuid: filmUuid}).then(film => {
    console.log(film);

    const caption = `Название: ${film.name}\nГод: ${film.year}\nРейтинг: ${film.rate}\nДлительность: ${film.length}\nСтрана: ${film.country}`
    bot.sendPhoto(chatId, film.picture, {
      caption: caption,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: 'Добавить в избранное',
              callback_data: film.uuid
            },
            {
              text: 'Показать кинотеатры',
              callback_data: film.uuid
            }
          ],
          [
            {
              text: `Кинопоиск ${film.name}`,
              url: film.link
            }
          ]
        ],
      }
    });
  })
})

//===============================================

function sendFilmsByQuery(chatId, query) {
  Film.find(query).then(films => {
    console.log(films);
    
    const html = films.map((f, i) => {
      return `<b>${i + 1}</b> <i>${f.name}</i> - /f${f.uuid}`
    }).join('\n')

    sendHTML(chatId, html, 'films')
  })
}

function sendHTML(chatId, html, kbName = null) {
  const options = {
    parse_mode: 'HTML'
  }

  if (kbName) {
    options['reply_markup'] = {
      keyboard: keyboard[kbName]
    }
  }

  bot.sendMessage(chatId, html, options)
}

function getCinemasInCoord(chatId, location) {
  Cinema.find({}).then(cinemas => {

    cinemas.forEach(c => {
      c.distance = geolib.getDistance(location, c.location) / 1000
      
    })

    cinemas = _.sortBy(cinemas, 'distance')

    const html = cinemas.map((c, i) => {
      return `<b>${i + 1}</b> ${c.name}. <em>Расстояние</em> - <strong>${c.distance}</strong> km. /c${c.uuid}`
    }).join('\n')

    sendHTML(chatId, html, 'home')
  })
}

