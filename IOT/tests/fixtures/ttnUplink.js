// Shaped from a real TTN "simulate uplink" webhook delivery, trimmed of
// fields IOT/controllers/TTN.js never reads (rx_metadata, settings).
function buildUplinkPayload(overrides = {}) {
  const {
    devId = 'mojuredjajsafaksa',
    devEui = '70B3D57ED0064DDF',
    devAddr = '260BAD40',
    applicationId = 'novappprroba',
    correlationId = 'as:up:01KZZK3FM1X76KE268T7M699ND',
    decodedPayload = {
      PumpTime: 20.57,
      TankFull: 7,
      distance: 2.58,
      humidity: 7.72,
      temperature: 12.86,
    },
    receivedAt = new Date().toISOString(),
    fCnt, // TTN's frame counter — the automation engine's idempotency key
  } = overrides;

  return {
    end_device_ids: {
      device_id: devId,
      application_ids: { application_id: applicationId },
      dev_eui: devEui,
      dev_addr: devAddr,
    },
    correlation_ids: [correlationId],
    received_at: receivedAt,
    uplink_message: {
      f_port: 1,
      ...(fCnt !== undefined && { f_cnt: fCnt }),
      frm_payload: 'AQIDBAUGBwgJ',
      decoded_payload: decodedPayload,
    },
    simulated: true,
  };
}

function buildUplinkHeaders(overrides = {}) {
  const {
    apikey,
    downlinkPush,
    downlinkReplace,
    ttsDomain = 'eu1.cloud.thethings.network',
  } = overrides;

  return {
    'content-type': 'application/json',
    'x-downlink-apikey': apikey,
    'x-downlink-push': downlinkPush,
    'x-downlink-replace': downlinkReplace,
    'x-tts-domain': ttsDomain,
  };
}

module.exports = { buildUplinkPayload, buildUplinkHeaders };
