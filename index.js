client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'voice3') { // <-- 명령어 이름 변경
    const member = interaction.member;
    const channel = member.voice.channel;

    if (!channel) {
      return interaction.reply('음성채널에 들어가 있어야 합니다.');
    }

    const members = channel.members.map(m => m.displayName);

    // 태그별 그룹 초기화
    const tagGroups = {
      '패왕': [],
      '베스트': [],
      '스타': [],
      '명가': [],
      '기타': []
    };

    members.forEach(name => {
      let matched = false;

      // 닉네임/레벨/직업 추출
      const infoMatch = name.match(/([^\[\]/]+)(?:\/(\d+))?(?:\/(.+))?$/);
      let displayName = infoMatch
        ? infoMatch[2] 
          ? `${infoMatch[1].trim()}/${infoMatch[2].trim()}/${(infoMatch[3]||'').trim()}` 
          : infoMatch[1].trim()
        : name;

      // [패왕] 태그
      if (name.includes('[패왕]')) {
        tagGroups['패왕'].push(displayName);
        matched = true;
      }

      // [베스트] 또는 [BEST] 포함
      if (name.includes('[베스트]') || name.includes('[BEST]')) {
        tagGroups['베스트'].push(displayName);
        matched = true;
      }

      // [스타] 태그
      if (name.includes('[스타]')) {
        tagGroups['스타'].push(displayName);
        matched = true;
      }

      // [명가] 태그
      if (name.includes('[명가]')) {
        tagGroups['명가'].push(displayName);
        matched = true;
      }

      // 기타 → 태그 그대로 유지
      if (!matched) tagGroups['기타'].push(name);
    });

    // 메시지 작성
    let message = '';
    for (const [tag, list] of Object.entries(tagGroups)) {
      if (list.length === 0) continue; // 인원이 0이면 생략
      message += `[${tag}]\n인원수 : ${list.length}명\n\n`;
      message += list.join('\n') + '\n\n';
    }

    await interaction.reply(message);
  }
});