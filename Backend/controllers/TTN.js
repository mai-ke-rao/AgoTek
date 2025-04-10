const TTNRouter = require('express').Router()
const logger = require('../utils/logger')
const bcrypt = require('bcrypt')
const Device = require('../models/device')


//apikey NNSXS.523DYXOLFLU5C25C5VYOUIVAJUF5CKDCSB6JWZY.ERBFIWIOA24ALXZFLKTTDRDJ7ADRA77VRK7WMOUMEIBHYBKEM4OQ
TTNRouter.get('/', async(request, response) => {
    response.set()
    response.status(200).json({"captain_teemo":"on duty"})
})

TTNRouter.post('/', async(request, response) => {
    const data = request.body.uplink_message.decoded_payload
    logger.info("uplink data is: ", data)
    response.status(200)
})

TTNRouter.post('/connector', userExtractor, async(request, response) => {

   var body = request.body
  
const apikey_hash = await bcrypt.hash(body.apikey)
const device = new Device({
    name: body.name,
    apikey_hash: apikey_hash,
  
})
if(Object.is(undefined, device.name || device.apikey_hash)){
    response.status(400).end()}
    else{
        
        const result = await device.save()
        
        const user = request.user
        user.devices = user.devices.concata(result.id)
        await user.save() 

        response.status(201).json(result)

    }

})


module.exports = TTNRouter