import { buildBacklogSnapshot, buildPrQueueSnapshot } from "./cron-sync.mjs";
import { handleSlackSyncSnapshot } from "./handle-slack-sync-snapshot.mjs";

function ensureBacklogConfig(config) {
	if (!config.trelloKey || !config.trelloToken || !config.trelloBoardId) {
		throw new Error(
			"Missing TRELLO_KEY, TRELLO_TOKEN or TRELLO_BOARD_ID for backlog cron sync.",
		);
	}
}

async function handleBacklogCronSync(config, slack) {
	ensureBacklogConfig(config);
	const payload = await buildBacklogSnapshot(config);
	const result = await handleSlackSyncSnapshot(payload, config, slack);

	return {
		status: result.status,
		body: {
			...result.body,
			cron: "backlog",
		},
	};
}

async function handlePrQueueCronSync(config, slack) {
	const payload = await buildPrQueueSnapshot(config);
	const result = await handleSlackSyncSnapshot(payload, config, slack);

	return {
		status: result.status,
		body: {
			...result.body,
			cron: "pr_queue",
		},
	};
}

export { handleBacklogCronSync, handlePrQueueCronSync };
