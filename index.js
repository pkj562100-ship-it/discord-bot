const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });

// 봇 로그인
client.login(process.env.DISCORD_TOKEN);

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

// /voice3 슬래시 명령어 처리
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'voice3') {
    const member = interaction.member;
    const channel = member.voice.channel;

    if (!channel) {
      return interaction.reply('음성채널에 들어가 있어야 합니다.');
    }

    const members = channel.members.map(m => m.displayName);

    const tagGroups = { '패왕': [], '베스트': [], '스타': [], '명가': [], '기타': [] };

    members.forEach(name => {
      let matched = false;

      const infoMatch = name.match(/([^\[\]/]+)(?:\/(\d+))?(?:\/(.+))?$/);
      let displayName = infoMatch
        ? infoMatch[2] ? `${infoMatch[1].trim()}/${infoMatch[2].trim()}/${(infoMatch[3]||'').trim()}` : infoMatch[1].trim()
        : name;

      if (name.includes('[패왕]')) { tagGroups['패왕'].push(displayName); matched = true; }
      if (name.includes('[베스트]') || name.includes('[BEST]')) { tagGroups['베스트'].push(displayName); matched = true; }
      if (name.includes('[스타]')) { tagGroups['스타'].push(displayName); matched = true; }
      if (name.includes('[명가]')) { tagGroups['명가'].push(displayName); matched = true; }
      if (!matched) tagGroups['기타'].push(name);
    });

    let message = '';
    for (const [tag, list] of Object.entries(tagGroups)) {
      if (list.length === 0) continue;
      message += `[${tag}]\n인원수 : ${list.length}명\n\n`;
      message += list.join('\n') + '\n\n';
    }

    await interaction.reply(message);
  }
});