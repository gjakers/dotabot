const fs = require('fs');

const opendota = require('./opendota.js');

// Load player data
let raw_players = fs.readFileSync('./players.json');
let players = JSON.parse(raw_players);

const game_modes = {
	TURBO:   23,
	ALLPICK: 22,
	SPECIAL: 19,
};

const lobby_types = {
	UNRANKED: 0,
	RANKED: 7,
	SPECIAL: 12,
};

class Player {
	constructor(discord) {
		this.discord = discord;
		if(players.hasOwnProperty(discord)) {
			this.id = players[discord].id;
			this.name = players[discord].name;
		}
		this.games = [];
	}

	totals() {
		var totals = { unranked: 0, ranked: 0, turbo: 0, special: 0 };
		for (var game of this.games) {
			if (game.duration < 300)
				continue;
			if (game.game_mode == game_modes.TURBO)
				totals.turbo++;
			else if (game.game_mode == game_modes.SPECIAL)
				totals.special++;
			else if (game.lobby_type == lobby_types.RANKED)
				totals.ranked++;
			else if (game.lobby_type == lobby_types.UNRANKED)
				totals.unranked++;
		}
		return totals;
	}

	// Does user exist in server
	async exists(guild) {
		return guild.members.fetch(this.discord)
			.then(  function() { return true;  })
			.catch( function() { return false; })
	}

	async getRoles(guild) {
		return guild.members.fetch(this.discord).then( member => {
			return member.roles.cache;
		});
	}

	async hasRole(guild, role_name) {
		return guild.members.fetch(this.discord).then( member => {
			return member.roles.cache.find( role => {
				return (role.name === role_name);
			});
		});
	}

	async setRole(guild, role_name) {
		//Get role from server
		let role_set = guild.roles.cache.find((role) => {
			return role.name === role_name;
		});
		if (role_set == null) {
			console.log(`Unable to find role: ${role_name}`);
			return false;
		}
		//Assign role to user
		return guild.members.fetch(this.discord).then( member => {
			return member.roles.add(role_set);
		}).catch( function(err) {
			console.log("Failed to set role: " + err);
		});
	}

	async removeRole(guild, role_name) {
		//Get role from server
		let role_set = guild.roles.cache.find((role) => {
			return role.name === role_name;
		});
		if (role_set == null) {
			console.log(`Unable to find role: ${role_name}`);
			return false;
		}
		//Remove role from user
		return guild.members.fetch(this.discord).then( member => {
			return member.roles.remove(role_set);
		}).catch( function(err) {
			console.log("Failed to remove role: " + err);
		});
	}

	// Milliseconds since last match
	async lastPlayed() {
		var options = { limit: '50', significant: '0'};
		return opendota.playerMatches(this.id, options).then( matches => {
			for (var match of matches) {
				if (match.duration < 300)
					continue;
				if ((match.game_mode == game_modes.TURBO)	 ||
					(match.game_mode == game_modes.SPECIAL)  ||
					(match.lobby_type == lobby_types.RANKED) ||
					(match.lobby_type == lobby_types.UNRANKED))
				{						
					return (Date.now() - new Date(match.start_time*1000));
				}
			}
		});
	}

	async poll() {
		this.games = await this.#pollNormal();
		//this.games = this.games.concat(await this.#pollNormal());
		//this.games = this.games.concat(await this.#pollSpecial());
	}

	async #pollNormal() {
		var options = { date: '7', limit: '200', significant: '0'};
		return opendota.playerMatches(this.id, options).then(function(matches) {
			return matches;
		});
	}

	async #pollSpecial() {
		var options = { date: '7', limit: '200', significant: '0', game_mode: '19'};
		return opendota.playerMatches(this.id, options).then(function(matches) {
			return matches;
		});
	}
}

module.exports = { Player };