const { SlashCommandBuilder } = require('discord.js');
import "dotenv/config";
import { log_server } from "../util";
const embed = {
    color: 0x00FFFF,
    title: '자갈치상인 명령어 모음',
    fields: [
        {
            name: 'play',
            value: 'Youtube URL을 이용해 노래를 재생합니다.',
            inline: false
        },
        {
            name: 'local',
            value: '서버에 저장된 노래를 재생합니다.\n업로드 링크: [https://bandallgom.com:42667/sharing/PgFBHTVNv]\n업로드 시 "귀하의 이름"은 music으로 작성\n/local [업로드한 파일 이름]',
            inline: false
        },
        {
            name: 'skip',
            value: '현재 재생 중인 노래를 건너뜁니다.',
            inline: false
        },
        {
            name: 'stop',
            value: '노래 재생을 중단하고 음성채팅방을 나갑니다.',
            inline: false
        },
        {
            name: 'pause',
            value: '노래 재생을 일시중지합니다.',
            inline: false
        },
        {
            name: 'unpause',
            value: '일시중시된 노래를 다시 재생합니다.',
            inline: false
        },
        {
            name: 'queue',
            value: '재생목록을 출력합니다.',
            inline: false
        },
        {
            name: 'leave',
            value: '음성채팅방에서 나갑니다.',
            inline: false
        },
    ],
    timestamp: new Date().toISOString(),
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('도움말을 출력합니다.'),

        async execute(interaction, client) {
            log_server(`[${interaction.guild.name}:${interaction.user.username}] used help`);
            interaction.reply({embeds: [embed]});
        },

};