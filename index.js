import 'dotenv/config';
import { Client, GatewayIntentBits, SlashCommandBuilder, Routes } from 'discord.js';
import { REST } from '@discordjs/rest';
import axios from 'axios';
import QRCode from 'qrcode';
import express from 'express';

// ===== Render用Webサーバー =====
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));

// ===== Discord Bot =====
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const TOKEN = process.env.TOKEN;
const GEMIMI_API_KEY = process.env.GEMIMI_API_KEY;
const chatChannels = new Set();

// ===== スラッシュコマンド定義 =====
const commands = [
    new SlashCommandBuilder().setName('ping').setDescription('Bot動作確認'),
    new SlashCommandBuilder().setName('ban').setDescription('ユーザーBAN')
        .addUserOption(o => o.setName('target').setDescription('対象').setRequired(true)),
    new SlashCommandBuilder().setName('kick').setDescription('ユーザーキック')
        .addUserOption(o => o.setName('target').setDescription('対象').setRequired(true)),
    new SlashCommandBuilder().setName('clear').setDescription('メッセージ削除')
        .addIntegerOption(o => o.setName('amount').setDescription('削除数').setRequired(true)),
    new SlashCommandBuilder().setName('serverinfo').setDescription('サーバー情報'),
    new SlashCommandBuilder().setName('userinfo').setDescription('ユーザー情報')
        .addUserOption(o => o.setName('target').setDescription('対象').setRequired(true)),
    new SlashCommandBuilder().setName('timeout').setDescription('タイムアウト')
        .addUserOption(o => o.setName('target').setDescription('対象').setRequired(true))
        .addIntegerOption(o => o.setName('seconds').setDescription('秒数').setRequired(true)),
    new SlashCommandBuilder().setName('ipinfo').setDescription('IP情報取得')
        .addStringOption(o => o.setName('ip').setDescription('IPアドレス').setRequired(true)),
    new SlashCommandBuilder().setName('qrcode').setDescription('QRコード生成')
        .addStringOption(o => o.setName('url').setDescription('URL').setRequired(true)),
    new SlashCommandBuilder().setName('chatset').setDescription('AI応答チャンネル設定')
        .addChannelOption(o => o.setName('channel').setDescription('チャンネル').setRequired(true))
];

// ===== コマンド登録 =====
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('Commands registered');
    } catch (err) {
        console.error(err);
    }
});

// ===== スラッシュコマンド実行 =====
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName } = interaction;

    if (commandName === 'ping') return interaction.reply('Pong!');
    if (commandName === 'ban') {
        const user = interaction.options.getUser('target');
        const member = interaction.guild.members.cache.get(user.id);
        if (!member) return interaction.reply('メンバーが見つかりません');
        await member.ban();
        return interaction.reply(`${user.tag} をBANしました`);
    }
    if (commandName === 'kick') {
        const user = interaction.options.getUser('target');
        const member = interaction.guild.members.cache.get(user.id);
        if (!member) return interaction.reply('メンバーが見つかりません');
        await member.kick();
        return interaction.reply(`${user.tag} をキックしました`);
    }
    if (commandName === 'clear') {
        const amount = interaction.options.getInteger('amount');
        const messages = await interaction.channel.messages.fetch({ limit: amount });
        await interaction.channel.bulkDelete(messages);
        return interaction.reply({ content: `${amount}件削除`, ephemeral: true });
    }
    if (commandName === 'serverinfo') {
        const g = interaction.guild;
        return interaction.reply(`サーバー名: ${g.name}\nメンバー数: ${g.memberCount}`);
    }
    if (commandName === 'userinfo') {
        const user = interaction.options.getUser('target');
        return interaction.reply(`ユーザー名: ${user.tag}\nID: ${user.id}`);
    }
    if (commandName === 'timeout') {
        const user = interaction.options.getUser('target');
        const seconds = interaction.options.getInteger('seconds');
        const member = interaction.guild.members.cache.get(user.id);
        if (!member) return interaction.reply('メンバーが見つかりません');
        await member.timeout(seconds * 1000);
        return interaction.reply(`${user.tag} を ${seconds}秒タイムアウト`);
    }
    if (commandName === 'ipinfo') {
        const ip = interaction.options.getString('ip');
        try {
            const res = await axios.get(`http://ip-api.com/json/${ip}`);
            const data = res.data;
            return interaction.reply(`IP: ${data.query}\n国: ${data.country}\n都市: ${data.city}\nISP: ${data.isp}`);
        } catch {
            return interaction.reply('IP情報取得失敗');
        }
    }
    if (commandName === 'qrcode') {
        const url = interaction.options.getString('url');
        try {
            const qr = await QRCode.toDataURL(url);
            return interaction.reply(qr);
        } catch {
            return interaction.reply('QRコード作成失敗');
        }
    }
    if (commandName === 'chatset') {
        const channel = interaction.options.getChannel('channel');
        chatChannels.add(channel.id);
        return interaction.reply(`${channel} をAI応答チャンネルに設定しました`);
    }
});

// ===== メッセージ監視 =====
client.on('messageCreate', msg => {
    if (msg.content.includes('わらび')) msg.reply('なんやねん');

    if (chatChannels.has(msg.channel.id) && !msg.author.bot) {
        (async () => {
            try {
                const res = await axios.post('https://gemimi-api.example.com/ask', {
                    question: msg.content
                }, {
                    headers: { 'Authorization': `Bearer ${GEMIMI_API_KEY}`, 'Content-Type': 'application/json' }
                });
                msg.reply(res.data.answer);
            } catch {
                msg.reply('AI応答失敗');
            }
        })();
    }
});

client.login(TOKEN);
