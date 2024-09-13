/**
 * @file recent.js
 * 
 * @description Contains "/recent" command and associated functions
 */

const { EmbedBuilder, } = require("discord.js");
const opendota = require('./opendota.js');
const objects = require('./objects.js');

// RECENT command
async function recent(interaction) {
    await interaction.deferReply();
    var playerID = '';

    if(interaction.options.getSubcommand() === 'username') {
        var user = interaction.options.getUser('username');
        if(!objects.players.hasOwnProperty(user.id)) {
            interaction.editReply("No dotabuff registered for **" + user.username + "**!");
            return;
        }
        playerID = objects.players[user.id].id;
    }
    else if (interaction.options.getSubcommand() === 'id') {
        playerID = interaction.options.getString('id');
    }

	let header = "";
	let embeds = [];
    await opendota.recentMatches(playerID).then(function(matches) {
        if (matches.length)                             
        {
            embeds = recentEmbed(matches.slice(0,5));
            if(interaction.options.getSubcommand() === 'username'){
				header = "Recent matches for **" + user.username + "**";
            }
            else if (interaction.options.getSubcommand() === 'id') {
				header = "Recent matches for **" + playerID + "**";
            }
        } else {
            interaction.editReply("OpenDota is not working, or something");
			return;
        }
    }).catch(function(err) {
        console.log(err);
    });

	const replyMessage = await interaction.editReply({
		content: header,
		embeds: embeds,
		fetchReply: true
	});

	//await replyMessage.react('👍');

	if (replyMessage.partial) {
		try {
			await replyMessage.fetch();
		} catch (error) {
			console.error('Error fetching message: ', error);
			return;
		}
	}

	//Create reaction collector for response message
	try {
		const filter = (reaction, user) => !user.bot; // Ignore bot reactions
		const reactionCollector = await replyMessage.createReactionCollector({ filter, time: 60000});

		reactionCollector.on('collect', (reaction, user) => {
			console.log(`Reaction:${user.tag} ${reaction.emoji.name}`);
		});

		reactionCollector.on('end', collected => {
			if (collected.size === 0) {
				console.log('No reactions, deleting.');
				replyMessage.delete()
					.then(() => console.log('Message deleted.'))
					.catch(err => console.error('Failed to delete message: ', err));
			} else {
				console.log('Cancelling message deletion.');
			}
		});
	} catch (error) {
		console.error('Error handling reactions: ', error);
	}
}



// Create the embed for the /recent response
function recentEmbed(matches) {
	var embeds = [];
	matches.forEach(function(match) {
		var hero = objects.heroes[match['hero_id']];
		var duration_minutes = Math.floor(match.duration/60);
		var duration_seconds = String(match.duration % 60).padStart(2, '0');
		var won = (match.player_slot < 128) === match.radiant_win;

		var embed = new EmbedBuilder()
			.setURL((match.game_mode === 18 ? " https://windrun.io/matches/" : "https://www.dotabuff.com/matches/") + match.match_id)
			.setThumbnail(hero.image)
			.addFields(
				{ name: hero.name,
				  value: '[`' + (timeAgo(match.start_time + match.duration) + " ago").toString().padEnd(17, " ") + "`](" + 
                    (match.game_mode === 18 ? " https://windrun.io/matches/" : "https://www.dotabuff.com/matches/") + match.match_id + ")",
				  inline: true
				},
				{ name: match.game_mode === 18 ? "Ability Draft" :
                        ((objects.lobbies[match.lobby_type]) ? objects.lobbies[match.lobby_type].name : "Unknown" ).padEnd(11),
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

// Returns string of time elapsed since given timestamp
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


module.exports = {recent, };