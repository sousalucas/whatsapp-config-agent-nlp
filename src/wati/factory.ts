import { config } from "../utils/config.js";
import type { WatiClient } from "./types.js";
import { MockWatiClient } from "./mock.js";
import { RealWatiClient } from "./client.js";

export function createWatiClient(): WatiClient {
  if (config.wati.mode === "real") {
    if (!config.wati.apiUrl || !config.wati.apiToken) {
      throw new Error("WATI_API_URL and WATI_API_TOKEN are required when WATI_MODE=real");
    }
    return new RealWatiClient(config.wati.apiUrl, config.wati.apiToken);
  }
  return new MockWatiClient();
}
