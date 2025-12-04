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
        response.json(activities)
        console.log("request params: ", request.params.id);
        
    }
    catch (error) {
        console.error('Error while fetching data:', error);
      }
})

/*
activitiesRouter.get('/:parcelId', userExtractor, async (req, res, next) => {
  try {
    const activities = await Item().find({
      user: req.user.id,
      parcel: req.params.parcelId,
    }).sort({ createdAt: -1 });

    return res.json(activities);
  } catch (err) {
    return next(err);
  }
});
*/




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
 * GET /:parcelId
 * Returns all activities (any kind) for the current user and the given parcel.
 */


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


module.exports = activitiesRouter