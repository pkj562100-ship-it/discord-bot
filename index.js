require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const TOKEN = process.env.TOKEN;
const APPLICATION_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// ===== 추가 (디버깅용) =====
console.log("========== ENV CHECK ==========");
console.log("TOKEN 존재:", !!TOKEN);
console.log("TOKEN 길이:", TOKEN ? TOKEN.length : 0);
console.log("CLIENT_ID:", APPLICATION_ID);
console.log("GUILD_ID:", GUILD_ID);
console.log("===============================");
// =============================

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

// ✅ 명령어 등록
const commands = [
  new SlashCommandBuilder()
    .setName('인원')
    .setDescription('현재 음성 채널 인원 체크 (패왕, 대장, 킹덤 역할 분류)')
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
    
    const groups = {
      '패왕': [],
      '대장': [],
      '킹덤': [],
      '기타': []
    };

    members.forEach(m => {
      // 닉네임에서 [대장], [관리자] 등의 대괄호 태그 및 슬래시(/) 뒤 부캐명 정리
      let cleanName = m.displayName.replace(/^\[.*?\]/, '').trim();
      if (cleanName.includes('/')) {
        cleanName = cleanName.split('/')[0].trim() || m.displayName;
      }

      // 유저가 보유한 역할(Role) 이름 목록
      const roleNames = m.roles.cache.map(role => role.name);

      // 역할 체크 (우선순위: 패왕 > 대장 > 킹덤)
      if (roleNames.some(name => name.includes('패왕'))) {
        groups['패왕'].push(cleanName);
      } else if (roleNames.some(name => name.includes('대장'))) {
        groups['대장'].push(cleanName);
      } else if (roleNames.some(name => name.includes('킹덤'))) {
        groups['킹덤'].push(cleanName);
      } else {
        // 관리자만 있거나 세 주요 역할이 없는 경우 '기타'로 분류
        groups['기타'].push(cleanName);
      }
    });

    const embed = new EmbedBuilder()
      .setTitle(`📢 ${options.getString('타임명') || '실시간 인원 체크'}`)
      .setDescription(`**총원: ${members.size}명**`)
      .setColor(0x5865F2);

    // 각 역할 그룹별 인원 출력 (패왕을 최상단으로 배치)
    if (groups['패왕'].length > 0) {
      embed.addFields({
        name: `⚔️ 패왕 (${groups['패왕'].length}명)`,
        value: `\`\`\`${groups['패왕'].join(', ')}\`\`\``
      });
    }

    if (groups['대장'].length > 0) {
      embed.addFields({
        name: `👑 대장 (${groups['대장'].length}명)`,
        value: `\`\`\`${groups['대장'].join(', ')}\`\`\``
      });
    }

    if (groups['킹덤'].length > 0) {
      embed.addFields({
        name: `🏰 킹덤 (${groups['킹덤'].length}명)`,
        value: `\`\`\`${groups['킹덤'].join(', ')}\`\`\``
      });
    }

    if (groups['기타'].length > 0) {
      embed.addFields({
        name: `👤 기타 인원 (${groups['기타'].length}명)`,
        value: `\`\`\`${groups['기타'].join(', ')}\`\`\``
      });
    }

    await interaction.editReply({ embeds: [embed] });
  }
});

client.login(TOKEN);