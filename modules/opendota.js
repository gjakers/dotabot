const request   = require('request');

export class Player {

	constructor(id) {
		this.id = id;
		this.url = "/players/${id}";
	}
	async recentMatches() {
		return apiCall(url + "/recentMatches");
	}

	async matches(options) {
		return apiCall(url + "/matches/" + this.#optionsString(options));
	}

	#optionsString(options) {
		const str = '?';
		for (var option in options) {
			str += "${option}=${options[option]}&";
		}
	}
}

const default_headers = {'User-Agent': "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) " +
									   "AppleWebKit/537.36 (KHTML, like Gecko) " +
									   "Chrome/62.0.3202.94 " +
									   "Safari/537.36"};

async function apiCall(cmd) {
	var options = {
		url: "https://api.opendota.com/api" + cmd,
		headers: default_headers
	};

	return new Promise ((resolve, reject) => {
		request(options, function(err, response, body) {
			if (err)
				return reject(err);
			try {
				resolve(JSON.parse(body));
			} catch(e) {
				console.log("Opendota API failed: \n" + cmd + '\n');
				resolve('');
			}
		});
	});
}

export async function getMatch(id) {
	return apiCall("/matches/${id}");
}

