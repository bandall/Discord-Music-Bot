const { AudioPlayerStatus, joinVoiceChannel, createAudioPlayer, createAudioResource } = require('@discordjs/voice');
const ytdl = require("ytdl-core");
import fs, { createReadStream } from "fs";
import path from "path"
import "dotenv/config"
const queueMap = new Map();

const embed = {
    color: 0x00FFFF,
    author: {
        name: '',
        icon_url: '',
    },
    fields: [{
        name: '현재 재생 중인 노래',
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
    if(!interaction || !client) {
        interaction.reply({ content: '🚫 Discord 서버와의 통신에 오류가 발생했습니다.' });
        return;
    }
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
    try {
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
            interaction.reply("🎶 노래 재생이 시작됩니다.")
            play(interaction, client);
            return;
        }
    } catch (error) {
        interaction.reply({ content: `💿 노래를 재생 목록에 추가할 수 없습니다.` });
        return;
    }

    if(interaction.member.voice.channel.id != serverQueue.connection.joinConfig.channelId) {
        interaction.reply({ content: '🚫 자갈치상인이 이미 사용중입니다.' });
        return;
    }
    serverQueue.playlist.push(song);
    interaction.reply({ content: `💿 재생목록에 추가됨  ➡  [${song.title}]` });
}

const addLocalPlaylist = async (interaction, client) => {
    if(!interaction || !client) {
        interaction.reply({ content: '🚫 Discord 서버와의 통신에 오류가 발생했습니다.' });
        return;
    }
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
    try {
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
            interaction.reply("🎶 노래 재생이 시작됩니다.")
            play(interaction, client);
            return;
        }
    } catch (error) {
        interaction.reply({ content: `💿 노래를 재생 목록에 추가할 수 없습니다.` });
        return;
    }
    if(interaction.member.voice.channel.id != serverQueue.connection.joinConfig.channelId) {
        interaction.reply({ content: '🚫 자갈치상인이 이미 사용중입니다.' });
        return;
    }
    serverQueue.playlist.push(song);
    interaction.reply({ content: `💿 재생목록에 추가됨  ➡  [${song.title}]` });
}

const play = async (interaction, client) => {
    let serverQueue = queueMap.get(interaction.guild.id);
    if(!serverQueue) {
        console.log("Cannot find Queue at funcion PLAY");
        interaction.reply({ content: `🚫 서버의 재생목록을 찾지 못 했습니다.` });
        return;
    }
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
const playNextBackup = async (interaction, client) => {
    let serverQueue = queueMap.get(interaction.guild.id)
    if(serverQueue) {
        serverQueue.playlist.shift();
        if (serverQueue.playlist.length == 0) {
            serverQueue.player.stop();
            serverQueue.connection.destroy();
            queueMap.delete(interaction.guild.id);
        } else {
            play(interaction, client);
        }
    }
}

const playNext = async (interaction, client) => {
    let serverQueue = queueMap.get(interaction.guild.id)
    if(serverQueue) {
        serverQueue.playlist.shift();
        if (serverQueue.playlist.length == 0) {
            // 10분
            for(let i = 0; i < 600; i++) {
                await sleep(1000);
                let tmpServerQueue = queueMap.get(interaction.guild.id);
                if(!tmpServerQueue) return;
                if(tmpServerQueue.playlist.length > 0) {
                    tmpServerQueue.playlist.unshift("Dummy");
                    playNext(interaction, client);
                    return;
                }
            }
            serverQueue.player.stop();
            serverQueue.connection.destroy();
            queueMap.delete(interaction.guild.id);
        } else {
            play(interaction, client);
        }
    }
}

const skip = async (interaction, client) => {
    if(!interaction || !client) {
        interaction.reply({ content: '🚫 Discord 서버와의 통신에 오류가 발생했습니다.' });
        return;
    }

    let serverQueue = queueMap.get(interaction.guild.id);
    if(!serverQueue) {
        interaction.reply({content: "🚫 음악 재생 중이 아닙니다."});
        return;
    }

    if(serverQueue.playlist.length == 0) {
        interaction.reply({content: "🚫 음악 재생 중이 아닙니다."});
        return;
    }
    //소리 나는거 해결
    if(serverQueue.player._state.status != 'pause') {
        serverQueue.player.unpause();
    }

    if(serverQueue.playlist.length == 1) {
        try {
            interaction.reply('⏩ 노래를 건너뛰는 중입니다.\n❗ 재생 목록이 더 이상 없습니다.');
            const reply = await interaction.fetchReply();
            reply.react('🛑');
            serverQueue.playlist = [];
            queueMap.set(interaction.guild.id, serverQueue);
            serverQueue.player.stop();
        } catch (error) {
            client.channels.cache.get(serverQueue.textChannel).send("🚫 오류가 발생했습니다.");
            console.log(error);
        }
    } else {
        interaction.reply({ content: '⏩ 노래를 건너뛰는 중입니다. '});
        playNext(interaction, client)
    }
}

const pause = async (interaction, client) => {
    if(!interaction || !client) {
        interaction.reply({ content: '🚫 Discord 서버와의 통신에 오류가 발생했습니다.' });
        return;
    }

    let serverQueue = queueMap.get(interaction.guild.id);
    if(!serverQueue) {
        interaction.reply({content: "🚫 음악 재생 중이 아닙니다."});
        return;
    }

    if(serverQueue.playlist.length == 0) {
        interaction.reply({content: "🚫 음악 재생 중이 아닙니다."});
        return;
    }

    if(serverQueue.player._state.status != 'playing') {
        interaction.reply({content: "🚫 음악 재생 중이 아닙니다."});
        return;
    }

    try {
        serverQueue.player.pause();
        interaction.reply({content: "음악을 일시정지 합니다."});
        const reply = await interaction.fetchReply();
        reply.react('⏸');
    } catch (error) {
        client.channels.cache.get(serverQueue.textChannel).send("🚫 오류가 발생해 음악을 정지할 수 없습니다.");
        console.log(error);
    }
}

const unpause = async (interaction, client) => {
    if(!interaction || !client) {
        interaction.reply({ content: '🚫 Discord 서버와의 통신에 오류가 발생했습니다.' });
        return;
    }

    let serverQueue = queueMap.get(interaction.guild.id);
    if(!serverQueue) {
        interaction.reply({content: "🚫 음악 재생 중이 아닙니다."});
        return;
    }

    if(serverQueue.playlist.length == 0) {
        interaction.reply({content: "🚫 음악 재생 중이 아닙니다."});
        return;
    }

    if(serverQueue.player._state.status != 'paused') {
        interaction.reply({content: "🚫 일시정지 상태가 아닙니다."});
        return;
    }
  
    try {
        serverQueue.player.unpause();
        interaction.reply({content: "음악을 다시 재생합니다."});
        const reply = await interaction.fetchReply();
        reply.react('▶️');
    } catch (error) {
        client.channels.cache.get(serverQueue.textChannel).send("🚫 오류가 발생해 음악을 재생할 수 없습니다.");
        console.log(error);
    }

}

const stop = async (interaction, client) => {
    if(!interaction || !client) {
        interaction.reply({ content: '🚫 Discord 서버와의 통신에 오류가 발생했습니다.' });
        return;
    }

    let serverQueue = queueMap.get(interaction.guild.id);

    if(!serverQueue) {
        interaction.reply({content: "🚫 음악 재생 중이 아닙니다."});
        return;
    }

    if(serverQueue.playlist.length == 0) {
        interaction.reply({content: "🚫 음악 재생 중이 아닙니다."});
        return;
    }

    try {
        interaction.reply('재생을 중지합니다.');
        const reply = await interaction.fetchReply();
        reply.react('🛑');
        serverQueue.playlist = [];
        queueMap.set(interaction.guild.id, serverQueue);
        serverQueue.player.stop();
    } catch (error) {
        client.channels.cache.get(serverQueue.textChannel).send("🚫 오류가 발생했습니다.");
        console.log(error);
    }
    
}

const showQueue = async (interaction, client) => {
    if(!interaction || !client) {
        interaction.reply({ content: '🚫 Discord 서버와의 통신에 오류가 발생했습니다.' });
        return;
    }
    let serverQueue = queueMap.get(interaction.guild.id);
    if(!serverQueue) {
        interaction.reply({content: "🚫 재생목록이 비어있습니다."});
        return;
    }

    if(serverQueue.playlist.length == 0) {
        interaction.reply({content: "🚫 재생목록이 비어있습니다."});
        return;
    }

    embed.author.name = client.username;
    embed.author.icon_url = `https://cdn.discordapp.com/avatars/${client.id}/${client.avatar}.webp`;
    embed.fields[0].value = "▶ "
    for(let i = 0; i < serverQueue.playlist.length; i++) {
        const song = serverQueue.playlist[i];
        embed.fields[0].value += `${i+1}. ${song.title}\n`
    }
    interaction.reply({embeds: [embed]});
}

const leave = async (interaction, client) => {
    if(!interaction || !client) {
        interaction.reply({ content: '🚫 Discord 서버와의 통신에 오류가 발생했습니다.' });
        return;
    }
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

const sleep = (ms) => {
    return new Promise(resolve=>{
        setTimeout(resolve,ms)
    });
}


module.exports = { play, playNext, addPlayList, pause, unpause, stop, addLocalPlaylist, showQueue, leave, skip };
