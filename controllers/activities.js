const activitiesRouter = require('express').Router()
const Activity = require('../models/activity')
const { tokenExtractor, userExtractor } = require('../utils/middleware')
const express = require('express');
const mongoose = require('mongoose');

//rerturns activies for choosen parcel and user id.
activitiesRouter.get('/:id', userExtractor, async(request, response) => {
   
   
    try{
    const activities = await Base.find({user: request.user.id.toString()
        , parcel: request.params.id})
         return response.json(activities)
        
        
    }
    catch (error) {
        console.error('Error while fetching data:', error);
        return response.status(404).json("Error while fetching data")
      }
})






// Pull discriminator models from your activity file
// NOTE: Komentar and Analiza are exported as Schemas in your file, not Models.
// See the comment below on how to register them as discriminators before using.
const {
  Obrada,
  Djubrenje,
  SetvaSadnja,
  NegaUseva,
  ZetvaBerba,
  Komentar,   
  Analiza,
  Base    
} = require('../models/activity');
const { findByIdAndUpdate } = require('../models/user');



/**
 * Helper: access the Base model ("Item") registered by your discriminator setup.
 * Your activity.js defines:
 *   const Base = mongoose.model('Item', BaseSchema);
 * but it doesn't export Base explicitly. That's fine—Mongoose keeps a registry.
 */
const Item = () => mongoose.model('Item');

/**
 * Map incoming activityType to the correct discriminator Model.
 * These string keys must match your BaseSchema enum ("obrada", "djubrenje", "setva/sadnja", "nega useva", "zetva/berba", "komentar").
 */
const MODEL_BY_ACTIVITY_TYPE = {
  'obrada': Obrada,
  'djubrenje': Djubrenje,
  'setva/sadnja': SetvaSadnja,
  'nega useva': NegaUseva,
  'zetva/berba': ZetvaBerba,
  'komentar': Komentar,
  'analiza': Analiza
};




/**
 * Generic creator
 * POST /
 * Body must include activityType (one of your enum values).
 * The rest of the body is passed to the correct discriminator.
 */
activitiesRouter.post('/', userExtractor, async (req, res, next) => {
  try {
    const { activityType, parcel, ...rest } = req.body;

    if (!activityType) {
      return res.status(400).json({ error: 'activityType is required' });
    }
    if (!parcel) {
      return res.status(400).json({ error: 'parcel is required' });
    }

    const Model = MODEL_BY_ACTIVITY_TYPE[activityType];
    if (!Model) {
      return res.status(400).json({ error: `Unsupported activityType: ${activityType}` });
    }

    // Ensure Base fields exist; discriminator-specific fields are in ...rest
    const doc = new Model({
      activityType,           
      user: req.user.id,
      parcel,
      ...rest,
    });

    const saved = await doc.save();
    return res.status(201).json(saved);
  } catch (err) {
    return next(err);
  }
});


activitiesRouter.put("/:actId", userExtractor, async (req, res, nest) => {

  console.log("request je ", req.body);
  
  const updatedDoc = await Base.findByIdAndUpdate( req.params.actId,
  { $set: req.body },
  {
    new: true,          // return updated document
    runValidators: true // validate against discriminator schema
  })


  if(!updatedDoc)
  {
    return res.status(404).json({ error: 'Not found' })
  }
  else{
    
res.status(200).json(updatedDoc);
  }
})




activitiesRouter.delete("/:actId", userExtractor, async (req, res, next) => {

const deletedDoc = await Base.findByIdAndDelete(req.params.actId)
if (!deletedDoc) {
  return res.status(404).json({ error: 'Not found' });
}

res.status(200).json({
  message: 'Deleted successfully',
  deletedDoc
});

})


module.exports = activitiesRouter