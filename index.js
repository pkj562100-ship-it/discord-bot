// 🔑 index.js - /voice3 최신 버전 (발록 추가)

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');

// 🔑 봇 설정
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// 🔑 토큰 (Render 환경변수)
const TOKEN = process.env.TOKEN;

// 🔑 슬래시 명령어 등록
const commands = [
  new SlashCommandBuilder()
    .setName('voice3')
    .setDescription('음성 채널 유저를 태그별로 그룹화하여 출력')
    .toJSON()
];

// 🔑 명령어 등록
const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
  try {
    console.log('슬래시 명령어 등록 중...');
    await rest.put(
      Routes.applicationCommands('1487489265448390830'), // <-- Application ID
      { body: commands }
    );
    console.log('슬래시 명령어 등록 완료!');
  } catch (error) {
    console.error(error);
  }
})();

// 🔑 봇 준비 완료
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// 🔑 슬래시 명령어 처리
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'voice3') {
    const channel = interaction.member.voice.channel;
    if (!channel) return interaction.reply('❌ 음성 채널에 먼저 들어가세요!');

    const members = channel.members
      .filter(member => !member.user.bot) // 봇 제외
      .map(member => member.displayName);

    if (members.length === 0) return interaction.reply('👻 음성 채널에 유저가 없습니다.');

    // 🔹 태그별 그룹화 (발록 추가)
    const groups = {
      '패왕': [],
      '스타': [],
      'BEST': [], // 베스트/Best 통합
      '발록': [],
      '명가': [],
      '기타': []
    };

    members.forEach(name => {
      const tagMatch = name.trim().match(/^\[(.*?)\]/); // 앞 태그 추출
      let displayName = name; // 실제 표시할 이름

      if (tagMatch) {
        let tag = tagMatch[1].trim();

        if (tag === '베스트' || tag === 'BEST') tag = 'BEST';

        // 닉네임에서 앞 태그 제거
        displayName = name.replace(/^\[.*?\]/, '').trim();

        if (groups[tag]) groups[tag].push(displayName);
        else groups['기타'].push(displayName);
      } else {
        groups['기타'].push(name);
      }
    });

    // 🔹 출력 텍스트 구성
    let replyText = '';
    for (const [tag, list] of Object.entries(groups)) {
      if (list.length > 0) {
        replyText += `\n[${tag}]\n${list.join('\n')}\n`;
      }
    }

    await interaction.reply(`🔊 현재 음성 채널 유저:${replyText}`);
  }
});

// 🔑 로그인
client.login(TOKEN);