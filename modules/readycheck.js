const Discord = require("discord.js");


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
    await interaction.deferReply()

    var embed = new Discord.MessageEmbed()
        .setTitle("READY CHECK")
        .setDescription('**' + readycheck_user + "** requested a Ready Check.")
        .setColor('#a9cf54')
    
    var row = new Discord.MessageActionRow()
        .addComponents(
            new Discord.MessageButton()
                .setCustomId('ready')
                .setLabel('READY')
                .setStyle('SUCCESS'),
            new Discord.MessageButton()
                .setCustomId('notready')
                .setLabel('NOT READY')
                .setStyle("DANGER")
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
    var embed = new Discord.MessageEmbed()
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
    var embed = new Discord.MessageEmbed()
        .setTitle("READY CHECK")
        .setDescription(str)

    var row = new Discord.MessageActionRow()
        .addComponents(
            new Discord.MessageButton()
                .setCustomId('ready')
                .setLabel('READY')
                .setStyle('SUCCESS')
                .setDisabled(true),
            new Discord.MessageButton()
                .setCustomId('notready')
                .setLabel('NOT READY')
                .setStyle("DANGER")
                .setDisabled(true)
        );
        
    interaction.editReply({ embeds: [embed], components: [row] })
    readycheck_in_progress = false;
    setTimeout(() => { interaction.deleteReply() }, 300000);
}

module.exports = {readycheck, readycheckButtonpressed, };