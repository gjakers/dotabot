const { match } = require("assert");
const Discord = require("discord.js");
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

async function recent(interaction) {
    var playerID = '';

    if(interaction.options.getSubcommand() === 'username') {
        var player = interaction.options.getUser('username');
        console.log("recent: " + player.username + " " + player.id );

        if(players.hasOwnProperty(player.id)) {
            playerID = players[player.id].id;
        } else {
            interaction.reply("No dotabuff registerered for **" + player.username + "**!");
            return;
        }
    }
    else if (interaction.options.getSubcommand() === 'id') {
        playerID = interaction.options.getString('id');
    }

    await interaction.deferReply();
    opendota.recentMatches(playerID).then(function(matches) {
        if (matches.length)                             
        {
            var embeds = recentEmbed(matches.slice(0,5));
            interaction.editReply({ content: "Recent matches for **" + player.username + "**", embeds: embeds, });
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

async function weekly(interaction) {
    var playerID = '';
    var user = interaction.options.getUser('username');
    console.log("weekly: " + user.username + " " + user.id );

    if(players.hasOwnProperty(user.id)) {
        interaction.deferReply();
        playerID = players[user.id].id;
    } else {
        interaction.reply("No dotabuff registerered for **" + user.username + "**!");
        return;
    }

    opendota.playerMatches(playerID, { "date": 7, "significant": 0}).then(function(matches) {
        opendota.getPlayer(playerID).then(async function(player) {
            if(matches.length == 0) {
                var nogames = new Discord.MessageEmbed()
                    .setTitle(user.username + "'s week in DotA 2")
                    .setURL("https://www.opendota.com/players/" + players[user.id].id + "/matches?date=7&significant=0")
                    .setThumbnail(player.profile.avatarmedium)
                    .setDescription("They didn't play! Sad!")
                interaction.editReply({ embeds: [nogames], });
                return;
            }

            let stats = weeklyStats(matches);
            var embeds = weeklyStart(matches, user, player, stats);
            interaction.editReply({ embeds: embeds, });
            
            let match_data = [];
            stats.normals.forEach(async function(match) {
                let data = opendota.getMatch(match.id);
                match_data.push(data);
            });

            embeds.pop();
            let hero_embed = await weeklyHero(match_data, playerID);
            embeds = embeds.concat(hero_embed);
            interaction.editReply({ embeds: embeds, });
        }).catch(function(err) {
            console.log(err);
        });
    }).catch(function(err) {
        console.log(err);
    });
}

function weeklyStart(matches, user, player, stats) {
    let mmr = (stats.ranked_won - stats.ranked_lost)*30;
    var embeds = [];
    var header = new Discord.MessageEmbed()
        .setTitle(user.username + "'s week in DotA 2")
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
            { name: "MMR change: " + (mmr == 0 ? '' : (mmr > 0 ? "+" : "-")) + mmr ,
              value: "**Rank: " + rankString(player.rank_tier) + '**',
              inline: true,
            },
        )
        .setColor('#242f39')
    embeds.push(header);
    var waiting = new Discord.MessageEmbed()
        .addField("Processing match data...", "This should take a few seconds...")
    embeds.push(waiting);
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
            case 7: medal = 'Divine ';   break;
            case 8: medal = 'Immortal';  break;
            default: medal = 'Unknown '; break;
        }
    let stars = '';
    switch (rank_tier%10) {
        case 1: stars =   'I'; break;
        case 2: stars =  'II'; break;
        case 3: stars = 'III'; break;
        case 4: stars =  'IV'; break;
        case 5: stars =   'V'; break;
    }
    return medal + stars;
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

        // Hero totals  { id: { count: X, won: X, lost: X } }
        if (typeof stats.heroes[match.hero_id] === 'undefined')
            stats.heroes[match.hero_id] = { count: 0, won: 0, lost: 0 };
        stats.heroes[match.hero_id].count++;
        won ? stats.heroes[match.hero_id].won++ : stats.heroes[match.hero_id].lost++;
        
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
            stats.normals.push({ id: match.match_id, slot: match.player_slot });
        }
    });    
    return stats;
}

async function weeklyHero(match_data, id) {
    let averages = { kills: 0, deaths: 0, assists: 0, gpm: 0, xpm: 0, denies: 0,
        hero_dmg: 0, healing: 0, stacked_camps: 0, buyback: 0, tower_dmg: 0,
    }
    let heroes_played = {};
    for (var k=0; k<match_data.length; k++) {
        data = await match_data[k];
        let player = {};
        for (var i=0; i < data.players.length; i++) {
            if (data.players[i].account_id == id) {
                player = data.players[i];
                break;
            }
        }

        if (typeof heroes_played[player.hero_id] === 'undefined') {
            heroes_played[player.hero_id] = { id: player.hero_id, count: 0, won: 0, lost: 0, kills: 0, gpm: 0,
            xpm: 0, deaths: 0, assists: 0, hero_dmg: 0, healing: 0, tower_dmg: 0, healing: 0 };
        }
        heroes_played[player.hero_id].count++;
        heroes_played[player.hero_id].kills += player.kills;
        heroes_played[player.hero_id].deaths += player.deaths;
        heroes_played[player.hero_id].assists += player.assists;
        heroes_played[player.hero_id].gpm += player.gold_per_min;
        heroes_played[player.hero_id].xpm += player.xp_per_min;
        heroes_played[player.hero_id].hero_dmg +=player.hero_damage;
        heroes_played[player.hero_id].healing += player.hero_healing;
        heroes_played[player.hero_id].tower_dmg += player.tower_damage;
        (player.player_slot < 128 === data.radiant_win) ? heroes_played[player.hero_id].won++ : heroes_played[player.hero_id].lost++;
        
        averages.kills   += player.kills / match_data.length;
        averages.deaths  += player.deaths / match_data.length;
        averages.assists += player.assists / match_data.length;
        averages.gpm     += player.gold_per_min / match_data.length;
        averages.xpm     += player.xp_per_min / match_data.length;
        averages.hero_dmg  += player.hero_damage / match_data.length;
        averages.healing += player.hero_healing / match_data.length;
        averages.stacked_camps += player.camps_stacked / match_data.length;
        averages.tower_dmg += player.tower_damage / match_data.length;
        averages.buyback += player.buyback_count / match_data.length;
        averages.denies += player.denies / match_data.length;
    }

    let waiting = new Discord.MessageEmbed()
        .setAuthor({ name: "Averages for the Week", 
            iconURL: "https://static.wikia.nocookie.net/dota2_gamepedia/images/a/ac/Emoticon_hookless.gif/revision/latest?cb=20210630210835"})
        //.setTitle("Averages for the Week")
        .addFields(
            { name: Math.round(averages.kills) + '/' + Math.round(averages.deaths) + '/' + Math.round(averages.assists) + " KDA",
              value: '**' + Math.round(averages.gpm) + '/' + Math.round(averages.xpm) + " GPM/XPM**",
              inline: true,
            },
            { name: averages.hero_dmg < 1000 ? Math.round(averages.hero_dmg) + " Hero DMG" :
                    Math.round(averages.hero_dmg/1000) + "K Hero DMG",
              value: '**' + (averages.tower_dmg < 1000 ? Math.round(averages.tower_dmg)  + " Tower DMG**" :
                     Math.round(averages.tower_dmg/1000) + "K Tower DMG**"),
              inline: true,
            },
            { name: averages.healing < 1000 ? Math.round(averages.healing) + " Healing" :
                    Math.round(averages.healing/1000) + "K Healing",
              value: '**' + Math.round(averages.denies) + " Denies**",
              inline: true,
            },
        )
        .setFooter({text: "Averages are based on normal match types (excluding ability draft, turbo, etc.)"})
        .setColor('#353F49')

    let most_played = {};
    let cnt = 0;
    for (let hero in heroes_played) {
        if (heroes_played[hero].count > cnt) {
            most_played = heroes_played[hero];
            cnt = heroes_played[hero].count;
        }
    }

    let hero = new Discord.MessageEmbed()
        //.setTitle("Most played hero: " + heroes[most_played.id].name)
        .setAuthor({ name: "Most played hero: " + heroes[most_played.id].name, 
            iconURL: "https://static.wikia.nocookie.net/dota2_gamepedia/images/8/86/Emoticon_bountyrune.gif/revision/latest?cb=20210411183524"})
        .setThumbnail(heroes[most_played.id].image)
        .addFields(
            { name: most_played.count + " Matches",
              value: '**' + Math.round((most_played.won/most_played.count)*100) + "% Winrate**",
              inline: true,
            },
            { name: Math.round(most_played.kills/most_played.count) + '/' +
                    Math.round(most_played.deaths/most_played.count) + '/' + 
                    Math.round(most_played.assists/most_played.count) + " KDA",
              value: '**' + Math.round(most_played.gpm/most_played.count) + '/' + 
                     Math.round(most_played.xpm/most_played.count) + " GPM/XPM**",
              inline: true,
            },
            { name: Math.round(most_played.hero_dmg/most_played.count) < 1000 ? Math.round(most_played.hero_dmg/most_played.count) + " Avg Hero DMG" :
                    Math.round(most_played.hero_dmg/most_played.count/1000) + "K Hero DMG",
              value: '**' + (Math.round(most_played.tower_dmg/most_played.count) < 1000 ? Math.round(most_played.tower_dmg/most_played.count) + " Avg Tower DMG**" :
                    Math.round(most_played.tower_dmg/most_played.count/1000) + "K Tower DMG**"),
              inline: true,
            },
        )
        .setColor('#2D3741')

    return [hero, waiting];
}


async function judgement(guild) {
    var today = new Date();
    console.log("Judgement " + today.toLocaleString());
    // Find anyone with 'dota' role and no dotabuff registered
    guild.members.fetch().then(members => {
        members.forEach(member => {
            if(member.roles.cache.find( role => { return role.name === 'dota'})) {
                if(!players.hasOwnProperty(member.id)) {
                    let gamer = new player.Player(member.id);
                    console.log("BANNED: " + member.user.username);
                    gamer.removeRole(guild, 'dota');
                    gamer.removeRole(guild, 'thin ice');
                    gamer.removeRole(guild, 'scum');
                }
            }
        });
    });
    let king_solvers = [];
    // Check everyone with dotabuff registered
    for (var discord in players) {
        let gamer = new player.Player(discord);
        let king_solver = gamer.exists(guild).then(async function(exists_in_server) {
            if (exists_in_server) {
                // Ignore OOTO gamers
                 return await gamer.hasRole(guild, 'out-of-office').then(async function(is_ooto) {
                    if(is_ooto) {
                        //console.log(gamer.name + ": OUT OF OFFICE")
                    } else {
                        // Check matches for the week
                        return await gamer.poll().then( async function() {
                            let totals = gamer.totals();
                            let sum = totals.unranked + totals.ranked + totals.turbo + totals.special;
                            // Check time of last match for users with 0 weekly matches
                            if (sum == 0) {
                                await gamer.lastPlayed().then(async function(time_since) {
                                    days_since = Math.floor((((time_since / 1000) / 60) / 60) / 24);
                                    if(days_since < 14) {
                                        //console.log("thin ice: " + gamer.name);
                                        gamer.setRole(guild, 'thin ice');
                                        gamer.removeRole(guild, 'dota');
                                    }
                                    else {
                                        //console.log("scum: "+ gamer.name);
                                        gamer.setRole(guild, 'scum');
                                        gamer.removeRole(guild, 'dota');
                                        gamer.removeRole(guild, 'thin ice');
                                    }
                                });
                            } else {
                                checkProbation(guild, gamer, totals);
                            }
                            return(gamer);
                        });
                    }     
                });
            }
        });

        king_solvers.push(king_solver);
    }

    let most_played = 0;
    let new_king = [];
    let old_king = [];
    for (var i=0; i < king_solvers.length; i++) {
        let gamer = await king_solvers[i];
        if (typeof gamer != 'undefined') {
            await gamer.hasRole(guild, 'king').then( has_role => {
                if (has_role) {
                    old_king.push(gamer);
                }
            });

            let totals = gamer.totals();
            let sum = totals.unranked + totals.ranked + totals.turbo + totals.special;
            //console.log(gamer.name + ": " + sum)
            if(sum >= most_played) {
                if (sum > most_played) {
                    new_king.length = 0;
                }
                new_king.push(gamer);
                most_played = sum;
            }
        }
        
    }

    // Remove fallen kings
    for(var i=0; i < old_king.length; i++) {
        let king = old_king[i];
        if(!new_king.includes(king)) {
            king.removeRole(guild, 'king');
            console.log("king has fallen: " + king.name);
        }
    }

    // Crown new kings
    for (var i=0; i < new_king.length; i++) {
        let king = new_king[i];
        if(!old_king.includes(king)) {
            king.setRole(guild, 'king');
            console.log("new king is crowned: " + king.name)
        }
    }
}

function checkProbation(guild, player, totals) {
    let sum = totals.unranked + totals.ranked + totals.turbo + totals.special;
    if(sum >= 3) {
        //console.log("dota: " + player.name);
        player.setRole(guild, 'dota');
        player.removeRole(guild, 'scum');
        player.removeRole(guild, 'thin ice');
    }
}

module.exports = {recent, weekly, judgement};