import { Client, Collection, Events, GatewayIntentBits } from "discord.js";
import fs from "fs"
import path from "path"
import "dotenv/config"

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent
	],
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
	const filePath = path.join(commandsPath, file);
	const command = require(filePath);
	// Set a new item in the Collection with the key as the command name and the value as the exported module
	if ('data' in command && 'execute' in command) {
		client.commands.set(command.data.name, command);
	} else {
		console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
	}
}

const handleMusicCommand = async (interaction, command) => {
	await command.execute(interaction, client);
}

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;

	const command = interaction.client.commands.get(interaction.commandName);

	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	try {
		await handleMusicCommand(interaction, command);
	} catch (error) {
		console.error(`Error executing ${interaction.commandName}`);
		console.error(error);
	}
});

client.login(process.env.token);
client.once(Events.ClientReady, () => {
	client.user.setActivity('생선 진열', { type: 'PLAYING' });
    console.log(`Logged in as ${client.user.tag}!`);
    console.log(`Discord Bot is Listening!!`);
});
