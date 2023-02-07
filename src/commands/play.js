const { SlashCommandBuilder } = require('discord.js');
const { addPlayList } = require('../queue');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Youtube 또는 SoundCloud URL을 이용해 노래를 재생합니다.')
        .addStringOption(option =>
            option.setName('url')
                .setDescription('Youtube 또는 SoundCloud URL')
                .setRequired(true)
        ),

        async execute(interaction, client) {
            await addPlayList(interaction, client);
        },
        
};