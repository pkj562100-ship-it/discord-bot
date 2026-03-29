require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const schedule = require('node-schedule');

const TOKEN = process.env.TOKEN;
const APPLICATION_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// 💡 아래 따옴표 안에 복사한 채널 ID 숫자만 넣으세요.
const REPORT_CHANNEL_ID = '1487735750245220482'; 

if (!TOKEN || !APPLICATION_ID || !GUILD_ID) {
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

let bloodTaxRate = 20;
let attendanceLog = {}; 

const colors = {
  '패왕': 0x0000FF, '스타': 0xFFFF00, 'BEST': 0xFFC0CB,
  '발록': 0xFF0000, '명가': 0x800080, '기타': 0x808080
};

const commands = [
  new SlashCommandBuilder().setName('인원').setDescription('인원 체크 및 기록').addStringOption(o => o.setName('타임명').setDescription('예: 19시카파')),
  new SlashCommandBuilder().setName('통계').setDescription('참여 통계 확인'),
  new SlashCommandBuilder().setName('통계초기화').setDescription('데이터 초기화'),
  new SlashCommandBuilder().setName('혈비').setDescription('혈비 설정').addIntegerOption(o => o.setName('값').setRequired(true)),
  new SlashCommandBuilder().setName('정산1').setDescription('혈비 제외 정산').addStringOption(o => o.setName('아이템이름').setRequired(true)).addIntegerOption(o => o.setName('아이템금액').setRequired(true)).addIntegerOption(o => o.setName('패왕인원수').setRequired(true)).addIntegerOption(o => o.setName('스타인원수').setRequired(true)).addIntegerOption(o => o.setName('베스트인원수').setRequired(true)).addIntegerOption(o => o.setName('발록인원수').setRequired(true)),
  new SlashCommandBuilder().setName('정산2').setDescription('혈비 없이 정산').addStringOption(o => o.setName('아이템이름').setRequired(true)).addIntegerOption(o => o.setName('아이템금액').setRequired(true)).addIntegerOption(o => o.setName('패왕인원수').setRequired(true)).addIntegerOption(o => o.setName('스타인원수').setRequired(true)).addIntegerOption(o => o.setName('베스트인원수').setRequired(true)).addIntegerOption(o => o.setName('발록인원수').setRequired(true))
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(APPLICATION_ID, GUILD_ID), { body: commands });
  } catch (e) { console.error(e); }
})();

client.once('ready', () => {
  console.log('Bot is Ready');
  
  schedule.scheduleJob('10 23 * * *', async () => {
    const channel = client.channels.cache.get(REPORT_CHANNEL_ID);
    if (!channel || Object.keys(attendanceLog).length === 0) return;

    const stats = { '패왕': [], '스타': [], 'BEST': [], '발록': [], '명가': [], '기타': [] };
    Object.entries(attendanceLog).forEach(([name, count]) => {
      const tagMatch = name.match(/^\[(.*?)\]/);
      let tag = '기타';
      if (tagMatch) {
        let t = tagMatch[1].trim();
        if (t === '베스트' || t === 'BEST') t = 'BEST';
        if (stats[t]) tag = t;
      }
      stats[tag].push({ name, count });
    });

    const embeds = [new EmbedBuilder().setTitle('📊 오늘 최종 보탐 통계').setColor(0xFFAA00).setTimestamp()];
    for (const [tag, users] of Object.entries(stats)) {
      if (users.length > 0) {
        const list = users.sort((a, b) => b.count - a.count).map(u => `**${u.name}**: ${u.count}회`).join('\n');
        embeds.push(new EmbedBuilder().setTitle(`[${tag}]`).setDescription(list).setColor(colors[tag] || 0x808080));
      }
    }
    channel.send({ content: '🔔 **정기 보고**', embeds });
  });

  schedule.scheduleJob('0 0 * * *', () => { attendanceLog = {}; });
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, options } = interaction;

  if (commandName === '인원') {
    const timeName = options.getString('타임명') || '인원 체크';
    if (!interaction.member.voice.channel) return interaction.reply('❌ 음성 채널에 접속하세요.');
    const members = interaction.member.voice.channel.members.filter(m => !m.user.bot);
    const groups = { '패왕': [], '스타': [], 'BEST': [], '발록': [], '명가': [], '기타': [] };

    members.forEach(m => {
      const name = m.displayName;
      attendanceLog[name] = (attendanceLog[name] || 0) + 1;
      const tagMatch = name.match(/^\[(.*?)\]/);
      let tag = '기타', dName = name;
      if (tagMatch) {
        tag = tagMatch[1].trim();
        if (tag === '베스트' || tag === 'BEST') tag = 'BEST';
        dName = name.replace(/^\[.*?\]/, '').trim();
      }
      if (groups[tag]) groups[tag].push(dName); else groups['기타'].push(dName);
    });

    const embeds = [new EmbedBuilder().setTitle(`📢 ${timeName}`).setDescription(`총 **${members.size}**명`).setColor(0xFFFFFF)];
    for (const [tag, list] of Object.entries(groups)) {
      if (list.length > 0) embeds.push(new EmbedBuilder().setTitle(`[${tag}] (${list.length}명)`).setDescription(list.join('\n')).setColor(colors[tag]));
    }
    await interaction.reply({ embeds });
  }

  if (commandName === '통계') {
    if (Object.keys(attendanceLog).length === 0) return interaction.reply('📊 기록 없음');
    await interaction.reply({ content: '📊 실시간 데이터가 쌓이고 있습니다.', ephemeral: true });
  }

  if (commandName === '통계초기화') { attendanceLog = {}; await interaction.reply('🗑️ 초기화 완료'); }

  if (commandName === '혈비') { bloodTaxRate = options.getInteger('값'); await interaction.reply(`✅ ${bloodTaxRate}% 설정`); }

  if (commandName === '정산1' || commandName === '정산2') {
    const isTax = commandName === '정산1';
    const itemName = options.getString('아이템이름');
    const total = options.getInteger('아이템금액');
    const p = { '패왕': options.getInteger('패왕인원수'), '스타': options.getInteger('스타인원수'), 'BEST': options.getInteger('베스트인원수'), '발록': options.getInteger('발록인원수') };
    const target = isTax ? total * (1 - bloodTaxRate / 100) : total;
    const totalP = Object.values(p).reduce((a, b) => a + b, 0);
    const res = {}; let sum = 0;
    for (let [t, n] of Object.entries(p)) { const amt = Math.floor(target * (n / totalP)); res[t] = amt; sum += amt; }
    const rem = Math.round(target - sum);
    if (rem > 0) res[Object.entries(p).sort((a, b) => b[1] - a[1])[0][0]] += rem;
    const embeds = [new EmbedBuilder().setTitle(`💎 ${itemName}`).setDescription(`총: ${total.toLocaleString()}\n${isTax ? `혈비제외: ${Math.floor(target).toLocaleString()}` : '혈비제외 정산'}`).setColor(0x00FF00)];
    for (let [t, a] of Object.entries(res)) embeds.push(new EmbedBuilder().setTitle(`${t} 정산`).setDescription(`💰 **${a.toLocaleString()}**`).setColor(colors[t]));
    await interaction.reply({ embeds });
  }
});

client.login(TOKEN);