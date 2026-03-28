const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = '1487489265448390830'; // 개발자 포털에서 확인

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// ✅ 슬래시 명령어 등록
const commands = [
  new SlashCommandBuilder()
    .setName('voice')
    .setDescription('현재 음성채널 인원 출력')
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('슬래시 명령어 등록 중...');
    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands },
    );
    console.log('등록 완료!');
  } catch (error) {
    console.error(error);
  }
})();

// ✅ 봇 준비 완료
client.once('clientReady', () => {
  console.log(`로그인됨: ${client.user.tag}`);
});

// ✅ 슬래시 명령어 처리
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'voice') {
    const member = interaction.member;
    const channel = member.voice.channel;

    if (!channel) {
      return interaction.reply('음성채널에 들어가 있어야 합니다.');
    }

    const members = channel.members.map(m => m.displayName);

    await interaction.reply(members.join('\n'));
  }
});

const TOKEN = process.env.TOKEN;

client.login(TOKEN);