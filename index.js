require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder
} = require('discord.js');

// 1. 환경변수 안전 추출 및 정제
const TOKEN = (process.env.TOKEN || "").trim();
const CLIENT_ID = (process.env.CLIENT_ID || "").trim();
const GUILD_ID = (process.env.GUILD_ID || "").trim();

console.log("====================================");
console.log("--- [환경변수 검증 로그] ---");
console.log("CLIENT_ID :", CLIENT_ID);
console.log("GUILD_ID  :", GUILD_ID);
console.log("TOKEN 길이:", TOKEN.length);
console.log("====================================");

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error("❌ 오류: TOKEN, CLIENT_ID, GUILD_ID 환경 변수가 올바르게 설정되지 않았습니다.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers
  ]
});

// 리니지 클래식 4대 직업 정의
const CLASSIC_JOBS = ["기사", "요정", "마법사", "군주"];

// 자동 갱신 상태 변수
let autoUpdateInterval = null;
let activeVoiceChannelId = null;
let statusMessage = null;

// 슬래시 명령어 정의
const commands = [
  new SlashCommandBuilder()
    .setName("보탐시작")
    .setDescription("현재 음성채널을 보탐방으로 등록하고 인원판 자동 갱신을 시작합니다.")
    .addStringOption(opt => opt.setName("타임명").setDescription("예: 20시 보탐").setRequired(false)),
  new SlashCommandBuilder()
    .setName("보탐종료")
    .setDescription("보탐 자동 갱신을 종료합니다."),
  new SlashCommandBuilder()
    .setName("인원")
    .setDescription("현재 음성채널 인원을 확인합니다.")
    .addStringOption(opt => opt.setName("타임명").setDescription("예: 20시 보탐").setRequired(false)),
  new SlashCommandBuilder()
    .setName("직업")
    .setDescription("현재 음성채널 인원의 직업 분포를 확인합니다."),
  new SlashCommandBuilder()
    .setName("닉확인")
    .setDescription("닉네임 양식이 잘못되었거나 대괄호 태그가 없는 인원을 확인합니다.")
].map(command => command.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

/**
 * 리니지 클래식 닉네임 분석 및 그룹/직업 추출 함수
 */
function parseMemberDetails(member) {
  const raw = member.displayName; // 디스코드 표시 닉네임

  // 1. 대괄호 안의 혈맹 태그 추출 (예: "[패왕G]" -> "패왕G")
  const tagMatch = raw.match(/^\[(.*?)\]/);
  const clanTag = tagMatch ? tagMatch[1] : "";

  // 2. 대괄호 [혈맹] 태그 제거 후 나머지 텍스트 파싱
  const withoutClan = raw.replace(/^\[.*?\]\s*/, "");
  const parts = withoutClan.split("/").map(p => p.trim());

  // 소괄호(구 닉네임)를 포함한 순수 이름
  const cleanName = parts[0] || raw;

  // 3. 직업 파싱
  let detectedJob = "기타";
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (part.includes("기사")) {
      detectedJob = "기사";
      break;
    } else if (part.includes("요정")) {
      detectedJob = "요정";
      break;
    } else if (part.includes("마법사") || part.includes("법사")) {
      detectedJob = "마법사";
      break;
    } else if (part.includes("군주")) {
      detectedJob = "군주";
      break;
    }
  }

  // 4. 닉네임 태그에 기반한 그룹 판별
  let group = "미확인";
  if (clanTag.includes("패왕")) {
    group = "패왕";
  } else if (clanTag.includes("대장")) {
    group = "대장";
  } else if (clanTag.includes("킹덤")) {
    group = "킹덤";
  }

  return {
    raw,
    name: cleanName,
    job: detectedJob,
    group: group
  };
}

// 음성 채널 유저 분석
function parseVoiceMembers(voiceChannel) {
  const members = [...voiceChannel.members.values()].filter(m => !m.user.bot);

  const groups = {
    패왕: [],
    대장: [],
    킹덤: [],
    미확인: []
  };

  for (const member of members) {
    const parsed = parseMemberDetails(member);
    if (groups[parsed.group]) {
      groups[parsed.group].push(parsed);
    } else {
      groups.미확인.push(parsed);
    }
  }

  return { total: members.length, groups };
}

// 인원 현황 임베드 생성
function buildEmbed(timeName, parsedData) {
  const { total, groups } = parsedData;

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`📢 ${timeName}`)
    .setDescription(`**👥 총원 : ${total}명**`)
    .setTimestamp();

  const addField = (title, icon, list) => {
    if (!list.length) return;
    const names = list.map(m => m.name).join(", ");
    embed.addFields({
      name: `${icon} ${title} (${list.length}명)`,
      value: "```" + names + "```"
    });
  };

  addField("패왕", "⚔️", groups.패왕);
  addField("대장", "👑", groups.대장);
  addField("킹덤", "🏰", groups.킹덤);
  addField("닉네임 확인 필요", "❗", groups.미확인);

  return embed;
}

client.once("clientReady", () => {
  console.log(`✅ 디스코드 봇 로그인 완료 : ${client.user.tag}`);
});

// 인터랙션 (슬래시 명령어) 처리
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, member } = interaction;
  const voiceChannel = member.voice ? member.voice.channel : null;

  // 1. /보탐시작
  if (commandName === "보탐시작") {
    if (!voiceChannel) {
      return interaction.reply({ content: "❌ 먼저 음성 채널에 입장해 주세요.", ephemeral: true });
    }

    if (autoUpdateInterval) {
      return interaction.reply({ content: "⚠️ 이미 보탐 자동 갱신이 진행 중입니다. `/보탐종료` 후 다시 실행해 주세요.", ephemeral: true });
    }

    const timeName = interaction.options.getString("타임명") || "실시간 보탐 현황";
    activeVoiceChannelId = voiceChannel.id;

    const parsedData = parseVoiceMembers(voiceChannel);
    const embed = buildEmbed(timeName, parsedData);

    statusMessage = await interaction.reply({ embeds: [embed], fetchReply: true });

    // 10초 주기 자동 갱신
    autoUpdateInterval = setInterval(async () => {
      try {
        const currentVoiceChannel = await client.channels.fetch(activeVoiceChannelId);
        if (currentVoiceChannel && statusMessage) {
          const updatedData = parseVoiceMembers(currentVoiceChannel);
          const updatedEmbed = buildEmbed(timeName, updatedData);
          await statusMessage.edit({ embeds: [updatedEmbed] });
        }
      } catch (e) {
        console.error("자동 갱신 중 오류:", e);
      }
    }, 10000);

    return;
  }

  // 2. /보탐종료
  if (commandName === "보탐종료") {
    if (!autoUpdateInterval) {
      return interaction.reply({ content: "❌ 진행 중인 자동 갱신이 없습니다.", ephemeral: true });
    }

    clearInterval(autoUpdateInterval);
    autoUpdateInterval = null;
    activeVoiceChannelId = null;
    statusMessage = null;

    return interaction.reply("🛑 **보탐 자동 갱신이 종료되었습니다.**");
  }

  // 3. /인원
  if (commandName === "인원") {
    if (!voiceChannel) {
      return interaction.reply({ content: "❌ 먼저 음성 채널에 입장해 주세요.", ephemeral: true });
    }

    const timeName = interaction.options.getString("타임명") || "실시간 인원 체크";
    const parsedData = parseVoiceMembers(voiceChannel);
    const embed = buildEmbed(timeName, parsedData);

    return interaction.reply({ embeds: [embed] });
  }

  // 4. /직업
  if (commandName === "직업") {
    if (!voiceChannel) {
      return interaction.reply({ content: "❌ 먼저 음성 채널에 입장해 주세요.", ephemeral: true });
    }

    const parsedData = parseVoiceMembers(voiceChannel);
    const allMembers = [
      ...parsedData.groups.패왕,
      ...parsedData.groups.대장,
      ...parsedData.groups.킹덤,
      ...parsedData.groups.미확인
    ];

    const countJobs = (memberList) => {
      const counts = { 기사: 0, 요정: 0, 마법사: 0, 군주: 0, 기타: 0 };
      for (const m of memberList) {
        if (counts[m.job] !== undefined) {
          counts[m.job]++;
        } else {
          counts["기타"]++;
        }
      }
      return counts;
    };

    const formatCounts = (counts) => {
      const order = ["기사", "요정", "마법사", "군주", "기타"];
      return order
        .filter(job => counts[job] > 0 || job !== "기타")
        .map(job => `${job} ${counts[job]}`)
        .join("\n");
    };

    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle("📊 음성채널 직업 분포 현황")
      .addFields(
        { name: "🌐 전체", value: "```\n" + formatCounts(countJobs(allMembers)) + "\n```" },
        { name: "⚔️ 패왕", value: "```\n" + formatCounts(countJobs(parsedData.groups.패왕)) + "\n```", inline: true },
        { name: "👑 대장", value: "```\n" + formatCounts(countJobs(parsedData.groups.대장)) + "\n```", inline: true },
        { name: "🏰 킹덤", value: "```\n" + formatCounts(countJobs(parsedData.groups.킹덤)) + "\n```", inline: true }
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  // 5. /닉확인
  if (commandName === "닉확인") {
    if (!voiceChannel) {
      return interaction.reply({ content: "❌ 먼저 음성 채널에 입장해 주세요.", ephemeral: true });
    }

    const parsedData = parseVoiceMembers(voiceChannel);
    const unverified = parsedData.groups.미확인;

    if (!unverified.length) {
      return interaction.reply({ content: "✅ 대괄호 태그가 없거나 닉네임 양식이 잘못된 인원이 없습니다!", ephemeral: true });
    }

    const names = unverified.map(m => m.raw).join("\n");

    const embed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setTitle(`❗ 닉네임 확인 필요 인원 (${unverified.length}명)`)
      .setDescription("아래 인원들은 닉네임에 [패왕], [대장], [킹덤] 형태의 대괄호 태그가 없거나 양식이 맞지 않습니다.\n```\n" + names + "\n```")
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
});

client.on("error", console.error);
process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

// 2. [핵심 수정] 명령어 등록 완료 후 봇 로그인 진행 (비동기 동기화)
async function startBot() {
  try {
    console.log("⏳ 슬래시 명령어 서버 즉시 등록 시도 중...");
    
    // 특정 Guild(서버)에 즉시 등록
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log("✅ 슬래시 명령어 서버 즉시 등록 완료!");

    // 명령어 등록 성공 확인 후 봇 로그인 실행
    await client.login(TOKEN);
  } catch (error) {
    console.error("❌ 초기화 및 로그인 중 오류 발생:", error);
  }
}

startBot();