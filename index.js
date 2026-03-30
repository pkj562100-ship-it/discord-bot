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

// ✅ 명령어 등록
const commands = [
  new SlashCommandBuilder()
    .setName('인원')
    .setDescription('현재 채널 인원 체크')
    .addStringOption(o => o.setName('타임명').setDescription('예: 19시 타임')),

  new SlashCommandBuilder().setName('통계').setDescription('통계 안내'),
  new SlashCommandBuilder().setName('통계초기화').setDescription('데이터 초기화'),

  new SlashCommandBuilder()
    .setName('혈비')
    .setDescription('혈비 설정')
    .addIntegerOption(o => o.setName('값').setRequired(true)),

  new SlashCommandBuilder()
    .setName('정산1')
    .setDescription('혈비 적용 정산')
    .addStringOption(o => o.setName('아이템이름').setRequired(true))
    .addIntegerOption(o => o.setName('아이템금액').setRequired(true))
    .addIntegerOption(o => o.setName('패왕인원수').setRequired(true))
    .addIntegerOption(o => o.setName('스타인원수').setRequired(true))
    .addIntegerOption(o => o.setName('베스트인원수').setRequired(true))
    .addIntegerOption(o => o.setName('발록인원수').setRequired(true)),

  new SlashCommandBuilder()
    .setName('정산2')
    .setDescription('혈비 없이 정산')
    .addStringOption(o => o.setName('아이템이름').setRequired(true))
    .addIntegerOption(o => o.setName('아이템금액').setRequired(true))
    .addIntegerOption(o => o.setName('패왕인원수').setRequired(true))
    .addIntegerOption(o => o.setName('스타인원수').setRequired(true))
    .addIntegerOption(o => o.setName('베스트인원수').setRequired(true))
    .addIntegerOption(o => o.setName('발록인원수').setRequired(true))
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
    console.error(e);
  }
})();

client.once('ready', () => {
  console.log(`✅ 봇 온라인: ${client.user.tag}`);

  // ✅ 23:10 자동 통계
  schedule.scheduleJob('10 23 * * *', async () => {
    const channel = client.channels.cache.get(REPORT_CHANNEL_ID);
    if (!channel || Object.keys(attendanceLog).length === 0) return;

    const stats = { '패왕': [], '스타': [], 'BEST': [], '발록': [], '명가': [], '기타': [] };

    Object.values(attendanceLog).forEach(user => {
      const { name, tag, count } = user;
      if (stats[tag]) stats[tag].push({ name, count });
      else stats['기타'].push({ name, count });
    });

    const embeds = [
      new EmbedBuilder().setTitle('📊 오늘 최종 통계').setColor(0xFFAA00)
    ];

    for (const [tag, users] of Object.entries(stats)) {
      if (users.length > 0) {
        const list = users
          .sort((a, b) => b.count - a.count)
          .map(u => `**${u.name}**: ${u.count}회`)
          .join('\n');

        embeds.push(
          new EmbedBuilder()
            .setTitle(`[${tag}]`)
            .setDescription(list)
            .setColor(colors[tag])
        );
      }
    }

    channel.send({ content: '🔔 정기 보고', embeds });
  });

  // 자정 초기화
  schedule.scheduleJob('0 0 * * *', () => {
    attendanceLog = {};
  });
});

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

      // 태그 추출
      const tagMatch = rawName.match(/^\[(.*?)\]/);
      let tag = '기타';

      if (tagMatch) {
        tag = tagMatch[1].trim();
        if (tag === '베스트' || tag === 'BEST') tag = 'BEST';
      }

      // 닉네임 정리 (태그 제거 + / 뒤 제거)
      let cleanName = rawName.replace(/^\[.*?\]/, '').trim();
      cleanName = cleanName.split('/')[0].trim();

      // 저장 (ID 기준)
      if (!attendanceLog[userId]) {
        attendanceLog[userId] = { name: cleanName, tag, count: 0 };
      }

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

    // ✅ 쉼표(,) 출력 적용
    for (const [tag, list] of Object.entries(groups)) {
      if (list.length > 0) {
        embeds.push(
          new EmbedBuilder()
            .setTitle(`[${tag}] (${list.length})`)
            .setDescription(list.join(', '))
            .setColor(colors[tag])
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