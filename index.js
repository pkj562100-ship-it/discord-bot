require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const schedule = require('node-schedule');

const TOKEN = process.env.TOKEN;
const APPLICATION_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const REPORT_CHANNEL_ID = '1487735750245220482';

if (!TOKEN || !APPLICATION_ID || !GUILD_ID) {
  console.log('❌ .env 설정 확인 필요');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

let bloodTaxRate = 20;
let attendanceLog = {};

const colors = {
  '패왕': 0x0000FF,
  '스타': 0xFFFF00,
  'BEST': 0xFFC0CB,
  '발록': 0xFF0000,
  '명가': 0x800080,
  '기타': 0x808080
};

// ✅ 모든 옵션에 .setDescription()을 추가했습니다.
const commands = [
  new SlashCommandBuilder()
    .setName('인원')
    .setDescription('현재 채널 인원 체크')
    .addStringOption(o => o.setName('타임명').setDescription('예: 19시 타임')),

  new SlashCommandBuilder().setName('통계').setDescription('통계 안내를 확인합니다.'),
  new SlashCommandBuilder().setName('통계초기화').setDescription('데이터를 초기화합니다.'),

  new SlashCommandBuilder()
    .setName('혈비')
    .setDescription('혈비 세율을 설정합니다.')
    .addIntegerOption(o => o.setName('값').setDescription('0~100 사이의 숫자').setRequired(true)),

  new SlashCommandBuilder()
    .setName('정산1')
    .setDescription('혈비 적용 정산')
    .addStringOption(o => o.setName('아이템이름').setDescription('아이템 이름').setRequired(true))
    .addIntegerOption(o => o.setName('아이템금액').setDescription('아이템 총 금액').setRequired(true))
    .addIntegerOption(o => o.setName('패왕인원수').setDescription('패왕 인원수').setRequired(true))
    .addIntegerOption(o => o.setName('스타인원수').setDescription('스타 인원수').setRequired(true))
    .addIntegerOption(o => o.setName('베스트인원수').setDescription('베스트 인원수').setRequired(true))
    .addIntegerOption(o => o.setName('발록인원수').setDescription('발록 인원수').setRequired(true)),

  new SlashCommandBuilder()
    .setName('정산2')
    .setDescription('혈비 없이 정산')
    .addStringOption(o => o.setName('아이템이름').setDescription('아이템 이름').setRequired(true))
    .addIntegerOption(o => o.setName('아이템금액').setDescription('아이템 총 금액').setRequired(true))
    .addIntegerOption(o => o.setName('패왕인원수').setDescription('패왕 인원수').setRequired(true))
    .addIntegerOption(o => o.setName('스타인원수').setDescription('스타 인원수').setRequired(true))
    .addIntegerOption(o => o.setName('베스트인원수').setDescription('베스트 인원수').setRequired(true))
    .addIntegerOption(o => o.setName('발록인원수').setDescription('발록 인원수').setRequired(true))
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    const data = await rest.put(
      Routes.applicationGuildCommands(APPLICATION_ID, GUILD_ID),
      { body: commands }
    );
    console.log(`✅ ${data.length}개 명령어 등록 완료`);
  } catch (e) {
    console.error(e);
  }
})();

// ... 이후 로직은 기존과 동일하므로 생략 (기본 코드 그대로 사용)
client.once('ready', () => { console.log(`✅ 봇 온라인: ${client.user.tag}`); });
client.on('interactionCreate', async interaction => {
    // 기존에 주신 인터랙션 처리 코드 붙여넣기
});
client.login(TOKEN);