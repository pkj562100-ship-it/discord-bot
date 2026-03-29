require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const TOKEN = process.env.TOKEN;
const APPLICATION_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !APPLICATION_ID || !GUILD_ID) {
  console.error('⚠️ 환경 변수 설정 오류: .env 또는 Render 환경 변수를 확인하세요.');
  process.exit(1);
}

// 봇 클라이언트 설정
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

// 초기값 및 설정
let bloodTaxRate = 20;
const colors = {
  '패왕': 0x0000FF, '스타': 0xFFFF00, 'BEST': 0xFFC0CB,
  '발록': 0xFF0000, '명가': 0x800080, '기타': 0x808080
};

// ------------------- 슬래시 명령어 정의 (구조 수정됨) -------------------
const commands = [
  new SlashCommandBuilder()
    .setName('인원')
    .setDescription('음성 채널 유저를 그룹화하여 출력')
    .addStringOption(option => 
      option.setName('타임명')
        .setDescription('예: 19시카파타임')
        .setRequired(false))
    .toJSON(),
  
  new SlashCommandBuilder()
    .setName('혈비')
    .setDescription('혈비를 설정합니다 (%)')
    .addIntegerOption(option =>
      option.setName('값')
        .setDescription('혈비 % 입력 (0~100)')
        .setRequired(true))
    .toJSON(),
  
  new SlashCommandBuilder()
    .setName('정산1')
    .setDescription('혈비 제외 후 인원수 기반 정산')
    .addStringOption(option => option.setName('아이템이름').setDescription('아이템 이름').setRequired(true))
    .addIntegerOption(option => option.setName('아이템금액').setDescription('총 금액').setRequired(true))
    .addIntegerOption(option => option.setName('패왕인원수').setDescription('패왕 인원').setRequired(true))
    .addIntegerOption(option => option.setName('스타인원수').setDescription('스타 인원').setRequired(true))
    .addIntegerOption(option => option.setName('베스트인원수').setDescription('BEST 인원').setRequired(true))
    .addIntegerOption(option => option.setName('발록인원수').setDescription('발록 인원').setRequired(true))
    .toJSON(),
  
  new SlashCommandBuilder()
    .setName('정산2')
    .setDescription('혈비 없이 인원수 기반 정산')
    .addStringOption(option => option.setName('아이템이름').setDescription('아이템 이름').setRequired(true))
    .addIntegerOption(option => option.setName('아이템금액').setDescription('총 금액').setRequired(true))
    .addIntegerOption(option => option.setName('패왕인원수').setDescription('패왕 인원').setRequired(true))
    .addIntegerOption(option => option.setName('스타인원수').setDescription('스타 인원').setRequired(true))
    .addIntegerOption(option => option.setName('베스트인원수').setDescription('BEST 인원').setRequired(true))
    .addIntegerOption(option => option.setName('발록인원수').setDescription('발록 인원').setRequired(true))
    .toJSON()
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

// ------------------- 명령어 동기화 (오류 방지 로직) -------------------
(async () => {
  try {
    console.log('🔹 명령어 동기화 중...');
    // 글로벌 삭제 (빈 배열 PUT)
    await rest.put(Routes.applicationCommands(APPLICATION_ID), { body: [] });
    // 서버 등록
    await rest.put(Routes.applicationGuildCommands(APPLICATION_ID, GUILD_ID), { body: commands });
    console.log('✅ 명령어 동기화 및 등록 완료!');
  } catch (error) {
    console.error('❌ 명령어 등록 오류:', error);
  }
})();

// ------------------- 이벤트 핸들러 -------------------
client.once('ready', () => {
  console.log(`✅ 로그인 완료: ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // --- /인원 ---
  if (interaction.commandName === '인원') {
    const timeOption = interaction.options.getString('타임명');
    const timeName = timeOption ? timeOption : '보탐 인원 체크';
    const channel = interaction.member.voice.channel;
    
    if (!channel) return interaction.reply('❌ 음성 채널에 먼저 들어가주세요!');

    const members = channel.members
      .filter(member => !member.user.bot)
      .map(member => member.displayName);

    if (members.length === 0) return interaction.reply('👻 채널에 인원이 없습니다.');

    const groups = { '패왕': [], '스타': [], 'BEST': [], '발록': [], '명가': [], '기타': [] };

    members.forEach(name => {
      const tagMatch = name.trim().match(/^\[(.*?)\]/);
      let displayName = name;
      if (tagMatch) {
        let tag = tagMatch[1].trim();
        if (tag === '베스트' || tag === 'BEST') tag = 'BEST';
        displayName = name.replace(/^\[.*?\]/, '').trim();
        if (groups[tag]) groups[tag].push(displayName);
        else groups['기타'].push(displayName);
      } else groups['기타'].push(name);
    });

    const embeds = [];
    embeds.push(new EmbedBuilder()
      .setTitle(`📢 ${timeName}`)
      .setDescription(`현재 접속 인원: 총 **${members.length}**명`)
      .setColor(0xFFFFFF)
      .setTimestamp());

    for (const [tag, list] of Object.entries(groups)) {
      if (list.length > 0) {
        embeds.push(new EmbedBuilder()
          .setTitle(`[${tag}] (${list.length}명)`)
          .setDescription(list.join('\n'))
          .setColor(colors[tag] || 0x808080));
      }
    }
    await interaction.reply({ embeds });
  }

  // --- /혈비 ---
  if (interaction.commandName === '혈비') {
    const rate = interaction.options.getInteger('값');
    if (rate < 0 || rate > 100) return interaction.reply('❌ 0~100 사이의 숫자를 입력하세요.');
    bloodTaxRate = rate;
    await interaction.reply(`✅ 혈비가 **${bloodTaxRate}%**로 설정되었습니다.`);
  }

  // --- /정산1 (혈비 포함) ---
  if (interaction.commandName === '정산1') {
    const itemName = interaction.options.getString('아이템이름');
    const totalAmount = interaction.options.getInteger('아이템금액');
    const counts = {
      '패왕': interaction.options.getInteger('패왕인원수'),
      '스타': interaction.options.getInteger('스타인원수'),
      'BEST': interaction.options.getInteger('베스트인원수'),
      '발록': interaction.options.getInteger('발록인원수')
    };

    const afterTax = totalAmount * (1 - bloodTaxRate / 100);
    const totalPeople = Object.values(counts).reduce((a, b) => a + b, 0);

    const result = {};
    let sum = 0;
    for (let [tag, num] of Object.entries(counts)) {
      const amount = Math.floor(afterTax * (num / totalPeople));
      result[tag] = amount;
      sum += amount;
    }

    const remainder = Math.round(afterTax - sum);
    if (remainder > 0) {
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      result[sorted[0][0]] += remainder;
    }

    const embeds = [
      new EmbedBuilder()
        .setTitle(`💎 아이템: ${itemName}`)
        .setDescription(`**총 금액:** ${totalAmount.toLocaleString()} 💎\n**혈비(${bloodTaxRate}%):** ${Math.floor(totalAmount - afterTax).toLocaleString()} 제외`)
        .setColor(0x00FF00)
    ];

    for (let [tag, amount] of Object.entries(result)) {
      embeds.push(new EmbedBuilder()
        .setTitle(`${tag} 혈맹 정산금`)
        .setDescription(`💰 정산금: **${amount.toLocaleString()}**`)
        .setColor(colors[tag] || 0x808080));
    }
    await interaction.reply({ embeds });
  }

  // --- /정산2 (혈비 제외) ---
  if (interaction.commandName === '정산2') {
    const itemName = interaction.options.getString('아이템이름');
    const totalAmount = interaction.options.getInteger('아이템금액');
    const counts = {
      '패왕': interaction.options.getInteger('패왕인원수'),
      '스타': interaction.options.getInteger('스타인원수'),
      'BEST': interaction.options.getInteger('베스트인원수'),
      '발록': interaction.options.getInteger('발록인원수')
    };

    const totalPeople = Object.values(counts).reduce((a, b) => a + b, 0);

    const result = {};
    let sum = 0;
    for (let [tag, num] of Object.entries(counts)) {
      const amount = Math.floor(totalAmount * (num / totalPeople));
      result[tag] = amount;
      sum += amount;
    }

    const remainder = Math.round(totalAmount - sum);
    if (remainder > 0) {
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      result[sorted[0][0]] += remainder;
    }

    const embeds = [
      new EmbedBuilder()
        .setTitle(`💎 아이템: ${itemName}`)
        .setDescription(`**총 금액:** ${totalAmount.toLocaleString()} 💎\n(혈비 제외 정산)`)
        .setColor(0x00FF00)
    ];

    for (let [tag, amount] of Object.entries(result)) {
      embeds.push(new EmbedBuilder()
        .setTitle(`${tag} 혈맹 정산금`)
        .setDescription(`💰 정산금: **${amount.toLocaleString()}**`)
        .setColor(colors[tag] || 0x808080));
    }
    await interaction.reply({ embeds });
  }
});

client.login(TOKEN);