const TTNRouter = require('express').Router()
const logger = require('../utils/logger')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const config = require('../utils/config')
const Device = require('../models/device')
const Bucket = require('../models/bucket')
const { tokenExtractor, userExtractor } = require('../utils/middleware')
const fetch = require('node-fetch'); 



//getting data from ttn
TTNRouter.post('/', async(request, response) => {

    if(Object.is(undefined, request.body.uplink_message.decoded_payload))
    {
            return
    }
    const data = request.body.uplink_message.decoded_payload
    const dev_id = request.body.end_device_ids.device_id


    if(!data){

       return response.status(200)
    }
    logger.info("uplink data is: ", data)
    var datetime = new Date();
    const dataArray = [];

    for (let variable in data) {
        const bucket = {
            name: variable,
            value: data[variable],
            date_time: datetime.toISOString().slice(0, 19),  //new Date() more optimal
            dev_id: dev_id
        };
        dataArray.push(bucket);
    }
    
    // Insert entire json batch
    await Bucket.insertMany(dataArray);
    
    response.status(200)
})



//create device
TTNRouter.post('/connector', userExtractor, async(request, response) => {

   var body = request.body
  const apikey_encrypted = jwt.sign(body.apikey, config.SECRET)

const device = new Device({
    name: body.name,
    apikey_encrypted: apikey_encrypted,
    app_id: body.app_id,
    hook_id: body.hook_id,
    dev_id: body.dev_id,
    user: request.user.id
  
})
if(Object.is(undefined, device.name || device.apikey_hash)){
    response.status(400).end()}
    else{
        
        

        const result = await device.save()
        
        const user = request.user
        user.devices = user.devices.concat(result.id)
        await user.save() 

        response.status(201).json(result)

    }

})

//Shouldn't I do decrytion here?
TTNRouter.get('/device_list', userExtractor, async(request, response) => {

  
    const devices = await Device.find({user: request.user.id.toString()})
    devices.forEach(el => {
        el.apikey_encrypted = ""
    })
    response.status(200).json(devices)
})




//getting the device data in bathces of 15 (hopefully newer to older)
TTNRouter.get('/device_data/:dev_id/:page', userExtractor, async(request, response) => {
    
    

    
    const skip = (15*Number(request.params.page))-15
    try {
    var data = null
    data = await Bucket.find({dev_id: request.params.dev_id}).sort({date_time: -1}).limit(15).skip(skip)
    }catch(error){
      console.error("error in getting data from Data Base")
      res.status(500).json({ error: 'Failed to get data from data base' });
    }
    if(data){
    return response.json(data).status(200)
    }
    else {
      res.status(500).json({ error: 'Failed to get data from data base' });
    }
    


})



TTNRouter.post('/send-downlink', userExtractor, async (req, res) => {
    const { dev_id, app_id, hook_id, downlinkPayload } = req.body;
    logger.info("we are rolling")
    const url = `https://eu1.cloud.thethings.network/api/v3/as/applications/${app_id}/webhooks/${hook_id}/devices/${dev_id}/down/push`;
  
    
    const device = await Device.find({user: req.user.id.toString(), dev_id: dev_id.toString()})
    logger.info("key from device", device[0].apikey_encrypted)
   

    const apikey = jwt.verify(device[0].apikey_encrypted, process.env.SECRET)
    try {
        
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
      logger.info("response status", result['Symbol(Response internals)'].status)
      res.status(200)
    } catch (error) {
      console.error('Error pushing to TTN:', error);
      res.status(500).json({ error: 'Failed to send downlink' });
    }
  });

module.exports = TTNRouter