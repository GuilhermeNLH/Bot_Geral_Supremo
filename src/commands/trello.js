/**
 * src/commands/trello.js
 *
 * Defines the /trello slash-command group and all its sub-commands.
 *
 * Sub-commands
 * ────────────
 *  /trello listar_listas
 *  /trello listar_cards    lista:
 *  /trello criar_card      lista: titulo: [descricao:] [prazo:]
 *  /trello atualizar_card  card_id: [titulo:] [descricao:] [prazo:]
 *  /trello mover_card      card_id: lista_destino:
 *  /trello deletar_card    card_id:
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require('discord.js');
const { parseTableFormat } = require('../tableFormat');

/**
 * Build the SlashCommandBuilder definition.
 * (Used both here and in deploy-commands.js)
 */
const data = new SlashCommandBuilder()
  .setName('trello')
  .setDescription('Gerencie seu quadro Trello pelo Discord')

  // ── listar_listas ──────────────────────────────────────────────────────────
  .addSubcommand((sub) =>
    sub
      .setName('listar_listas')
      .setDescription('Lista todas as listas abertas do quadro Trello'),
  )

  // ── listar_cards ──────────────────────────────────────────────────────────
  .addSubcommand((sub) =>
    sub
      .setName('listar_cards')
      .setDescription('Lista os cards de uma lista específica')
      .addStringOption((opt) =>
        opt
          .setName('lista')
          .setDescription('Nome da lista')
          .setRequired(true),
      ),
  )

  // ── criar_card ─────────────────────────────────────────────────────────────
  .addSubcommand((sub) =>
    sub
      .setName('criar_card')
      .setDescription('Cria um novo card em uma lista do Trello')
      .addStringOption((opt) =>
        opt.setName('lista').setDescription('Nome da lista de destino').setRequired(true),
      )
      .addStringOption((opt) =>
        opt.setName('titulo').setDescription('Título do card').setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName('descricao')
          .setDescription(
            'Descrição. Use "Campo: valor | Campo2: valor2" para formato de tabela.',
          )
          .setRequired(false),
      )
      .addStringOption((opt) =>
        opt
          .setName('prazo')
          .setDescription('Prazo (ISO 8601, ex.: 2024-12-31T23:59:00)')
          .setRequired(false),
      ),
  )

  // ── atualizar_card ─────────────────────────────────────────────────────────
  .addSubcommand((sub) =>
    sub
      .setName('atualizar_card')
      .setDescription('Atualiza título, descrição ou prazo de um card')
      .addStringOption((opt) =>
        opt.setName('card_id').setDescription('ID do card').setRequired(true),
      )
      .addStringOption((opt) =>
        opt.setName('titulo').setDescription('Novo título').setRequired(false),
      )
      .addStringOption((opt) =>
        opt
          .setName('descricao')
          .setDescription('Nova descrição (suporta formato de tabela)')
          .setRequired(false),
      )
      .addStringOption((opt) =>
        opt
          .setName('prazo')
          .setDescription('Novo prazo (ISO 8601)')
          .setRequired(false),
      ),
  )

  // ── mover_card ─────────────────────────────────────────────────────────────
  .addSubcommand((sub) =>
    sub
      .setName('mover_card')
      .setDescription('Move um card para outra lista')
      .addStringOption((opt) =>
        opt.setName('card_id').setDescription('ID do card').setRequired(true),
      )
      .addStringOption((opt) =>
        opt.setName('lista_destino').setDescription('Nome da lista de destino').setRequired(true),
      ),
  )

  // ── deletar_card ────────────────────────────────────────────────────────────
  .addSubcommand((sub) =>
    sub
      .setName('deletar_card')
      .setDescription('Deleta permanentemente um card do Trello')
      .addStringOption((opt) =>
        opt.setName('card_id').setDescription('ID do card').setRequired(true),
      ),
  );

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('../trelloClient').TrelloClient} trello
 */
async function execute(interaction, trello) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'listar_listas') return handleListarListas(interaction, trello);
  if (sub === 'listar_cards') return handleListarCards(interaction, trello);
  if (sub === 'criar_card') return handleCriarCard(interaction, trello);
  if (sub === 'atualizar_card') return handleAtualizarCard(interaction, trello);
  if (sub === 'mover_card') return handleMoverCard(interaction, trello);
  if (sub === 'deletar_card') return handleDeletarCard(interaction, trello);
}

// ── listar_listas ─────────────────────────────────────────────────────────────

async function handleListarListas(interaction, trello) {
  await interaction.deferReply({ ephemeral: true });
  let lists;
  try {
    lists = await trello.listLists();
  } catch (err) {
    return interaction.editReply(`❌ Erro ao buscar listas: ${err.message}`);
  }

  if (!lists.length) return interaction.editReply('Nenhuma lista encontrada no quadro.');

  const embed = new EmbedBuilder()
    .setTitle('📋 Listas do Quadro Trello')
    .setColor(0x0079bf);

  for (const lst of lists) {
    embed.addFields({ name: lst.name, value: `\`ID: ${lst.id}\``, inline: false });
  }

  return interaction.editReply({ embeds: [embed] });
}

// ── listar_cards ──────────────────────────────────────────────────────────────

async function handleListarCards(interaction, trello) {
  await interaction.deferReply({ ephemeral: true });
  const listName = interaction.options.getString('lista');

  let lst, cards;
  try {
    lst = await trello.getListByName(listName);
    if (!lst) {
      return interaction.editReply(
        `❌ Lista **${listName}** não encontrada. Use \`/trello listar_listas\` para ver as listas disponíveis.`,
      );
    }
    cards = await trello.listCards(lst.id);
  } catch (err) {
    return interaction.editReply(`❌ Erro ao buscar cards: ${err.message}`);
  }

  if (!cards.length) {
    return interaction.editReply(`Nenhum card encontrado na lista **${lst.name}**.`);
  }

  const embed = new EmbedBuilder()
    .setTitle(`🃏 Cards em **${lst.name}**`)
    .setColor(0x61bd4f);

  const display = cards.slice(0, 25);
  for (const card of display) {
    const desc = card.desc
      ? card.desc.slice(0, 100) + (card.desc.length > 100 ? '…' : '')
      : '—';
    embed.addFields({
      name: card.name,
      value: `${desc}\n🔗 [Abrir no Trello](${card.url})\n\`ID: ${card.id}\``,
      inline: false,
    });
  }

  if (cards.length > 25) {
    embed.setFooter({ text: `Mostrando 25 de ${cards.length} cards.` });
  }

  return interaction.editReply({ embeds: [embed] });
}

// ── criar_card ────────────────────────────────────────────────────────────────

async function handleCriarCard(interaction, trello) {
  await interaction.deferReply();
  const listName = interaction.options.getString('lista');
  const titulo = interaction.options.getString('titulo');
  const descricaoRaw = interaction.options.getString('descricao') ?? '';
  const prazo = interaction.options.getString('prazo') ?? null;

  let lst, card;
  try {
    lst = await trello.getListByName(listName);
    if (!lst) {
      return interaction.editReply(
        `❌ Lista **${listName}** não encontrada. Use \`/trello listar_listas\` para ver as listas disponíveis.`,
      );
    }
    const formattedDesc = parseTableFormat(descricaoRaw);
    card = await trello.createCard(lst.id, titulo, formattedDesc, prazo);
  } catch (err) {
    return interaction.editReply(`❌ Erro ao criar card: ${err.message}`);
  }

  const embed = new EmbedBuilder()
    .setTitle('✅ Card criado com sucesso!')
    .setColor(0x61bd4f)
    .addFields(
      { name: 'Título', value: card.name, inline: true },
      { name: 'Lista', value: lst.name, inline: true },
    );

  if (card.due) embed.addFields({ name: 'Prazo', value: card.due, inline: true });
  if (descricaoRaw) {
    embed.addFields({
      name: 'Descrição',
      value: (card.desc ?? '').slice(0, 300) + ((card.desc ?? '').length > 300 ? '…' : ''),
      inline: false,
    });
  }
  embed.addFields({ name: 'Link', value: `[Abrir no Trello](${card.url})`, inline: false });
  embed.setFooter({ text: `ID: ${card.id}` });

  return interaction.editReply({ embeds: [embed] });
}

// ── atualizar_card ────────────────────────────────────────────────────────────

async function handleAtualizarCard(interaction, trello) {
  await interaction.deferReply();
  const cardId = interaction.options.getString('card_id');
  const titulo = interaction.options.getString('titulo');
  const descricaoRaw = interaction.options.getString('descricao');
  const prazo = interaction.options.getString('prazo');

  if (!titulo && !descricaoRaw && !prazo) {
    return interaction.editReply(
      '⚠️ Informe ao menos um campo para atualizar (título, descrição ou prazo).',
    );
  }

  const fields = {};
  if (titulo) fields.name = titulo;
  if (descricaoRaw) fields.desc = parseTableFormat(descricaoRaw);
  if (prazo) fields.due = prazo;

  let card;
  try {
    card = await trello.updateCard(cardId, fields);
  } catch (err) {
    return interaction.editReply(`❌ Erro ao atualizar card: ${err.message}`);
  }

  const embed = new EmbedBuilder()
    .setTitle('✅ Card atualizado com sucesso!')
    .setColor(0xf2a900)
    .addFields({ name: 'Título', value: card.name, inline: true });

  if (card.due) embed.addFields({ name: 'Prazo', value: card.due, inline: true });
  embed.addFields({ name: 'Link', value: `[Abrir no Trello](${card.url})`, inline: false });
  embed.setFooter({ text: `ID: ${card.id}` });

  return interaction.editReply({ embeds: [embed] });
}

// ── mover_card ────────────────────────────────────────────────────────────────

async function handleMoverCard(interaction, trello) {
  await interaction.deferReply();
  const cardId = interaction.options.getString('card_id');
  const destName = interaction.options.getString('lista_destino');

  let dest, card;
  try {
    dest = await trello.getListByName(destName);
    if (!dest) {
      return interaction.editReply(
        `❌ Lista de destino **${destName}** não encontrada. Use \`/trello listar_listas\` para ver as listas disponíveis.`,
      );
    }
    card = await trello.moveCard(cardId, dest.id);
  } catch (err) {
    return interaction.editReply(`❌ Erro ao mover card: ${err.message}`);
  }

  const embed = new EmbedBuilder()
    .setTitle('✅ Card movido com sucesso!')
    .setColor(0x5ba4cf)
    .addFields(
      { name: 'Título', value: card.name, inline: true },
      { name: 'Nova lista', value: dest.name, inline: true },
    )
    .addFields({ name: 'Link', value: `[Abrir no Trello](${card.url})`, inline: false })
    .setFooter({ text: `ID: ${card.id}` });

  return interaction.editReply({ embeds: [embed] });
}

// ── deletar_card ──────────────────────────────────────────────────────────────

async function handleDeletarCard(interaction, trello) {
  const cardId = interaction.options.getString('card_id');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('confirm_delete')
      .setLabel('Confirmar')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🗑️'),
    new ButtonBuilder()
      .setCustomId('cancel_delete')
      .setLabel('Cancelar')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('✖️'),
  );

  await interaction.reply({
    content: `⚠️ Tem certeza que deseja deletar permanentemente o card \`${cardId}\`?`,
    components: [row],
    ephemeral: true,
  });

  let buttonInteraction;
  try {
    buttonInteraction = await interaction.channel.awaitMessageComponent({
      filter: (i) => i.user.id === interaction.user.id,
      componentType: ComponentType.Button,
      time: 30_000,
    });
  } catch {
    return interaction.editReply({ content: '⌛ Tempo esgotado. Operação cancelada.', components: [] });
  }

  if (buttonInteraction.customId === 'cancel_delete') {
    return buttonInteraction.update({ content: '❎ Operação cancelada.', components: [] });
  }

  try {
    await trello.deleteCard(cardId);
  } catch (err) {
    return buttonInteraction.update({
      content: `❌ Erro ao deletar card: ${err.message}`,
      components: [],
    });
  }

  return buttonInteraction.update({
    content: `✅ Card \`${cardId}\` deletado com sucesso.`,
    components: [],
  });
}

module.exports = { data, execute };
