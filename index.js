require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const schedule = require('node-schedule');

const TOKEN = process.env.TOKEN;
const APPLICATION_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const REPORT_CHANNEL_ID = '1487735750245220482';

if (!TOKEN || !APPLICATION_ID || !GUILD_ID) {
  console.log('❌ .env 설정 확인 필요');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

let bloodTaxRate = 20;
let attendanceLog = {};

const colors = {
  '패왕': 0x0000FF,
  '스타': 0xFFFF00,
  'BEST': 0xFFC0CB,
  '발록': 0xFF0000,
  '명가': 0x800080,
  '기타': 0x808080
};

// ✅ 명령어 등록 (Description 누락 부분 수정 완료)
const commands = [
  new SlashCommandBuilder()
    .setName('인원')
    .setDescription('현재 채널 인원 체크')
    .addStringOption(o => o.setName('타임명').setDescription('체크할 타임 이름을 입력하세요 (예: 19시 타임)')),

  new SlashCommandBuilder().setName('통계').setDescription('통계 안내를 확인합니다.'),
  new SlashCommandBuilder().setName('통계초기화').setDescription('오늘의 통계 데이터를 초기화합니다.'),

  new SlashCommandBuilder()
    .setName('혈비')
    .setDescription('혈비 세율을 설정합니다.')
    .addIntegerOption(o => o.setName('값').setDescription('설정할 혈비 퍼센트(0~100)').setRequired(true)),

  new SlashCommandBuilder()
    .setName('정산1')
    .setDescription('혈비를 적용하여 정산합니다.')
    .addStringOption(o => o.setName('아이템이름').setDescription('아이템 이름을 입력하세요').setRequired(true))
    .addIntegerOption(o => o.setName('아이템금액').setDescription('총 금액을 입력하세요').setRequired(true))
    .addIntegerOption(o => o.setName('패왕인원수').setDescription('패왕 인원수').setRequired(true))
    .addIntegerOption(o => o.setName('스타인원수').setDescription('스타 인원수').setRequired(true))
    .addIntegerOption(o => o.setName('베스트인원수').setDescription('베스트 인원수').setRequired(true))
    .addIntegerOption(o => o.setName('발록인원수').setDescription('발록 인원수').setRequired(true)),

  new SlashCommandBuilder()
    .setName('정산2')
    .setDescription('혈비 없이 정산합니다.')
    .addStringOption(o => o.setName('아이템이름').setDescription('아이템 이름을 입력하세요').setRequired(true))
    .addIntegerOption(o => o.setName('아이템금액').setDescription('총 금액을 입력하세요').setRequired(true))
    .addIntegerOption(o => o.setName('패왕인원수').setDescription('패왕 인원수').setRequired(true))
    .addIntegerOption(o => o.setName('스타인원수').setDescription('스타 인원수').setRequired(true))
    .addIntegerOption(o => o.setName('베스트인원수').setDescription('베스트 인원수').setRequired(true))
    .addIntegerOption(o => o.setName('발록인원수').setDescription('발록 인원수').setRequired(true))
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    const data = await rest.put(
      Routes.applicationGuildCommands(APPLICATION_ID, GUILD_ID),
      { body: commands }
    );
    console.log(`✅ ${data.length}개 명령어 등록 완료`);
  } catch (e) {
    console.error('❌ 명령어 등록 중 오류 발생:', e);
  }
})();

// ... (이하 client.once 및 client.on 로직은 동일하므로 생략하거나 그대로 사용하시면 됩니다)
// ... (전달해주신 코드의 뒷부분을 그대로 붙여넣으세요)

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, options } = interaction;

  if (commandName === '인원') {
    if (!interaction.member.voice.channel) {
      return interaction.reply('❌ 음성채널 들어가세요');
    }
    const members = interaction.member.voice.channel.members.filter(m => !m.user.bot);
    const groups = { '패왕': [], '스타': [], 'BEST': [], '발록': [], '명가': [], '기타': [] };
    const uniqueUsers = new Set();

    members.forEach(m => {
      if (uniqueUsers.has(m.id)) return;
      uniqueUsers.add(m.id);
      const userId = m.id;
      const rawName = m.displayName;
      const tagMatch = rawName.match(/^\[(.*?)\]/);
      let tag = '기타';
      if (tagMatch) {
        tag = tagMatch[1].trim();
        if (tag === '베스트' || tag === 'BEST') tag = 'BEST';
      }
      let cleanName = rawName.replace(/^\[.*?\]/, '').trim().split('/')[0].trim();
      if (!attendanceLog[userId]) attendanceLog[userId] = { name: cleanName, tag, count: 0 };
      attendanceLog[userId].count += 1;
      attendanceLog[userId].name = cleanName;
      attendanceLog[userId].tag = tag;
      if (groups[tag]) groups[tag].push(cleanName);
      else groups['기타'].push(cleanName);
    });

    const embeds = [
      new EmbedBuilder()
        .setTitle(`📢 ${options.getString('타임명') || '인원 체크'}`)
        .setDescription(`총 ${members.size}명`)
    ];

    for (const [tag, list] of Object.entries(groups)) {
      if (list.length > 0) {
        embeds.push(
          new EmbedBuilder()
            .setTitle(`[${tag}] (${list.length})`)
            .setDescription(list.join(', '))
            .setColor(colors[tag] || 0x808080)
        );
      }
    }
    await interaction.reply({ embeds });
  }

  if (commandName === '통계') {
    return interaction.reply({ content: '📊 23:10 자동 통계 출력됩니다.', ephemeral: true });
  }

  if (commandName === '통계초기화') {
    attendanceLog = {};
    return interaction.reply('🗑️ 초기화 완료');
  }

  if (commandName === '혈비') {
    const val = options.getInteger('값');
    if (val < 0 || val > 100) return interaction.reply('❌ 0~100만 가능');
    bloodTaxRate = val;
    return interaction.reply(`혈비 ${val}% 설정`);
  }
});

client.login(TOKEN);