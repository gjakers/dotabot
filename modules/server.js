const {EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const player = require('./player.js');
const fs = require('fs');

// Load player data
let raw_players = fs.readFileSync('./players.json');
let players = JSON.parse(raw_players);

let rankings = [];
var last_checked = new Date();


async function judgement(guild) {
    rankings = [];
    var today = new Date();
    console.log("Judgement " + today.toLocaleString());
    // Find anyone with 'dota' role and no dotabuff registered
    guild.members.fetch().then(members => {
        members.forEach(member => {
            if(member.roles.cache.find( role => { 
                    return (role.name === 'dota' || role.name === 'thin ice' || role.name === 'scum')})) {
                if(!players.hasOwnProperty(member.id)) {
                    let gamer = new player.Player(member.id);
                    console.log("BANNED: " + member.user.username);
                    gamer.removeRole(guild, 'dota');
                    gamer.removeRole(guild, 'thin ice');
                    gamer.removeRole(guild, 'scum');
                }
            }
        });
    }).catch(function(err) {
        console.log(err);
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
            rankings.push({name: gamer.name, count: sum })
            last_checked = today;
        }
    }

    rankings.sort((a,b) => (b.count) - (a.count));
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

// LEADERBOARD command
async function leaderboard(interaction) {
    await interaction.deferReply();

    if(rankings.length <= 0) {
        interaction.editReply({content: 'Something went wrong...',
        ephemeral: true, });
        return;
    }
    let str = '';
    rankings.forEach((player) => {
        if(player.count > 0) {
            str += player.count.toString().padEnd(4, ' ');
            str += player.name + '\n';
        }
    });

    var ranks = new EmbedBuilder()
        .addFields(
            { name: ":crown: Weekly Leaderboard :crown:",
              value: str,
        })
        .setFooter({ text: "Last updated " + ((Date.now() - last_checked)/60000).toFixed(0) + " minutes ago" })
        .setColor('#F0C230')

    interaction.editReply({embeds: [ranks]});
}

var readycheck_players = {};
var readycheck_in_progress = false;
var readycheck_user = '';
//READYCHECK command
async function readycheck(interaction) {
    if (readycheck_in_progress) {
        await interaction.reply({content: "A ready check is already in progress!", ephemeral: true});
        return;
    }

    readycheck_players = {};
    readycheck_in_progress = true;
    readycheck_user = interaction.user.username;
    await interaction.deferReply();

    var embed = new EmbedBuilder()
        .setTitle("READY CHECK")
        .setDescription('**' + readycheck_user + "** requested a Ready Check.")
        .setColor('#a9cf54')
    
    var row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('ready')
                .setLabel('READY')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('notready')
                .setLabel('NOT READY')
                .setStyle(ButtonStyle.Danger)
        );
    interaction.editReply({ content: " ", embeds: [embed], components: [row]});
    setTimeout(() => { closeReadycheck(interaction) }, 90000);
}

function readycheckButtonpressed(interaction) {
    //interaction.deferUpdate();

    console.log(interaction.customId + ' ' + interaction.user.username)
    var ready = (interaction.customId === 'ready');
    readycheck_players[interaction.user.username] = ready;

    var str = '**' + readycheck_user + "** requested a Ready Check.\n\n";
    str += '';
    for (var player in readycheck_players) {
        str += '**' + player + '** is ';
        str += readycheck_players[player] ? 'Ready' : 'Not Ready';
        str += '\n';
    }
    var embed = new EmbedBuilder()
        .setTitle("READY CHECK")
        .setDescription(str)
        .setColor('#a9cf54')

    interaction.update({ embeds: [embed] });
}

function closeReadycheck(interaction) {
    var str = '**' + readycheck_user + "** requested a Ready Check.\n\n";

    if(Object.keys(readycheck_players).length === 0) {
        str += "No one answered!";
    } else {
        for (var player in readycheck_players) {
            str += '**' + player + '** is ';
            str += readycheck_players[player] ? 'Ready' : 'Not Ready';
            str += '\n';
        }
        str += "\n**Ready Check** complete."
    }
    var embed = new EmbedBuilder()
        .setTitle("READY CHECK")
        .setDescription(str)

    var row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('ready')
                .setLabel('READY')
                .setStyle(ButtonStyle.Success)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId('notready')
                .setLabel('NOT READY')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(true)
        );
        
    interaction.editReply({ embeds: [embed], components: [row] })
    readycheck_in_progress = false;
    setTimeout(() => { interaction.deleteReply() }, 300000);
}

module.exports = {judgement, leaderboard, readycheck, readycheckButtonpressed, };