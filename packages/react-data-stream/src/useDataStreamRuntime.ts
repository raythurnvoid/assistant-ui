"use client";

import { toLanguageModelMessages } from "./converters";
import {
	type AssistantRuntime,
	type ChatModelAdapter,
	type ChatModelRunOptions,
	INTERNAL,
	type LocalRuntimeOptions,
	type ThreadMessage,
	type Tool,
	useLocalRuntime,
} from "@assistant-ui/react";
import { z } from "zod";
import type { JSONSchema7 } from "json-schema";
import { AssistantMessageAccumulator, DataStreamDecoder, unstable_toolResultStream } from "assistant-stream";
import { asAsyncIterableStream } from "assistant-stream/utils";
import { app_fetch_main_chat } from "../../../../../src/lib/fetch.ts";

const { splitLocalRuntimeOptions } = INTERNAL;

type HeadersValue = Record<string, string> | Headers;

export type UseDataStreamRuntimeOptions = {
	api: string;
	onResponse?: (response: Response) => void | Promise<void>;
	onFinish?: (message: ThreadMessage) => void;
	onError?: (error: Error) => void;
	onCancel?: () => void;
	credentials?: RequestCredentials;
	headers?: HeadersValue | (() => Promise<HeadersValue>);
	body?: object | (() => Promise<object | undefined>);
	sendExtraMessageFields?: boolean;
} & (
	| {
			api: string;
			credentials?: RequestCredentials;
			headers?: HeadersValue | (() => Promise<HeadersValue>);
			body?: object | (() => Promise<object | undefined>);
			useAssistantUiFetch: true;
	  }
	| {
			useAssistantUiFetch?: false;
	  }
) &
	LocalRuntimeOptions;

type DataStreamRuntimeRequestOptions = {
	messages: any[];
	tools: any;
	system?: string | undefined;
	runConfig?: any;
	unstable_assistantMessageId?: string;
	state?: any;
};

const toAISDKTools = (tools: Record<string, Tool>) => {
	return Object.fromEntries(
		Object.entries(tools).map(([name, tool]) => [
			name,
			{
				...(tool.description ? { description: tool.description } : undefined),
				parameters: (tool.parameters instanceof z.ZodType
					? z.toJSONSchema(tool.parameters)
					: tool.parameters) as JSONSchema7,
			},
		]),
	);
};

const getEnabledTools = (tools: Record<string, Tool>) => {
	return Object.fromEntries(Object.entries(tools).filter(([, tool]) => !tool.disabled && tool.type !== "backend"));
};

class DataStreamRuntimeAdapter implements ChatModelAdapter {
	constructor(private options: Omit<UseDataStreamRuntimeOptions, keyof LocalRuntimeOptions>) {}

	async *run({
		messages,
		runConfig,
		abortSignal,
		context,
		unstable_assistantMessageId,
		unstable_getMessage,
	}: ChatModelRunOptions) {
		const bodyValue = typeof this.options.body === "function" ? await this.options.body() : this.options.body;

		abortSignal.addEventListener(
			"abort",
			() => {
				if (!abortSignal.reason?.detach) this.options.onCancel?.();
			},
			{ once: true },
		);

		const transformed_messages = toLanguageModelMessages(messages, {
			unstable_includeId: this.options.sendExtraMessageFields,
		}) as DataStreamRuntimeRequestOptions["messages"];

		const last_user_message_index_from_end = transformed_messages
			.toReversed()
			.findIndex((message) => message.role !== "user");
		const last_user_messages = transformed_messages.slice(
			last_user_message_index_from_end === -1 ? 0 : -1 * last_user_message_index_from_end,
		);

		if (!last_user_messages.length) {
			console.warn("No message to send when the user requested to send a message");

			return;
		}

		const input = {
			system: context.system,
			messages: last_user_messages,
			tools: toAISDKTools(getEnabledTools(context.tools ?? {})) as unknown as DataStreamRuntimeRequestOptions["tools"],
			...(unstable_assistantMessageId ? { unstable_assistantMessageId } : {}),
			runConfig,
			state: unstable_getMessage().metadata.unstable_state || undefined,
			...context.callSettings,
			...context.config,
			...(bodyValue ?? {}),
		} satisfies DataStreamRuntimeRequestOptions;

		let result: Response;
		if (this.options.useAssistantUiFetch) {
			const options = this.options as Extract<UseDataStreamRuntimeOptions, { useAssistantUiFetch: true }>;

			const headersValue = typeof options.headers === "function" ? await options.headers() : options.headers;

			const headers = new Headers(headersValue);
			headers.set("Content-Type", "application/json");

			result = await fetch(options.api, {
				method: "POST",
				headers,
				credentials: options.credentials ?? "same-origin",
				body: JSON.stringify(input),
				signal: abortSignal,
			});
		} else {
			const fetch_result = await app_fetch_main_chat({
				input: {
					...(input as any),
					threadId: window.rt0_chat_current_thread_id,
				},
			});
			if (fetch_result._nay) {
				throw fetch_result._nay;
			}

			result = fetch_result._yay.response;
		}

		await this.options.onResponse?.(result);

		try {
			if (!result.ok) {
				throw new Error(`Status ${result.status}: ${await result.text()}`);
			}
			if (!result.body) {
				throw new Error("Response body is null");
			}

			const stream = result.body
				.pipeThrough(new DataStreamDecoder())
				.pipeThrough(
					unstable_toolResultStream(context.tools, abortSignal, () => {
						throw new Error("Tool interrupt is not supported in data stream runtime");
					}),
				)
				.pipeThrough(new AssistantMessageAccumulator());

			yield* asAsyncIterableStream(stream);

			this.options.onFinish?.(unstable_getMessage());
		} catch (error: unknown) {
			this.options.onError?.(error as Error);
			throw error;
		}
	}
}

export const useDataStreamRuntime = (options: UseDataStreamRuntimeOptions): AssistantRuntime => {
	const { localRuntimeOptions, otherOptions } = splitLocalRuntimeOptions(options);

	return useLocalRuntime(new DataStreamRuntimeAdapter(otherOptions), localRuntimeOptions);
};

declare global {
	interface Window {
		rt0_chat_current_thread_id?: string | undefined;
	}
}
