require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder
} = require('discord.js');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error("❌ TOKEN / CLIENT_ID / GUILD_ID 확인");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const commands = [
  new SlashCommandBuilder()
    .setName("인원")
    .setDescription("현재 음성채널 인원 확인")
    .addStringOption(option =>
      option
        .setName("타임명")
        .setDescription("예: 19시 보탐")
        .setRequired(false)
    )
].map(command => command.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );

    console.log("✅ 슬래시 명령어 등록 완료");
  } catch (err) {
    console.error("❌ 명령어 등록 실패");
    console.error(err);
  }
})();

client.once("clientReady", () => {
  console.log(`✅ 로그인 완료 : ${client.user.tag}`);
});

client.on("interactionCreate", async interaction => {

  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName !== "인원") return;

  try {

    const voiceChannel = interaction.member.voice.channel;

    if (!voiceChannel) {
      return interaction.reply({
        content: "❌ 먼저 음성채널에 들어가세요.",
        ephemeral: true
      });
    }

    const members = [...voiceChannel.members.values()]
      .filter(member => !member.user.bot);

    const groups = {
      패왕: [],
      대장: [],
      킹덤: [],
      기타: []
    };

    for (const member of members) {

      let nickname = member.displayName
        .replace(/^\[.*?\]\s*/, "")
        .split("/")[0]
        .trim();

      const roles = member.roles.cache.map(r => r.name);

      if (roles.some(r => r.includes("패왕"))) {
        groups.패왕.push(nickname);

      } else if (roles.some(r => r.includes("대장"))) {
        groups.대장.push(nickname);

      } else if (roles.some(r => r.includes("킹덤"))) {
        groups.킹덤.push(nickname);

      } else {
        groups.기타.push(nickname);
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`📢 ${interaction.options.getString("타임명") || "실시간 인원 체크"}`)
      .setDescription(`**총원 : ${members.length}명**`);

    const addField = (title, icon, list) => {
      if (!list.length) return;

      embed.addFields({
        name: `${icon} ${title} (${list.length}명)`,
        value: "```" + list.join(", ") + "```"
      });
    };

    addField("패왕", "⚔️", groups.패왕);
    addField("대장", "👑", groups.대장);
    addField("킹덤", "🏰", groups.킹덤);
    addField("기타", "👤", groups.기타);

    await interaction.reply({
      embeds: [embed]
    });

  } catch (err) {

    console.error(err);

    if (!interaction.replied) {
      await interaction.reply({
        content: "❌ 오류가 발생했습니다.",
        ephemeral: true
      });
    }
  }
});

client.on("error", console.error);

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

client.login(TOKEN);