const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');

// 🔑 봇 설정
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// 🔑 토큰 (Render 환경변수에 넣은 TOKEN)
const TOKEN = process.env.TOKEN;

// 🔑 슬래시 명령어 등록
const commands = [
  new SlashCommandBuilder()
    .setName('voice')
    .setDescription('봇 테스트 명령어')
    .toJSON()
];

// 🔑 명령어 등록 함수
const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('슬래시 명령어 등록 중...');
    await rest.put(
      Routes.applicationCommands('1487489265448390830'),
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

  if (interaction.commandName === 'voice') {
    await interaction.reply('봇 정상 작동!');
  }
});

// 🔑 로그인
client.login(TOKEN);