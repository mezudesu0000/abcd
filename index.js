import 'dotenv/config';
import { Client, GatewayIntentBits, Collection } from 'discord.js';
import fs from 'fs';
import gemimi from 'gemimi';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

client.commands = new Collection();

// commandsフォルダの読み込み
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const command = await import(`./commands/${file}`);
    client.commands.set(command.default.data.name, command.default);
}

// スラッシュコマンド実行
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction, client);
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'エラーが発生しました。', ephemeral: true });
    }
});

// メッセージ監視（わらび→なんやねん）
client.on('messageCreate', msg => {
    if (msg.content.includes('わらび')) {
        msg.reply('なんやねん');
    }
});

// AI応答（chatsetで指定されたチャンネルのみ）
const chatChannels = new Map(); // チャンネルIDを保存
client.on('messageCreate', async msg => {
    if (chatChannels.has(msg.channel.id) && !msg.author.bot) {
        const reply = await gemimi.ask(msg.content, process.env.GEMIMI_API_KEY);
        msg.reply(reply);
    }
});

client.login(process.env.TOKEN);
