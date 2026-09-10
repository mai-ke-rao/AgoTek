import Device from "../models/device.js";
import { decrypt } from "../utils/cryptoHelper.js";

// The one place that turns "send this payload to that device" into a TTN
// request (§8). The HTTP route and the automation executor both call it, so
// device lookup, ownership scoping, key decryption and the TTN POST can't
// drift apart.

export class DownlinkError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "DownlinkError";
    this.status = status;
  }
}

export interface DownlinkResult {
  status: number;
}

// Scoping the lookup by user IS the ownership check (§6.1) — a dev_id that
// belongs to someone else simply isn't found.
export async function sendDownlink(
  userId: string,
  devId: string,
  payload: unknown
): Promise<DownlinkResult> {
  const device = await Device.findOne({ user: userId, dev_id: devId });

  if (!device) {
    throw new DownlinkError(`device not found or not owned: ${devId}`, 404);
  }
  if (!device.downpush) {
    // TTN hands us the push URL on the device's first uplink; until then
    // there's nowhere to send anything.
    throw new DownlinkError(`device ${devId} has no downlink push URL yet`, 409);
  }

  const apikey = decrypt(device.apikey_encrypted);

  const response = await fetch(device.downpush, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apikey}`,
      "Content-Type": "application/json",
      "User-Agent": "my-app/1.0",
    },
    body: JSON.stringify({ downlinks: [payload] }),
  });

  if (!response.ok) {
    throw new DownlinkError(`TTN responded ${response.status}`, 502);
  }

  return { status: response.status };
}
