const { SlashCommandBuilder } = require('discord.js');
const { seek } = require('../queue');
module.exports = {
    data: new SlashCommandBuilder()
        .setName('seek')
        .setDescription('현재 재생 중인 노래의 시간을 수정합니다.')
        .addIntegerOption(option =>
            option.setName('min')
                .setDescription('분')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('sec')
                .setDescription('초')
                .setRequired(true)
        )
        ,

        async execute(interaction, client) {
            await seek(interaction, client)
        },
};