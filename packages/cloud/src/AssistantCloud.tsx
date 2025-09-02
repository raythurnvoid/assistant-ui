import { AssistantCloudAPI, AssistantCloudConfig } from "./AssistantCloudAPI";
import { AssistantCloudAuthTokens } from "./AssistantCloudAuthTokens";
import { AssistantCloudRuns } from "./AssistantCloudRuns";
import { AssistantCloudThreads } from "./AssistantCloudThreads";
import { AssistantCloudFiles } from "./AssistantCloudFiles";
import { ThreadHistoryAdapter } from "@assistant-ui/react";

export class AssistantCloud {
  public readonly auth;
  public readonly threads;
  public readonly runs;
  public readonly files;
  public __historyAdapter?: ThreadHistoryAdapter;

  constructor(config: AssistantCloudConfig) {
    const api = new AssistantCloudAPI(config);
    this.threads = new AssistantCloudThreads(api);
    this.auth = {
      tokens: new AssistantCloudAuthTokens(api),
    };
    this.runs = new AssistantCloudRuns(api);
    this.files = new AssistantCloudFiles(api);
  }
}
