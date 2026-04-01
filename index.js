require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const schedule = require('node-schedule');

const TOKEN = process.env.TOKEN;
const APPLICATION_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const REPORT_CHANNEL_ID = '1487735750245220482';

if (!TOKEN || !APPLICATION_ID || !GUILD_ID) {
  console.log('❌ .env 설정 확인 필요 (TOKEN, CLIENT_ID, GUILD_ID)');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers
  ],
});

let bloodTaxRate = 20; // 기본 혈비 20%
let attendanceLog = {};

const colors = {
  '패왕': 0x0000FF,
  '스타': 0xFFFF00,
  'BEST': 0xFFC0CB,
  '발록': 0xFF0000,
  '명가': 0x800080,
  '기타': 0x808080
};

// ✅ 명령어 등록 데이터
const commands = [
  new SlashCommandBuilder()
    .setName('인원')
    .setDescription('현재 채널 인원 체크')
    .addStringOption(o => o.setName('타임명').setDescription('예: 19시 타임').setRequired(false)),

  new SlashCommandBuilder()
    .setName('통계')
    .setDescription('오늘의 누적 통계를 확인합니다.'),

  new SlashCommandBuilder()
    .setName('통계초기화')
    .setDescription('데이터를 초기화합니다.'),

  new SlashCommandBuilder()
    .setName('혈비')
    .setDescription('혈비 세율 설정 (기본 20%)')
    .addIntegerOption(o => o.setName('값').setDescription('0~100 사이 숫자').setRequired(true)),

  new SlashCommandBuilder()
    .setName('정산1')
    .setDescription('혈비(세금) 적용 후 정산')
    .addStringOption(o => o.setName('아이템이름').setDescription('아이템 이름').setRequired(true))
    .addIntegerOption(o => o.setName('아이템금액').setDescription('총 판매 금액').setRequired(true))
    .addIntegerOption(o => o.setName('패왕인원수').setDescription('패왕 인원').setRequired(true))
    .addIntegerOption(o => o.setName('스타인원수').setDescription('스타 인원').setRequired(true))
    .addIntegerOption(o => o.setName('베스트인원수').setDescription('베스트 인원').setRequired(true))
    .addIntegerOption(o => o.setName('발록인원수').setDescription('발록 인원').setRequired(true)),

  new SlashCommandBuilder()
    .setName('정산2')
    .setDescription('혈비 없이 전체 N빵 정산')
    .addStringOption(o => o.setName('아이템이름').setDescription('아이템 이름').setRequired(true))
    .addIntegerOption(o => o.setName('아이템금액').setDescription('총 판매 금액').setRequired(true))
    .addIntegerOption(o => o.setName('패왕인원수').setDescription('패왕 인원').setRequired(true))
    .addIntegerOption(o => o.setName('스타인원수').setDescription('스타 인원').setRequired(true))
    .addIntegerOption(o => o.setName('베스트인원수').setDescription('베스트 인원').setRequired(true))
    .addIntegerOption(o => o.setName('발록인원수').setDescription('발록 인원').setRequired(true))
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(APPLICATION_ID, GUILD_ID), { body: commands });
    console.log('✅ 명령어 동기화 완료');
  } catch (e) { console.error('❌ 명령어 등록 오류:', e); }
})();

client.once('ready', () => {
  console.log(`✅ 봇 온라인: ${client.user.tag}`);

  // 매일 23:10 자동 통계 보고
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
      if (!users.length) continue;
      const displayTag = tag === 'BEST' ? '베스트' : tag;
      embeds.push(
        new EmbedBuilder()
          .setTitle(`[${displayTag}]`)
          .setDescription(users.map(u => `**${u.name}**: ${u.count}회`).join('\n'))
          .setColor(colors[tag] || 0x808080)
      );
    }
    channel.send({ content: '🔔 정기 보고', embeds });
  });

  // 자정 초기화
  schedule.scheduleJob('0 0 * * *', () => { attendanceLog = {}; console.log('데이터 초기화 완료'); });
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, options } = interaction;

  // 1. 인원 체크
  if (commandName === '인원') {
    await interaction.deferReply();
    await interaction.guild.members.fetch();

    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) return interaction.editReply('❌ 음성 채널에 입장해 주세요.');

    const members = voiceChannel.members.filter(m => !m.user.bot);
    const groups = { '패왕': [], '스타': [], 'BEST': [], '발록': [], '명가': [], '기타': [] };

    members.forEach(m => {
      const rawName = m.displayName;
      const userId = m.id;
      const tagMatch = rawName.match(/^\[(.*?)\]/);
      let tag = '기타';

      if (tagMatch) {
        let extracted = tagMatch[1].trim().replace(/^\d+\s*/, '');
        if (extracted === '베스트' || extracted === 'BEST') tag = 'BEST';
        else if (extracted.includes('패왕')) tag = '패왕';
        else if (extracted.includes('스타')) tag = '스타';
        else if (extracted.includes('명가')) tag = '명가';
        else if (extracted.includes('발록')) tag = '발록';
      }

      let cleanName = rawName.replace(/^\[.*?\]/, '').trim();
      if (cleanName.includes('/')) {
        cleanName = cleanName.split('/')[0].trim() || '이름없음';
      }

      if (!attendanceLog[userId]) attendanceLog[userId] = { name: cleanName, tag, count: 0 };
      attendanceLog[userId].count += 1;
      attendanceLog[userId].name = cleanName;
      attendanceLog[userId].tag = tag;
      groups[tag].push(cleanName);
    });

    const embed = new EmbedBuilder()
      .setTitle(`📢 ${options.getString('타임명') || '실시간 인원 체크'}`)
      .setDescription(`**총원: ${members.size}명**`)
      .setColor(0x5865F2);

    for (const [tag, list] of Object.entries(groups)) {
      if (!list.length) continue;
      const displayTag = tag === 'BEST' ? '베스트' : tag;
      embed.addFields({ name: `${displayTag} (${list.length}명)`, value: `\`\`\`${list.join(', ')}\`\`\`` });
    }
    await interaction.editReply({ embeds: [embed] });
  }

  // 2. 통계 확인/초기화/혈비 설정
  if (commandName === '통계') return interaction.reply({ content: '📊 23:10에 자동 보고됩니다.', ephemeral: true });
  if (commandName === '통계초기화') { attendanceLog = {}; return interaction.reply('🗑️ 모든 데이터가 초기화되었습니다.'); }
  if (commandName === '혈비') {
    const val = options.getInteger('값');
    if (val < 0 || val > 100) return interaction.reply('❌ 0에서 100 사이의 숫자만 입력 가능합니다.');
    bloodTaxRate = val;
    return interaction.reply(`✅ 혈비 세율이 **${val}%**로 설정되었습니다.`);
  }

  // 3. 정산 로직 (정산1, 정산2)
  if (commandName === '정산1' || commandName === '정산2') {
    const itemName = options.getString('아이템이름');
    const totalAmount = options.getInteger('아이템금액');
    const counts = {
      '패왕': options.getInteger('패왕인원수'),
      '스타': options.getInteger('스타인원수'),
      '베스트': options.getInteger('베스트인원수'),
      '발록': options.getInteger('발록인원수')
    };

    const totalPeople = Object.values(counts).reduce((a, b) => a + b, 0);
    if (totalPeople === 0) return interaction.reply('❌ 인원수는 0명일 수 없습니다.');

    // 혈비 계산
    const currentTax = commandName === '정산1' ? Math.floor(totalAmount * (bloodTaxRate / 100)) : 0;
    const distributableAmount = totalAmount - currentTax;
    const perPerson = Math.floor(distributableAmount / totalPeople);

    const embed = new EmbedBuilder()
      .setTitle(`💰 아이템 정산 결과 (${commandName === '정산1' ? '혈비 적용' : 'N빵'})`)
      .addFields(
        { name: '📦 아이템명', value: itemName, inline: true },
        { name: '💎 총 금액', value: `${totalAmount.toLocaleString()} 다이아`, inline: true },
        { name: '👥 총 인원', value: `${totalPeople}명`, inline: true }
      )
      .setColor(commandName === '정산1' ? 0xFF0000 : 0x00FF00);

    if (commandName === '정산1') {
      embed.addFields(
        { name: `📑 혈비 (${bloodTaxRate}%)`, value: `${currentTax.toLocaleString()} 다이아`, inline: true },
        { name: '🎁 분배 총액', value: `${distributableAmount.toLocaleString()} 다이아`, inline: true }
      );
    }

    embed.addFields({ name: '💵 1인당 분배금', value: `**${perPerson.toLocaleString()}** 다이아` });

    return interaction.reply({ embeds: [embed] });
  }
});

client.login(TOKEN);