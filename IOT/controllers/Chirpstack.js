const ChirpstackRouter = require('express').Router()
const Chripdev = require('../models/chripdev')
const { tokenExtractor, userExtractor } = require('../utils/middleware')
const fetch = require('node-fetch');
const { encrypt, decrypt } = require("../utils/cryptoHelper");


ChirpstackRouter.post('/', async(req, res) => {
  console.log(req.body);
  res.sendStatus(200)
})


ChirpstackRouter.post('/connector', tokenExtractor, userExtractor, async(request, response) => {
  var body = request.body
  const apikey_encrypted = encrypt(body.apikey);

  try {
    const device = new Chripdev({
      name: body.name,
      apikey_encrypted: apikey_encrypted,
      dev_eui: body.dev_eui,
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
        error: "Device with this dev_eui already exists"
      });
    }
    console.error(err)
    response.status(500).json({ error: 'Failed to create device' })
  }
})


ChirpstackRouter.post('/send-downlink', tokenExtractor, userExtractor, async (req, res) => {
  const { dev_eui, downlinkPayload } = req.body;

  try {
    const device = await Chripdev.findOne({user: req.user.id.toString(), dev_eui: dev_eui.toString()})
    const apikey = decrypt(device.apikey_encrypted)
    const url = `https://console.meteoscientific.com/api/devices/${device.dev_eui}/queue`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apikey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'ROOT',
        'Connection': 'keep-alive'
      },
      body: JSON.stringify({
        "queueItem": {
          "confirmed": true,
          "fPort": 28,
          "data": downlinkPayload,
          "isEncrypted": false,
          "isPending": false,
          "fCntDown": 0,
          "expiresAt": null
        }
      })
    });

    const result = await response;
    res.status(200).json(result)
  } catch (error) {
    console.error('Error pushing to Chirpstack:', error);
    res.status(500).json({ error: 'Failed to send downlink' });
  }
})

module.exports = ChirpstackRouter
