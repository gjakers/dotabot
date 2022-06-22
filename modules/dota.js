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

async function recent(client, interaction) {
    var options = interaction.data.options;
    var subcommand = options[0].name;
    var playerID = '';
    var playerName = '';
    if(subcommand == 'username') {
        
        var player = await client.users.fetch(options[0].options[0].value.toString());
        console.log("recent: " + player.username + " " + player.id );

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
    opendota.recentMatches(playerID).then(function(matches) {
        if (matches.length)                             
        {
            var embeds = recentEmbed(matches.slice(0,5));
            client.api.interactions(interaction.id, interaction.token).callback.post({
                data: {
                    type: 4,
                    data: {
                        content: "Recent matches for **" + playerName + "**",
                        embeds: embeds,
                    }
                }
            });
        } else {
            client.api.interactions(interaction.id, interaction.token).callback.post({
                data: {
                    type: 4,
                    data: {
                        content: "OpenDota is not working, or something",
                    }
                }
            });
        }
    }).catch(function(err) {
        console.log(err);
    });
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

module.exports = {recent, judgement};