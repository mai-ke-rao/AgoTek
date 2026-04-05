ChirpstackRouter = require('express').Router()
const Chripdev = require('../models/chripdev')
const jwt = require('jsonwebtoken')
const { userExtractor } = require('../utils/middleware')
const fetch = require('node-fetch'); 
const config = require('../utils/config')
 const { encrypt, decrypt } = require("../utils/cryptoHelper");



//getting the uplinks 
ChirpstackRouter.post('/', async(req, res) => {

console.log(req);


});

//create device
ChirpstackRouter.post('/connector', userExtractor, async(request, response) => {

   var body = request.body
   
    const apikey_encrypted = encrypt(device.apikey_encrypted);

  try{
const device = new Chripdev({
    name: body.name,
    apikey_encrypted: apikey_encrypted,
    dev_eui: body.dev_eui,
    user: request.user.id
  
})
  

if(Object.is(undefined, device.name || device.apikey_hash)){
    response.status(400).end()}
    else{
        
        

        const result = await device.save()
        
       

        response.status(201).json(result)

    }
  }
  catch (err) {
  if (err.code === 11000) {
    return response.status(409).json({
      error: "Device with this dev_eui already exists"
    });
  }

  next(err); // let errorHandler deal with other errors
}

})


//sending downlink
ChirpstackRouter.post('/send-downlink', userExtractor, async (req, res) => {

    const { dev_eui, downlinkPayload } = req.body;
   
   
    console.log("downlink payload", downlinkPayload);
    
    try {
    const device = await Chripdev.findOne({user: req.user.id.toString(), dev_eui: dev_eui.toString()})


     const apikey = jwt.verify(device.apikey_encrypted, process.env.SECRET)
     const url = `https://console.meteoscientific.com/api/devices/${device.dev_eui}/queue`
     console.log("url is : ", url);
     

    
        
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
     // logger.info("response status", result['Symbol(Response internals)'].status)
      res.status(200).json(result)
    } catch (error) {
      console.error('Error pushing to TTN:', error);
      res.status(500).json({ error: 'Failed to send downlink' });
    }

  });






module.exports = ChirpstackRouter