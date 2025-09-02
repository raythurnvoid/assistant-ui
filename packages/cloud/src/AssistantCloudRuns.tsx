import { AssistantCloudAPI } from "./AssistantCloudAPI";
import { AssistantStream, PlainTextDecoder } from "assistant-stream";
import { app_fetch_stream_runs, AppAuthProvider, has_defined_property } from "../app_aui_bridge.ts";

type AssistantCloudRunsStreamBody = {
	thread_id: string;
	assistant_id: "system/thread_title";
	messages: any[]; // TODO type
};

export class AssistantCloudRuns {
	constructor(private cloud: AssistantCloudAPI) {}

	public __internal_getAssistantOptions(assistantId: string) {
		return {
			api: `${this.cloud._baseUrl}/v1/runs/stream`,
			headers: async () => {
				const headers = await this.cloud._auth.getAuthHeaders();
				if (!headers) throw new Error("Authorization failed");
				return {
					...headers,
					Accept: "text/plain",
				};
			},
			body: {
				assistant_id: assistantId,
				response_format: "vercel-ai-data-stream/v1",
				thread_id: "unstable_todo",
			},
		};
	}

	public async stream(body: AssistantCloudRunsStreamBody): Promise<AssistantStream> {
		let response: Response;
		if (has_defined_property(this.cloud.config, "useAssistantUiCloud") && this.cloud.config.useAssistantUiCloud) {
			response = await this.cloud.makeRawRequest("/runs/stream", {
				method: "POST",
				headers: {
					Accept: "text/plain",
				},
				body,
			});
		} else {
			// Use local backend
			const result = await app_fetch_stream_runs({
				input: body,
				auth: await AppAuthProvider.getIsAuthenticated(),
			});

			if (result._nay) {
				throw new Error(`Stream request failed: ${result._nay.message}`);
			}

			response = result._yay.response;
		}

		const baseStream = AssistantStream.fromResponse(response, new PlainTextDecoder());

		return baseStream;
	}
}
