import assert from 'node:assert/strict';
import test from 'node:test';

import { parseGitHubReviewNotification } from '../src/github-review-notification.mjs';

test('parseGitHubReviewNotification extracts the minimum shape', () => {
	const out = parseGitHubReviewNotification({
		pullRequest: {
			number: 65,
			title: 'Feat/self update credentials',
			htmlUrl: 'https://github.com/org/repo/pull/65',
			authorLogin: 'FelipePacheco30',
		},
		review: {
			state: 'approved',
			reviewerLogin: 'JV-L0pes',
		},
		notification: {
			messageText: '  Fala. Vi a atualização do PR #65.  ',
		},
	});

	assert.equal(out.authorLogin, 'FelipePacheco30');
	assert.equal(out.reviewState, 'approved');
	assert.equal(out.messageText, 'Fala. Vi a atualização do PR #65.');
});

test('parseGitHubReviewNotification rejects missing authorLogin', () => {
	assert.throws(
		() =>
			parseGitHubReviewNotification({
				pullRequest: {},
				review: {},
				notification: { messageText: 'x' },
			}),
		/authorLogin is required/i,
	);
});
