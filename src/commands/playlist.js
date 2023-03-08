const { SlashCommandBuilder } = require('discord.js');
const { addPlayList } = require('../queue');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('playlist')
        .setDescription('유튜브 url로 Playlist를 재생합니다.')
        .addStringOption(option =>
            option.setName('url')
                .setDescription('Youtube Playlist URL')
                .setRequired(true)
        ),

        async execute(interaction, client) {
            await addPlayList(interaction, client);
        },
        
};