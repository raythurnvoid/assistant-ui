import { ReadonlyJSONObject } from "assistant-stream/utils";
import { AssistantCloudAPI } from "./AssistantCloudAPI";
import {
  type app_convex_Id,
  app_convex,
  app_convex_api,
  app_convex_adapt_convex_to_app_message,
  has_defined_property,
} from "../app_aui_bridge.ts";

export type CloudMessage = {
  id: string;
  parent_id: string | null;
  height: number;
  created_at: string;
  updated_at: string;
  format: "aui/v0" | string;
  content: ReadonlyJSONObject;
};

type AssistantCloudThreadMessageListQuery = {
  format?: string;
};

type AssistantCloudThreadMessageListResponse = {
  messages: CloudMessage[];
};

type AssistantCloudThreadMessageCreateBody = {
  parent_id: string | null;
  format: "aui/v0" | string;
  content: ReadonlyJSONObject;
};

type AssistantCloudMessageCreateResponse = {
  message_id: string;
};

export class AssistantCloudThreadMessages {
  constructor(private cloud: AssistantCloudAPI) {}

  public async list(
    threadId: string,
    query?: AssistantCloudThreadMessageListQuery,
  ): Promise<AssistantCloudThreadMessageListResponse> {
    if (
      has_defined_property(this.cloud.config, "useAssistantUiCloud") &&
      this.cloud.config.useAssistantUiCloud
    ) {
      return this.cloud.makeRequest(
        `/threads/${encodeURIComponent(threadId)}/messages`,
      );
    } else {
      const result = await app_convex.query(
        app_convex_api.ai_chat.thread_messages_list,
        {
          threadId: threadId as app_convex_Id<"threads">,
          query,
        },
      );

      return {
        messages:
          result?.messages.map((message) => {
            const adapted_message =
              app_convex_adapt_convex_to_app_message(message);

            return {
              ...adapted_message,
              /*
						The app type for `content` is "too accurate", while assistant-ui wants
						`ReadonlyJSONObject` that is more loose.
						*/
              content: adapted_message.content as unknown as ReadonlyJSONObject,
            };
          }) ?? [],
      };
    }
  }

  public async create(
    threadId: string,
    body: AssistantCloudThreadMessageCreateBody,
  ): Promise<AssistantCloudMessageCreateResponse> {
    if (
      has_defined_property(this.cloud.config, "useAssistantUiCloud") &&
      this.cloud.config.useAssistantUiCloud
    ) {
      return this.cloud.makeRequest(
        `/threads/${encodeURIComponent(threadId)}/messages`,
        { method: "POST", body },
      );
    } else {
      return app_convex.mutation(app_convex_api.ai_chat.thread_messages_add, {
        threadId: threadId as app_convex_Id<"threads">,
        content: body.content as any,
        format: body.format,
        parentId: body.parent_id as app_convex_Id<"messages"> | null,
      });
    }
  }
}
