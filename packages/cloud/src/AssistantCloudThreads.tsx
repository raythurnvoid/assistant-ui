import { AssistantCloudAPI } from "./AssistantCloudAPI";
import { AssistantCloudThreadMessages } from "./AssistantCloudThreadMessages";
import {
	type app_convex_Id,
	app_convex,
	app_convex_api,
	app_convex_adapt_convex_to_app_thread,
	has_defined_property,
} from "../app_aui_bridge.ts";

type AssistantCloudThreadsListQuery = {
	is_archived?: boolean;
	limit?: number;
	after?: string;
};

type CloudThread = {
	title: string;
	last_message_at: Date;
	metadata: unknown;
	external_id: string | null;
	id: string;
	project_id: string;
	created_at: string;
	updated_at: string;
	workspace_id: string;
	is_archived: boolean;
};

type AssistantCloudThreadsListResponse = {
	threads: CloudThread[];
};

type AssistantCloudThreadsCreateBody = {
	title?: string | undefined;
	last_message_at: Date;
	metadata?: unknown | undefined;
	external_id?: string | undefined;
};

type AssistantCloudThreadsCreateResponse = {
	thread_id: string;
};

type AssistantCloudThreadsUpdateBody = {
	title?: string | undefined;
	last_message_at?: Date | undefined;
	metadata?: unknown | undefined;
	is_archived?: boolean | undefined;
};

export class AssistantCloudThreads {
	public readonly messages: AssistantCloudThreadMessages;

	constructor(private cloud: AssistantCloudAPI) {
		this.messages = new AssistantCloudThreadMessages(cloud);
	}

	public async list(query?: AssistantCloudThreadsListQuery): Promise<AssistantCloudThreadsListResponse> {
		if (has_defined_property(this.cloud.config, "useAssistantUiCloud") && this.cloud.config.useAssistantUiCloud) {
			return this.cloud.makeRequest("/threads", { query });
		} else {
			const result = await app_convex.query(app_convex_api.ai_chat.threads_list, {
				paginationOpts: {
					numItems: query?.limit ?? 20,
					cursor: query?.after ?? null,
				},
				archived: false,
			});

			return {
				threads: result.page.map((thread) => app_convex_adapt_convex_to_app_thread(thread)),
			};
		}
	}

	public async get(threadId: string): Promise<CloudThread> {
		return this.cloud.makeRequest(`/threads/${encodeURIComponent(threadId)}`);
	}

	public async create(body: AssistantCloudThreadsCreateBody): Promise<AssistantCloudThreadsCreateResponse> {
		if (has_defined_property(this.cloud.config, "useAssistantUiCloud") && this.cloud.config.useAssistantUiCloud) {
			return this.cloud.makeRequest("/threads", { method: "POST", body });
		} else {
			return app_convex.mutation(app_convex_api.ai_chat.thread_create, {
				lastMessageAt: body.last_message_at.getTime(),
				metadata: body.metadata,
				title: body.title,
				externalId: body.external_id,
			});
		}
	}

	public async update(threadId: string, body: AssistantCloudThreadsUpdateBody): Promise<void> {
		if (has_defined_property(this.cloud.config, "useAssistantUiCloud") && this.cloud.config.useAssistantUiCloud) {
			return this.cloud.makeRequest(`/threads/${encodeURIComponent(threadId)}`, {
				method: "PUT",
				body,
			});
		} else {
			await app_convex.mutation(app_convex_api.ai_chat.thread_update, {
				threadId: threadId as app_convex_Id<"threads">,
				title: body.title,
				isArchived: body.is_archived,
			});
		}
	}

	public async delete(threadId: string): Promise<void> {
		if (has_defined_property(this.cloud.config, "useAssistantUiCloud") && this.cloud.config.useAssistantUiCloud) {
			return this.cloud.makeRequest(`/threads/${encodeURIComponent(threadId)}`, {
				method: "DELETE",
			});
		} else {
			app_convex.mutation(app_convex_api.ai_chat.thread_archive, {
				threadId: threadId as app_convex_Id<"threads">,
			});
		}
	}
}
