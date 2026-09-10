import Device from "../../models/device.js";

// Postgres can't FK-enforce that a dev_id belongs to a user_id — devices live in
// Mongo (§6.1). The application layer is the only thing standing between a user
// and someone else's hardware, so this check runs on create and, once the
// evaluator lands, again before firing.

export class OwnershipError extends Error {
  status = 403;
  devIds: string[];

  constructor(devIds: string[]) {
    super(`device(s) not owned by user: ${devIds.join(", ")}`);
    this.name = "OwnershipError";
    this.devIds = devIds;
  }
}

// Only TTN devices are checked: the downlink action needs `downpush`, which
// Chirpdev doesn't have, so a Chirpstack device can never be a valid target.
export async function assertDevicesOwned(userId: string, devIds: string[]): Promise<void> {
  const wanted = [...new Set(devIds)];
  if (wanted.length === 0) return;

  const owned = await Device.find({ user: userId, dev_id: { $in: wanted } })
    .select("dev_id")
    .lean<{ dev_id: string }[]>();

  const ownedIds = new Set(owned.map((d) => d.dev_id));
  const missing = wanted.filter((id) => !ownedIds.has(id));

  if (missing.length > 0) throw new OwnershipError(missing);
}
