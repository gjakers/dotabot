const {Client, Intents } = require("discord.js");
require('dotenv').config();
const client  = new Client({ intents: [Intents.FLAGS.GUILDS,
									   Intents.FLAGS.GUILD_MESSAGES,
									   Intents.FLAGS.GUILD_MEMBERS]
						   });
const config = require('./config.json');
const { builtinModules } = require('module');
const { match } = require("assert");

const smok_timeout = require('./modules/timeout.js');
const dota = require('./modules/dota.js');


// Load player data
const fs = require('fs');
const { resolve } = require("path");
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
		data: {
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
	});

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


	client.guilds.fetch(guildId).then( guild => {
		//list_members(guild);
		dota.judgement(guild);
		// setInterval(dota.judgement, 3600000, guild);
	});
});

client.ws.on('INTERACTION_CREATE', async (interaction) => {
	switch(interaction.type) {
		case 2: // COMMAND
			switch (interaction.data.name.toLowerCase()) {
				case 'recent':
					dota.recent(client, interaction);
					break;
				case 'timeout':
					smok_timeout.timeoutCommand(client, interaction);
					break;
				default:
					console.log("Unknown command recieved!")
			}
			break;
		case 3: // BUTTON
			switch (interaction.data.custom_id.toLowerCase()) {
				case 'vote_yes':
				case 'vote_no':
					smok_timeout.timeoutButtons(client, interaction, command);
					break;
				default:
					console.log("Unknown button pressed!")
			}
			break;
	}
});

async function list_members(guild) {
	guild.members.fetch().then(members => {
        members.forEach(member => {
			console.log(member.user.username + " " + member.id)
		});
	});
}
