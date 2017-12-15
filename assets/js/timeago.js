/**
 * Copyright (c) 2016 hustcc
 * License: MIT
 * Version: %%GULP_INJECT_VERSION%%
 * https://github.com/hustcc/timeago.js
**/
/* jshint expr: true */
this.timeAgo = (() => {
  const timers = new Map() // real-time render timers
  const indexMapEn = 'second_minute_hour_day_week_month_year'.split('_')
  const indexMapZh = '秒_分钟_小时_天_周_月_年'.split('_')
    // build-in locales: en & zh_CN
  const locales = {
    en (number, index) {
      if (index === 0) return ['just now', 'right now']
      var unit = indexMapEn[parseInt(index / 2)]
      if (number > 1) unit += 's'
      return [number + ' ' + unit + ' ago', 'in ' + number + ' ' + unit]
    },
    zh_CN (number, index) {
      if (index === 0) return ['刚刚', '片刻后']
      const unit = indexMapZh[parseInt(index / 2)]
      return [number + unit + '前', number + unit + '后']
    }
  }

  // second, minute, hour, day, week, month, year(365 days)
  const SEC_ARRAY = [60, 60, 24, 7, 365 / 7 / 12, 12]
  const SEC_ARRAY_LEN = 6
  // ATTR_DATETIME = 'datetime'
  const ATTR_DATA_TID = 'data-tid'

  // format Date / string / timestamp to Date instance.
  const toDate = input => {
    if (input instanceof Date) return input
    if (!isNaN(input)) return new Date(parseInt(input))
    if (/^\d+$/.test(input)) return new Date(parseInt(input))
    input = (input || '').trim().replace(/\.\d+/, '') // remove milliseconds
      .replace(/-/, '/').replace(/-/, '/')
      .replace(/(\d)T(\d)/, '$1 $2').replace(/Z/, ' UTC') // 2017-2-5T3:57:52Z -> 2017-2-5 3:57:52UTC
      .replace(/([+-]\d\d):?(\d\d)/, ' $1$2') // -04:00 -> -0400
    return new Date(input)
  }
  // format the diff second to *** time ago, with setting locale
  function formatDiff (diff, locale, defaultLocale) {
    // if locale is not exist, use defaultLocale.
    // if defaultLocale is not exist, use build-in `en`.
    // be sure of no error when locale is not exist.
    locale = locales[locale] ? locale : (locales[defaultLocale] ? defaultLocale : 'en')

    const agoin = diff < 0 ? 1 : 0 // timein or timeago
    const totalSec = diff = Math.abs(diff)

    let i = 0
    while (diff >= SEC_ARRAY[i] && i < SEC_ARRAY_LEN) {
      diff /= SEC_ARRAY[i]
      i++
    }
    diff = parseInt(diff)
    i *= 2

    if (diff > (i === 0 ? 9 : 1)) i += 1
    return locales[locale](diff, i, totalSec)[agoin].replace('%s', diff)
  }
  // calculate the diff second between date to be formated an now date.
  function diffSec (date, nowDate) {
    nowDate = nowDate ? toDate(nowDate) : new Date()
    return (nowDate - toDate(date)) / 1000
  }
  /**
   * nextInterval: calculate the next interval time.
   * - diff: the diff sec between now and date to be formated.
   *
   * What's the meaning?
   * diff = 61 then return 59
   * diff = 3601 (an hour + 1 second), then return 3599
   * make the interval with high performace.
  **/
  const nextInterval = diff => {
    let d = Math.abs(diff)
    let rst = 1
    let i = 0
    while (diff >= SEC_ARRAY[i] && i < SEC_ARRAY_LEN) {
      diff /= SEC_ARRAY[i]
      rst *= SEC_ARRAY[i]
      i++
    }
    // return leftSec(d, rst);
    d = d % rst
    d = d ? rst - d : rst
    return Math.ceil(d)
  }
  // get the node attribute, native DOM and jquery supported.
  const getAttr = (node, name) => node.getAttribute(name)
  // get the datetime attribute, `data-timeagp` / `datetime` are supported.
  const getDateAttr = node => getAttr(node, 'data-timeago') || getAttr(node, 'datetime')
  // set the node attribute, native DOM and jquery supported.
  const setTidAttr = (node, val) => node.setAttribute(ATTR_DATA_TID, val)
  /**
   * timeago: the function to get `timeago` instance.
   * - nowDate: the relative date, default is new Date().
   * - defaultLocale: the default locale, default is en. if your set it, then the `locale` parameter of format is not needed of you.
   *
   * How to use it?
   * var timeagoLib = require('timeago.js');
   * var timeago = timeagoLib(); // all use default.
   * var timeago = timeagoLib('2016-09-10'); // the relative date is 2016-09-10, so the 2016-09-11 will be 1 day ago.
   * var timeago = timeagoLib(null, 'zh_CN'); // set default locale is `zh_CN`.
   * var timeago = timeagoLib('2016-09-10', 'zh_CN'); // the relative date is 2016-09-10, and locale is zh_CN, so the 2016-09-11 will be 1天前.
  **/
  const Timeago = (nowDate, defaultLocale = 'en', methods = {
    // what the timer will do
    doRender (node, date, locale) {
      var diff = diffSec(date, nowDate)
      // delete previously assigned timeout's id to node
      node.textContent = formatDiff(diff, locale, defaultLocale)
      // waiting %s seconds, do the next render
      let tid = setTimeout(() => {
        methods.doRender(node, date, locale)
        timers.delete(tid)
      },
        Math.min(nextInterval(diff) * 1000, 0x7FFFFFFF)
      )
      timers.set(tid, 0)
      // set attribute date-tid
      setTidAttr(node, tid)
    },
    /**
     * format: format the date to *** time ago, with setting or default locale
     * - date: the date / string / timestamp to be formated
     * - locale: the formated string's locale name, e.g. en / zh_CN
     *
     * How to use it?
     * var timeago = require('timeago.js')();
     * timeago.format(new Date(), 'pl'); // Date instance
     * timeago.format('2016-09-10', 'fr'); // formated date string
     * timeago.format(1473473400269); // timestamp with ms
    **/
    format: (date, locale) => formatDiff(diffSec(date, nowDate), locale, defaultLocale),
    /**
     * render: render the DOM real-time.
     * - nodes: which nodes will be rendered.
     * - locale: the locale name used to format date.
     *
     * How to use it?
     * var timeago = require('timeago.js')();
     * // 1. javascript selector
     * timeago.render(document.querySelectorAll('.need_to_be_rendered'));
     * // 2. use jQuery selector
     * timeago.render($('.need_to_be_rendered'), 'pl');
     *
     * Notice: please be sure the dom has attribute `datetime`.
    **/
    render (nodes, locale) {
      if (nodes.length === undefined) nodes = [nodes]
      for (const node of nodes) {
        // render item
        methods.doRender(node, getDateAttr(node), locale)
      }
    },
    /**
     * setLocale: set the default locale name.
     *
     * How to use it?
     * var timeago = require('timeago.js')();
     * timeago.setLocale('fr');
    **/
    setLocale (locale) { defaultLocale = locale }
  }) => methods
  /**
   * register: register a new language locale
   * - locale: locale name, e.g. en / zh_CN, notice the standard.
   * - localeFunc: the locale process function
   *
   * How to use it?
   * var timeagoFactory = require('timeago.js');
   *
   * timeagoFactory.register('the locale name', the_locale_func);
   * // or
   * timeagoFactory.register('pl', require('timeago.js/locales/pl'));
   **/
  Timeago.register = (locale, fn) => { locales[locale] = fn }
  /**
   * cancel: cancels one or all the timers which are doing real-time render.
   *
   * How to use it?
   * For canceling all the timers:
   * var timeagoFactory = require('timeago.js');
   * var timeago = timeagoFactory();
   * timeago.render(document.querySelectorAll('.need_to_be_rendered'));
   * timeagoFactory.cancel(); // will stop all the timers, stop render in real time.
   *
   * For canceling single timer on specific node:
   * var timeagoFactory = require('timeago.js');
   * var timeago = timeagoFactory();
   * var nodes = document.querySelectorAll('.need_to_be_rendered');
   * timeago.render(nodes);
   * timeagoFactory.cancel(nodes[0]); // will clear a timer attached to the first node, stop render in real time.
   **/
  Timeago.cancel = node => {
    if (node) {
      var tid = getAttr(node, ATTR_DATA_TID)
      if (tid) {
        clearTimeout(tid)
        timers.delete(tid)
      }
    } else {
      timers.forEach(clearTimeout)
      timers.clear()
    }
  }

  return Timeago
})()
