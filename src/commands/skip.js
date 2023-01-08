const { SlashCommandBuilder } = require('discord.js');
const { playNext } = require('../queue');
module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('현재 재생 중인 노래를 건너뜁니다.'),
        
        async execute(interaction, client) {
            interaction.reply({ content: '노래를 건너뛰는 중입니다. '});
            playNext(interaction, client)
        },
};