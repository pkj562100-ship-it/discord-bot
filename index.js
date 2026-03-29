require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const TOKEN = process.env.TOKEN;
const APPLICATION_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !APPLICATION_ID || !GUILD_ID) {
  console.error('⚠️ 환경 변수가 설정되지 않았습니다. .env 혹은 Render 환경 변수 확인 필요');
  process.exit(1);
}

// 봇 클라이언트 설정
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

// 혈비 초기값 (20%)
let bloodTaxRate = 20;

// 혈맹별 색상 설정
const colors = {
  '패왕': 0x0000FF, // 파랑
  '스타': 0xFFFF00, // 노랑
  'BEST': 0xFFC0CB, // 분홍
  '발록': 0xFF0000, // 빨강
  '명가': 0x800080, // 보라
  '기타': 0x808080  // 회색
};

// ------------------- 슬래시 명령어 정의 -------------------
const commands = [
  new SlashCommandBuilder()
    .setName('인원')
    .setDescription('음성 채널 유저를 그룹화하여 출력')
    .addStringOption(option => 
      option.setName('타임명')
        .setDescription('예: 19시카파타임 (선택 사항)')
        .setRequired(false))
    .toJSON(),
  
  new SlashCommandBuilder()
    .setName('혈비')
    .setDescription('혈비를 설정합니다 (%)')
    .addIntegerOption(option =>
      option.setName('값')
        .setDescription('혈비 %를 입력 (0~100)')
        .setRequired(true))
    .toJSON(),
  
  new SlashCommandBuilder()
    .setName('정산1')
    .setDescription('혈비 제외 후 인원수 기반 정산')
    .addStringOption(option => option.setName('아이템이름').setDescription('아이템 이름').setRequired(true))
    .addIntegerOption(option => option.setName('아이템금액').setDescription('총 아이템 금액').setRequired(true))
    .addIntegerOption(option => option.setName('패왕인원수').setDescription('패왕 인원').setRequired(true))
    .addIntegerOption(option => option.setName('스타인원수').setDescription('스타 인원').setRequired(true))
    .addIntegerOption(option => option.setName('베스트인원수').setDescription('BEST 인원').setRequired(true))
    .addIntegerOption(option => option.setName('발록인원수').setDescription('발록 인원').setRequired(true))
    .toJSON(),
  
  new SlashCommandBuilder()
    .setName('정산2')
    .setDescription('혈비 없이 인원수 기반 정산')
    .addStringOption(option => option.setName('아이템이름').setDescription('아이템 이름').setRequired(true))
    .addIntegerOption(option => option.setName('아이템금액').setDescription('총 아이템 금액').setRequired(true))
    .addIntegerOption(option => option.setName('패왕인원수').setDescription('패왕 인원').setRequired(true))
    .addIntegerOption(option => option.setName('스타인원수').setDescription('스타 인원').setRequired(true))
    .addIntegerOption(option => option.setName('베스트인원수').setDescription('BEST 인원').setRequired(true))
    .addIntegerOption(option => option.setName('발록인원수').setDescription('발록 인원').setRequired(true))
    .toJSON()
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

// ------------------- 명령어 동기화 (기존 오류 명령어 삭제 및 재등록) -------------------
(async () => {
  try {
    console.log('🔹 명령어 동기화 시작...');
    
    // 글로벌 명령어 초기화 (기존 voice2 등 삭제용)
    await rest.put(Routes.applicationCommands(APPLICATION_ID), { body: [] });
    
    // 현재 서버에 새 명령어 등록
    await rest.put(
      Routes.applicationGuildCommands(APPLICATION_ID, GUILD_ID),
      { body: commands }
    );
    
    console.log('✅ 모든 명령어 동기화 및 등록 완료!');
  } catch (error) {
    console.error('❌ 명령어 등록 중 오류 발생:', error);
  }
})();

// ------------------- 봇 이벤트 처리 -------------------
client.once('ready', () => {
  console.log(`✅ 로그인 성공: ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // --- /인원 명령어 ---
  if (interaction.commandName === '인원') {
    const timeName = interaction.options.getString('타임명') || '보탐 인원 체크';
    const channel = interaction.member.voice.channel;
    
    if (!channel) return interaction.reply('❌ 음성 채널에 먼저 입장해주세요!');

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
    
    // 메인 제목 임베드
    embeds.push(new EmbedBuilder()
      .setTitle(`📢 ${timeName}`)
      .setDescription(`현재 접속 인원: 총 **${members.length}**명`)
      .setColor(0xFFFFFF)
      .setTimestamp()
    );

    // 혈맹별 리스트
    for (const [tag, list] of Object.entries(groups)) {
      if (list.length > 0) {
        embeds.push(new EmbedBuilder()
          .setTitle(`[${tag}] (${list.length}명)`)
          .setDescription(list.join('\n'))
          .setColor(colors[tag] || 0x808080)
        );
      }
    }
    await interaction.reply({ embeds });
  }

  // --- /혈비 명령어 ---
  if (interaction.commandName === '혈비') {
    const rate = interaction.options.getInteger('값');
    if (rate < 0 || rate > 100) return interaction.reply('❌ 0~100 사이의 숫자를 입력하세요.');
    bloodTaxRate = rate;
    await interaction.reply(`✅ 혈비가 **${bloodTaxRate}%**로 변경되었습니다.`);
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
      const amount = Math.floor(afterTax