const { AudioPlayerStatus, joinVoiceChannel, createAudioPlayer, createAudioResource, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
import play_dl from "play-dl";
import fs, { createReadStream } from "fs";
import path from "path"
import "dotenv/config"
import { log_server, secToStamp, sleep } from "./util";
const queueMap = new Map();

// need to reset token after expired
play_dl.getFreeClientID().then((clientID) => play_dl.setToken({
     soundcloud : {
         client_id : clientID
     }
}))

const embed = {
    color: 0x00FFFF,
    fields: [{
        name: '현재 재생 중인 노래',
        value: '',
        inline: false
      },
    ],
    timestamp: new Date().toISOString(),
};

// make connection and add handler
const getVoiceConnect = (interaction, client) => {
    const connection = joinVoiceChannel({
        channelId: interaction.member.voice.channel.id,
        guildId: interaction.guild.id,
        adapterCreator: interaction.guild.voiceAdapterCreator,
    });

    connection.on(VoiceConnectionStatus.Disconnected, async (oldState, newState) => {
        try {
            await Promise.race([
                entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
            ]);
            // Seems to be reconnecting to a new channel - ignore disconnect
        } catch (error) {
            // Seems to be a real disconnect which SHOULDN'T be recovered from
            handleDisconnect(interaction, client);
        }
    });

    // due to discord udp change
    const networkStateChangeHandler = (oldNetworkState, newNetworkState) => {
        const newUdp = Reflect.get(newNetworkState, 'udp');
        clearInterval(newUdp?.keepAliveInterval);
    };
    // voice connection monitor
    connection.on('stateChange', (oldState, newState) => {
        log_server(`Connection transitioned from ${oldState.status} to ${newState.status}`);
        Reflect.get(oldState, 'networking')?.off('stateChange', networkStateChangeHandler);
        Reflect.get(newState, 'networking')?.on('stateChange', networkStateChangeHandler);
    });      
    log_server(`Connected to [${interaction.guild.name}:${interaction.user.username}]`);
    return connection;
}

// make audio player and add handler
const getPlayer = (interaction, client) => {
    const player = createAudioPlayer();
    player.on('error', error => {
        log_server(`ERROR: Player got an error`);
        log_server(error);
        client.channels.cache.get(serverQueue.textChannel).send("‼음악을 재생 중 오류가 발생했습니다.");
        playNext(interaction, client);
    });
    player.on(AudioPlayerStatus.Idle, () => {
        playNext(interaction, client);
    });
    player.on('stateChange', (oldState, newState) => {
        log_server(`Player transitioned from ${oldState.status} to ${newState.status}`);
    });
    return player;
}

// return song lists
const stringPlaylist = (playlist) => {
    let listString = "";
    for (let i = 0; i < playlist.songs.length; i++) {
        const song = playlist.songs[i];
        const tmpString = `${i+1}. ${song.title} \`${secToStamp(song.time)}\`\n`
        if(listString.length + tmpString.length + 30 >= 1024) {
            listString += " ...";
            break;
        }
        listString += tmpString;
    }
    return listString;
}

// add single youtube or soundcloud url to playlist
const addSong = async (interaction, client) => {
    if(!interaction || !client) {
        await interaction.reply({ content: '🚫 Discord 서버와의 통신에 오류가 발생했습니다.' });
        return;
    }
    if(!interaction.member.voice.channel) {
        await interaction.reply({ content: '🚫 음악 기능을 사용하기 위해서는 음성 채널에 참가해야 합니다.' });
        return;
    }

    await interaction.deferReply();
    let song = null;
    try {
        const url = interaction.options.getString('url');
        if(url.startsWith('https') && play_dl.yt_validate(url) !== false) {
            const songInfo = await play_dl.video_info(url);
            song = {
                type: 'youtube',
                title: songInfo.video_details.title,
                url: songInfo.video_details.url,
                time: songInfo.video_details.durationInSec,
                seek: 0
            };
        } else if (url.startsWith('https') && await play_dl.so_validate(url) !== false){
            const songInfo = await play_dl.soundcloud(url); 
            song = {
                type: 'soundcloud',
                title: songInfo.name,
                url: songInfo.url,
                time: songInfo.durationInSec,
                seek: 0
            };
        } else {
            await interaction.editReply({ content: '🚫 잘못된 URL 입니다.' });
            return;
        }
    } catch (error) {
        log_server(error);
        await interaction.editReply({ content: '🚫 잘못된 URL 입니다.' });
        return;
    }
    
    // 서버큐 불러오기 또는 생성하기
    let serverQueue = queueMap.get(interaction.guild.id)
    try {
        if(!serverQueue) {
            const connection = getVoiceConnect(interaction, client);
            const player = getPlayer(interaction, client);
            connection.subscribe(player);
            serverQueue = {
                playlist: [],
                player: player,
                connection: connection,
                textChannel: interaction.channelId
            };
            serverQueue.playlist.push(song);
            queueMap.set(interaction.guild.id, serverQueue);
            await interaction.editReply("🎶 노래 재생이 시작됩니다.");
            log_server(`[${interaction.guild.name}:${interaction.user.username}] added new song [${song.title}]`);
            play(interaction, client);
            return;
        }
    } catch (error) {
        await interaction.editReply({ content: `💿 노래를 재생 목록에 추가할 수 없습니다.` });
        return;
    }

    if(interaction.member.voice.channel.id != serverQueue.connection.joinConfig.channelId) {
        await interaction.editReply({ content: '🚫 자갈치상인이 이미 사용중입니다.' });
        return;
    }
    serverQueue.playlist.push(song);
    await interaction.editReply({ content: `💿 재생목록에 추가됨  ➡  [${song.title}]` });
    log_server(`[${interaction.guild.name}:${interaction.user.username}] added new song [${song.title}]`);
}

// add local song to playlist
const addLocalSong = async (interaction, client) => {
    if(!interaction || !client) {
        await interaction.reply({ content: '🚫 Discord 서버와의 통신에 오류가 발생했습니다.' });
        return;
    }
    if(!interaction.member.voice.channel) {
        await interaction.reply({ content: '🚫 음악 기능을 사용하기 위해서는 음성 채널에 참가해야 합니다.' });
        return;
    }
    // set deferRely
    await interaction.deferReply();

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
            path: musicPath,
            time: 0
        };
    } catch (error) {
        await interaction.editReply({ content: '🚫 잘못된 파일명 입니다.' });
        return;
    }
    
    // 서버큐 불러오기 또는 생성하기
    let serverQueue = queueMap.get(interaction.guild.id)
    try {
        if(!serverQueue) {
            const connection = getVoiceConnect(interaction, client);
            const player = getPlayer(interaction, client);
            connection.subscribe(player);
            serverQueue = {
                playlist: [],
                player: player,
                connection: connection,
                textChannel: interaction.channelId
            };
            serverQueue.playlist.push(song);
            queueMap.set(interaction.guild.id, serverQueue);
            await interaction.editReply("🎶 노래 재생이 시작됩니다.");
            log_server(`[${interaction.guild.name}:${interaction.user.username}] added new song [${song.title}]`);
            play(interaction, client);
            return;
        }
    } catch (error) {
        await interaction.editReply({ content: `💿 노래를 재생 목록에 추가할 수 없습니다.` });
        return;
    }
    if(interaction.member.voice.channel.id != serverQueue.connection.joinConfig.channelId) {
        await interaction.editReply({ content: '🚫 자갈치상인이 이미 사용중입니다.' });
        return;
    }
    serverQueue.playlist.push(song);
    await interaction.editReply({ content: `💿 재생목록에 추가됨  ➡  [${song.title}]` });
    log_server(`[${interaction.guild.name}:${interaction.user.username}] added new song [${song.title}]`);
}

// add Youtube Playlist
const addPlayList = async (interaction, client) => {
    if(!interaction || !client) {
        await interaction.reply({ content: '🚫 Discord 서버와의 통신에 오류가 발생했습니다.' });
        return;
    }
    if(!interaction.member.voice.channel) {
        await interaction.reply({ content: '🚫 음악 기능을 사용하기 위해서는 음성 채널에 참가해야 합니다.' });
        return;
    }

    // set deferRely
    await interaction.deferReply();

    const playlist = {
        title: "",
        videoCount: 0,
        songs: []
    };
    try {
        const url = interaction.options.getString('url');
        const playlist_info = await play_dl.playlist_info(url, { incomplete : true });
        playlist.title = playlist_info.title;
        playlist.videoCount = playlist_info.videoCount;
        for(let i = 0; i < playlist_info.videos.length; i++) {
            const songInfo = playlist_info.videos[i];
            const song = {
                type: 'youtube',
                title: songInfo.title,
                url: songInfo.url,
                time: songInfo.durationInSec
            };
            playlist.songs.push(song);
        }
    } catch (error) {
        await interaction.editReply({ content: '🚫 잘못된 URL 입니다.' });
        return;
    }
    
    // 서버큐 불러오기 또는 생성하기
    let serverQueue = queueMap.get(interaction.guild.id)
    try {
        if(!serverQueue) {
            const connection = getVoiceConnect(interaction, client);
            const player = getPlayer(interaction, client);
            connection.subscribe(player);
            serverQueue = {
                playlist: [],
                player: player,
                connection: connection,
                textChannel: interaction.channelId
            };
            serverQueue.playlist.push(...playlist.songs);
            queueMap.set(interaction.guild.id, serverQueue);
            // send embeds
            embed.fields[0].name = `추가된 재생목록: ${playlist.title}`;
            embed.fields[0].value = stringPlaylist(playlist);
            embed.timestamp = new Date().toISOString();
            await interaction.editReply({embeds: [embed]});
            log_server(`[${interaction.guild.name}:${interaction.user.username}] added new playlist [${playlist.title}]`);
            play(interaction, client);
            return;
        }
    } catch (error) {
        log_server(error);
        await interaction.editReply({ content: `💿 노래를 재생 목록에 추가할 수 없습니다.` });
        return;
    }

    if(interaction.member.voice.channel.id != serverQueue.connection.joinConfig.channelId) {
        await interaction.editReply({ content: '🚫 자갈치상인이 이미 사용중입니다.' });
        return;
    }
    serverQueue.playlist.push(...playlist.songs);
    embed.fields[0].name = `추가된 재생목록: ${playlist.title}`;
    embed.fields[0].value = stringPlaylist(playlist);
    await interaction.editReply({embeds: [embed]});
    log_server(`[${interaction.guild.name}:${interaction.user.username}] added new playlist [${playlist.title}]`);
}

// play song to voice channel
const play = async (interaction, client) => {
    let serverQueue = queueMap.get(interaction.guild.id);
    if(!serverQueue) {
        log_server("Cannot find Queue at funcion PLAY");
        await client.channels.cache.get(serverQueue.textChannel).send({ content: `🚫 서버의 재생목록을 찾지 못 했습니다.` });
        return;
    }
    const song = serverQueue.playlist[0];
    let player = serverQueue.player;
    let resource = null;
    try {
        if(song.type == "youtube" || song.type == "soundcloud") {
            let stream = await play_dl.stream(song.url, { seek : song.seek })
            resource = createAudioResource(stream.stream, { 
                inputType: stream.type,
                inlineVolume: true
             });
        } else {
            resource = createAudioResource(createReadStream(song.path), { inlineVolume: true });
        }
        resource.volume.setVolume(0.3);
        embed.fields[0].name = "현재 재생 중인 노래"
        embed.fields[0].value = `🎵    Now playing  ➡  ${song.title}`;
        embed.timestamp = new Date().toISOString();
        if(song.time) embed.fields[0].value += `  \`${secToStamp(song.time)}\``
        else embed.fields[0].value += `  \`local music\``
        await client.channels.cache.get(serverQueue.textChannel).send({embeds: [embed]});
        log_server(`[${interaction.guild.name}] playing [${song.title}]`);
        player.play(resource);
    } catch (error) {
        await client.channels.cache.get(serverQueue.textChannel).send("‼음악을 재생할 수 없습니다. 다음곡으로 넘어갑니다.");
        log_server(`[${interaction.guild.name}] can't play [${song.title}]`);
        log_server(error);
        playNext(interaction, client);
        return;
    }
}

// play next song
const playNext = async (interaction, client) => {
    let serverQueue = queueMap.get(interaction.guild.id)
    if(serverQueue) {
        serverQueue.playlist.shift();
        if (serverQueue.playlist.length == 0) {
            log_server(`[${interaction.guild.name}] is waiting for new song`);
            // 1시간
            for(let i = 0; i < 3600; i++) {
                await sleep(1000);
                let tmpServerQueue = queueMap.get(interaction.guild.id);
                if(!tmpServerQueue) return;
                if(tmpServerQueue.playlist.length > 0) {
                    tmpServerQueue.playlist.unshift("Dummy");
                    playNext(interaction, client);
                    return;
                }
            }
            log_server(`[${interaction.guild.name}] exit`);
            serverQueue.player.stop();
            serverQueue.connection.destroy();
            queueMap.delete(interaction.guild.id);
        } else {
            play(interaction, client);
        }
    }
}

// skip current song
const skip = async (interaction, client) => {
    if(!interaction || !client) {
        await interaction.reply({ content: '🚫 Discord 서버와의 통신에 오류가 발생했습니다.' });
        return;
    }

    let serverQueue = queueMap.get(interaction.guild.id);
    if(!serverQueue) {
        await interaction.reply({content: "🚫 음악 재생 중이 아닙니다."});
        return;
    }

    if(serverQueue.playlist.length == 0) {
        await interaction.reply({content: "🚫 음악 재생 중이 아닙니다."});
        return;
    }
    //소리 나는거 해결 
    if(serverQueue.player._state.status === 'pause') {
        // serverQueue.player.unpause();
        await interaction.reply({content: "🚫 skip하기 전에 unpause 해주세요."});
        return;
    }
    log_server(`[${interaction.guild.name}:${interaction.user.username}] used skip`);
    if(serverQueue.playlist.length == 1) {
        try {
            await interaction.reply('⏩ 노래를 건너뛰는 중입니다.\n❗ 재생 목록이 더 이상 없습니다.');
            const reply = await interaction.fetchReply();
            reply.react('🛑');
            serverQueue.playlist = [];
            queueMap.set(interaction.guild.id, serverQueue);
            serverQueue.player.stop();
        } catch (error) {
            await client.channels.cache.get(serverQueue.textChannel).send("🚫 오류가 발생했습니다.");
            log_server(`[${interaction.guild.name}:${interaction.user.username}] can't skip song`);
            log_server(error);
        }
    } else {
        await interaction.reply({ content: '⏩ 노래를 건너뛰는 중입니다. '});
        playNext(interaction, client)
    }
}

const seek = async (interaction, client) => {
    if(!interaction || !client) {
        await interaction.reply({ content: '🚫 Discord 서버와의 통신에 오류가 발생했습니다.' });
        return;
    }

    let serverQueue = queueMap.get(interaction.guild.id);
    if(!serverQueue) {
        await interaction.reply({content: "🚫 음악 재생 중이 아닙니다."});
        return;
    }

    if(serverQueue.playlist.length == 0) {
        await interaction.reply({content: "🚫 음악 재생 중이 아닙니다."});
        return;
    }

    log_server(`[${interaction.guild.name}:${interaction.user.username}] used seek`);
    if(serverQueue.player._state.status === 'pause') {
        // serverQueue.player.unpause();
        await interaction.reply({content: "🚫 seek하기 전에 unpause 해주세요."});
        return;
    }

    const cur_song = serverQueue.playlist[0];
    if (cur_song.type !== "youtube") {
        // loacl hint https://shotstack.io/learn/use-ffmpeg-to-trim-video/
        await interaction.reply({ content: '🚫 Youtube 음원만 seek가 가능합니다.'});
        return;
    }
    
    const seek_time = interaction.options.getInteger('min') * 60 + interaction.options.getInteger('sec');
    if(cur_song.time <= seek_time || seek_time < 0) {
        await interaction.reply({ content: '🚫 입력한 시간이 잘못되었습니다.'});
        return;
    }
    
    serverQueue.playlist[0].seek = seek_time;

    // add new playlist and skip
    await interaction.reply({ content: '⏩ 노래를 빨리감는 중입니다 '});
    serverQueue.playlist.unshift("Dummy");
    playNext(interaction, client)
}

// pause player
const pause = async (interaction, client) => {
    if(!interaction || !client) {
        await interaction.reply({ content: '🚫 Discord 서버와의 통신에 오류가 발생했습니다.' });
        return;
    }

    let serverQueue = queueMap.get(interaction.guild.id);
    if(!serverQueue) {
        await interaction.reply({content: "🚫 음악 재생 중이 아닙니다."});
        return;
    }

    if(serverQueue.playlist.length == 0) {
        await interaction.reply({content: "🚫 음악 재생 중이 아닙니다."});
        return;
    }

    if(serverQueue.player._state.status != 'playing') {
        await interaction.reply({content: "🚫 음악 재생 중이 아닙니다."});
        return;
    }

    try {
        log_server(`[${interaction.guild.name}:${interaction.user.username}] used pause`);
        serverQueue.player.pause();
        await interaction.reply({content: "음악을 일시정지 합니다."});
        const reply = await interaction.fetchReply();
        reply.react('⏸');
    } catch (error) {
        log_server(`[${interaction.guild.name}:${interaction.user.username}] can't pause`);
        await client.channels.cache.get(serverQueue.textChannel).send("🚫 오류가 발생해 음악을 정지할 수 없습니다.");
        log_server(error);
    }
}

// unpause player
const unpause = async (interaction, client) => {
    if(!interaction || !client) {
        await interaction.reply({ content: '🚫 Discord 서버와의 통신에 오류가 발생했습니다.' });
        return;
    }

    let serverQueue = queueMap.get(interaction.guild.id);
    if(!serverQueue) {
        await interaction.reply({content: "🚫 음악 재생 중이 아닙니다."});
        return;
    }

    if(serverQueue.playlist.length == 0) {
        await interaction.reply({content: "🚫 음악 재생 중이 아닙니다."});
        return;
    }

    if(serverQueue.player._state.status != 'paused') {
        await interaction.reply({content: "🚫 일시정지 상태가 아닙니다."});
        return;
    }
  
    try {
        log_server(`[${interaction.guild.name}:${interaction.user.username}] used unpause`);
        serverQueue.player.unpause();
        await interaction.reply({content: "음악을 다시 재생합니다."});
        const reply = await interaction.fetchReply();
        reply.react('▶️');
    } catch (error) {
        log_server(`[${interaction.guild.name}:${interaction.user.username}] can't unpause`);
        await client.channels.cache.get(serverQueue.textChannel).send("🚫 오류가 발생해 음악을 재생할 수 없습니다.");
        log_server(error);
    }

}

// stop player
const stop = async (interaction, client) => {
    if(!interaction || !client) {
        await interaction.reply({ content: '🚫 Discord 서버와의 통신에 오류가 발생했습니다.' });
        return;
    }

    let serverQueue = queueMap.get(interaction.guild.id);

    if(!serverQueue) {
        await interaction.reply({content: "🚫 음악 재생 중이 아닙니다."});
        return;
    }

    if(serverQueue.playlist.length == 0) {
        await interaction.reply({content: "🚫 음악 재생 중이 아닙니다."});
        return;
    }

    try {
        log_server(`[${interaction.guild.name}:${interaction.user.username}] used stop`);
        await interaction.reply('재생을 중지합니다.');
        const reply = await interaction.fetchReply();
        reply.react('🛑');
        serverQueue.playlist = [];
        queueMap.set(interaction.guild.id, serverQueue);
        serverQueue.player.stop();
    } catch (error) {
        log_server(`[${interaction.guild.name}:${interaction.user.username}] can't stop`);
        await client.channels.cache.get(serverQueue.textChannel).send("🚫 오류가 발생했습니다.");
        log_server(error);
    }
    
}

// send embed playlist message to text channel
const showQueue = async (interaction, client) => {
    if(!interaction || !client) {
        await interaction.reply({ content: '🚫 Discord 서버와의 통신에 오류가 발생했습니다.' });
        return;
    }
    let serverQueue = queueMap.get(interaction.guild.id);
    if(!serverQueue) {
        await interaction.reply({content: "🚫 재생목록이 비어있습니다."});
        return;
    }

    if(serverQueue.playlist.length == 0) {
        await interaction.reply({content: "🚫 재생목록이 비어있습니다."});
        return;
    }

    try {
        embed.fields[0].name = "현재 재생 중인 노래"
        embed.fields[0].value = "▶ " + stringPlaylist({ songs: serverQueue.playlist });
        embed.timestamp = new Date().toISOString();
        log_server(`[${interaction.guild.name}:${interaction.user.username}] used queue`);
        await interaction.reply({embeds: [embed]});
    } catch (error) {
        await interaction.reply({content: "🚫 재생목록 출력 중 오류가 발생했습니다."});
        log_server(`[${interaction.guild.name}:${interaction.user.username}] can't queue`);
        log_server(error);
    }
}

// leave voice channel
const leave = async (interaction, client) => {
    if(!interaction || !client) {
        await interaction.reply({ content: '🚫 Discord 서버와의 통신에 오류가 발생했습니다.' });
        return;
    }
    let serverQueue = queueMap.get(interaction.guild.id);
    if(!serverQueue) {
        await interaction.reply({content: "🚫 현재 음악 방에 참가 중이지 않습니다."});
        return;
    }
    try {
        log_server(`[${interaction.guild.name}:${interaction.user.username}] used leave`);
        await interaction.reply({content: "🧨"});
        serverQueue.player.stop();
        serverQueue.connection.destroy();
        queueMap.delete(interaction.guild.id);
    } catch (error) {
        await interaction.reply({content: "🚫 음성 채널을 나가는 도중 오류가 발생했습니다."});
        log_server(`[${interaction.guild.name}:${interaction.user.username}] can't leave`);
        log_server(error);
    }
}

// handel disconnect event such as kick
const handleDisconnect = async (interaction, client) => {
    log_server(`[${interaction.guild.name}] forced voice disconnect`);
    if(!interaction || !client) {
        log_server("[ERROR] => handleDisconnect has null args")
        return;
    }
    let serverQueue = queueMap.get(interaction.guild.id);
    if(!serverQueue) {
        log_server("[ERROR] => handleDisconnect can't find serverQueue")
        return;
    }
    try {
        client.channels.cache.get(serverQueue.textChannel).send({content: "🧨"});
        serverQueue.player.stop();
        serverQueue.connection.destroy();
        queueMap.delete(interaction.guild.id);
    } catch (error) {
        log_server(`[ERROR] => handleDisconnect can't disconnect voice channel`);
        log_server(error);
    }
}

module.exports = { play, playNext, addSong, pause, unpause, stop, addLocalSong, showQueue, leave, skip, addPlayList, seek };
