const Discord = require("discord.js");
require('dotenv').config();
const client  = new Discord.Client();
const config = require('./config.json');
const { builtinModules } = require('module');
const { match } = require("assert");

const smok_timeout = require('./timeout.js');
const dota = require('./dota.js');

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

client.ws.on('INTERACTION_CREATE', async (interaction) => {
	if(interaction.type == 2) // COMMAND
	{
		const { name, options } = interaction.data;
		const command = name.toLowerCase();

		switch (command) {
			case 'recent':
				dota.recent(client, interaction);
				break;
			case 'timeout':
				smok_timeout.timeoutCommand(client, interaction);
				break;
			default:
				console.log("Unknown command recieved!")
		}
	}
	if (interaction.type == 3) // BUTTON
	{
		const command = interaction.data.custom_id.toLowerCase();
		switch (command) {
			case 'vote_yes':
			case 'vote_no':
				smok_timeout.timeoutButtons(client, interaction, command);
				break;
			default:
				console.log("Unknown button pressed!")
		}
	}
})

