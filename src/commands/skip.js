const { SlashCommandBuilder } = require('discord.js');
const { skip } = require('../queue');
module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('현재 재생 중인 노래를 건너뜁니다.'),
        
        async execute(interaction, client) {
            await skip(interaction, client)
        },
};