process.env.NTBA_FIX_319 = 1;
const telegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const config = require('./config');
const geolib = require('geolib');
const { __ } = require('i18n');
const _ = require('lodash');
const helper = require('./helper');
const keyboard = require('./keyboard');
const kb = require('./keyboard-buttons');
const database = require('../database.json');
const localeService = require('./services/localeService');

helper.logStart()

mongoose.connect(config.DB_URL, {
  promiseLibrary: global.Promise
})
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.log(err))

require('./models/film.model')
require('./models/cinema.model')
require('./models/user.model')

const Film = mongoose.model('films')
const Cinema = mongoose.model('cinemas')
const User = mongoose.model('users')

// uncomment two lines below to add cinemas and movies to database
// database.films.forEach(f => new Film(f).save().catch(e => console.log(e)))
// database.cinemas.forEach(c => new Cinema(c).save().catch(e => console.log(e)))

const ACTION_TYPE = {
  TOGGLE_FAV_FILM: 'tff',
  SHOW_CINEMAS: 'sc',
  SHOW_CINEMAS_MAP: 'scm',
  SHOW_FILMS: 'sf'
}

//==============================================

const bot = new telegramBot(config.TOKEN, {
  polling: true
});

bot.on('message', msg => {
  console.log('Working', msg.from.first_name, msg.from.last_name)

  if (msg.from.language_code) {
    localeService(msg.from.language_code);

    const chatId = helper.getChatId(msg);

    bot.setMyCommands([
      {command: '/start', description: __('startMsgBtn')},
    ])

    switch (msg.text) {
      case kb.home.favourite:
        showFavouriteFilms(chatId, msg.from.id)
        break
      case kb.home.films:
        console.log(keyboard.films)
        bot.sendMessage(chatId, __('chooseText'), {
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
        bot.sendMessage(chatId, __('sendGeoText'), {
          reply_markup: {
            keyboard: keyboard.cinemas
          }
        })
        break
      case kb.back:
        bot.sendMessage(chatId, __('toWatchText'), {
          reply_markup: {keyboard: keyboard.home}
        })
      break
    }
  }
  if (msg.location) {
    console.log(msg.location);
    getCinemasInCoord(chatId, msg.location);
  }
})

bot.onText(/\/start/, msg => {
  let first_name = msg.from.first_name
  const text = __('helloText', {first_name})

  bot.sendMessage(helper.getChatId(msg), text, {
    reply_markup: {
      keyboard: keyboard.home
    }
  })
})

bot.onText(/\/f(.+)/, (msg, [source, match]) => {
  const filmUuid = helper.getItemUuid(source)
  const chatId = helper.getChatId(msg)

  Promise.all([
    Film.findOne({uuid: filmUuid}),
    User.findOne({telegramId: msg.from.id})
  ]).then(([film, user]) => {
    console.log(film);

    let isFav = false

    if (user) {
      isFav = user.films.indexOf(film.uuid) !== -1
    }

    const favText = isFav ? __('delFavBtn') : __('addFavBtn')

    const caption = `${__('title')}: ${film.name}\n${__('year')}: ${film.year}\n${__('rating')}: ${film.rate}\n${__('duration')}: ${film.length}\n${__('country')}: ${film.country}`
    bot.sendPhoto(chatId, film.picture, {
      caption: caption,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: favText,
              callback_data: JSON.stringify({
                type: ACTION_TYPE.TOGGLE_FAV_FILM,
                filmUuid: film.uuid,
                isFav: isFav
              })
            },
            {
              text: __('showCinemaBtn'),
              callback_data: JSON.stringify({
                type: ACTION_TYPE.SHOW_CINEMAS,
                cinemaUuids: film.cinemas
              })
            }
          ],
          [
            {
              text: `${__('kinopoiskBtn')} ${film.name}`,
              url: film.link
            }
          ]
        ],
      }
    });
  })
})

bot.onText(/\/c(.+)/, (msg, [source, match]) => {
  const cinemaUuid = helper.getItemUuid(source)
  const chatId = helper.getChatId(msg)

  Cinema.findOne({uuid: cinemaUuid}).then(cinema => {
    console.log(cinema);
    bot.sendMessage(chatId, `${__('cinemaText')} ${cinema.name}`, {
      reply_markup: {
        inline_keyboard: [
          [
             {
                text: cinema.name,
                url: cinema.url
             },
             {
                text: __('showOnMapBtn'),
                callback_data: JSON.stringify({
                  type: ACTION_TYPE.SHOW_CINEMAS_MAP,
                  lat: cinema.location.latitude,
                  lon: cinema.location.longitude
                })
             }
          ],
          [
             {
                text: __('showMoviesBtn'),
                callback_data: JSON.stringify({
                  type: ACTION_TYPE.SHOW_FILMS,
                  filmUuids: cinema.films
                })
             }
          ]
        ]
      }
    })
  })
})

bot.on('callback_query', query => {
  const userId = query.from.id
  let data

  try {
    data = JSON.parse(query.data)
  } catch (e) {
    throw new Error('Data is not an object')
  }

  console.log(query.data);
  const { type } = data

  if (type === ACTION_TYPE.SHOW_CINEMAS_MAP) {
    const {lat, lon} = data
    bot.sendLocation(query.message.chat.id, lat, lon)
  } else if (type === ACTION_TYPE.SHOW_CINEMAS) {
    sendCinemasByQuery(userId, {uuid: {'$in': data.cinemaUuids}})
  } else if (type === ACTION_TYPE.TOGGLE_FAV_FILM) {
    toggleFavouriteFilm(userId, query.id, data)
  } else if (type === ACTION_TYPE.SHOW_FILMS) {
    sendFilmsByQuery(userId, {uuid: {'$in': data.filmUuids}})
  }
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
      return `<b>${i + 1}</b> ${c.name}. <em>${__('distance')}</em> - <strong>${c.distance}</strong> ${__('km')}. /c${c.uuid}`
    }).join('\n')

    sendHTML(chatId, html, 'home')
  })
}

function toggleFavouriteFilm(userId, queryId, {filmUuid, isFav}) {

  let userPromise

  User.findOne({telegramId: userId})
    .then(user => {
      if (user) {
        if (isFav) {
          user.films = user.films.filter(fUuid => fUuid !== filmUuid) 
        } else {
          user.films.push(filmUuid)
        }
        userPromise = user
      } else {
        userPromise = new User({
          telegramId: userId,
          films: [filmUuid]
        })
      }

      const answerText = isFav ? __('deleted') : __('added')

      userPromise.save().then(_ => {
        bot.answerCallbackQuery({
          callback_query_id: queryId,
          text: answerText
        })
      }).catch(err => console.log(err))
    }).catch(err => console.log(err))
}

function showFavouriteFilms(chatId, telegramId) {
  User.findOne({telegramId})
    .then(user => {
      if (user) {
        Film.find({uuid: {'$in': user.films}}).then(films => {
          let html
          if (films.length) {
            html = films.map((f, i) => {
              return `<b>${i + 1}</b> ${f.name} - <b>${f.rate}</b> (/f${f.uuid})`
            }).join('\n')
          } else {
            html = __('notAddAnythingText')
          }

          sendHTML(chatId, html, 'home')
        }).catch(err => console.log(err))
      } else {
        sendHTML(chatId, __('notAddAnythingText'), 'home')
      }
    }).catch(err => console.log(err))
}

function sendCinemasByQuery(userId, query) {
  Cinema.find(query).then(cinemas => {
    console.log(cinemas)
    const html = cinemas.map((c, i) => {
      return `<b>${i + 1}</b> ${c.name} - /c${c.uuid}`
    }).join('\n')

    sendHTML(userId, html, 'home')
  })
}
