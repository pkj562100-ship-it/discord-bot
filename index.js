require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const schedule = require('node-schedule'); // 스케줄러 라이브러리 추가

const TOKEN = process.env.TOKEN;
const APPLICATION_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !APPLICATION_ID || !GUILD_ID) {
  console.error('⚠️ 환경 변수 설정 오류를 확인하세요.');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

// 데이터 저장소
let bloodTaxRate = 20;
let attendanceLog = {}; // { "닉네임": 참여횟수 }

const colors = {
  '패왕': 0x0000FF, '스타': 0xFFFF00, 'BEST': 0xFFC0CB,
  '발록': 0xFF0000, '명가': 0x800080, '기타': 0x808080
};

// ------------------- 슬래시 명령어 정의 -------------------
const commands = [
  new SlashCommandBuilder()
    .setName('인원')
    .setDescription('음성 채널 유저 그룹화 및 참여 기록')
    .addStringOption(option => option.setName('타임명').setDescription('예: 19시카파타임').setRequired(false))
    .toJSON(),
  
  new SlashCommandBuilder()
    .setName('통계')
    .setDescription('현재까지의 혈맹별 참여 횟수 통계를 확인합니다')
    .toJSON(),

  new SlashCommandBuilder()
    .setName('통계초기화')
    .setDescription('참여 통계 데이터를 수동으로 지웁니다')
    .toJSON(),

  new SlashCommandBuilder()
    .setName('혈비')
    .setDescription('혈비를 설정합니다 (%)')
    .addIntegerOption(option => option.setName('값').setDescription('0~100 입력').setRequired(true))
    .toJSON(),
  
  new SlashCommandBuilder()
    .setName('정산1')
    .setDescription('혈비 제외 후 인원수 기반 정산')
    .addStringOption(option => option.setName('아이템이름').setRequired(true).setDescription('아이템명'))
    .addIntegerOption(option => option.setName('아이템금액').setRequired(true).setDescription('총 금액'))
    .addIntegerOption(option => option.setName('패왕인원수').setRequired(true).setDescription('인원'))
    .addIntegerOption(option => option.setName('스타인원수').setRequired(true).setDescription('인원'))
    .addIntegerOption(option => option.setName('베스트인원수').setRequired(true).setDescription('인원'))
    .addIntegerOption(option => option.setName('발록인원수').setRequired(true).setDescription('인원'))
    .toJSON(),

  new SlashCommandBuilder()
    .setName('정산2')
    .setDescription('혈비 없이 인원수 기반 정산')
    .addStringOption(option => option.setName('아이템이름').setRequired(true).setDescription('아이템명'))
    .addIntegerOption(option => option.setName('아이템금액').setRequired(true).setDescription('총 금액'))
    .addIntegerOption(option => option.setName('패왕인원수').setRequired(true).setDescription('인원'))
    .addIntegerOption(option => option.setName('스타인원수').setRequired(true).setDescription('인원'))
    .addIntegerOption(option => option.setName('베스트인원수').setRequired(true).setDescription('인원'))
    .addIntegerOption(option => option.setName('발록인원수').setRequired(true).setDescription('인원'))
    .toJSON()
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

// 명령어 동기화
(async () => {
  try {
    await rest.put(Routes.applicationCommands(APPLICATION_ID), { body: [] });
    await rest.put(Routes.applicationGuildCommands(APPLICATION_ID, GUILD_ID), { body: commands });
    console.log('✅ 자동 통계 기능 포함 명령어 등록 완료!');
  } catch (error) {
    console.error('❌ 등록 오류:', error);
  }
})();

// ------------------- 자동 스케줄러 설정 -------------------
client.once('ready', () => {
  console.log(`✅ ${client.user.tag} 가동 시작`);

  // 1. 매일 23시 10분 자동 통계 보고
  schedule.scheduleJob('10 23 * * *', async () => {
    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) return;

    // 통계를 보낼 채널 찾기 (봇이 메시지를 보낼 수 있는 첫 번째 텍스트 채널 혹은 특정 이름의 채널)
    const channel = guild.channels.cache.find(ch => ch.name === '보탐-정산' || ch.name === '일반'); 
    if (!channel) return;

    if (Object.keys(attendanceLog).length === 0) {
        return channel.send('📊 오늘 기록된 보탐 참여 데이터가 없습니다.');
    }

    const statsByGroup = { '패왕': [], '스타': [], 'BEST': [], '발록': [], '명가': [], '기타': [] };
    Object.entries(attendanceLog).forEach(([name, count]) => {
      const tagMatch = name.trim().match(/^\[(.*?)\]/);
      let tag = '기타';
      if (tagMatch) {
        let extractedTag = tagMatch[1].trim();
        if (extractedTag === '베스트' || extractedTag === 'BEST') extractedTag = 'BEST';
        if (statsByGroup[extractedTag]) tag = extractedTag;
      }
      statsByGroup[tag].push({ name, count });
    });

    const embeds = [new EmbedBuilder()
      .setTitle('📅 오늘의 최종 보탐 참여 통계')
      .setDescription(`${new Date().toLocaleDateString()} 자정 자동 초기화 전 최종 리포트입니다.`)
      .setColor(0xFFAA00).setTimestamp()];

    for (const [tag, users] of Object.entries(statsByGroup)) {
      if (users.length > 0) {
        const userList = users.sort((a, b) => b.count - a.count).map(u => `**${u.name}**: ${u.count}회`).join('\n');
        embeds.push(new EmbedBuilder().setTitle(`[${tag}]`).setDescription(userList).setColor(colors[tag] || 0x808080));
      }
    }
    channel.send({ content: '🔔 **23:10 정기 통계 보고**', embeds });
  });

  // 2. 매일 자정(00:00) 데이터 초기화
  schedule.scheduleJob('0 0 * * *', () => {
    attendanceLog = {};
    console.log('📅 자정이 되어 참여 데이터가 초기화되었습니다.');
  });
});

// ------------------- 이벤트 핸들러 (명령어 처리) -------------------
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options } = interaction;

  if (commandName === '인원') {
    const timeName = options.getString('타임명') || '보탐 인원 체크';
    const channel = interaction.member.voice.channel;
    if (!channel) return interaction.reply('❌ 음성 채널에 먼저 들어가주세요!');

    const members = channel.members.filter(m => !m.user.bot).map(m => m.displayName);
    if (members.length === 0) return interaction.reply('👻 채널에 인원이 없습니다.');

    const groups = { '패왕': [], '스타': [], 'BEST': [], '발록': [], '명가': [], '기타': [] };
    members.forEach(name => {
      attendanceLog[name] = (attendanceLog[name] || 0) + 1;
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

    const embeds = [new EmbedBuilder().setTitle(`📢 ${timeName}`).setDescription(`현재 접속: **${members.length}**명`).setColor(0xFFFFFF).setTimestamp()];
    for (const [tag, list] of Object.entries(groups)) {
      if (list.length > 0) embeds.push(new EmbedBuilder().setTitle(`[${tag}] (${list.length}명)`).setDescription(list.join('\n')).setColor(colors[tag]));
    }
    await interaction.reply({ embeds });
  }

  if (commandName === '통계') {
    const logEntries = Object.entries(attendanceLog);
    if (logEntries.length === 0) return interaction.reply('📊 기록된 데이터가 없습니다.');

    const statsByGroup = { '패왕': [], '스타': [], 'BEST': [], '발록': [], '명가': [], '기타': [] };
    logEntries.forEach(([name, count]) => {
      const tagMatch = name.trim().match(/^\[(.*?)\]/);
      let tag = '기타';
      if (tagMatch) {
        let exTag = tagMatch[1].trim();
        if (exTag === '베스트' || exTag === 'BEST') exTag = 'BEST';
        if (statsByGroup[exTag]) tag = exTag;
      }
      statsByGroup[tag].push({ name, count });
    });

    const embeds = [new EmbedBuilder().setTitle('📊 실시간 참여 통계').setColor(0x00FFFF)];
    for (const [tag, users] of Object.entries(statsByGroup)) {
      if (users.length > 0) {
        const userList = users.sort((a, b) => b.count - a.count).map(u => `**${u.name}**: ${u.count}회`).join('\n');
        embeds.push(new EmbedBuilder().setTitle(`[${tag}]`).setDescription(userList).setColor(colors[tag]));
      }
    }
    await interaction.reply({ embeds });
  }

  if (commandName === '통계초기화') {
    attendanceLog = {};
    await interaction.reply('🗑️ 통계 데이터가 초기화되었습니다.');
  }

  // 혈비 및 정산 로직 (기존과 동일)
  if (commandName === '혈비') {
    bloodTaxRate = options.getInteger('값');
    await interaction.reply(`✅ 혈비가 **${bloodTaxRate}%**로 설정되었습니다.`);
  }

  if (commandName === '정산1' || commandName === '정산2') {
    const isTax = commandName === '정산1';
    const itemName = options.getString('아이템이름');
    const totalAmount = options.getInteger('아이템금액');
    const counts = { '패왕': options.getInteger('패왕인원수'), '스타': options.getInteger('스타인원수'), 'BEST': options.getInteger('베스트인원수'), '발록': options.getInteger('발록인원수') };
    const targetAmount = isTax ? totalAmount * (1 - bloodTaxRate / 100) : totalAmount;
    const totalPeople = Object.values(counts).reduce((a, b) => a + b, 0);
    const result = {}; let sum = 0;
    for (let [tag, num] of Object.entries(counts)) {
      const amount = Math.floor(targetAmount * (num / totalPeople));
      result[tag] = amount; sum += amount;
    }
    const remainder = Math.round(targetAmount - sum);
    if (remainder > 0) result[Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]] += remainder;
    const embeds = [new EmbedBuilder().setTitle(`💎 ${itemName}`).setDescription(`**총 금액:** ${totalAmount.toLocaleString()}\n${isTax ? `**혈비:** ${Math.floor(totalAmount - targetAmount).toLocaleString()} 제외` : '혈비 제외'}`).setColor(0x00FF00)];
    for (let [tag, amount] of Object.entries(result)) embeds.push(new EmbedBuilder().setTitle(`${tag} 정산금`).setDescription(`💰 **${amount.toLocaleString()}**`).setColor(colors[tag]));
    await interaction.reply({ embeds });
  }
});

client.login(TOKEN);