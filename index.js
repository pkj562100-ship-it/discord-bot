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

// ✅ 봇이 에러로 인해 종료되는 것을 방지하는 핸들러
client.on('error', error => console.error('디스코드 클라이언트 에러:', error));
process.on('unhandledRejection', error => console.error('알 수 없는 거부 오류:', error));

let bloodTaxRate = 20; 
let attendanceLog = {};

const colors = {
  '패왕': 0x0000FF, '스타': 0xFFFF00, 'BEST': 0xFFC0CB,
  '발록': 0xFF0000, '명가': 0x800080, '기타': 0x808080
};

const commands = [
  new SlashCommandBuilder()
    .setName('인원')
    .setDescription('현재 채널 인원 체크 (대규모 인원 대응)')
    .addStringOption(o => o.setName('타임명').setDescription('예: 19시 타임')),
  new SlashCommandBuilder().setName('통계').setDescription('오늘의 누적 통계를 확인합니다.'),
  new SlashCommandBuilder().setName('통계초기화').setDescription('데이터를 초기화합니다.'),
  new SlashCommandBuilder()
    .setName('혈비')
    .setDescription('혈비 세율 설정 (기본 20%)')
    .addIntegerOption(o => o.setName('값').setDescription('0~100 사이 숫자').setRequired(true)),
  new SlashCommandBuilder()
    .setName('정산1')
    .setDescription('혈비 적용 정산')
    .addStringOption(o => o.setName('아이템이름').setDescription('아이템 이름').setRequired(true))
    .addIntegerOption(o => o.setName('아이템금액').setDescription('총 판매 금액').setRequired(true))
    .addIntegerOption(o => o.setName('패왕인원수').setDescription('패왕 인원').setRequired(true))
    .addIntegerOption(o => o.setName('스타인원수').setDescription('스타 인원').setRequired(true))
    .addIntegerOption(o => o.setName('베스트인원수').setDescription('베스트 인원').setRequired(true))
    .addIntegerOption(o => o.setName('발록인원수').setDescription('발록 인원').setRequired(true)),
  new SlashCommandBuilder()
    .setName('정산2')
    .setDescription('혈비 없이 정산')
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

  schedule.scheduleJob('10 23 * * *', async () => {
    const channel = client.channels.cache.get(REPORT_CHANNEL_ID);
    if (!channel || Object.keys(attendanceLog).length === 0) return;

    const statsEmbed = new EmbedBuilder().setTitle('📊 오늘 최종 누적 통계').setColor(0xFFAA00).setTimestamp();
    
    for (const tag of Object.keys(colors)) {
      const users = Object.values(attendanceLog).filter(u => u.tag === tag);
      if (!users.length) continue;
      
      const listText = users.sort((a, b) => b.count - a.count).map(u => `**${u.name}**: ${u.count}회`).join('\n');
      const chunks = listText.match(/[\s\S]{1,1024}(\n|$)/g) || [listText];
      
      chunks.forEach((chunk, i) => {
        statsEmbed.addFields({ name: i === 0 ? `[${tag}]` : `[${tag} 계속]`, value: chunk });
      });
    }
    channel.send({ content: '🔔 정기 보고', embeds: [statsEmbed] });
  });

  schedule.scheduleJob('0 0 * * *', () => { attendanceLog = {}; });
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, options } = interaction;

  if (commandName === '인원') {
    await interaction.deferReply();

    // ❌ interaction.guild.members.fetch() 제거 (속도 제한의 주범)
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) return interaction.editReply('❌ 음성 채널에 먼저 입장해 주세요.');

    try {
      const members = voiceChannel.members.filter(m => !m.user.bot);
      const groups = { '패왕': [], '스타': [], 'BEST': [], '발록': [], '명가': [], '기타': [] };

      members.forEach(m => {
        const rawName = m.displayName;
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

        let cleanName = rawName.replace(/^\[.*?\]/, '').trim().split('/')[0].trim() || '이름없음';
        
        if (!attendanceLog[m.id]) attendanceLog[m.id] = { name: cleanName, tag, count: 0 };
        attendanceLog[m.id].count += 1;
        attendanceLog[m.id].name = cleanName;
        attendanceLog[m.id].tag = tag;
        groups[tag].push(cleanName);
      });

      const embed = new EmbedBuilder()
        .setTitle(`📢 ${options.getString('타임명') || '실시간 인원 체크'}`)
        .setDescription(`**총원: ${members.size}명** (데이터 누락 없음)`)
        .setColor(0x5865F2);

      // ✅ 글자 수 제한 해결 로직 (1,000자 단위 분할)
      for (const [tag, list] of Object.entries(groups)) {
        if (!list.length) continue;
        const fullText = list.join(', ');
        const chunks = fullText.match(/.{1,1000}(, |$)/g) || [fullText];

        chunks.forEach((chunk, i) => {
          embed.addFields({ 
            name: i === 0 ? `${tag === 'BEST' ? '베스트' : tag} (${list.length}명)` : `${tag} 계속`, 
            value: `\`\`\`${chunk}\`\`\`` 
          });
        });
      }
      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      await interaction.editReply('❌ 인원 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    }
  }

  // 통계 관련 명령어
  if (commandName === '통계') return interaction.reply({ content: '📊 23:10에 자동 보고됩니다.', ephemeral: true });
  if (commandName === '통계초기화') { attendanceLog = {}; return interaction.reply('🗑️ 모든 데이터가 초기화되었습니다.'); }
  if (commandName === '혈비') {
    const val = options.getInteger('값');
    if (val < 0 || val > 100) return interaction.reply('❌ 0~100 사이 숫자만 가능합니다.');
    bloodTaxRate = val;
    return interaction.reply(`✅ 혈비 세율이 **${val}%**로 설정되었습니다.`);
  }

  // 정산 명령어 (정산1, 정산2)
  if (commandName === '정산1' || commandName === '정산2') {
    const itemName = options.getString('아이템이름');
    const totalAmount = options.getInteger('아이템금액');
    const counts = {
      '패왕': options.getInteger('패왕인원수') || 0,
      '스타': options.getInteger('스타인원수') || 0,
      '베스트': options.getInteger('베스트인원수') || 0,
      '발록': options.getInteger('발록인원수') || 0
    };

    const totalPeople = Object.values(counts).reduce((a, b) => a + b, 0);
    if (totalPeople === 0) return interaction.reply('❌ 인원은 최소 1명 이상이어야 합니다.');

    const currentTax = commandName === '정산1' ? Math.floor(totalAmount * (bloodTaxRate / 100)) : 0;
    const distributableAmount = totalAmount - currentTax;
    const perPerson = Math.floor(distributableAmount / totalPeople);

    const embed = new EmbedBuilder()
      .setTitle(`💰 정산 결과 (${commandName === '정산1' ? '혈비 적용' : 'N빵'})`)
      .setColor(commandName === '정산1' ? 0xFF0000 : 0x00FF00)
      .addFields(
        { name: '📦 아이템명', value: itemName, inline: true },
        { name: '💎 총 금액', value: `${totalAmount.toLocaleString()} 💎`, inline: true },
        { name: '👥 총 인원', value: `${totalPeople} 명`, inline: true }
      );

    if (commandName === '정산1') {
      embed.addFields(
        { name: `📑 혈비 (${bloodTaxRate}%)`, value: `${currentTax.toLocaleString()} 💎`, inline: true },
        { name: '🎁 분배 대상 금액', value: `${distributableAmount.toLocaleString()} 💎`, inline: true }
      );
    }

    embed.addFields({ name: '💵 1인당 분배금', value: `**${perPerson.toLocaleString()}** 💎` });
    return interaction.reply({ embeds: [embed] });
  }
});

client.login(TOKEN);