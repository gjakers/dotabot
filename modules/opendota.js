/**
 * @file opendota.js
 * 
 * @description Contains code for making OpenDOTA API calls
 */

const request = require('request');

const API_URL = "https://api.opendota.com/api";
const CALL_INTERVAL_MS = 1100;
const REQUEST_TIMEOUT_MS = 10000;
const MAX_RETRIES = 5;
const DEFAULT_HEADERS = {'User-Agent': "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) " +
									   "AppleWebKit/537.36 (KHTML, like Gecko) " +
									   "Chrome/62.0.3202.94 " +
									   "Safari/537.36"};

var nextCall = Date.now();

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForRateLimit() {
	const now = Date.now();
	const scheduled = Math.max(now, nextCall);

	nextCall = scheduled + CALL_INTERVAL_MS;

	if (scheduled > now) {
		await sleep(scheduled - now);
	}
}

function requestOnce(cmd) {
	return new Promise((resolve, reject) => {
		request({
			url: API_URL + cmd,
			headers: DEFAULT_HEADERS,
			timeout: REQUEST_TIMEOUT_MS,
		}, (err, response, body) => {
			if (err) {
				return reject(err);
			}

			if (!response || response.statusCode < 200 || response.statusCode >= 300) {
				return reject (new Error(
					`OpenDota returned HTTP ${response?.statusCode ?? 'unknown'}`
				));
			}

			let parsed;

			try {
				parsed = JSON.parse(body);
			} catch {
				return reject(new Error('OpenDota returned invalid JSON'));
			}

			if (parsed?.error != null) {
				return reject(new Error(`OpenDota error: ${parsed.error}`));
			}

			resolve(parsed);
		});
	});
}

async function apiCall(cmd) {
    let lastError;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        await waitForRateLimit();

        try {
            return await requestOnce(cmd);
        } catch (err) {
            lastError = err;

            console.error(
                `OpenDota request failed (${attempt + 1}/${MAX_RETRIES + 1}): ${cmd}`,
                err.message
            );
        }
    }

    throw lastError;
}

function optionsString(options) {
	var str = '?';
	for (var option in options) {
		str += `${option}=${options[option]}&`;
	}
	return str;
}

async function getPlayer(id) {
	return apiCall(`/players/${id}`);
}

async function recentMatches(id) {
	return apiCall(`/players/${id}/recentMatches`);
}

function playerMatches(id, options) {
	return apiCall(`/players/${id}/matches/` + optionsString(options));
}

async function getMatch(id) {
	return apiCall(`/matches/${id}`);
}

async function playerWordcloud(id, options) {
	return apiCall(`/players/${id}/wordcloud/` + optionsString(options));
}

module.exports = { recentMatches, playerMatches, getMatch, getPlayer, playerWordcloud, };