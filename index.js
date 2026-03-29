require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const schedule = require('node-schedule');

const TOKEN = process.env.TOKEN;
const APPLICATION_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// 💡 중요: 복사한 채널 ID를 여기에 넣으세요!
const REPORT_CHANNEL_ID = '1487735750245220482'; 

if (!TOKEN || !APPLICATION_ID || !GUILD_ID) {
  console.error('⚠️ 환경 변수 설정 오류');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

let bloodTaxRate = 20;
let attendanceLog = {}; 

const colors = {
  '패왕': 0x0000FF, '스타': 0xFFFF00, 'BEST': 0xFFC0CB,
  '발록': 0xFF0000, '명가': 0x800080, '기타': 0x808080
};

// ------------------- 슬래시 명령어 정의 -------------------
const commands = [
  new SlashCommandBuilder().setName('인원').setDescription('음성 채널 유저 그룹화 및 참여 기록').addStringOption(opt => opt.setName('타임명').setDescription('예: 19시카파타임')),
  new SlashCommandBuilder().setName('통계').setDescription('현재까지의 혈맹별 참여 횟수 확인'),
  new SlashCommandBuilder().setName('통계초기화').setDescription('데이터 수동 초기화'),
  new SlashCommandBuilder().setName('혈비').setDescription('혈비 설정 (%)').addIntegerOption(opt => opt.setName('값').setRequired(true)),
  new SlashCommandBuilder().setName('정산1').setDescription('혈비 제외 정산').addStringOption(o => o.setName('아이템이름').setRequired(true)).addIntegerOption(o => o.setName('아이템금액').setRequired(true)).addIntegerOption(o => o.setName('패왕인원수').setRequired(true)).addIntegerOption(o => o.setName('스타인원수').setRequired(true)).addIntegerOption(o => o.setName('베스트인원수').setRequired(true)).addIntegerOption(o => o.setName('발록인원수').setRequired(true)),
  new SlashCommandBuilder().setName('정산2').setDescription('혈비 없이 정산').addStringOption(o => o.setName('아이템이름').setRequired(true)).addIntegerOption(o => o.setName('아이템금액').setRequired(true)).addIntegerOption(o => o.setName('패왕인원수').setRequired(true)).addIntegerOption(o => o.setName('스타인원수').setRequired(true)).addIntegerOption(o => o.setName('베스트인원수').setRequired(true)).addIntegerOption(o => o.setName('발록인원수').setRequired(true))
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(Routes.applicationCommands(APPLICATION_ID), { body: [] });
    await rest.put(Routes.applicationGuildCommands(APPLICATION_ID, GUILD_ID), { body: commands });
    console.log('✅ 명령어 등록 완료');
  } catch (error) { console.error(error); }
})();

// ------------------- 자동 스케줄러 (ID 고정 방식) -------------------
client.once('ready', () => {
  console.log(`✅ ${client.user.tag} 온라인`);

  // 1. 매일 23:10 자동 통계 보고
  schedule.scheduleJob('10 23 * * *', async () => {
    const channel = client.channels.cache.get(REPORT_CHANNEL_ID);
    if (!channel) return console.error('⚠️ 통계 채널을 찾을 수 없습니다.');

    if (Object.keys(attendanceLog).length === 0) return channel.send('📊