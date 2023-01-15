const { SlashCommandBuilder } = require('discord.js');
const { unpause } = require('../queue');
module.exports = {
    data: new SlashCommandBuilder()
        .setName('unpause')
        .setDescription('일시 중지된 노래를 다시 재생합니다.'),
        
        async execute(interaction, client) {
            await unpause(interaction, client)
        },
};