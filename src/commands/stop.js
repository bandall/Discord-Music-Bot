const { SlashCommandBuilder } = require('discord.js');
const { stop } = require("../queue")
module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('음악재생을 멈추고 Queue를 정리합니다.'),

    async execute(interaction, client) {
        stop(interaction, client)
    },
};