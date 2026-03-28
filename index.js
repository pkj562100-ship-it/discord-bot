const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');

// 🔑 봇 설정
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates // 👈 추가
  ]
});
// 🔑 토큰 (Render 환경변수에 넣은 TOKEN)
const TOKEN = process.env.TOKEN;

// 🔑 슬래시 명령어 등록
const commands = [
  new SlashCommandBuilder()
    .setName('voice2')
    .setDescription('봇 테스트 명령어')
    .toJSON()
];

// 🔑 명령어 등록 함수
const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('슬래시 명령어 등록 중...');
    await rest.put(
     Routes.applicationGuildCommands(
    '1487489265448390830', // 앱 ID
    '1469509176764928095' // 👈 여기에 니 디스코드 서버 ID 넣기
  ),
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

// 🔑 명령어 처리
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'voice2') {

    const channel = interaction.member.voice.channel;

    if (!channel) {
      return interaction.reply('❌ 음성 채널에 먼저 들어가세요!');
    }

    const members = channel.members
      .filter(member => !member.user.bot)
      .map(member => member.displayName);

    if (members.length === 0) {
      return interaction.reply('👻 음성 채널에 유저가 없습니다.');
    }

    const list = members.join('\n');

    await interaction.reply(`🔊 현재 음성 채널 유저:\n${list}`);
  }
});

// 🔑 로그인
client.login(TOKEN);
