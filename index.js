const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const TOKEN = process.env.TOKEN;
const APPLICATION_ID = '1487489265448390830'; // 본인 Application ID
const GUILD_ID = '여기에_서버ID_입력';       // 본인 서버 ID

let bloodTaxRate = 20;

const colors = {
  '패왕': 0x0000FF,
  '스타': 0xFFFF00,
  'BEST': 0xFFC0CB,
  '발록': 0xFF0000,
  '명가': 0x800080,
  '기타': 0x808080
};

// ------------------- 슬래시 명령어 정의 -------------------
const commands = [
  new SlashCommandBuilder()
    .setName('인원')
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
    .setName('정산1')
    .setDescription('혈비 제외 후 인원수 기반 정산')
    .addStringOption(option => option.setName('아이템이름').setDescription('아이템 이름').setRequired(true))
    .addIntegerOption(option => option.setName('아이템금액').setDescription('총 아이템 금액').setRequired(true))
    .addIntegerOption(option => option.setName('패왕인원수').setDescription('패왕 혈맹 인원 수').setRequired(true))
    .addIntegerOption(option => option.setName('스타인원수').setDescription('스타 혈맹 인원 수').setRequired(true))
    .addIntegerOption(option => option.setName('베스트인원수').setDescription('BEST 혈맹 인원 수').setRequired(true))
    .addIntegerOption(option => option.setName('발록인원수').setDescription('발록 혈맹 인원 수').setRequired(true))
    .toJSON(),

  new SlashCommandBuilder()
    .setName('정산2')
    .setDescription('혈비 없이 인원수 기반 정산')
    .addStringOption(option => option.setName('아이템이름').setDescription('아이템 이름').setRequired(true))
    .addIntegerOption(option => option.setName('아이템금액').setDescription('총 아이템 금액').setRequired(true))
    .addIntegerOption(option => option.setName('패왕인원수').setDescription('패왕 혈맹 인원 수').setRequired(true))
    .addIntegerOption(option => option.setName('스타인원수').setDescription('스타 혈맹 인원 수').setRequired(true))
    .addIntegerOption(option => option.setName('베스트인원수').setDescription('BEST 혈맹 인원 수').setRequired(true))
    .addIntegerOption(option => option.setName('발록인원수').setDescription('발록 혈맹 인원 수').setRequired(true))
    .toJSON()
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('기존 글로벌 명령어 삭제 중...');
    const globalCommands = await rest.get(Routes.applicationCommands(APPLICATION_ID));
    for (const cmd of globalCommands) {
      await rest.delete(Routes.applicationCommands(APPLICATION_ID, cmd.id));
      console.log(`삭제 완료: ${cmd.name}`);
    }

    console.log('새 서버 단위 명령어 등록 중...');
    await rest.put(
      Routes.applicationGuildCommands(APPLICATION_ID, GUILD_ID),
      { body: commands }
    );
    console.log('서버 단위 명령어 등록 완료!');
  } catch (error) {
    console.error(error);
  }
})();

// ------------------- 봇 이벤트 -------------------
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // ------------------- /인원 -------------------
  if (interaction.commandName === '인원') {
    const channel = interaction.member.voice.channel;
    if (!channel) return interaction.reply('❌ 음성 채널에 먼저 들어가세요!');

    const members = channel.members
      .filter(member => !member.user.bot)
      .map(member => member.displayName);

    if (members.length === 0) return interaction.reply('👻 음성 채널에 유저가 없습니다.');

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
    for (const [tag, list] of Object.entries(groups)) {
      if (list.length > 0) {
        embeds.push(new EmbedBuilder()
          .setTitle(`[${tag}] (${list.length}명)`)
          .setDescription(list.join('\n'))
          .setColor(colors[tag])
        );
      }
    }
    await interaction.reply({ embeds });
  }

  // ------------------- /혈비 -------------------
  if (interaction.commandName === '혈비') {
    const rate = interaction.options.getInteger('값');
    if (rate < 0 || rate > 100) return interaction.reply('❌ 0~100 사이의 값을 입력하세요.');
    bloodTaxRate = rate;
    await interaction.reply(`✅ 혈비가 ${bloodTaxRate}%로 설정되었습니다.`);
  }

  // ------------------- /정산1 -------------------
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
    const totalPeople = Object.values(counts).reduce((a,b)=>a+b,0);

    const result = {};
    let sum = 0;
    for (let [tag, num] of Object.entries(counts)) {
      const amount = Math.floor(afterTax * (num / totalPeople));
      result[tag] = amount;
      sum += amount;
    }

    const remainder = Math.round(afterTax - sum);
    if (remainder > 0) {
      const maxTag = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0];
      result[maxTag] += remainder;
    }

    const embeds = [];
    embeds.push(new EmbedBuilder()
      .setTitle(`아이템: ${itemName}`)
      .setDescription(`총 금액: ${totalAmount}\n혈비(${bloodTaxRate}%): ${Math.floor(totalAmount - afterTax)}`)
      .setColor(0x00FF00)
    );

    for (let [tag, amount] of Object.entries(result)) {
      embeds.push(new EmbedBuilder()
        .setTitle(`${tag} 혈맹 정산금`)
        .setDescription(`💰 정산금: ${amount}`)
        .setColor(colors[tag] || 0x808080)
      );
    }
    await interaction.reply({ embeds });
  }

  // ------------------- /정산2 -------------------
  if (interaction.commandName === '정산2') {
    const itemName = interaction.options.getString('아이템이름');
    const totalAmount = interaction.options.getInteger('아이템금액');

    const counts = {
      '패왕': interaction.options.getInteger('패왕인원수'),
      '스타': interaction.options.getInteger('스타인원수'),
      'BEST': interaction.options.getInteger('베스트인원수'),
      '발록': interaction.options.getInteger('발록인원수')
    };

    const totalPeople = Object.values(counts).reduce((a,b)=>a+b,0);

    const result = {};
    let sum = 0;
    for (let [tag, num] of Object.entries(counts)) {
      const amount = Math.floor(totalAmount * (num / totalPeople));
      result[tag] = amount;
      sum += amount;
    }

    const remainder = Math.round(totalAmount - sum);
    if (remainder > 0) {
      const maxTag = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0];
      result[maxTag] += remainder;
    }

    const embeds = [];
    embeds.push(new EmbedBuilder()
      .setTitle(`아이템: ${itemName}`)
      .setDescription(`총 금액: ${totalAmount}\n혈비 제외`)
      .setColor(0x00FF00)
    );

    for (let [tag, amount] of Object.entries(result)) {
      embeds.push(new EmbedBuilder()
        .setTitle(`${tag} 혈맹 정산금`)
        .setDescription(`💰 정산금: ${amount}`)
        .setColor(colors[tag] || 0x808080)
      );
    }
    await interaction.reply({ embeds });
  }
});

client.login(TOKEN);