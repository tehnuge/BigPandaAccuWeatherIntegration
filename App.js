'use strict'
const https = require('https');
//Not needed on AWS
// if (process.env.NODE_ENV !== 'production') {
//   require('dotenv').config();
// }

exports.handler = (event, context, callback) => {

  const sendForecast = (date, minTemp, maxTemp, link) => {
    let status = 'warning';
    if (parseInt(minTemp) < 40 || parseInt(maxTemp) > 80) {
      status = 'critical'
    }
    const data = JSON.stringify({
      app_key: process.env.BIGPANDA_APP_KEY,
      host: `AccuWeather`,
      forecastDay: date,
      description: `The temperature will be above ${minTemp} and below ${maxTemp}`,
      status,
      link
    });
    const options = {
      hostname: 'api.bigpanda.io',
      port: 443,
      path: '/data/v2/alerts',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.BIGPANDA_BEARER_AUTH}`,
        'Content-Length': data.length
      }
    }

    const req = https.request(options, res => {
      console.log(`statusCode: ${res.statusCode} date: ${date}`)

      let chunks = [];
      res.on('data', d => {
        chunks.push(d);
      }).on('end', () => {
        chunks = Buffer.concat(chunks).toString();
      })
    });

    req.on('error', error => {
      console.error(error)
    });

    req.write(data);
    req.end();
  }

  const processWeather = (data) => {
    let parsedData = JSON.parse(data)
    if (!parsedData["DailyForecasts"]) {
      console.log('no forecasts')
      return;
    }
    let forecasts = parsedData["DailyForecasts"];
    for (let i = 0; i < forecasts.length; i++) {
      let forecast = forecasts[i];
      let date = forecast["Date"];
      let minTemp = forecast["Temperature"]["Minimum"]["Value"];
      let maxTemp = forecast["Temperature"]["Maximum"]["Value"];
      let link = forecast["Link"];
      sendForecast(date, minTemp, maxTemp, link);
    }
  }

  const getForecasts = (locationKeys) => {
    for (let i = 0; i < locationKeys.length; i++) {
      let key = locationKeys[i]["Key"];
      const options = {
        hostname: 'dataservice.accuweather.com',
        port: 443,
        path: `/forecasts/v1/daily/5day/${key}?apikey=${process.env.ACCUWEATHER_KEY}`,
        method: 'GET',
      }
      const req = https.request(options, res => {
        console.log(`statusCode: ${res.statusCode}`)

        let data = []
        res.on('data', d => {
          data.push(d);
        }).on('end', () => {
          processWeather(data);
        });
      });

      req.on('error', error => {
        console.error('ACCUWEATHER ERROR:' + error)
      })

      req.end();
    }
  }

  const getLocationKeys = (query) => {
    const options = {
      hostname: 'dataservice.accuweather.com',
      port: 443,
      path: `/locations/v1/search?q=${query}&apikey=${process.env.ACCUWEATHER_KEY}`,
      method: 'GET',
    }

    let data = [];
    const req = https.request(options, res => {
      console.log(`statusCode: ${res.statusCode}`)

      res.on('data', d => {
        data.push(d);
      }).on('end', () => {
        data = Buffer.concat(data).toString();
        getForecasts(JSON.parse(data));
      });
    });

    req.on('error', error => {
      console.error('ACCUWEATHER ERROR:' + error)
    });

    req.end();
    return data;
  }

  try{
    getLocationKeys('san%20francisco');
    callback(null, { "statusCode" : 200, "body" : "Call successful."})
  }
  catch(e){
    callback(e, { "statusCode" : 500, "body" : e});
  }
}