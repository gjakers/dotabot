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

    const user = interaction.options.getUser('username');

    if(!objects.players.hasOwnProperty(user.id)) {
        await interaction.editReply(
            "No dotabuff registerered for **" + user.username + "**!"
        );
        return;
    }

    const playerID = objects.players[user.id].id;

    let matches;
    let player;

    try{
        matches = await opendota.playerMatches(playerID, { "date": 7, "significant": 0});
        player  = await opendota.getPlayer(playerID);
    } catch (err) {
        console.error("OpenDota failed to respond during /weekly:", err);
        await interaction.editReply(
            "OpenDota is not responding. Could not fetch matches."
        );
        return;
    }

    if(matches.length == 0) {
        const nogames = new EmbedBuilder()
            .setTitle(user.username + "'s week in DotA 2")
            .setURL("https://www.opendota.com/players/" + objects.players[user.id].id + "/matches?date=7&significant=0")
            .setThumbnail(player.profile.avatarmedium)
            .setFooter({text: "They didn't play! Sad!",
                        iconURL: "https://static.wikia.nocookie.net/dota2_gamepedia/images/1/17/Emoticon_sick.gif"})

        interaction.editReply({ embeds: [nogames], });
        return;
    }

    const stats = weeklyStats(matches);
    const embeds = weeklyStart(matches, user, player, stats);

    await interaction.editReply({ embeds: embeds, });
}

function weeklyStart(matches, user, player, stats) {
    const mmr = (stats.ranked_won - stats.ranked_lost);
    const winrate = Math.round((stats.won / matches.length)*100);
    var embeds = [];
    var header = new EmbedBuilder()
        .setTitle(player.profile.personaname + "'s week in DotA 2")
        .setURL("https://www.opendota.com/players/" + objects.players[user.id].id + "/matches?date=7&significant=0")
        .setThumbnail(player.profile.avatarmedium)
        .addFields(
            { name: matches.length + ((matches.length === 1) ? " Match" : " Matches"),
              value: '**' + winrate + "% Winrate**",
              inline: true,
            },
            { name: stats.modes.ranked + " Ranked",
              value: '**' + (matches.length - stats.modes.ranked) + " Unranked**",
              inline: true,
            },
            { name: "Ranked W/L: " + (mmr > 0 ? "+" : "") + mmr ,
              value: "**" + rankString(player.rank_tier) + '**',
              inline: true,
            },
            { name: "Heroes played",
              value: heroesString(stats.heroes),
              inline: false,
            },
        )
        .setColor(winrateColor(winrate))
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

    const rows = arr.map(elem => {
        let hero;

        if (elem.id in objects.heroes) {
            hero = objects.heroes[elem.id];
        } else {
            hero = objects.heroes['0'];
        }

        return {
            name: hero.name,
            won: elem.won,
            lost: elem.lost
        };
    });

    const nameWidth = Math.max(...rows.map(row => row.name.length));

    const winWidth  = Math.max(1, ...rows.map(row => row.won.toString().length));

    const lossWidth = Math.max(1, ...rows.map(row => row.lost.toString().length));

    let string = "```ansi\n";

    rows.forEach(row => {
        const color = row.won === row.lost ? '33' :
                      row.won >   row.lost ? '32' :
                                             '31';
        const name   = row.name.padEnd(nameWidth);
        const wins   = row.won.toString().padStart(winWidth);
        const losses = row.lost.toString().padStart(lossWidth);                                     
        
        string += `\u001b[0;${color}m` +
                  `${name}  ${wins}-${losses}\n`;
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

function winrateColor(winrate) {
    winrate = Math.max(0, Math.min(100, winrate));

    const red   = [255,  23,  68];
    const gray  = [128, 128, 128];
    const green = [  0, 230, 118];

    let start, end, t;

    if (winrate <= 50) {
        start = red;
        end = gray;
        t = winrate / 50;
    } else {
        start = gray;
        end = green;
        t = (winrate - 50) / 50;
    }

    const rgb = start.map((value, i) =>
        Math.round(value + (end[i] - value) * t)
    );

    return (
        "#" +
        rgb.map(value => value.toString(16).padStart(2, "0")).join("")
    );
}

module.exports = {weekly, };
