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
        console.log("recent: " + user.username + " " + user.id );

        if(!objects.players.hasOwnProperty(user.id)) {
            interaction.editReply("No dotabuff registered for **" + user.username + "**!");
            return;
        }
        playerID = objects.players[user.id].id;
    }
    else if (interaction.options.getSubcommand() === 'id') {
        playerID = interaction.options.getString('id');
        console.log("recent: " + playerID );
    }

    opendota.recentMatches(playerID).then(function(matches) {
        if (matches.length)                             
        {
            var embeds = recentEmbed(matches.slice(0,5));
            if(interaction.options.getSubcommand() === 'username'){
                interaction.editReply({ content: "Recent matches for **" + user.username + "**", 
                                    embeds: embeds, });
            }
            else if (interaction.options.getSubcommand() === 'id') {
                interaction.editReply({ content: "Recent matches for **" + playerID + "**", 
                                        embeds: embeds, });
            }
        } else {
            interaction.editReply("OpenDota is not working, or something");
        }
    }).catch(function(err) {
        console.log(err);
    });
}

function recentEmbed(matches) {
	var embeds = [];
	matches.forEach(function(match) {
        console.log(match['hero_id']);
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