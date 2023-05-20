const Discord = require("discord.js");
const { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const request = require('request');
require('dotenv').config();

async function pollmovie(interaction) {
    //  interaction.reply({content: "coming soon...", ephemeral: true});
    //  return;

    const modal = new ModalBuilder()
        .setCustomId('pollmovieSubmit')
        .setTitle('My Modal')

    const moviesInput = new TextInputBuilder()
        .setCustomId('moviesInput')
        .setLabel("List of IMDb links to movies, one per line")
        .setStyle(TextInputStyle.Paragraph)
    
    const actionRow = new ActionRowBuilder().addComponents(moviesInput);
    modal.addComponents(actionRow);

    await interaction.showModal(modal);
}

async function pollmovieModalReceived(interaction) {
    await interaction.deferReply();
    const list = interaction.fields.getTextInputValue('moviesInput').split("\n");
    let bad_entries = [];
    let good_entries = [];
    // First check for valid URLs
    for(var i=0; i<list.length; i++) {
        if(list[i].trim() === '') continue;
        if(!list[i].startsWith("https://www.imdb.com/title/")) {
            bad_entries.push(list[i]);
        } else {
            good_entries.push(list[i]);
        }
    }

    // If any invalid URLs found, send error message
    if(bad_entries.length) {
        let msg = "idiot!!\nThe following could not be read as valid IMDb URLs:\n";
        msg += "```\n";
        bad_entries.forEach(entry => {
            msg += entry + "\n";
        });
        msg += "```";
        msg += "URL should look like: `https://www.imdb.com/title/tt0116151/`";
        interaction.editReply({ content: msg, ephemeral: true });
        return;
    }
    // If no movies were listed, send error message
    if(good_entries.length === 0) {
        interaction.editReply({ content: "You didn't list any movies bruv", ephemeral: true});
        return;
    }

    var row = new ActionRowBuilder();
    let embeds = [];
    for (var i=0; i<good_entries.length; i++) {
        let id =  good_entries[i].match(/imdb.com\/title\/([a-zA-Z0-9]+)/)[1];
        let embed = await getTitle(id).then( body => {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('movie' + (i+1))
                    .setLabel(body.title)
                    .setStyle(ButtonStyle.Success)
            );
            return movieEmbed(body);
        });
        embeds.push(embed) 
    }
    var results_embed = new EmbedBuilder()
        .setTitle("POLL RESULTS")
        .addFields()
    let test = await interaction.editReply({embeds: embeds, components: [row]});
}

function movieEmbed(movie) {
    var embed = new EmbedBuilder()
        .setTitle(movie.title + " (" + movie.year + " · " + movie.runtimeStr + ")")
        .setURL("https://www.imdb.com/title/" + movie.id + "?")
        .setThumbnail(movie.image)
        .addFields(
            { name: movie.stars + " · " + movie.imDbRating + "/10☆",
              value: movie.plot,
              inline: false
            },
        )
    return embed;
}

function pollmovieButtonpressed(interaction) {
    var embeds = interaction.message.embeds;

    let i = parseInt(interaction.customId.charAt(interaction.customId.length-1))-1;
    //Check if already voted
    console.log(embeds[i].data.url)
    if(!embeds[i].data.url.includes(interaction.user.id + ','))
    {
        embeds[i].data.title += ":orangutan:";
        embeds[i].data.url += interaction.user.id + ',';
    }
    interaction.update({embeds: embeds, components: interaction.message.components})
}

function whoVoted(embeds) {

}



const default_headers = {'User-Agent': "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) " +
									   "AppleWebKit/537.36 (KHTML, like Gecko) " +
									   "Chrome/62.0.3202.94 " +
									   "Safari/537.36"};
var nextCall = Date.now();

async function apiCall(cmd, tries = 0) {
    var options = {
        url: "https://imdb-api.com/en/API" + cmd,
        headers: default_headers
    };

    if (nextCall > Date.now()) {
        await new Promise(resolve => setTimeout(resolve, nextCall - Date.now()));
        return apiCall(cmd, tries);
    }

    nextCall = Date.now() + 1100;
    return new Promise ((resolve, reject) => {
        request(options, function(err, response, body) {
            if (err) {
                if (tries > 5) {
                    return reject(err);
                }
                else {
                    console.log(`ERROR: ${err}\nretrying(${tries})`);
                    return apiCall(cmd, ++tries);
                }
            }
            try {
                var parsed_body = JSON.parse(body);
                if(parsed_body.error != null) {
                    return apiCall(cmd, ++tries);
                } else {
                    resolve(parsed_body);
                }
            } catch(e) {
                console.log("iMDB API failed: \n" + cmd + '\n');
                resolve('');
            }
        });
    });
}

async function getTitle(id) {
    return apiCall(`/Title/${process.env.IMDB_KEY}/${id.trim()}`);
}


module.exports = {pollmovie, pollmovieButtonpressed, pollmovieModalReceived };