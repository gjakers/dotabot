const Discord = require("discord.js");
require('dotenv').config();
const client  = new Discord.Client();
const fs = require('fs');
const config = require('./config.json');
const { builtinModules } = require('module');
const request   = require('request');
const { match } = require("assert");

// Load hero data
let raw_heroes = fs.readFileSync('./hero-images.json');
let heroes = JSON.parse(raw_heroes);

// Load lobbytype data
let raw_lobbies = fs.readFileSync('./lobby_type.json');
let lobbies = JSON.parse(raw_lobbies);

// Load player data
let raw_players = fs.readFileSync('./players.json');
let players = JSON.parse(raw_players);

const guildId = config.guildID;
const getApp = (guildId) => {
	const app = client.api.applications(client.user.id);
	if (guildId) {
		app.guilds(guildId);
	}
	return app;
}

client.login(config.token);

client.on("ready", async () => {
	console.log("Start...");
	client.user.setActivity('Shame Simulator 2');
	await getApp(guildId).commands.post({
		data: 
			{
				name: "recent",
				description: "Get recent matches of the player",
				options: [
					{
						name: "username",
						description: "Get match data using player's username",
						type: 1,
						options: [
							{
								name: "username",
								description: "Player's name",
								type: 6,
								required: true
							}
						]
					},
					{
						name: "id",
						description: "Get match data using player's ID#",
						type: 1,
						options: [
							{
								name: "id",
								description: "Player's ID#",
								type: 3,
								required: true
							}
						]
					}
				],
				name: "timeout",
				description: "Start a vote to put smok in timeout",
				options: [
					{
						name: "minutes",
						description: "How many minutes will the timeout be (1-60)",
						type: 4,
						required: true
					}
				]
			},
	})

	/* GET/DELETE COMMANDS
	 * Get guild commands
			const commands = await getApp(guildId).commands.get();
	 * Delete guild command
			await getApp(guildId).commands('856003677747544104').delete();
	 * Get Global commands
			const commands = await client.api.applications(client.user.id).commands.get();
	 * Delete Global commands
			await client.api.applications(client.user.id).commands('855997652528529428').delete();
	 */
});

let smok_votes = {};
const vote_types = {
	YES:  1,
	NO:	 -1,
	SMOK: 0,
};


client.ws.on('INTERACTION_CREATE', async (interaction) => {
	if(interaction.type == 2) // COMMAND
	{
		const { name, options } = interaction.data;
		const command = name.toLowerCase();

		if(command == 'recent') {		
			var subcommand = options[0].name;
			var playerID = '';
			var playerName = '';
			if(subcommand == 'username') {
				
				var player = await client.users.fetch(options[0].options[0].value.toString());
				console.log(player.username + " " + player.id );

				if(players.hasOwnProperty(player.id)) {
					playerID = players[player.id].id;
					playerName = player.username;
				} else {
					client.api.interactions(interaction.id, interaction.token).callback.post({
						data: {
							type: 4,
							data: {
								content: "No dotabuff registered for **" + player.username + "**!"
							}
						}
					});
					return;
				}
			}
			else if (subcommand == 'id') {
				playerID = options[0].options[0].value;
				playerName = playerID;
			}

			//var matches = await recentMatches(playerID);
			recentMatches(playerID).then(function(matches) {
				if (matches.length)                             
				{
					var embeds = recentEmbed(matches);
					client.api.interactions(interaction.id, interaction.token).callback.post({
						data: {
							type: 4,
							data: {
								content: "Recent matches for **" + playerName + "**",
								embeds: embeds,
							}
						}
					})
				} else {
					client.api.interactions(interaction.id, interaction.token).callback.post({
						data: {
							type: 4,
							data: {
								content: "OpenDota is not working, or something",
							}
						}
					})
				}
			}).catch(function(err) {
				console.log(err);
			});
			
		}
		if(command == 'timeout') {
			var timeout_length = options[0].value;
			if(timeout_length > 60) // too long! send ephemeral warning msg
			{
				client.api.interactions(interaction.id, interaction.token).callback.post({
					data: {
						type: 4,
						data: {
							flags: 1<<6,
							content: "You can't ban smok for more than 60 minutes!\nyet"
						}
					}
				});
			}
			else
			{
				client.api.interactions(interaction.id, interaction.token).callback.post({
					data : {
						type: 4,
						data: {
							content: "Does smok deserve a " + timeout_length + " minute ban?\nVotes:",
							components: [{
								type: 1,
								components: [
									{
										type: 2,
										label: "Yes",
										style: 3,
										custom_id: "vote_yes",
									},
									{
										type: 2,
										label: "No",
										style: 4,
										custom_id: "vote_no"
									}
								]	
							}]
						}
					}
				});
			}
		}
	}
	if (interaction.type == 3) // BUTTON
	{
		const command = interaction.data.custom_id.toLowerCase();
		if(command == 'vote_yes' || command == 'vote_no')
		{
			//Resolve buttonpress
			client.api.interactions(interaction.id, interaction.token).callback.post({
				data: {
					type: 6
				}
			});

			// Only hold vote for 3 minutes
			const since = (Date.now() - Date.parse(interaction.message.timestamp))/1000;
			if(since > 90) {
				return;
			}

			//Initialize count on first vote
			if(interaction.message.content.endsWith('Votes:')) {
				setTimeout(() => {
						closeVote(interaction.channel_id, interaction.message);
					},
					90000);
				smok_votes[interaction.message.id] = {
					count: 0,
					votes: [],
					users: {}
			};
			}	

			const user_id = interaction.member.user.id;
			if(smok_votes[interaction.message.id].users[user_id]) {
				return;
			}
			
			//Logging...
			var player = await client.users.fetch(user_id.toString());
			console.log(player.username + " " + command);

			smok_votes[interaction.message.id].users[user_id] = true;

			let emote = '';
			const voted_yes = (command == 'vote_yes');
			if(user_id == "872257325040291841") { // smok's vote
				smok_votes[interaction.message.id].votes.push(vote_types.SMOK);
				emote = ":face_vomiting:"
			}
			else if(voted_yes) {
				smok_votes[interaction.message.id].votes.push(vote_types.YES);
				smok_votes[interaction.message.id].count += 1;
				emote = ":white_check_mark:";
			}
			else {
				smok_votes[interaction.message.id].votes.push(vote_types.NO);
				smok_votes[interaction.message.id].count -= 1;
				emote = ":negative_squared_cross_mark:";
			}
			
			client.api.channels(interaction.channel_id).messages(interaction.message.id).patch({
				data: {
					content: interaction.message.content + emote
				}
			});
		}
	}
})

//End the vote
function closeVote(channel_id, message) {
	var ban_duration = message.content.match(/(\d+)/)[0];
	console.log("ban duration: " + ban_duration);
	var banned = smok_votes[message.id].count > 2;

	let emotes = ''; //Re-create vote emote string
	for (const vote of smok_votes[message.id].votes) {
		switch (vote) {
			case vote_types.YES:
				emotes += ":white_check_mark:"; break;
			case vote_types.NO:
				emotes += ":negative_squared_cross_mark:"; break;
			case vote_types.SMOK:
				emotes += ":face_vomiting:"; break;
		}
	}

	//Announce result, gray-out buttons
	client.api.channels(channel_id).messages(message.id).patch({
		data: {
			content: message.content + emotes + "\n*The vote has ended.*\n**Smok is " + (banned ? "banned.**" : "not banned.**"),
			components: [{
				type: 1,
				components: [
					{
						type: 2,
						label: "Yes",
						style: 2,
						custom_id: "vote_yes",
					},
					{
						type: 2,
						label: "No",
						style: 2,
						custom_id: "vote_no"
					}
				]	
			}]
		}
	});
	
	if(banned) { //Ban smok  872257325040291841
		timeoutUser('872257325040291841', ban_duration);
	}
}

// Give user 'silenced' role and remove 'dota' role, reverse if minutes = 0
async function timeoutUser(user_id, minutes) {
	client.guilds.fetch(guildId).then( guild => {
		//Get 'silenced' role
		let silenced = guild.roles.cache.find((role) => {
			return role.name === 'silenced'
		});
		//Get 'dota' role
		let dota = guild.roles.cache.find((role) => {
			return role.name == 'dota'
		});
		guild.members.fetch(user_id).then( member => {
			if(minutes) {
				member.roles.add(silenced);
				member.roles.remove(dota);
			} else {
				member.roles.add(dota);
				member.roles.remove(silenced);
			}
		}).catch(function(err) {
			console.log(err);
		});;
	});

	//Schedule the un-banning
	if(minutes) {
		setTimeout(() => { timeoutUser(user_id, 0) }, minutes*60*1000 );
	}
}


function timeAgo(seconds) {
	let time_since = (Date.now() - new Date(seconds * 1000))/60000; //convert to minutes
	var unit = "minute";
	if(time_since >= 1440) {
		time_since /= 1440;
		unit = "day";
	}
	else if(time_since >= 60) {
		time_since /= 60;
		unit = "hour";
	}
	return Math.floor(time_since).toString() + " " + unit + ((Math.floor(time_since) > 1) ? "s" : "");
}

function recentEmbed(matches) {
	var embeds = [];
	matches.forEach(function(match) {
		//console.log(match);
		var hero = heroes[match['hero_id']];
		var duration_minutes = Math.floor(match.duration/60);
		var duration_seconds = String(match.duration % 60).padStart(2, '0');
		var won = (match.player_slot < 128) === match.radiant_win;

		var embed = new Discord.MessageEmbed()
			//.setAuthor(hero.name, hero.image, "https://www.dotabuff.com/matches/" + match.match_id)
			//.setTitle(hero.name)
			//.setURL("https://www.dotabuff.com/matches/" + match.match_id)
			// .setAuthor(won ? "Won Match" : "Lost Match",
			// 	       won ? "https://i.imgur.com/8BF2K0L.gif" : "https://cdn.betterttv.net/emote/5f0901cba2ac620530368579/3x.gif",
			// 		   "https://www.dotabuff.com/matches/" + match.match_id
			// )
			.setURL("https://www.dotabuff.com/matches/" + match.match_id)
			.setThumbnail(hero.image)
			.addFields(
				{ name: hero.name,
				  value: '[`' + (timeAgo(match.start_time + match.duration) + " ago").toString().padEnd(17, " ") + "`](https://www.dotabuff.com/matches/" + match.match_id + ")",
				  inline: true
				},
				{ name: ((lobbies[match.lobby_type]) ? lobbies[match.lobby_type].name : "Unknown" ).padEnd(11),
				  value: '`'+ ("KDA " + match.kills + '/' + match.deaths + '/' + match.assists).padEnd(12, " ") + '`',
				  inline: true
				},
				{ name: ((match.party_size > 1) ? (":busts_in_silhouette:x" + match.party_size) : "Solo").padEnd(12),
				  value: '`'+ ("Duration " + duration_minutes + ":" + duration_seconds).padEnd(15, " ") +'`',
				  inline: true
				},
			)
			.setColor(won ? '#a9cf54' : '#c23c2a' )
		embeds.push(embed);
	});
	return embeds;

}


const default_headers = {'User-Agent': "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) " +
									   "AppleWebKit/537.36 (KHTML, like Gecko) " +
									   "Chrome/62.0.3202.94 " +
									   "Safari/537.36"};

	
async function recentMatches(id) {
	var options = { url: "https://api.opendota.com/api/players/" + id + "/recentMatches",
				    headers: default_headers
				};
	return new Promise ((resolve, reject) => {
		request(options, function(err, response, body) {
			if (err) return reject(err);
			try{
				resolve(JSON.parse(body).slice(0,5));
				//resolve(JSON.parse("{}{}<<<<sdflksmlfs"));
			} catch(e){
				console.log("here");
				resolve('');
			}
		});
	});
}

function getMatch(id) {
	var options = { url:"https://api.opendota.com/api/matches/" + id,
					headers: default_headers
				};
	request(options, function(err, response, body) {
		//console.log(JSON.parse(body));
	
			});
}