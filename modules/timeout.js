let smok_votes = {};
const vote_types = {
	YES:  1,
	NO:	 -1,
	SMOK: 0,
};

//End the vote
function closeVote(client, channel_id, message) {
	var ban_duration = message.content.match(/(\d+)/)[0];
	console.log("ban duration: " + ban_duration);
	var banned = smok_votes[message.id].count > 2;

	let emotes = ''; //Re-create vote emote string
	for (const vote of smok_votes[message.id].votes) {
		switch (vote) {
			case vote_types.YES:
				emotes += ":white_check_mark:"; break;
			case vote_types.NO:
				emotes += ":negative_squared_cross_mark:"; break;
			case vote_types.SMOK:
				emotes += ":face_vomiting:"; break;
		}
	}

	//Announce result, gray-out buttons
	client.api.channels(channel_id).messages(message.id).patch({
		data: {
			content: message.content + emotes + "\n*The vote has ended.*\n**Smok is " + (banned ? "banned.**" : "not banned.**"),
			components: [{
				type: 1,
				components: [
					{
						type: 2,
						label: "Yes",
						style: 2,
						custom_id: "vote_yes",
					},
					{
						type: 2,
						label: "No",
						style: 2,
						custom_id: "vote_no"
					}
				]	
			}]
		}
	});
	
	if(banned) { //Ban smok  872257325040291841
		timeoutUser(client, '872257325040291841', ban_duration);
	}
}

// Give user 'silenced' role and remove 'dota' role, reverse if minutes = 0
async function timeoutUser(client, user_id, minutes) {
	client.guilds.fetch(guildId).then( guild => {
		//Get 'silenced' role
		let silenced = guild.roles.cache.find((role) => {
			return role.name === 'silenced'
		});
		//Get 'dota' role
		let dota = guild.roles.cache.find((role) => {
			return role.name == 'dota'
		});
		guild.members.fetch(user_id).then( member => {
			if(minutes) {
				member.roles.add(silenced);
				//member.roles.remove(dota);
			} else {
				//member.roles.add(dota);
				member.roles.remove(silenced);
			}
		}).catch(function(err) {
			console.log(err);
		});
	});

	//Schedule the un-banning
	if(minutes) {
		setTimeout(() => { timeoutUser(user_id, 0) }, minutes*60*1000 );
	}
}

async function timeoutCommand(client, interaction) {
    var timeout_length = interaction.data.options[0].value;
    if(timeout_length > 60) // too long! send ephemeral warning msg
    {
        client.api.interactions(interaction.id, interaction.token).callback.post({
            data: {
                type: 4,
                data: {
                    flags: 1<<6,
                    content: "You can't ban smok for more than 60 minutes!\nyet"
                }
            }
        });
    }
    else
    {
        client.api.interactions(interaction.id, interaction.token).callback.post({
            data : {
                type: 4,
                data: {
                    content: "Does smok deserve a " + timeout_length + " minute ban?\nVotes:",
                    components: [{
                        type: 1,
                        components: [
                            {
                                type: 2,
                                label: "Yes",
                                style: 3,
                                custom_id: "vote_yes",
                            },
                            {
                                type: 2,
                                label: "No",
                                style: 4,
                                custom_id: "vote_no"
                            }]	
                    }]
                }
            }
        });
    }
}

async function timeoutButtons(client, interaction, command) {
    //Resolve buttonpress
    client.api.interactions(interaction.id, interaction.token).callback.post({
        data: {
            type: 6
        }
    });

    // Only hold vote for 3 minutes
    const since = (Date.now() - Date.parse(interaction.message.timestamp))/1000;
    if(since > 90) {
        return;
    }

    //Initialize count on first vote
    if(interaction.message.content.endsWith('Votes:')) {
        setTimeout(() => {
                closeVote(client, interaction.channel_id, interaction.message);
            },
            90000);
        smok_votes[interaction.message.id] = {
            count: 0,
            votes: [],
            users: {}
    };
    }	

    const user_id = interaction.member.user.id;
    if(smok_votes[interaction.message.id].users[user_id]) {
        return;
    }
    
    //Logging...
    var player = await client.users.fetch(user_id.toString());
    console.log(player.username + " " + command);

    smok_votes[interaction.message.id].users[user_id] = true;

    let emote = '';
    const voted_yes = (command == 'vote_yes');
    if(user_id == "872257325040291841") { // smok's vote
        smok_votes[interaction.message.id].votes.push(vote_types.SMOK);
        emote = ":face_vomiting:"
    }
    else if(voted_yes) {
        smok_votes[interaction.message.id].votes.push(vote_types.YES);
        smok_votes[interaction.message.id].count += 1;
        emote = ":white_check_mark:";
    }
    else {
        smok_votes[interaction.message.id].votes.push(vote_types.NO);
        smok_votes[interaction.message.id].count -= 1;
        emote = ":negative_squared_cross_mark:";
    }
    
    client.api.channels(interaction.channel_id).messages(interaction.message.id).patch({
        data: {
            content: interaction.message.content + emote
        }
    });
}


module.exports = { timeoutCommand, timeoutButtons };
