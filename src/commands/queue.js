const { SlashCommandBuilder } = require('discord.js');
const { showQueue } = require("../queue")
module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('현재 재생 목록을 출력합니다.'),

    async execute(interaction, client) {
        await showQueue(interaction, client)
    },
};