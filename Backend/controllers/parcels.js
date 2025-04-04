const parcelsRouter = require('express').Router()
const { findByIdandDelete } = require('../models/parcel')
const Parcel = require('../models/parcel')
const User = require('../models/user')
const { tokenExtractor, userExtractor } = require('../utils/middleware')





parcelsRouter.get('/', userExtractor, async(request, response) => {
    //Find wont do.
    const parcels = await Parcel.find({user: request.user.id.toString()})
    response.json(parcels)
} )


parcelsRouter.post('/', userExtractor, async(request, response) => {
var body = request.body
const user = request.user
var datetime = new Date();
const parcel = new Parcel({
    name: body.name,
    vrsta_useva: body.vrsta_useva,
    povrsina: body.povrsina,
    date: datetime.toISOString().slice(0,10),
    user: user.id
})
if(Object.is(undefined, parcel.name)){
    response.status(400).end()}
    else{



const result = await parcel.save()


user.parcels = user.parcels.concat(result.id)
await user.save()

response.status(201).json(result)

    }
})

module.exports = parcelsRouter