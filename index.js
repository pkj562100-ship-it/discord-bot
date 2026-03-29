const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// 🔑 봇 설정
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// 🔑 토큰
const TOKEN = process.env.TOKEN;
const APPLICATION_ID = '1487489265448390830'; // 본인 Application ID로 교체

// 🔑 혈비 & 기여도 초기값
let bloodTaxRate = 20; // 혈비 %
let guildContributions = {
  '패왕': 20,
  '스타': 40,
  'BEST': 20,
  '발록': 20,
  '명가': 0
};

// 🔑 슬래시 명령어 등록
const commands = [
  new SlashCommandBuilder()
    .setName('voice3')
    .setDescription('음성 채널 유저를 태그별로 그룹화하여 출력 (색상)')
    .toJSON(),

  new SlashCommandBuilder()
    .setName('혈비')
    .setDescription('혈비를 설정합니다')
    .addIntegerOption(option =>
      option.setName('값')
        .setDescription('혈비 %를 입력 (0~100)')
        .setRequired(true))
    .toJSON(),

  new SlashCommandBuilder()
    .setName('기여도')
    .setDescription('혈맹 기여도를 설정합니다')
    .addStringOption(option =>
      option.setName('태그')
        .setDescription('기여도를 설정할 태그 이름')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('값')
        .setDescription('기여도 %를 입력')
        .setRequired(true))
    .toJSON(),

  new SlashCommandBuilder()
    .setName('정산')
    .setDescription('아이템 금액을 정산합니다')
    .addIntegerOption(option =>
      option.setName('아이템금액')
        .setDescription('총 아이템 금액을 입력')
        .setRequired(true))
    .toJSON()
];

// 🔹 슬래시 명령어 등록
const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
  try {
    console.log('슬래시 명령어 등록 중...');
    await rest.put(
      Routes.applicationCommands(APPLICATION_ID),
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

  // ------------------- voice3 -------------------
  if (interaction.commandName === 'voice3') {
    const channel = interaction.member.voice.channel;
    if (!channel) return interaction.reply('❌ 음성 채널에 먼저 들어가세요!');

    const members = channel.members
      .filter(member => !member.user.bot)
      .map(member => member.displayName);

    if (members.length === 0) return interaction.reply('👻 음성 채널에 유저가 없습니다.');

    // 🔹 태그별 그룹화
    const groups = {
      '패왕': [],
      '스타': [],
      'BEST': [],
      '발록': [],
      '명가': [],
      '기타': []
    };

    members.forEach(name => {
      const tagMatch = name.trim().match(/^\[(.*?)\]/);
      let displayName = name;

      if (tagMatch) {
        let tag = tagMatch[1].trim();
        if (tag === '베스트' || tag === 'BEST') tag = 'BEST';
        displayName = name.replace(/^\[.*?\]/, '').trim();
        if (groups[tag]) groups[tag].push(displayName);
        else groups['기타'].push(displayName);
      } else {
        groups['기타'].push(name);
      }
    });

    // 🔹 그룹별 색상
    const colors = {
      '패왕': 0x0000FF, // 파랑
      '스타': 0xFFFF00, // 노랑
      'BEST': 0xFFC0CB, // 분홍
      '발록': 0xFF0000, // 빨강
      '명가': 0x800080, // 보라
      '기타': 0x808080  // 회색
    };

    // 🔹 Embed 배열 생성
    const embeds = [];
    for (const [tag, list] of Object.entries(groups)) {
      if (list.length > 0) {
        const embed = new EmbedBuilder()
          .setTitle(`[${tag}] (${list.length}명)`)
          .setDescription(list.join('\n'))
          .setColor(colors[tag]);
        embeds.push(embed);
      }
    }

    await interaction.reply({ embeds });
  }

  // ------------------- 혈비 설정 -------------------
  if (interaction.commandName === '혈비') {
    const rate = interaction.options.getInteger('값');
    if (rate < 0 || rate > 100) return interaction.reply('❌ 0~100 사이의 값을 입력하세요.');
    bloodTaxRate = rate;
    await interaction.reply(`✅ 혈비가 ${bloodTaxRate}%로 설정되었습니다.`);
  }

  // ------------------- 기여도 설정 -------------------
  if (interaction.commandName === '기여도') {
    const tag = interaction.options.getString('태그');
    const rate = interaction.options.getInteger('값');
    if (rate < 0) return interaction.reply('❌ 0 이상의 값을 입력하세요.');
    guildContributions[tag] = rate;
    await interaction.reply(`✅ ${tag} 혈맹 기여도가 ${rate}%로 설정되었습니다.`);
  }

  // ------------------- 정산 -------------------
  if (interaction.commandName === '정산') {
    const totalAmount = interaction.options.getInteger('아이템금액');
    const afterTax = totalAmount * (1 - bloodTaxRate / 100);

    const totalContribution = Object.values(guildContributions).reduce((a,b)=>a+b,0);
    const result = {};
    for (let [tag, contrib] of Object.entries(guildContributions)) {
      result[tag] = Math.floor(afterTax * (contrib / totalContribution));
    }

    const embed = new EmbedBuilder()
      .setTitle(`💰 아이템 금액 정산`)
      .setColor(0x00FF00)
      .setDescription(`총 금액: ${totalAmount}\n혈비(${bloodTaxRate}%): ${Math.floor(totalAmount-afterTax)}`);

    let desc = '';
    for (let [tag, amount] of Object.entries(result)) {
      desc += `${tag}: ${amount}\n`;
    }
    embed.setDescription(embed.data.description + '\n\n' + desc);

    await interaction.reply({ embeds: [embed] });
  }
});

// 🔑 로그인
client.login(TOKEN);