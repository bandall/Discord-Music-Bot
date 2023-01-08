const { generateDependencyReport, getVoiceConnection, AudioPlayerStatus, entersState, joinVoiceChannel, createAudioPlayer, createAudioResource, VoiceConnectionStatus } = require('@discordjs/voice');
const ytdl = require("ytdl-core");
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
            location: 'Youtube',
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
        const url = interaction.options.getString('url');
        const songInfo = await ytdl.getInfo(url);
        song = {
            location: 'Youtube',
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
        interaction.reply({ content: `💿 Queue에 추가됨 ➡ [${song.title}]` });
        return;
    }
    serverQueue.playlist.push(song);
    interaction.reply({ content: `💿 Queue에 추가됨 ➡ [${song.title}]` });
}

const play = async (interaction, client) => {
    let serverQueue = queueMap.get(interaction.guild.id);
    const song = serverQueue.playlist[0];
    const player = serverQueue.player;
    const resource = createAudioResource(ytdl(song.url, {
        filter: "audioonly",
        quality: 'highestaudio',
        highWaterMark: 1 << 25
    }));
    embed.author.name = client.username;
    embed.author.icon_url = `https://cdn.discordapp.com/avatars/${client.id}/${client.avatar}.webp`;
    embed.fields[0].value = `🎵    Now playing  ➡  ${song.title}`;
    client.channels.cache.get(serverQueue.textChannel).send({embeds: [embed]});
    player.play(resource);
}

const playNext = async (interaction, client) => {
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

module.exports = { play, playNext, addPlayList, pause, unpause, stop, addLocalPlaylist, showQueue };


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