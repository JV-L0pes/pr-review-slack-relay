const MAX_MESSAGE_LENGTH = 900;

function normalizeWhitespace(value) {
	return value.replace(/\s+/g, " ").trim();
}

function truncate(value, max = MAX_MESSAGE_LENGTH) {
	if (value.length <= max) {
		return value;
	}
	return `${value.slice(0, max - 1).trimEnd()}…`;
}

function parseGitHubReviewNotification(payload) {
	if (!payload || typeof payload !== "object") {
		throw new Error("Payload must be an object.");
	}

	const pullRequest = payload.pullRequest;
	const review = payload.review;
	const notification = payload.notification;

	if (!pullRequest || typeof pullRequest !== "object") {
		throw new Error("Missing pullRequest in payload.");
	}
	if (!review || typeof review !== "object") {
		throw new Error("Missing review in payload.");
	}
	if (!notification || typeof notification !== "object") {
		throw new Error("Missing notification in payload.");
	}

	const authorLogin =
		typeof pullRequest.authorLogin === "string"
			? pullRequest.authorLogin.trim()
			: "";
	const messageText =
		typeof notification.messageText === "string"
			? truncate(normalizeWhitespace(notification.messageText))
			: "";

	if (!authorLogin) {
		throw new Error("pullRequest.authorLogin is required.");
	}
	if (!messageText) {
		throw new Error("notification.messageText is required.");
	}

	return {
		prNumber: pullRequest.number ?? null,
		prTitle:
			typeof pullRequest.title === "string" ? pullRequest.title.trim() : "",
		prUrl:
			typeof pullRequest.htmlUrl === "string" ? pullRequest.htmlUrl.trim() : "",
		authorLogin,
		reviewState:
			typeof review.state === "string" ? review.state.trim() : "commented",
		reviewerLogin:
			typeof review.reviewerLogin === "string"
				? review.reviewerLogin.trim()
				: "",
		commentKind:
			typeof review.commentKind === "string" ? review.commentKind.trim() : "",
		commentPath:
			typeof review.commentPath === "string" ? review.commentPath.trim() : "",
		commentLine:
			typeof review.commentLine === "number" ? review.commentLine : null,
		messageText,
	};
}

export { parseGitHubReviewNotification };
