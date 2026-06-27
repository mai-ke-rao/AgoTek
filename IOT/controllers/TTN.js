const TTNRouter = require('express').Router()
const logger = require('../utils/logger')
const Device = require('../models/device')
const Chirpdev = require('../models/chripdev')
const Bucket = require('../models/bucket')
const { tokenExtractor, userExtractor } = require('../utils/middleware')
const fetch = require('node-fetch');
const { encrypt, decrypt } = require("../utils/cryptoHelper");


const apikeyExtractor = (device) => {
  try {
    const apikey = decrypt(device.apikey_encrypted);
    return apikey
  } catch(e) {
    throw new Error('Device api key error')
  }
}

TTNRouter.post('/', async(request, response) => {
  try {
    const io = request.app.get('io');

    if(Object.is(undefined, request.body.uplink_message.decoded_payload)) {
      return response.sendStatus(200)
    }

    const data = request.body.uplink_message?.decoded_payload
    const dev_id = request.body.end_device_ids.device_id

    const dev = await Device.findOne({dev_id: dev_id})

    if(!dev) {
      return response.status(404).json({ error: "Not found" });
    }

    const apikey = apikeyExtractor(dev)
    if(apikey != request.headers['x-downlink-apikey']) {
      return response.status(401).json({ error: 'Device api key error' });
    }

    if(!dev.downpush) {
      dev.downpush = request.headers['x-downlink-push']
    }
    await dev.save();

    if(!data) {
      return response.sendStatus(200)
    }

    logger.info("uplink data is: ", data)
    var datetime = new Date();
    const dataArray = [];

    for (let variable in data) {
      const bucket = {
        name: variable,
        value: data[variable],
        date_time: datetime.toISOString().slice(0, 19),
        dev_id: dev_id
      };
      dataArray.push(bucket);
    }

    const insertedDocs = await Bucket.insertMany(dataArray);

    io.to(dev_id).emit('uplink', {
      dev_id,
      rows: insertedDocs,
    });

    return response.sendStatus(200)
  } catch (err) {
    console.error(err);
    return response.sendStatus(500);
  }
})


TTNRouter.post('/connector', tokenExtractor, userExtractor, async(request, response) => {
  var body = request.body
  const encryptedKey = encrypt(body.apikey);

  try {
    const device = new Device({
      name: body.name,
      apikey_encrypted: encryptedKey,
      dev_id: body.dev_id,
      user: request.user.id
    })

    if(Object.is(undefined, device.name || device.apikey_encrypted)) {
      return response.status(400).end()
    }

    const result = await device.save()
    response.status(201).json(result)
  } catch (err) {
    if (err.code === 11000) {
      return response.status(409).json({
        error: "Device with this dev_id already exists"
      });
    }
    console.error(err)
    response.status(500).json({ error: 'Failed to create device' })
  }
})


TTNRouter.get('/device_list', tokenExtractor, userExtractor, async(request, response) => {
  if(!request.user.id)
    return response.status(401).end()

  const devices = await Device.find({user: request.user.id.toString()})
  const chirpDev = await Chirpdev.find({user: request.user.id.toString()})

  devices.forEach(el => { el.apikey_encrypted = "" })
  chirpDev.forEach(el => { el.apikey_encrypted = "" })

  response.status(200).json(devices.concat(chirpDev))
})


TTNRouter.get('/device_data/:dev_id/:page', tokenExtractor, userExtractor, async(request, response) => {
  try {
    var dev = await Device.find({dev_id: request.params.dev_id, user: request.user.id.toString()})
  } catch(error) {
    console.error("device not found")
    return response.status(403).json({ error: 'device not found' });
  }

  try {
    var data;
    if(String(request.params.page) != "all") {
      const skip = (15 * Number(request.params.page)) - 15
      data = await Bucket.find({dev_id: request.params.dev_id}).sort({date_time: -1}).limit(15).skip(skip)
    } else {
      data = await Bucket.find({dev_id: request.params.dev_id}).sort({date_time: -1})
    }

    if(data) {
      return response.json(data).status(200)
    } else {
      response.status(500).json({ error: 'Failed to get data from database' });
    }
  } catch(error) {
    console.error("error getting data from database")
    response.status(500).json({ error: 'Failed to get data from database' });
  }
})


TTNRouter.post('/send-downlink', tokenExtractor, userExtractor, async (req, res) => {
  const { dev_id, downlinkPayload } = req.body;

  try {
    const device = await Device.find({user: req.user.id.toString(), dev_id: dev_id.toString()})
    const url = device[0].downpush;
    const apikey = apikeyExtractor(device[0])

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apikey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'my-app/1.0'
      },
      body: JSON.stringify({ downlinks: [downlinkPayload] })
    });

    const result = await response;
    res.status(200).json(result)
  } catch (error) {
    console.error('Error pushing to TTN:', error);
    res.status(500).json({ error: 'Failed to send downlink' });
  }
})

module.exports = TTNRouter
