const mongoose = require('mongoose')
const Parcel = require('../models/parcel')
const { Base: Activity } = require('../models/activity')
const Device = require('../models/device')
const Chirpdev = require('../models/chripdev')
const Bucket = require('../models/bucket')
const db = require('./db')

// Every read the assistant's tools make. Each function takes the userId from
// the verified JWT and scopes the query by it, so ownership is enforced here
// on the server regardless of what the model asks for. Device, Chirpdev and
// Bucket are the same collections IOT writes; Backend only reads them.

async function listParcels(userId) {
  return Parcel.find({ user: userId }).select('name vrsta_useva povrsina date').lean()
}

async function findOwnedParcel(userId, parcelId) {
  if (!mongoose.isValidObjectId(parcelId)) return null
  return Parcel.findOne({ _id: parcelId, user: userId }).select('name vrsta_useva povrsina').lean()
}

async function listActivities(userId, { parcelId, activityType, from, to, limit }) {
  const filter = { user: userId }
  if (parcelId) filter.parcel = parcelId
  if (activityType) filter.activityType = activityType
  if (from || to) {
    filter.datum_od = {}
    if (from) filter.datum_od.$gte = from
    if (to) filter.datum_od.$lte = `${to}￿`
  }
  return Activity.find(filter).sort({ datum_od: -1 }).limit(limit).lean()
}

async function listDevices(userId) {
  const [ttn, chirp] = await Promise.all([
    Device.find({ user: userId }).select('name dev_id downpush').lean(),
    Chirpdev.find({ user: userId }).select('name dev_eui').lean(),
  ])
  return { ttn, chirp }
}

async function deviceVariables(devId) {
  return Bucket.distinct('name', { dev_id: devId })
}

async function lastReadingAt(devId) {
  const row = await Bucket.findOne({ dev_id: devId }).sort({ date_time: -1 }).select('date_time').lean()
  return row ? row.date_time : null
}

async function findOwnedDevice(userId, devId) {
  return Device.findOne({ user: userId, dev_id: devId }).select('name dev_id').lean()
}

async function ownedDeviceIds(userId, devIds) {
  const owned = await Device.find({ user: userId, dev_id: { $in: [...new Set(devIds)] } }).select('dev_id').lean()
  return new Set(owned.map((d) => d.dev_id))
}

// Only call after findOwnedDevice / ownedDeviceIds.
async function readings(devId, { variables, since, limit }) {
  const filter = { dev_id: devId, date_time: { $gte: since } }
  if (variables && variables.length) filter.name = { $in: variables }
  return Bucket.find(filter).sort({ date_time: -1 }).limit(limit).select('name value date_time').lean()
}

async function variableSeen(devId, variable) {
  return Boolean(await Bucket.exists({ dev_id: devId, name: variable }))
}

// Rules domain (Postgres, owned by IOT). Read-only here; writes go through
// IOT's API on confirmation.
async function listRules(userId) {
  const { rows } = await db.query(
    `SELECT r.id, r.name, r.combinator, r.enabled, r.created_at, s.last_fired_at,
            COALESCE(json_agg(json_build_object(
              'devId', c.dev_id, 'variable', c.variable,
              'comparator', c.comparator, 'threshold', c.threshold) ORDER BY c.position)
              FILTER (WHERE c.id IS NOT NULL), '[]') AS clauses,
            a.target_dev_id, a.payload
       FROM rules r
       LEFT JOIN rule_clauses c ON c.rule_id = r.id
       LEFT JOIN rule_actions a ON a.rule_id = r.id
       LEFT JOIN rule_state s ON s.rule_id = r.id
      WHERE r.user_id = $1
      GROUP BY r.id, a.id, s.rule_id
      ORDER BY r.created_at DESC
      LIMIT 50`,
    [String(userId)]
  )
  return rows
}

async function ruleHistory(userId, ruleId, limit) {
  const { rows } = await db.query(
    `SELECT a.fired_at, a.status, a.detail, a.target_dev_id, a.snapshot
       FROM rule_audit a
       JOIN rules r ON r.id = a.rule_id
      WHERE r.id = $1 AND r.user_id = $2
      ORDER BY a.fired_at DESC
      LIMIT $3`,
    [ruleId, String(userId), limit]
  )
  return rows
}

async function ruleOwned(userId, ruleId) {
  const { rows } = await db.query('SELECT id, name FROM rules WHERE id = $1 AND user_id = $2', [ruleId, String(userId)])
  return rows[0] || null
}

module.exports = {
  listParcels, findOwnedParcel, listActivities,
  listDevices, deviceVariables, lastReadingAt, findOwnedDevice, ownedDeviceIds,
  readings, variableSeen,
  listRules, ruleHistory, ruleOwned,
}
