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
    .setDescription('현재 채널 인원 체크 (100명 이상 대응)')
    .addStringOption(o => o.setName('타임명').setDescription('예: 19시 타임')),

  new SlashCommandBuilder().setName('통계').setDescription('오늘의 누적 통계를 확인합니다.'),
  new SlashCommandBuilder().setName('통계초기화').setDescription('데이터를 초기화합니다.'),

  new SlashCommandBuilder()
    .setName('혈비')
    .setDescription('혈비 세율 설정')
    .addIntegerOption(o => o.setName('값').setDescription('0~100 사이의 숫자').setRequired(true)),

  new SlashCommandBuilder()
    .setName('정산1')
    .setDescription('혈비 적용 정산')
    .addStringOption(o => o.setName('아이템이름').setDescription('아이템 이름').setRequired(true))
    .addIntegerOption(o => o.setName('아이템금액').setDescription('총 금액').setRequired(true))
    .addIntegerOption(o => o.setName('패왕인원수').setDescription('패왕 인원수').setRequired(true))
    .addIntegerOption(o => o.setName('스타인원수').setDescription('스타 인원수').setRequired(true))
    .addIntegerOption(o => o.setName('베스트인원수').setDescription('베스트 인원수').setRequired(true))
    .addIntegerOption(o => o.setName('발록인원수').setDescription('발록 인원수').setRequired(true)),

  new SlashCommandBuilder()
    .setName('정산2')
    .setDescription('혈비 없이 정산')
    .addStringOption(o => o.setName('아이템이름').setDescription('아이템 이름').setRequired(true))
    .addIntegerOption(o => o.setName('아이템금액').setDescription('총 금액').setRequired(true))
    .addIntegerOption(o => o.setName('패왕인원수').setDescription('패왕 인원수').setRequired(true))
    .addIntegerOption(o => o.setName('스타인원수').setDescription('스타 인원수').setRequired(true))
    .addIntegerOption(o => o.setName('베스트인원수').setDescription('베스트 인원수').setRequired(true))
    .addIntegerOption(o => o.setName('발록인원수').setDescription('발록 인원수').setRequired(true))
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(APPLICATION_ID, GUILD_ID), { body: commands });
    console.log('✅ 명령어 동기화 완료');
  } catch (e) { console.error(e); }
})();

client.once('ready', () => {
  console.log(`✅ 봇 온라인: ${client.user.tag}`);

  // 23:10 자동 통계
  schedule.scheduleJob('10 23 * * *', async () => {
    const channel = client.channels.cache.get(REPORT_CHANNEL_ID);
    if (!channel || Object.keys(attendanceLog).length === 0) return;

    const stats = { '패왕': [], '스타': [], 'BEST': [], '발록': [], '명가': [], '기타': [] };

    Object.values(attendanceLog).forEach(user => {
      if (stats[user.tag]) stats[user.tag].push(user);
      else stats['기타'].push(user);
    });

    const embeds = [new EmbedBuilder().setTitle('📊 오늘 최종 통계').setColor(0xFFAA00)];

    for (const [tag, users] of Object.entries(stats)) {
      if (users.length === 0) continue;

      const displayTag = tag === 'BEST' ? '베스트' : tag;

      const list = users
        .sort((a, b) => b.count - a.count)
        .map(u => `**${u.name}**: ${u.count}회`)
        .join('\n');

      embeds.push(
        new EmbedBuilder()
          .setTitle(`[${displayTag}]`)
          .setDescription(list)
          .setColor(colors[tag])
      );
    }

    channel.send({ content: '🔔 정기 보고', embeds });
  });

  schedule.scheduleJob('0 0 * * *', () => { attendanceLog = {}; });
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options } = interaction;

  if (commandName === '인원') {
    await interaction.deferReply();

    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) return interaction.editReply('❌ 음성 채널에 입장해 주세요.');

    try {
      const members = voiceChannel.members.filter(m => !m.user.bot);
      const groups = { '패왕': [], '스타': [], 'BEST': [], '발록': [], '명가': [], '기타': [] };

      members.forEach(m => {
        const rawName = m.displayName;
        const userId = m.id;

        const tagMatch = rawName.match(/^\[(.*?)\]/);
        let tag = '기타';

        if (tagMatch) {
          let extracted = tagMatch[1].trim();

          // 숫자 제거
          extracted = extracted.replace(/^\d+\s*/, '');

          if (extracted === '베스트' || extracted === 'BEST') tag = 'BEST';
          else if (extracted.includes('패왕')) tag = '패왕';
          else if (extracted.includes('스타')) tag = '스타';
          else if (extracted.includes('명가')) tag = '명가';
          else if (extracted.includes('발록')) tag = '발록';
        }

        let cleanName = rawName.replace(/^\[.*?\]/, '').trim().split('/')[0].trim();

        if (!attendanceLog[userId]) {
          attendanceLog[userId] = { name: cleanName, tag, count: 0 };
        }

        attendanceLog[userId].count += 1;
        attendanceLog[userId].name = cleanName;
        attendanceLog[userId].tag = tag;

        groups[tag].push(cleanName);
      });

      const mainEmbed = new EmbedBuilder()
        .setTitle(`📢 ${options.getString('타임명') || '실시간 인원 체크'}`)
        .setDescription(`**총원: ${members.size}명**`)
        .setColor(0x5865F2);

      for (const [tag, list] of Object.entries(groups)) {
        if (list.length === 0) continue;

        const displayTag = tag === 'BEST' ? '베스트' : tag;
        const fullText = list.join(', ');
        const chunks = fullText.match(/.{1,1000}(, |$)/g) || [fullText];

        chunks.forEach((chunk, index) => {
          mainEmbed.addFields({
            name: index === 0 ? `${displayTag} (${list.length}명)` : `${displayTag} (계속)`,
            value: `\`\`\`${chunk}\`\`\``,
            inline: false
          });
        });
      }

      await interaction.editReply({ embeds: [mainEmbed] });

    } catch (err) {
      console.error(err);
      await interaction.editReply('❌ 오류 발생');
    }
  }

  if (commandName === '통계') {
    return interaction.reply({ content: '📊 23:10 자동 보고됩니다.', ephemeral: true });
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