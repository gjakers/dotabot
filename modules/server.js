/**
 * @file server.js
 * 
 * @description Contains server management functions and "/leaderboard" command
 * judgement - check user's match histories and assign roles accordingly
 * leaderboard - show weekly match count of every user
 */

const {EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const player = require('./player.js');
const objects = require('./objects.js');

let rankings = [];
var last_checked = new Date();

// JUDGEMENT
async function judgement(guild) {
    const today = new Date();
    console.log("Judgement " + today.toLocaleString());

    // Fetch Discord members first.
    let members;
    try {
        members = await guild.members.fetch();
    } catch (err) {
        console.error("Judgement aborted: could not fetch Discord members.", err);
        return;
    }

    const playerStates = [];
    try {
        for (const discord of Object.keys(objects.players)) {
            const member = members.get(discord);

            // Player is registered but no longer in the Discord.
            if (!member) {
                continue;
            }

            // Ignore out-of-office players.
            if (member.roles.cache.some(role => role.name === 'out-of-office')) {
                continue;
            }

            const gamer = new player.Player(discord);

            // Throws if OpenDota fails.
            await gamer.poll();

            const totals = gamer.totals();
            const sum = totals.unranked +
                        totals.ranked +
                        totals.turbo +
                        totals.special;
            let days_since = null;

            // We only need the older match-history query if they
            // haven't played during the current weekly window.
            if (sum === 0) {
                const time_since = await gamer.lastPlayed();

                // Infinity is valid here: means OpenDota successfully
                // returned data but we found no qualifying previous match.
                if (typeof time_since !== 'number' || Number.isNaN(time_since)) {
                    throw new Error(
                        `Invalid lastPlayed() result for ${gamer.name}`
                    );
                }

                days_since = Math.floor(time_since / 86400000);
            }

            playerStates.push({
                gamer,
                member,
                sum,
                days_since
            });
        }


        if ((playerStates.length > 1) &&
            (playerStates.every(state =>
                                (state.sum === 0 &&
                                 state.days_since === Infinity)))
        ) {
            throw new Error(
                "OpenDota returned empty match history for every active player"
            );
        }

    } catch (err) {
        console.error(
            "Judgement aborted: OpenDota data unavailable.",
            err
        );
        return;
    }

    // Build leaderboard locally first.
    const newRankings = playerStates
        .map(state => ({
            name: state.gamer.name,
            count: state.sum
        }))
        .sort((a, b) => b.count - a.count);

    // Commit last-known-good leaderboard.
    rankings = newRankings;
    last_checked = today;

    // Remove Dota-related roles from anyone not registered in players.json.
    for (const member of members.values()) {
        if (!objects.players.hasOwnProperty(member.id)) {
            const rolesToRemove = member.roles.cache.filter(role =>
                role.name === 'dota' ||
                role.name === 'thin ice' ||
                role.name === 'scum' ||
                role.name === 'king'
            );

            if (rolesToRemove.size > 0) {
                console.log("BANNED: " + member.user.username);

                for (const role of rolesToRemove.values()) {
                    await member.roles.remove(role);
                }
            }
        }
    }

    // Apply roles
    for (const state of playerStates) {
        const gamer = state.gamer;

        if (state.sum > 0) {
            await gamer.setRole(guild, 'dota');
            await gamer.removeRole(guild, 'scum');
            await gamer.removeRole(guild, 'thin ice');
        }
        else if (state.days_since < 14) {
            await gamer.setRole(guild, 'thin ice');
            await gamer.removeRole(guild, 'dota');
            await gamer.removeRole(guild, 'scum');
        }
        else {
            await gamer.setRole(guild, 'scum');
            await gamer.removeRole(guild, 'dota');
            await gamer.removeRole(guild, 'thin ice');
        }
    }

    // Crown the King
    if (playerStates.length > 0) {
        const most_played = Math.max(
            ...playerStates.map(state => state.sum)
        );

        // If everyone has zero weekly games, just preserve existing King state.
        if (most_played > 0) {
            const newKingIds = new Set(
                playerStates
                    .filter(state => state.sum === most_played)
                    .map(state => state.member.id)
            );

            // Remove fallen / stale Kings, including OOTO players.
            for (const member of members.values()) {
                const kingRole = member.roles.cache.find(
                    role => role.name === 'king'
                );

                if (kingRole && !newKingIds.has(member.id)) {
                    await member.roles.remove(kingRole);
                    console.log(
                        "king has fallen: " +
                        (objects.players[member.id]?.name ?? member.user.username)
                    );
                }
            }

            // Crown new King(s).
            for (const state of playerStates) {
                if (
                    newKingIds.has(state.member.id) &&
                    !state.member.roles.cache.some(role => role.name === 'king')
                ) {
                    await state.gamer.setRole(guild, 'king');
                    console.log("new king is crowned: " + state.gamer.name);
                }
            }
        }
        else {
            console.log(
                "Nobody has played this week; preserving existing King."
            );
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

    try {
        if (rankings.length === 0) {
            await interaction.editReply(
                "Leaderboard data is not available yet. " +
                "The bot has not yet completed a successful OpenDota refresh."
            );
            return;
        }

        const str = rankings
            .filter(player => player.count > 0)
            .map(player =>
                player.count.toString().padEnd(4, ' ') +
                player.name
            )
            .join('\n');

        const ranks = new EmbedBuilder()
            .addFields({
                name: ":crown: Weekly Leaderboard :crown:",
                value: str || "Nobody has played in the last 7 days."
            })
            .setFooter({
                text:
                    "Last updated " +
                    ((Date.now() - last_checked) / 60000).toFixed(0) +
                    " minutes ago"
            })
            .setColor('#F0C230');

        await interaction.editReply({ embeds: [ranks] });

    } catch (err) {
        console.error("Failed to display leaderboard:", err);

        // Avoid leaving the Discord interaction spinning forever.
        try {
            await interaction.editReply(
                "Something went wrong while displaying the leaderboard."
            );
        } catch (replyErr) {
            console.error("Could not send leaderboard error message:", replyErr);
        }
    }
}


module.exports = {judgement, leaderboard, };