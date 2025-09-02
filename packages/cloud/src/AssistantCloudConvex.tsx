/* Module used by Convex */

import { AssistantCloudAPI, AssistantCloudConfig } from "./AssistantCloudAPI";
import { AssistantCloudAuthTokens } from "./AssistantCloudAuthTokens";

/**
 * A stripped down version of AssistantCloud that only supports auth tokens.
 */
export class AssistantCloudConvex {
  public readonly auth;

  constructor(config: AssistantCloudConfig) {
    const api = new AssistantCloudAPI(config);
    this.auth = {
      tokens: new AssistantCloudAuthTokens(api),
    };
  }
}
