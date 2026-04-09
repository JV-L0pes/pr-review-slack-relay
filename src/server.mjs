import { loadConfig } from './config.mjs';
import { createApp } from './app.mjs';

const config = loadConfig();
const app = createApp();

app.listen(config.port, () => {
	console.log(
		`pr-review-whatsapp-relay listening on http://localhost:${config.port}`,
	);
});
