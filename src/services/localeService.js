const path = require('path');
const i18n = require('i18n');

const localeService = (lng) => {
  i18n.configure({
    locales: ['en', 'ru'],
    directory: path.join('src', 'locales'),
    defaultLocale: lng
  })

  i18n.setLocale(lng);
}  

module.exports = localeService
