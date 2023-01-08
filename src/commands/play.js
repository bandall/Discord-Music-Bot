const { SlashCommandBuilder } = require('discord.js');
const { generateDependencyReport, getVoiceConnection, AudioPlayerStatus, entersState, joinVoiceChannel, createAudioPlayer, createAudioResource, VoiceConnectionStatus } = require('@discordjs/voice');
const { ChannelType } = require('discord.js');
const ytdl = require("ytdl-core");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play a Music')
        .addChannelOption((option) =>
            option
                .setName('channel')
                .setDescription('Where')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildVoice)
        ),

        async execute(interaction) {
            interaction.reply({
                content: 'ok',
            });
            const voiceChannel = interaction.options.getChannel('channel');
            const voiceConnection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: interaction.guildId,
                adapterCreator: interaction.guild.voiceAdapterCreator,
            })
            
            const connection = getVoiceConnection(interaction.guildId);
            const player = createAudioPlayer();
            // const resource = createAudioResource('C:\\Users\\jsm53\\Desktop\\Discord Bot\\music\\music.mp3');
            const resource = createAudioResource(ytdl("https://www.youtube.com/watch?v=SXE-gIU3yJs"));
            try {
                await entersState(voiceConnection, VoiceConnectionStatus.Ready, 5000);
                console.log("Connected: " + voiceChannel.guild.name);
            } catch (error) {
                console.log("Voice Connection not ready within 5s.", error);
                return null;
            }
            connection.subscribe(player);
            player.play(resource);

            player.on(AudioPlayerStatus.Playing, () => {
                console.log('Playing');
            })

            player.on('error', error => {
                console.error(`Error: ${error.message} with resource`);
            })

            player.on(AudioPlayerStatus.Idle, () => {
                player.stop();
                connection.destroy();
                console.log("Song Ends");
            });
        },
};