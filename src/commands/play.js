const { SlashCommandBuilder } = require('discord.js');
const { addPlayList } = require('../queue');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('유튜브 url로 노래를 재생합니다.')
        .addStringOption(option =>
            option.setName('url')
                .setDescription('Youtube URL')
                .setRequired(true)
        ),

        async execute(interaction, client) {
            addPlayList(interaction, client);
        },
        
};