import express from "express";

import { loadConfig } from "./config.mjs";
import {
	handleBacklogCronSync,
	handlePrQueueCronSync,
} from "./handle-cron-sync.mjs";
import { handleGitHubPrReviewNotify } from "./handle-github-pr-review-notify.mjs";
import { handleSlackSyncSnapshot } from "./handle-slack-sync-snapshot.mjs";
import { SlackClient } from "./slack-client.mjs";

function createApp() {
	const config = loadConfig();
	const slack = new SlackClient(config);
	const app = express();

	app.use(express.json({ limit: "256kb" }));

	function unauthorized(res) {
		return res.status(401).json({
			ok: false,
			error: "unauthorized",
		});
	}

	function webhookAuthorized(req) {
		const authorization = req.get("authorization") ?? "";
		const expected = `Bearer ${config.webhookBearerToken}`;
		return authorization === expected;
	}

	function cronAuthorized(req) {
		const authorization = req.get("authorization") ?? "";
		const expected = `Bearer ${config.cronSecret}`;
		return authorization === expected;
	}

	app.get("/health", (_req, res) => {
		res.json({
			ok: true,
			service: "pr-review-slack-relay",
			prAlertsChannelId: config.slackPrAlertsChannelId,
			backlogChannelId: config.slackBacklogChannelId,
		});
	});

	app.post("/github/pr-review-notify", async (req, res) => {
		if (!webhookAuthorized(req)) {
			return unauthorized(res);
		}

		try {
			const result = await handleGitHubPrReviewNotify(req.body, config, slack);
			return res.status(result.status).json(result.body);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "unknown_internal_error";
			return res.status(400).json({
				ok: false,
				error: message,
			});
		}
	});

	app.post("/slack/sync-snapshot", async (req, res) => {
		if (!webhookAuthorized(req)) {
			return unauthorized(res);
		}

		try {
			const result = await handleSlackSyncSnapshot(req.body, config, slack);
			return res.status(result.status).json(result.body);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "unknown_internal_error";
			return res.status(400).json({
				ok: false,
				error: message,
			});
		}
	});

	app.get("/cron/backlog-sync", async (req, res) => {
		if (!cronAuthorized(req)) {
			return unauthorized(res);
		}

		try {
			const result = await handleBacklogCronSync(config, slack);
			return res.status(result.status).json(result.body);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "unknown_internal_error";
			return res.status(400).json({
				ok: false,
				error: message,
			});
		}
	});

	app.get("/cron/pr-queue-sync", async (req, res) => {
		if (!cronAuthorized(req)) {
			return unauthorized(res);
		}

		try {
			const result = await handlePrQueueCronSync(config, slack);
			return res.status(result.status).json(result.body);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "unknown_internal_error";
			return res.status(400).json({
				ok: false,
				error: message,
			});
		}
	});

	return app;
}

export { createApp };
