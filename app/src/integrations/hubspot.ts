// Синхронізація ліда з контактом у HubSpot CRM.
import { readEnv } from "../core/config.js";
import { postJson } from "../core/http.js";
import { log } from "../core/log.js";
import { isRecord, isString, parseJson } from "../core/parse.js";
import type { Integration, Lead, Result } from "../core/types.js";

const HUBSPOT_CONTACTS_URL = "https://api.hubapi.com/crm/v3/objects/contacts";

export function toHubspotProperties(lead: Lead): Record<string, string> {
  const properties: Record<string, string> = {
    email: lead.email,
    firstname: lead.name,
    lifecyclestage: "lead",
  };
  if (lead.phone !== undefined) properties.phone = lead.phone;
  return properties;
}

const isHubspotContact = (value: unknown): value is { id: string } => isRecord(value) && isString(value.id);

export const hubspot: Integration = {
  name: "hubspot",
  requiredEnv: ["HUBSPOT_ACCESS_TOKEN"],

  async send(lead: Lead): Promise<Result<void>> {
    const token = readEnv("HUBSPOT_ACCESS_TOKEN");
    if (!token.ok) return token;

    const response = await postJson(
      HUBSPOT_CONTACTS_URL,
      { properties: toHubspotProperties(lead) },
      { headers: { authorization: `Bearer ${token.value}` } },
    );
    if (!response.ok) {
      log.error(`hubspot: lead ${lead.id} not delivered: ${response.error}`);
      return response;
    }

    const parsed = parseJson(response.value, isHubspotContact, "hubspot");
    if (!parsed.ok) {
      log.error(`hubspot: lead ${lead.id} not delivered: ${parsed.error}`);
      return parsed;
    }

    log.info(`hubspot: contact ${parsed.value.id} created for lead ${lead.id}`);
    return { ok: true, value: undefined };
  },
};
