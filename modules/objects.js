/**
 * @file objects.js
 * 
 * @description Contains frequently used objects
 */
const fs = require('fs');

// Load player data JSON 
let players = JSON.parse(fs.readFileSync('./players.json'));

// Load lobbytype data JSON
let lobbies = JSON.parse(fs.readFileSync('./lobby_type.json'));

// Load hero data JSON
let heroes = {};
fs.readFile('./hero-images.json', 'utf8', (err, data) => {
    if (err) {
        console.error("Error reading file:", err);
        return;
    }
    //Remove BOM
    if (data.charCodeAt(0) === 0xFEFF) {
        data = data.slice(1);
    }

    try {
        heroes = JSON.parse(data);
    } catch (jsonError) {
        console.error('Error parsing JSON:', jsonError);
        return;
    }
});

module.exports = {players, lobbies, heroes, };