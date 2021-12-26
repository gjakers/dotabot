const fs = require('fs');


const opendota = require('./modules/opendota.js');

// Load player data
let raw_players = fs.readFileSync('./players.json');
let players = JSON.parse(raw_players);

class PollResult {
	constructor() {
		this.games = {};
		this.wins = 0;
		this.losses = 0;
		this.rank = 0;
	}

	poll() {
		
	}

}


for (var discord_id in players) {
	let {name, id}  = players[discord_id];
	var player = new opendota.Player(id);

	player.matches( { date: 7 }).then(function(matches) {
		const wins = 0;
		const losses = 0;
		for (var match in matches) {

		}
	}).catch(function(err) {
        console.log(err);
    });
}
