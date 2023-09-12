import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} from "discord.js";
import { lookupBook } from "../../books.js";
import { randomExport } from "../quoordinates/random.js";
import { complete } from "../../openai_helper.js";
import { quosLogic } from "./quos.js";
import { invocationWorkflow } from "../../invocation.js";

const curioCommand = new SlashCommandBuilder()
  .setName("curio")
  .setDescription("Asks you questions to help you explore the library.");

export const data = curioCommand;

export async function execute(interaction) {
  // get three random quotes
  // ask user which one they like best
  // show them the quote they picked

  await interaction.deferReply({
    ephemeral: true,
  });

  const threeQuotes = [];
  for (let i = 0; i < 3; i++) {
    let random = await randomExport();
    while (random.text.length > 2000) {
      random = await randomExport();
    }
    threeQuotes.push(random);
  }

  // use openai to generate a question about each quote
  const questions = [];
  for (const quote of threeQuotes) {
    const question = await complete(
      `Generate a single question from this quote. The end user cannot see the quote so DO NOT use any abstract concepts like "the speaker" or "the writer" in your question. BE EXPLICIT. DO NOT ASSUME the reader has read the quote. DO NOT use passive voice and do not use passive pronouns like he/she/they/him/her etc. You can use any of who/what/where/when/why. Say nothing else.\n\nQuote:\n\n${quote.text}\n\nQ:`,
      "gpt-3.5-turbo"
    );
    questions.push({
      question,
      quote,
    });
  }

  // ask user which quote they like best
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("curio__question_1")
      .setLabel("Question 1")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("curio__question_2")
      .setLabel("Question 2")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("curio__question_3")
      .setLabel("Question 3")
      .setStyle(ButtonStyle.Primary)
  );

  const message = await interaction.followUp({
    content:
      "**Which question are you curious about**?\n\n" +
      questions.map((q, i) => `\n\n${i + 1}. ${q.question}`.trim()).join("\n"),
    components: [row],
    fetchReply: true,
    ephemeral: true,
  });

  const filter = (i) => {
    return i.user.id === interaction.user.id;
  };

  const collector = message.createMessageComponentCollector({
    filter,
    time: 60_000,
  });

  collector.on("collect", async (i) => {
    if (
      i.customId === "curio__question_1" ||
      i.customId === "curio__question_2" ||
      i.customId === "curio__question_3"
    ) {
      await i.deferReply({
        ephemeral: true,
      });
      const question = questions[parseInt(i.customId.split("_")[3]) - 1];

      const quoordinate = await quosLogic(question.question);

      const quotes = quoordinate
        .map(
          (q) =>
            `> ${q.text}\n\n-- ${
              lookupBook(q.title)
                ? `[${q.title} (**affiliate link**)](${lookupBook(q.title)})`
                : q.title
            }\n\n`
        )
        .filter((q) => q.length < 2000);

      const thread = await i.channel.threads.create({
        name: question.question.slice(0, 50) + "...",
        autoArchiveDuration: 60,
        startMessage: i.channel.lastMessage,
        type: ChannelType.GUILD_PUBLIC_THREAD,
        reason: "Sending quotes as separate messages in one thread",
      });

      const makeAart = new ButtonBuilder()
        .setCustomId("button_id")
        .setLabel("aart")
        .setStyle(ButtonStyle.Primary);

      const learnMore = new ButtonBuilder()
        .setCustomId("quos_learn_more")
        .setLabel("delve")
        .setStyle(ButtonStyle.Primary);

      const summarize = new ButtonBuilder()
        .setCustomId("summarize")
        .setLabel("tldr")
        .setStyle(ButtonStyle.Primary);

      const share = new ButtonBuilder()
        .setCustomId("share")
        .setLabel("share")
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder().addComponents(
        makeAart,
        learnMore,
        summarize,
        share
      );

      for (const quote of quotes) {
        await thread.send({
          content: quote,
          components: [row],
        });
      }
      // link to thread
      await i.editReply(
        {
            content: `@${i.user.username}, here's a thread with quotes that might help you answer your question: ${thread.url}`,
        }
      );
      // await invocationWorkflow(i);

      collector.stop();
    }
  });
}
