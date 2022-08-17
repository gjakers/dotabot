const Discord = require("discord.js");
const request = require('request');
require('dotenv').config();

async function pollmovie(interaction) {
    interaction.reply("coming soon...");
    return;

    await interaction.deferReply();

    let list = [];
    list.push(
        interaction.options.getString('movie_1'),
        interaction.options.getString('movie_2'),
        interaction.options.getString('movie_3'),
        interaction.options.getString('movie_4'),
        interaction.options.getString('movie_5')
    );
    
    var row = new Discord.MessageActionRow();
    let embeds = [];
    let invalid = false;

    for(var i=0; i<list.length; i++) {
        console.log(list[i])
        if(list[i] == null) { continue; }
        let embed = await getTitle(list[i]).then( body => {
            if (body.errorMessage) { invalid = true; return null; }
            return movieEmbed(body);
        })
        if (invalid) {
            interaction.editReply({
                content: "One of your movie IDs was invalid: " + list[i] + "",
                ephemeral: true,
            });
            return;
        }

        embeds.push(embed);
        row.addComponents(
            new Discord.MessageButton()
                .setCustomId('movie' + (i + 1))
                .setLabel(embed.title)
                .setStyle('PRIMARY')
        )
    }
    
    interaction.editReply({ embeds: embeds, components: [row]});
}

function movieEmbed(movie) {
    var embed = new Discord.MessageEmbed()
        .setTitle(movie.title)
        .setURL("https://www.imdb.com/title/" + movie.id)
        .setThumbnail(movie.image)
        .addFields(
            { name: movie.year + " · " + movie.runtimeStr + " · ☆" + movie.imDbRating + "/10",
              value: movie.plot,
              inline: false
            },
            { name: movie.stars,
              value: movie.genres
            },
        )
    return embed;
}

function pollmovieButtonpressed(interaction) {
    console.log(interaction.customId + ' ' + interaction.user.username)
    console.log(interaction)
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




module.exports = {pollmovie, pollmovieButtonpressed };