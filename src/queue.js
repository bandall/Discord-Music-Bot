const { generateDependencyReport, getVoiceConnection, AudioPlayerStatus, joinVoiceChannel, createAudioPlayer, createAudioResource } = require('@discordjs/voice');
const ytdl = require("ytdl-core");
import fs, { createReadStream } from "fs";
import path from "path"
import "dotenv/config"
const queueMap = new Map();

const embed = {
    color: 0x426cf5,
    author: {
        name: '',
        icon_url: '',
    },
    fields: [{
        name: '현재 재생 목록',
        value: '',
        inline: false
      },
    ],
    timestamp: new Date().toISOString(),
    footer: {
        text: '',
        icon_url: '',
    },
};


const addPlayList = async (interaction, client) => {
    if(!interaction.member.voice.channel) {
        interaction.reply({ content: '🚫 음악 기능을 사용하기 위해서는 음성 채널에 참가해야 합니다.' });
        return;
    }
    
    let song = null;
    try {
        const url = interaction.options.getString('url');
        const songInfo = await ytdl.getInfo(url);
        song = {
            type: 'youtube',
            title: songInfo.videoDetails.title,
            url: songInfo.videoDetails.video_url
        };
    } catch (error) {
        interaction.reply({ content: '🚫 잘못된 URL 입니다.' });
        return;
    }
    
    // 서버큐 불러오기 또는 생성하기
    let serverQueue = queueMap.get(interaction.guild.id)
    if(!serverQueue) {
        const connection = joinVoiceChannel({
            channelId: interaction.member.voice.channel.id,
            guildId: interaction.guild.id,
            adapterCreator: interaction.guild.voiceAdapterCreator,
        });
        const player = createAudioPlayer();
        player.on('error', error => {
            console.error(`🚫 재생 도중 오류가 발생하였습니다.`);
            playNext(interaction, client, queueMap);
        });
        player.on(AudioPlayerStatus.Idle, () => {
            playNext(interaction, client, queueMap);
        });
        connection.subscribe(player);
        serverQueue = {
            playlist: [],
            player: player,
            connection: connection,
            textChannel: interaction.channelId
        };
        serverQueue.playlist.push(song);
        queueMap.set(interaction.guild.id, serverQueue);
        play(interaction, client);
        interaction.reply({ content: `💿 Queue에 추가됨  ➡  [${song.title}]` });
        return;
    }
    // if(interaction.member.voice.channel.id != serverQueue.connection.channelId) {
    //     interaction.reply({ content: '🚫 자갈치상인이 이미 사용중입니다.' });
    // }
    serverQueue.playlist.push(song);
    interaction.reply({ content: `💿 Queue에 추가됨  ➡  [${song.title}]` });
}

const addLocalPlaylist = async (interaction, client) => {
    if(!interaction.member.voice.channel) {
        interaction.reply({ content: '🚫 음악 기능을 사용하기 위해서는 음성 채널에 참가해야 합니다.' });
        return;
    }
    
    let song = null;
    try {
        const songName = interaction.options.getString('file');
        const musicPath = path.join(process.env.localPath, songName);
        const exist = fs.existsSync(musicPath);
        if(!exist) {
            throw new Error(`No Such File ${songName}`);
        }
        song = {
            type: 'local',
            title: songName,
            path: musicPath
        };
    } catch (error) {
        interaction.reply({ content: '🚫 잘못된 파일명 입니다.' });
        console.log(error);
        return;
    }
    
    // 서버큐 불러오기 또는 생성하기
    let serverQueue = queueMap.get(interaction.guild.id)
    if(!serverQueue) {
        const connection = joinVoiceChannel({
            channelId: interaction.member.voice.channel.id,
            guildId: interaction.guild.id,
            adapterCreator: interaction.guild.voiceAdapterCreator,
        });
        const player = createAudioPlayer();
        player.on('error', error => {
            console.error(`🚫 재생 도중 오류가 발생하였습니다.`);
            playNext(interaction, client, queueMap);
        });
        player.on(AudioPlayerStatus.Idle, () => {
            playNext(interaction, client, queueMap);
        });
        connection.subscribe(player);
        serverQueue = {
            playlist: [],
            player: player,
            connection: connection,
            textChannel: interaction.channelId
        };
        serverQueue.playlist.push(song);
        queueMap.set(interaction.guild.id, serverQueue);
        play(interaction, client);
        interaction.reply({ content: `💿 Queue에 추가됨 ➡ [${song.title}]` });
        return;
    }
    // if(interaction.member.voice.channel.id != serverQueue.connection.channelId) {
    //     interaction.reply({ content: '🚫 자갈치상인이 이미 사용중입니다.' });
    // }
    serverQueue.playlist.push(song);
    interaction.reply({ content: `💿 Queue에 추가됨 ➡ [${song.title}]` });
}

const play = async (interaction, client) => {
    let serverQueue = queueMap.get(interaction.guild.id);
    const song = serverQueue.playlist[0];
    let player = serverQueue.player;
    let resource = null;
    try {
        if(song.type == "youtube") {
            resource = createAudioResource(ytdl(song.url, {
                filter: "audioonly",
                quality: 'highestaudio',
                highWaterMark: 1 << 25
            }));
        } else {
            resource = createAudioResource(createReadStream(song.path));
        }
        
        embed.author.name = client.username;
        embed.author.icon_url = `https://cdn.discordapp.com/avatars/${client.id}/${client.avatar}.webp`;
        embed.fields[0].value = `🎵    Now playing  ➡  ${song.title}`;
        client.channels.cache.get(serverQueue.textChannel).send({embeds: [embed]});
        player.play(resource);
    } catch (error) {
        client.channels.cache.get(serverQueue.textChannel).send("‼음악을 재생할 수 없습니다. 다음곡으로 넘어갑니다.");
        console.log(error);
        playNext(interaction, client);
        return;
    }
}
// 지연시간 설정
const playNext = async (interaction, client) => {
    let serverQueue = queueMap.get(interaction.guild.id)
    if(serverQueue) {
        serverQueue.playlist.shift();
        if (serverQueue.playlist.length == 0) {
            serverQueue.player.stop();
            // serverQueue.connection.destroy();
            queueMap.delete(interaction.guild.id);
        } else {
            play(interaction, client);
        }
    }
}

const pause = async (interaction, client) => {
    let serverQueue = queueMap.get(interaction.guild.id);
    if(!serverQueue) {
        interaction.reply({content: "🚫 음악 재생 중이 아닙니다."});
        return;
    }

    serverQueue.player.pause();
    interaction.reply({content: "음악을 일시정지 합니다."});
    const reply = await interaction.fetchReply();
    reply.react('⏸');
}

const unpause = async (interaction, client) => {
    let serverQueue = queueMap.get(interaction.guild.id);
    if(!serverQueue) {
        interaction.reply({content: "🚫 음악 재생 중이 아닙니다."});
        return;
    }
    if(serverQueue.player._state.status != 'paused') {
        interaction.reply({content: "🚫 일시정지 상태가 아닙니다."});
        return;
    }
    serverQueue.player.unpause();
    interaction.reply({content: "음악을 다시 재생합니다."});
    const reply = await interaction.fetchReply();
    reply.react('▶️');
}

const stop = async (interaction, client) => {
    let serverQueue = queueMap.get(interaction.guild.id);
    if(!serverQueue) {
        interaction.reply({content: "🚫 음악 재생 중이 아닙니다."});
        return;
    }
    interaction.reply('재생을 중지합니다.');
    const reply = await interaction.fetchReply();
    reply.react('🛑');
    serverQueue.player.stop();
    queueMap.delete(interaction.guild.id);
}

const showQueue = async (interaction, client) => {
    let serverQueue = queueMap.get(interaction.guild.id);
    if(!serverQueue) {
        interaction.reply({content: "🚫 큐가 비어있습니다."});
        return;
    }
    embed.author.name = client.username;
    embed.author.icon_url = `https://cdn.discordapp.com/avatars/${client.id}/${client.avatar}.webp`;
    embed.fields[0].value = ""
    for(let i = 0; i < serverQueue.playlist.length; i++) {
        const song = serverQueue.playlist[i];
        embed.fields[0].value += `${i+1}. ${song.title}\n`
    }
    interaction.reply({embeds: [embed]});
}

const leave = async (interaction, client) => {
    let serverQueue = queueMap.get(interaction.guild.id);
    if(!serverQueue) {
        interaction.reply({content: "🚫 현재 음악 방에 참가 중이지 않습니다."});
        return;
    }
    try {
        interaction.reply({content: "🧨"});
        serverQueue.player.stop();
        serverQueue.connection.destroy();
        queueMap.delete(interaction.guild.id);
    } catch (error) {
        console.log(error);
    }
}
module.exports = { play, playNext, addPlayList, pause, unpause, stop, addLocalPlaylist, showQueue, leave };


/*

if(serverQueue.songs.length == 0) {
        serverQueue.player.stop();
        serverQueue.connection.disconect();
        queueMap.delete(interaction.guild_id);
    } else {
        await sleep(500);
        play(interaction, serverQueue, client, queueMap);
    }
*/