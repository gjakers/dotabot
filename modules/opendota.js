const request = require('request');

const default_headers = {'User-Agent': "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) " +
									   "AppleWebKit/537.36 (KHTML, like Gecko) " +
									   "Chrome/62.0.3202.94 " +
									   "Safari/537.36"};

var nextCall = Date.now();

async function apiCall(cmd, tries = 0) {
	var options = {
		url: "https://api.opendota.com/api" + cmd,
		headers: default_headers
	};

	if (nextCall > Date.now()) {
		await new Promise(resolve => setTimeout(resolve, nextCall - Date.now()));
		return apiCall(cmd, tries);
	}

	nextCall = Date.now() + 1100;

	return new Promise ((resolve, reject) => {
		//process.stdout.write(tries + " ")
		request(options, function(err, response, body) {
			if (err) {
				console.log(body)
				if (tries > 5) {
					console.log("5 tries...rejecting")
				 	return reject(err);
				}
				else {
					console.log(`ERROR: ${err}\nretrying(${tries})`);
					return apiCall(cmd, ++tries);
				}
			}
			try {
				var parsed_body = JSON.parse(body);
				if(parsed_body.error != null) {
					return apiCall(cmd, ++tries);
				} else {
					resolve(parsed_body);
				}
			} catch(err) {
				console.log("Opendota API failed: \n" + cmd + '\n');
				resolve('');
			}
		});
	});
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