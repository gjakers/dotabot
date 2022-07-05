const {Client, Intents } = require("discord.js");
require('dotenv').config();
const client  = new Client({ intents: [Intents.FLAGS.GUILDS,
									   Intents.FLAGS.GUILD_MESSAGES,
									   Intents.FLAGS.GUILD_MEMBERS]
						   });
const dota = require('./modules/dota.js');


const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { SlashCommandBuilder } = require('@discordjs/builders');

// Load player data
const fs = require('fs');
let raw_players = fs.readFileSync('./players.json');
let players = JSON.parse(raw_players);

const guildId = process.env.GUILD_ID;
const clientId = process.env.CLIENT_ID;
const getApp = (guildId) => {
	const app = client.api.applications(client.user.id);
	if (guildId) {
		app.guilds(guildId);
	}
	return app;
}

const recentcommand = new SlashCommandBuilder()
	.setName('recent')
	.setDescription("Get recent matches of the player")
	.addSubcommand(subcommand => subcommand
		.setName('username')
		.setDescription("Get match data using player's username")
		.addUserOption(option => option
			.setName('username')
			.setDescription("Player's name")
			.setRequired(true)
		))
	.addSubcommand(subcommand => subcommand
		.setName('id')
		.setDescription("Get match data using player's ID#")
		.addStringOption(option => option
			.setName('id')
			.setDescription("Player's ID#")
			.setRequired(true)
		));
const weeklyCommand = new SlashCommandBuilder()
	.setName('weekly')
	.setDescription("Weekly dota stats")
	.addUserOption(option => option
		.setName('username')
		.setDescription("Player's name")
		.setRequired(true)
	)	

const commands = [recentcommand, weeklyCommand, ];
const rest = new REST({ version: '9'}).setToken(process.env.DISCORD_SECRET_TOKEN);
(async () => {
	try {
		await rest.put(
			Routes.applicationGuildCommands(clientId, guildId),
			{ body: commands },
		);
	} catch (error) {
		console.log(error);
	}
})();

client.login(process.env.DISCORD_SECRET_TOKEN);
client.on("ready", async () => {
	console.log("Start...");
	client.user.setActivity('Shame Simulator 2');


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
	    setInterval(dota.judgement, 3600000, guild);
	});
});

client.on('interactionCreate', async (interaction) => {
	if(interaction.isCommand()) {
		switch(interaction.commandName) {
			case 'recent':
				dota.recent(interaction);
				break;
			case 'weekly':
				dota.weekly(interaction);
				break;
			default:
				console.log("Unknown command received!")
				break;
		}
		return;
	}

	if(interaction.isButton()) {
		return;
	}
});

async function list_members(guild) {
	guild.members.fetch().then(members => {
        members.forEach(member => {
			console.log(member.user.username + " " + member.id)
		});
	});
}
