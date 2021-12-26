const Discord = require("discord.js");
const fs = require('fs');
const request   = require('request');

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




module.exports = { recent };