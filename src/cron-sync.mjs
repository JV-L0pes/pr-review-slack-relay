const GITHUB_API_VERSION = "2022-11-28";

function normalizeList(items) {
	return items.filter(Boolean);
}

async function githubGetJson(url, githubToken) {
	const headers = {
		Accept: "application/vnd.github+json",
		"X-GitHub-Api-Version": GITHUB_API_VERSION,
	};

	if (githubToken) {
		headers.Authorization = `Bearer ${githubToken}`;
	}

	const response = await fetch(url, { headers });
	if (!response.ok) {
		const body = await response.text();
		throw new Error(`GitHub API ${response.status} for ${url}: ${body}`);
	}

	return response.json();
}

async function trelloGetJson(path, { key, token }) {
	const url = new URL(`https://api.trello.com/1${path}`);
	url.searchParams.set("key", key);
	url.searchParams.set("token", token);

	const response = await fetch(url);
	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Trello API ${response.status} for ${url}: ${body}`);
	}

	return response.json();
}

async function vercelGetJson(path, { token, teamId }) {
	const url = new URL(`https://api.vercel.com${path}`);
	if (teamId) {
		url.searchParams.set("teamId", teamId);
	}

	const response = await fetch(url, {
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
	});
	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Vercel API ${response.status} for ${url}: ${body}`);
	}

	return response.json();
}

function asArray(value) {
	return Array.isArray(value) ? value : [];
}

function countCardsByList(lists) {
	return lists.map((list) => ({
		name: list.name,
		count: Array.isArray(list.cards) ? list.cards.length : 0,
	}));
}

function summarizeCards(cards, limit = 3) {
	return cards.slice(0, limit).map((card) => {
		const link = card.shortUrl ? ` (${card.shortUrl})` : "";
		return `- \`${card.name}\`${link}`;
	});
}

function buildMembersById(members) {
	return new Map(
		members
			.filter((member) => member.fullName !== "AGÊNCIA BLACKCLOUD")
			.map((member) => [member.id, member]),
	);
}

function ownerLabel(card, membersById) {
	const owners = (card.idMembers ?? [])
		.map((memberId) => membersById.get(memberId))
		.filter(Boolean)
		.map((member) => member.fullName || member.username || "unknown");

	if (owners.length === 0) {
		return "sem responsável";
	}

	return owners.join(", ");
}

function buildPendingCardGroups(trelloLists, membersById) {
	const pendingStatuses = [
		"BACKLOG DA SPRINT",
		"READY",
		"DOING",
		"REVIEW",
		"BLOCKED",
		"CONDITIONAL",
	];

	const allPendingCards = pendingStatuses.flatMap((status) => {
		const cards =
			trelloLists.find((list) => list.name.toUpperCase() === status)?.cards ??
			[];

		return cards.map((card) => ({
			status,
			card,
			owner: ownerLabel(card, membersById),
			hasOwner: (card.idMembers ?? []).length > 0,
		}));
	});

	const formatLine = ({ status, card, owner }) => {
		const link = card.shortUrl ? ` | ${card.shortUrl}` : "";
		return `- [${status}] \`${card.name}\` | owner: ${owner}${link}`;
	};

	return {
		inProgressLines: allPendingCards
			.filter(({ status }) => ["DOING", "REVIEW"].includes(status))
			.map(formatLine),
		withOwnerLines: allPendingCards
			.filter(
				({ status, hasOwner }) =>
					!["DOING", "REVIEW"].includes(status) && hasOwner,
			)
			.map(formatLine),
		withoutOwnerLines: allPendingCards
			.filter(
				({ status, hasOwner }) =>
					!["DOING", "REVIEW"].includes(status) && !hasOwner,
			)
			.map(formatLine),
	};
}

function buildDocsLinks({ repository, defaultBranch }) {
	const base = `https://github.com/${repository}/blob/${defaultBranch}`;
	return [
		`- Sprint Goal: ${base}/docs/agile/sprint-1-goal.md`,
		`- Sprint backlog: ${base}/docs/agile/sprint-backlog.md`,
		`- Task breakdown: ${base}/docs/agile/sprint-1-task-breakdown.md`,
		`- Docs index: ${base}/docs/README.md`,
	];
}

async function loadRepository(repository, githubToken) {
	return githubGetJson(
		`https://api.github.com/repos/${repository}`,
		githubToken,
	);
}

async function loadOpenPullRequests(repository, githubToken) {
	const prs = await githubGetJson(
		`https://api.github.com/repos/${repository}/pulls?state=open&per_page=50`,
		githubToken,
	);
	return Array.isArray(prs) ? prs : [];
}

async function loadTrelloBoard(boardId, trelloCreds) {
	return trelloGetJson(
		`/boards/${boardId}?fields=name,url,shortUrl,shortLink`,
		trelloCreds,
	);
}

async function loadTrelloLists(boardId, trelloCreds) {
	const lists = await trelloGetJson(
		`/boards/${boardId}/lists?fields=name,closed&cards=open&card_fields=name,shortUrl,due,dueComplete,idMembers`,
		trelloCreds,
	);
	return Array.isArray(lists) ? lists.filter((list) => !list.closed) : [];
}

async function loadTrelloMembers(boardId, trelloCreds) {
	const members = await trelloGetJson(
		`/boards/${boardId}/members?fields=fullName,username`,
		trelloCreds,
	);
	return Array.isArray(members) ? members : [];
}

function buildBacklogSnapshotPayload({
	repository,
	defaultBranch,
	trelloBoard,
	trelloLists,
	trelloMembers,
	pullRequests,
}) {
	const membersById = buildMembersById(trelloMembers);
	const counts = countCardsByList(trelloLists);
	const doingCards =
		trelloLists.find((list) => list.name.toUpperCase() === "DOING")?.cards ??
		[];
	const reviewCards =
		trelloLists.find((list) => list.name.toUpperCase() === "REVIEW")?.cards ??
		[];
	const blockedCards =
		trelloLists.find((list) => list.name.toUpperCase() === "BLOCKED")?.cards ??
		[];
	const conditionalCards =
		trelloLists.find((list) => list.name.toUpperCase() === "CONDITIONAL")
			?.cards ?? [];

	const trelloLines = [
		`- Board: ${trelloBoard.url}`,
		...counts.map((item) => `- \`${item.name}\`: ${item.count} cards`),
	];

	const highlightLines = normalizeList([
		...summarizeCards(doingCards),
		...summarizeCards(reviewCards),
		...summarizeCards(blockedCards),
		...summarizeCards(conditionalCards),
	]);
	const pendingCardGroups = buildPendingCardGroups(trelloLists, membersById);

	const prLines =
		pullRequests.length > 0
			? pullRequests
					.sort((left, right) => right.number - left.number)
					.map(
						(pr) =>
							`- \`#${pr.number}\` ${pr.title} (${pr.head?.ref ?? "unknown"} -> ${
								pr.base?.ref ?? "unknown"
							}) - ${pr.html_url}`,
					)
			: ["- Nenhum PR aberto no momento."];

	return {
		snapshot: {
			snapshotKey: "backlog_sprint_status",
			channelTarget: "backlog",
			title: `${trelloBoard.name} - Snapshot Operacional`,
			statusLine: `*Repositório:* ${repository}\n*Sprint:* Sprint 1\n*Branch de referência:* ${defaultBranch}\n*Atualização:* board, PRs e docs reconciliados`,
			trelloLines,
			highlightLines:
				highlightLines.length > 0
					? highlightLines
					: [
							"- Nenhum card em DOING, REVIEW, BLOCKED ou CONDITIONAL no momento.",
						],
			pendingCardGroups,
			prLines,
			docLines: buildDocsLinks({ repository, defaultBranch }),
			operationalLines: [
				"- Este snapshot reconcilia board do Trello, PRs abertos e documentação versionada.",
				"- As pendências agora ficam separadas entre em andamento/review, com owner e sem owner.",
				"- Divergência entre board, docs e código deve ser tratada como bloqueio de coordenação.",
				"- Atualização automática pelo scheduler externo do relay.",
			],
			generatedAt: new Date().toLocaleString("pt-BR", {
				timeZone: "America/Sao_Paulo",
			}),
		},
	};
}

function hoursSince(value) {
	return Math.max(
		0,
		Math.floor((Date.now() - new Date(value).getTime()) / (1000 * 60 * 60)),
	);
}

async function loadReviews(repository, prNumber, githubToken) {
	const reviews = await githubGetJson(
		`https://api.github.com/repos/${repository}/pulls/${prNumber}/reviews?per_page=100`,
		githubToken,
	);
	return Array.isArray(reviews) ? reviews : [];
}

function summarizeLatestReview(reviews) {
	const meaningful = reviews.filter((review) =>
		["APPROVED", "CHANGES_REQUESTED"].includes(review.state),
	);
	if (meaningful.length === 0) {
		return null;
	}
	return meaningful.sort(
		(left, right) =>
			new Date(right.submitted_at).getTime() -
			new Date(left.submitted_at).getTime(),
	)[0];
}

function classifyPullRequest(pr, latestReview) {
	if (latestReview?.state === "CHANGES_REQUESTED") {
		return "changes_requested";
	}
	if (latestReview?.state === "APPROVED") {
		return "approved";
	}
	if ((pr.requested_reviewers?.length ?? 0) > 0) {
		return "awaiting_review";
	}
	return "open";
}

function formatStatusLabel(status) {
	switch (status) {
		case "changes_requested":
			return "CHANGES_REQUESTED";
		case "approved":
			return "APPROVED";
		case "awaiting_review":
			return "AGUARDANDO_REVIEW";
		default:
			return "ABERTO";
	}
}

function buildStatusCounts(items) {
	const counts = {
		changes_requested: 0,
		approved: 0,
		awaiting_review: 0,
		open: 0,
	};
	for (const item of items) {
		counts[item.status] += 1;
	}
	return counts;
}

function buildPrQueueSnapshotPayload({ repository, defaultBranch, items }) {
	const counts = buildStatusCounts(items);
	const groupedByBase = items.reduce((acc, item) => {
		const key = item.baseRef ?? "unknown";
		acc.set(key, [...(acc.get(key) ?? []), item]);
		return acc;
	}, new Map());

	const prLines =
		items.length > 0
			? items.map((item) => {
					const age = `${hoursSince(item.createdAt)}h`;
					const reviewBy = item.latestReviewer
						? ` | reviewer: ${item.latestReviewer}`
						: "";
					return `- \`#${item.number}\` ${formatStatusLabel(item.status)} | ${item.title} | ${item.authorLogin} | ${item.headRef} -> ${item.baseRef} | idade: ${age}${reviewBy} | ${item.htmlUrl}`;
				})
			: ["- Nenhum PR aberto no momento."];

	const highlightLines = Array.from(groupedByBase.entries()).map(
		([baseRef, prItems]) => `- \`${baseRef}\`: ${prItems.length} PR(s) abertos`,
	);

	return {
		snapshot: {
			snapshotKey: "pr_queue_status",
			channelTarget: "pr_alerts",
			title: "Fila de PRs - Snapshot Operacional",
			statusLine: `*Repositório:* ${repository}\n*Branch padrão:* ${defaultBranch}\n*Total abertos:* ${items.length}\n*Resumo:* ${counts.changes_requested} changes requested, ${counts.approved} approved, ${counts.awaiting_review} aguardando review, ${counts.open} abertos sem decisão`,
			trelloLines: [],
			highlightLines,
			prLines,
			docLines: [
				`- PR template: https://github.com/${repository}/blob/${defaultBranch}/.github/PULL_REQUEST_TEMPLATE.md`,
				`- Quality flow: https://github.com/${repository}/blob/${defaultBranch}/docs/quality/README.md`,
				`- PRs abertos: https://github.com/${repository}/pulls`,
			],
			operationalLines: [
				"- Este snapshot consolida a fila atual de PRs abertos no repositório.",
				"- Alertas imediatos de APPROVED, CHANGES_REQUESTED e comentários continuam chegando por evento separado.",
				"- Atualização automática pelo scheduler externo do relay.",
			],
			generatedAt: new Date().toLocaleString("pt-BR", {
				timeZone: "America/Sao_Paulo",
			}),
		},
	};
}

function sanitizeDeployChannelTarget(value) {
	if (value === "deploy") {
		return "deploy";
	}
	return value === "backlog" ? "backlog" : "pr_alerts";
}

function formatDeployState(state) {
	switch (state) {
		case "READY":
			return "READY";
		case "ERROR":
			return "ERROR";
		case "CANCELED":
			return "CANCELED";
		case "BUILDING":
			return "BUILDING";
		case "QUEUED":
			return "QUEUED";
		default:
			return state || "UNKNOWN";
	}
}

function buildDeployStateCounts(deployments) {
	return deployments.reduce((acc, deployment) => {
		const state = formatDeployState(deployment.state);
		acc[state] = (acc[state] ?? 0) + 1;
		return acc;
	}, {});
}

function formatRelativeMinutes(createdAt) {
	const createdTime = new Date(createdAt).getTime();
	if (!Number.isFinite(createdTime)) {
		return "idade desconhecida";
	}
	const minutes = Math.max(0, Math.floor((Date.now() - createdTime) / 60000));
	if (minutes < 60) {
		return `${minutes}min atrás`;
	}
	return `${Math.floor(minutes / 60)}h atrás`;
}

function deploymentLink(deployment) {
	if (deployment.url) {
		return `https://${deployment.url}`;
	}
	return "sem url";
}

function buildDeployStatusSnapshotPayload({
	projectId,
	deployments,
	channelTarget,
}) {
	const stateCounts = buildDeployStateCounts(deployments);
	const stateSummary = Object.entries(stateCounts)
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([state, count]) => `${state}: ${count}`)
		.join(", ");

	const latestProduction = deployments.find(
		(deployment) => deployment.target === "production",
	);
	const latestPreview = deployments.find(
		(deployment) => deployment.target !== "production",
	);
	const currentState = latestProduction
		? formatDeployState(latestProduction.state)
		: "SEM_DEPLOY_PROD";
	const currentHealth =
		currentState === "READY" ? "SAUDAVEL" : "ATENCAO";

	const highlightLines = [
		latestProduction
			? `- Prod: \`${formatDeployState(latestProduction.state)}\` | ${deploymentLink(
					latestProduction,
				)} | ${formatRelativeMinutes(latestProduction.createdAt)}`
			: "- Prod: nenhum deploy recente encontrado.",
		latestPreview
			? `- Preview: \`${formatDeployState(latestPreview.state)}\` | ${deploymentLink(
					latestPreview,
				)} | ${formatRelativeMinutes(latestPreview.createdAt)}`
			: "- Preview: nenhum deploy recente encontrado.",
	];

	const deployLines =
		deployments.length > 0
			? deployments.map((deployment) => {
					const actor =
						deployment.creator?.username ||
						deployment.creator?.email ||
						"unknown";
					const gitRef = deployment.meta?.githubCommitRef || "sem-branch";
					const gitSha = deployment.meta?.githubCommitSha
						? deployment.meta.githubCommitSha.slice(0, 7)
						: "sem-sha";
					return `- \`${formatDeployState(deployment.state)}\` | ${deployment.target || "preview"} | ${gitRef} (${gitSha}) | by ${actor} | ${formatRelativeMinutes(
						deployment.createdAt,
					)} | ${deploymentLink(deployment)}`;
				})
			: ["- Nenhum deploy encontrado para o projeto informado."];

	return {
		snapshot: {
			snapshotKey: "deploy_status",
			channelTarget: sanitizeDeployChannelTarget(channelTarget),
			title: "Deploy Status - Vercel",
			statusLine: `*Projeto:* ${projectId}\n*Status atual (produção):* ${currentState}\n*Saude operacional:* ${currentHealth}\n*Deploys monitorados:* ${
				deployments.length
			}\n*Estados:* ${stateSummary || "sem dados"}`,
			trelloLines: [],
			highlightLines,
			pendingCardGroups: {
				inProgressLines: [],
				withOwnerLines: [],
				withoutOwnerLines: [],
			},
			prLines: [],
			deployLines,
			docLines: [
				"- Dashboard Vercel: https://vercel.com/dashboard",
				"- Deployments API: https://vercel.com/docs/rest-api/reference/endpoints/deployments/list-deployments",
			],
			operationalLines: [
				"- Snapshot automático de deploy na Vercel disparado pelo cron externo.",
				"- Use este estado junto com os snapshots de backlog/PR para decidir priorização de incidentes.",
			],
			generatedAt: new Date().toLocaleString("pt-BR", {
				timeZone: "America/Sao_Paulo",
			}),
		},
	};
}

async function buildBacklogSnapshot(config) {
	const trelloCreds = {
		key: config.trelloKey,
		token: config.trelloToken,
	};
	const [repoInfo, pullRequests, trelloBoard, trelloLists, trelloMembers] =
		await Promise.all([
			loadRepository(config.githubRepository, config.githubToken),
			loadOpenPullRequests(config.githubRepository, config.githubToken),
			loadTrelloBoard(config.trelloBoardId, trelloCreds),
			loadTrelloLists(config.trelloBoardId, trelloCreds),
			loadTrelloMembers(config.trelloBoardId, trelloCreds),
		]);

	return buildBacklogSnapshotPayload({
		repository: config.githubRepository,
		defaultBranch: repoInfo.default_branch ?? "main",
		trelloBoard,
		trelloLists,
		trelloMembers,
		pullRequests,
	});
}

async function buildPrQueueSnapshot(config) {
	const [repoInfo, prs] = await Promise.all([
		loadRepository(config.githubRepository, config.githubToken),
		loadOpenPullRequests(config.githubRepository, config.githubToken),
	]);

	const items = await Promise.all(
		prs
			.sort((left, right) => right.number - left.number)
			.map(async (pr) => {
				const reviews = await loadReviews(
					config.githubRepository,
					pr.number,
					config.githubToken,
				);
				const latestReview = summarizeLatestReview(reviews);
				return {
					number: pr.number,
					title: pr.title,
					htmlUrl: pr.html_url,
					authorLogin: pr.user?.login ?? "unknown",
					baseRef: pr.base?.ref ?? "unknown",
					headRef: pr.head?.ref ?? "unknown",
					createdAt: pr.created_at,
					status: classifyPullRequest(pr, latestReview),
					latestReviewer: latestReview?.user?.login ?? null,
				};
			}),
	);

	return buildPrQueueSnapshotPayload({
		repository: config.githubRepository,
		defaultBranch: repoInfo.default_branch ?? "main",
		items,
	});
}

async function buildDeployStatusSnapshot(config) {
	if (!config.vercelApiToken) {
		throw new Error(
			"Missing VERCEL_API_TOKEN for deploy cron sync.",
		);
	}
	if (!config.vercelProjectId) {
		throw new Error(
			"Missing VERCEL_PROJECT_ID for deploy cron sync.",
		);
	}

	const result = await vercelGetJson(
		`/v6/deployments?projectId=${encodeURIComponent(
			config.vercelProjectId,
		)}&limit=${config.vercelDeployListLimit}`,
		{
			token: config.vercelApiToken,
			teamId: config.vercelTeamId,
		},
	);
	const deployments = asArray(result.deployments);

	return buildDeployStatusSnapshotPayload({
		projectId: config.vercelProjectId,
		deployments,
		channelTarget: config.deploySnapshotChannelTarget,
	});
}

export { buildBacklogSnapshot, buildPrQueueSnapshot, buildDeployStatusSnapshot };
