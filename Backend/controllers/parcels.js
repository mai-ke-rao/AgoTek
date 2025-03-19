const parcelsRouter = require('express').Router()
const { findByIdandDelete } = require('../models/parcel')
const Parcel = require('../models/parcel')
const User = require('../models/user')
const { tokenExtractor, userExtractor } = require('../utils/middleware')



parcelsRouter.get('/', userExtractor, async(request, response) => {
    
    const parcels = await Parcel.find({user: request.user.id.toString()})
    response.json(parcels)
} )


parcelsRouter.post('/', userExtractor, async(request, response) => {
var body = request.body
const user = request.user
const parcel = new Parcel({
    name: body.name,
    city: body.city,
    user: user.id
})
if(Object.is(undefined, parcel.name)){
    response.status(400).end()}
    else{

if(Object.is(undefined, parcel.city))
{
    parcel.city = "Novi sad"
}

const result = await parcel.save()

user.parcels = user.parcels.concat(result.id)
await user.save()

response.status(201).json(result)

    }
})

module.exports = parcelsRouter