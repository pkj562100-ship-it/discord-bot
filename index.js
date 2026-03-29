require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

// client 선언
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

// 로그인
client.login(process.env.DISCORD_TOKEN);

// 봇 준비 완료 이벤트
client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

// 슬래시 명령어 처리
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'voice3') {
    const channel = interaction.member.voice.channel;
    if (!channel) return interaction.reply('음성채널에 들어가 있어야 합니다.');

    // 현재 채널 접속자 닉네임 수집
    const members = channel.members.map(m => m.displayName);

    // 태그별 그룹 생성
    const tagGroups = { '패왕': [], '베스트': [], '스타': [], '명가': [], '기타': [] };

    members.forEach(name => {
      let matched = false;

      // 태그 제거 후 닉네임만 사용
      let displayName = name.replace(/\[.*?\]/g, '').trim();

      if (name.includes('[패왕]')) { tagGroups['패왕'].push(displayName); matched = true; }
      if (name.includes('[베스트]') || name.includes('[BEST]')) { tagGroups['베스트'].push(displayName); matched = true; }
      if (name.includes('[스타]')) { tagGroups['스타'].push(displayName); matched = true; }
      if (name.includes('[명가]')) { tagGroups['명가'].push(displayName); matched = true; }
      if (name.includes('[발록]')) { tagGroups['명가'].push(displayName); matched = true; }
      if (!matched) tagGroups['기타'].push(name); // 기타는 태그 포함
    });

    // 메시지 생성
    let message = '';
    for (const [tag, list] of Object.entries(tagGroups)) {
      if (list.length === 0) continue;
      message += `[${tag}]\n인원수 : ${list.length}명\n\n`;
      message += list.join('\n') + '\n\n';
    }

    // 응답
    await interaction.reply(message);
  }
});