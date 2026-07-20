require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const TOKEN = process.env.TOKEN;
const APPLICATION_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

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

// ✅ 명령어 등록 ('/인원' 단일 명령어만 남김)
const commands = [
  new SlashCommandBuilder()
    .setName('인원')
    .setDescription('현재 음성 채널 인원 체크 (패왕 전용)')
    .addStringOption(o => 
      o.setName('타임명')
       .setDescription('예: 19시 타임')
       .setRequired(false)
    )
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(APPLICATION_ID, GUILD_ID), { body: commands });
    console.log('✅ 명령어 동기화 완료');
  } catch (e) {
    console.error('❌ 명령어 등록 오류:', e);
  }
})();

client.once('ready', () => {
  console.log(`✅ 봇 온라인: ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options } = interaction;

  if (commandName === '인원') {
    await interaction.deferReply();
    await interaction.guild.members.fetch();

    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) return interaction.editReply('❌ 음성 채널에 입장해 주세요.');

    const members = voiceChannel.members.filter(m => !m.user.bot);
    
    const pwMembers = [];   // 패왕 인원 목록
    const otherMembers = []; // 기타 인원 목록

    members.forEach(m => {
      const rawName = m.displayName;
      const tagMatch = rawName.match(/^\[(.*?)\]/);
      
      let cleanName = rawName.replace(/^\[.*?\]/, '').trim();
      if (cleanName.includes('/')) {
        cleanName = cleanName.split('/')[0].trim() || '이름없음';
      }

      // [패왕] 태그 포함 여부 확인
      if (tagMatch && tagMatch[1].includes('패왕')) {
        pwMembers.push(cleanName);
      } else {
        otherMembers.push(cleanName);
      }
    });

    const embed = new EmbedBuilder()
      .setTitle(`📢 ${options.getString('타임명') || '실시간 인원 체크'}`)
      .setDescription(`**총원: ${members.size}명** (패왕: ${pwMembers.length}명)`)
      .setColor(0x0000FF); // 패왕 전용 파란색

    // 패왕 목록 출력
    if (pwMembers.length > 0) {
      embed.addFields({
        name: `👑 패왕 (${pwMembers.length}명)`,
        value: `\`\`\`${pwMembers.join(', ')}\`\`\``
      });
    }

    // 기타 인원 목록 출력 (필요 시)
    if (otherMembers.length > 0) {
      embed.addFields({
        name: `👤 기타 인원 (${otherMembers.length}명)`,
        value: `\`\`\`${otherMembers.join(', ')}\`\`\``
      });
    }

    await interaction.editReply({ embeds: [embed] });
  }
});

client.login(TOKEN);