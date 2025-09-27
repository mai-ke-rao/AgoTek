const activitiesRouter = require('express').Router()
const Activity = require('../models/activity')
const { tokenExtractor, userExtractor } = require('../utils/middleware')


//rerturns activies for choosen parcel and user id.
activitiesRouter.get('/:id', userExtractor, async(request, response) => {
   
    try{
    const activities = await Activity.find({user: request.user.id.toString()
        , parcel: request.params.id})
        response.json(activities)
        console.log("request params: ", request.params.id);
        
    }
    catch (error) {
        console.error('Error while fetching data:', error);
      }
})




activitiesRouter.post('/obrada', userExtractor, async(request,response) =>{

    var body = request.body
    const user = request.user 
    const activity = new Activity({
        activityType: 'obrada',
        datum_od: body.datum_od,
        datum_do: body.datum_do,
        tip_obrade: body.tip_obrade,
        dubina: body.dubina,
        komentar: body.komentar,
        cena_operacije_h: body.cena_operacije_h,
        user: user,
        parcel: body.parcel
    })


    const result = await activity.save()
    response.status(201).json(result)
    
    
})

module.exports = activitiesRouter