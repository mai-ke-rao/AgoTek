import { Router, type Request, type Response } from "express";
import { tokenExtractor, userExtractor } from "../../utils/middleware.js";
import { createRuleRequestSchema, patchRuleSchema, killSwitchSchema } from "../db/zod.js";
import { assertDevicesOwned, OwnershipError } from "./ownership.js";
import {
  createRule,
  listRules,
  getRule,
  patchRule,
  deleteRule,
  killSwitch,
  listAudit,
  type RuleWithRelations,
} from "./service.js";

// userExtractor (middleware.js) sets this after JWT verification; the JS side
// isn't typed, so this is just enough shape for the fields the handlers use.
interface AuthedRequest extends Request {
  user?: { id: string };
}

const rulesRouter = Router();

// tokenExtractor already runs globally in App.js by the time requests reach
// here, but every route needs request.user, so userExtractor runs for the
// whole router rather than being repeated per route (as TTN.js does).
rulesRouter.use(tokenExtractor, userExtractor);

function userId(request: AuthedRequest): string {
  return request.user!.id.toString();
}

function parseId(raw: string | string[]): number | null {
  if (typeof raw !== "string") return null;
  const id = Number(raw);
  return Number.isInteger(id) ? id : null;
}

// Every clause's dev_id plus the action's target — the full set of devices a
// rule would need read/write access to, checked against Mongo in one pass.
function devIdsIn(input: {
  clauses: { devId: string }[];
  action: { targetDevId: string };
}): string[] {
  return [...input.clauses.map((c) => c.devId), input.action.targetDevId];
}

rulesRouter.post("/", async (request: AuthedRequest, response: Response) => {
  const parsed = createRuleRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    await assertDevicesOwned(userId(request), devIdsIn(parsed.data));
    const result: RuleWithRelations = await createRule(userId(request), parsed.data);
    return response.status(201).json(result);
  } catch (err) {
    if (err instanceof OwnershipError) {
      return response.status(err.status).json({ error: err.message, devIds: err.devIds });
    }
    console.error(err);
    return response.status(500).json({ error: "Failed to create rule" });
  }
});

rulesRouter.get("/", async (request: AuthedRequest, response: Response) => {
  const rules = await listRules(userId(request));
  return response.status(200).json(rules);
});

rulesRouter.get("/:id", async (request: AuthedRequest, response: Response) => {
  const id = parseId(request.params.id);
  if (id === null) return response.status(400).json({ error: "id must be an integer" });

  const rule = await getRule(userId(request), id);
  if (!rule) return response.status(404).json({ error: "not found" });

  return response.status(200).json(rule);
});

rulesRouter.patch("/:id", async (request: AuthedRequest, response: Response) => {
  const id = parseId(request.params.id);
  if (id === null) return response.status(400).json({ error: "id must be an integer" });

  const parsed = patchRuleSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ error: parsed.error.flatten() });
  }

  const updated = await patchRule(userId(request), id, parsed.data);
  if (!updated) return response.status(404).json({ error: "not found" });

  return response.status(200).json(updated);
});

rulesRouter.delete("/:id", async (request: AuthedRequest, response: Response) => {
  const id = parseId(request.params.id);
  if (id === null) return response.status(400).json({ error: "id must be an integer" });

  const deleted = await deleteRule(userId(request), id);
  if (!deleted) return response.status(404).json({ error: "not found" });

  return response.status(204).end();
});

// Omit devId to disable every enabled rule the user owns (§6.2).
rulesRouter.post("/kill-switch", async (request: AuthedRequest, response: Response) => {
  const parsed = killSwitchSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ error: parsed.error.flatten() });
  }

  const disabled = await killSwitch(userId(request), parsed.data.devId);
  return response.status(200).json({ disabled });
});

rulesRouter.get("/:id/audit/:page", async (request: AuthedRequest, response: Response) => {
  const id = parseId(request.params.id);
  const page = parseId(request.params.page);
  if (id === null || page === null || page < 1) {
    return response.status(400).json({ error: "id and page must be positive integers" });
  }

  const audit = await listAudit(userId(request), id, page);
  if (!audit) return response.status(404).json({ error: "not found" });

  return response.status(200).json(audit);
});

export { rulesRouter };
