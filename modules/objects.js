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
let heroes = JSON.parse(fs.readFileSync('./hero-images.json'));

module.exports = {players, lobbies, heroes, };