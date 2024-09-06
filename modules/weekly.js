/**
 * @file weekly.js
 * 
 * @description Contains "/weekly" command and associated functions
 */
const { EmbedBuilder, } = require("discord.js");
const opendota = require('./opendota.js');

const objects = require('./objects.js');

// WEEKLY command
async function weekly(interaction) {
    await interaction.deferReply();
    var user = interaction.options.getUser('username');

    console.log("weekly: " + user.username + " " + user.id );

    if(!objects.players.hasOwnProperty(user.id)) {
        interaction.editReply("No dotabuff registerered for **" + user.username + "**!");
        return;
    }

    var playerID = objects.players[user.id].id;

    opendota.playerMatches(playerID, { "date": 7, "significant": 0}).then(function(matches) {
        opendota.getPlayer(playerID).then(async function(player) {
            if(matches.length == 0) {
                var nogames = new EmbedBuilder()
                    .setTitle(user.username + "'s week in DotA 2")
                    .setURL("https://www.opendota.com/players/" + objects.players[user.id].id + "/matches?date=7&significant=0")
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
        .setURL("https://www.opendota.com/players/" + objects.players[user.id].id + "/matches?date=7&significant=0")
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
            case 7: medal = 'Divine ';   break;
            case 8: medal = 'Immortal ';  break;
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
        hero = objects.heroes[elem.id];
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
module.exports = {weekly, };