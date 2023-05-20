const { match } = require("assert");
const { EmbedBuilder } = require("discord.js");
const fs = require('fs');
const opendota = require('./opendota.js');
const player = require('./player.js');

// Load hero data
let raw_heroes = fs.readFileSync('./hero-images.json');
let heroes = JSON.parse(raw_heroes);
// Load lobbytype data
let raw_lobbies = fs.readFileSync('./lobby_type.json');
let lobbies = JSON.parse(raw_lobbies);
// Load player data
let raw_players = fs.readFileSync('./players.json');
let players = JSON.parse(raw_players);


// RECENT command
async function recent(interaction) {
    await interaction.deferReply();
    var playerID = '';

    if(interaction.options.getSubcommand() === 'username') {
        var user = interaction.options.getUser('username');
        console.log("recent: " + user.username + " " + user.id );

        if(!players.hasOwnProperty(user.id)) {
            interaction.editReply("No dotabuff registered for **" + user.username + "**!");
            return;
        }
        playerID = players[user.id].id;
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
        console.log(match['hero_id'])
		var hero = heroes[match['hero_id']];
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
                        ((lobbies[match.lobby_type]) ? lobbies[match.lobby_type].name : "Unknown" ).padEnd(11),
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


// WEEKLY command
async function weekly(interaction) {
    await interaction.deferReply();
    var user = interaction.options.getUser('username');

    console.log("weekly: " + user.username + " " + user.id );

    if(!players.hasOwnProperty(user.id)) {
        interaction.editReply("No dotabuff registerered for **" + user.username + "**!");
        return;
    }

    var playerID = players[user.id].id;

    opendota.playerMatches(playerID, { "date": 7, "significant": 0}).then(function(matches) {
        opendota.getPlayer(playerID).then(async function(player) {
            if(matches.length == 0) {
                var nogames = new EmbedBuilder()
                    .setTitle(user.username + "'s week in DotA 2")
                    .setURL("https://www.opendota.com/players/" + players[user.id].id + "/matches?date=7&significant=0")
                    .setThumbnail(player.profile.avatarmedium)
                    .setFooter({text: "They didn't play! Sad!", iconURL: "https://static.wikia.nocookie.net/dota2_gamepedia/images/1/17/Emoticon_sick.gif"})

                interaction.editReply({ embeds: [nogames], });
                return;
            }

            let stats = weeklyStats(matches);
            var embeds = weeklyStart(matches, user, player, stats);
            interaction.editReply({ embeds: embeds, });
        }).catch(function(err) {
            console.log(err);
        });
    }).catch(function(err) {
        console.log(err);
    });
}

function weeklyStart(matches, user, player, stats) {
    let mmr = (stats.ranked_won - stats.ranked_lost);
    var embeds = [];
    var header = new EmbedBuilder()
        .setTitle(player.profile.personaname + "'s week in DotA 2")
        .setURL("https://www.opendota.com/players/" + players[user.id].id + "/matches?date=7&significant=0")
        .setThumbnail(player.profile.avatarmedium)
        .addFields(
            { name: matches.length + ((matches.length === '1') ? " Match" : " Matches"),
              value: '**' + Math.round((stats.won / matches.length)*100) + "% Winrate**",
              inline: true,
            },
            { name: stats.modes.ranked + " Ranked",
              value: '**' + (matches.length - stats.modes.ranked) + " Unranked**",
              inline: true,
            },
            { name: "Ranked W/L: " + (mmr > 0 ? "+" : "") + mmr ,
              value: "**Rank: " + rankString(player.rank_tier) + '**',
              inline: true,
            },
            { name: "Heroes played",
              value: heroesString(stats.heroes),
              inline: false,
            },
        )
        .setColor('#242f39')
        .setFooter({text: "Excluding special game modes from heroes list", iconURL: "https://static.wikia.nocookie.net/dota2_gamepedia/images/a/ac/Emoticon_hookless.gif"})
    embeds.push(header);
    return embeds;
}

function rankString(rank_tier) {
    var medal = '';
    if (rank_tier === null)
        medal = 'Not Calibrated'
    else
        switch (Math.floor(rank_tier/10)) {
            case 1: medal = 'Herald ';   break;
            case 2: medal = 'Guardian '; break;
            case 3: medal = 'Crusader '; break;
            case 4: medal = 'Archon ';   break;
            case 5: medal = 'Legend ';   break;
            case 6: medal = 'Ancient ';  break;
            case 7: medal = 'Ancient ';   break;
            case 8: medal = 'Immortal';  break;
            default: medal = 'Unknown '; break;
        }
    let stars = '';
    if (Math.floor(rank_tier/10) == 7) {
        switch (rank_tier%10) {
            case 1: stars =   'VI'; break;
            case 2: stars =  'VII'; break;
            case 3: stars = 'VIII'; break;
            case 4: stars =  'IX'; break;
            case 5: stars =   'X'; break;
        }
    } else {
        switch (rank_tier%10) {
            case 1: stars =   'I'; break;
            case 2: stars =  'II'; break;
            case 3: stars = 'III'; break;
            case 4: stars =  'IV'; break;
            case 5: stars =   'V'; break;
        }
    }
    return medal + stars;
}

function heroesString(list) {
    let arr = [];
    for (var hero in list) {
        arr.push(list[hero]);
    }
    arr.sort((a,b) =>  (b.won + b.lost) - (a.won + a.lost));

    let string = "```ansi\n";
    arr.forEach((elem) => {
        string += '[0;';
        string += (elem.won == elem.lost) ? '33' : ((elem.won > elem.lost) ?  '32' : '31');
        hero = heroes[elem.id];
        string += 'm' + hero.name + ' ' + elem.won + '-' + elem.lost + '\n';
    });
    string += "```"
    return string;
}

function weeklyStats(matches) {
    var stats = { won: 0, lost: 0, heroes: {}, normals: [], ranked_won: 0, ranked_lost: 0,
        modes: { ranked: 0, unranked: 0, all_pick: 0, ability_draft: 0, 
            turbo: 0, single_draft: 0, random_draft: 0, all_random: 0,
        },
        averages: { kills: 0, deaths: 0, assists: 0, gpm: 0, xpm: 0, }
    };
  
    matches.forEach(function(match) {
        // Win totals
        let won = (match.player_slot < 128 === match.radiant_win);
        won ? stats.won++ : stats.lost++;

        // Modes
        if (match.lobby_type === 7) { 
            stats.modes.ranked++;
            won ? stats.ranked_won++ : stats.ranked_lost++;
        }
        if (match.lobby_type === 0) { stats.modes.unranked++;      }
        if (match.game_mode  === 3) { stats.modes.random_draft++;  }
        if (match.game_mode  === 4) { stats.modes.single_draft++;  }
        if (match.game_mode  === 5) { stats.modes.all_random++;    }
        if (match.game_mode === 18) { stats.modes.ability_draft++; }
        if (match.game_mode === 22) { stats.modes.all_pick++;      }
        if (match.game_mode === 23) { stats.modes.turbo++;         }
        
        // Collect normal games
        if ((match.lobby_type === 0 || match.lobby_type === 7) && 
            (match.game_mode === 22 || match.game_mode === 16 || match.game_mode === 5 ||
             match.game_mode === 4  || match.game_mode === 3  || match.game_mode === 2))
        {
            // Hero totals  { id: { id: X, won: X, lost: X }, }
            if (typeof stats.heroes[match.hero_id] === 'undefined') {
                stats.heroes[match.hero_id] = { id: match.hero_id, won: 0, lost: 0 };
            }
            won ? stats.heroes[match.hero_id].won++ : stats.heroes[match.hero_id].lost++;

            stats.normals.push({ id: match.match_id, slot: match.player_slot });
        }
    });    
    return stats;
}

module.exports = {recent, weekly, };