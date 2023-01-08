const { SlashCommandBuilder } = require('discord.js');
const { pause } = require('../queue');
module.exports = {
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('현재 재생 중인 노래 일시중지합니다.'),
        
        async execute(interaction, client) {
            pause(interaction, client)
        },
};