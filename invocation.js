
import { GuildMember } from 'discord.js';
import fs from 'node:fs';

// extract user name from interaction
const getUserName = (interaction) => {
    if (interaction.member instanceof GuildMember) {
        return interaction.member.displayName;
    }
    else {
        return interaction.user.username;
    }
}

// if user not in invocations.json, add them
const addUser = (interaction, invocations) => {
    const userName = getUserName(interaction);
    if (!(userName in invocations)) {
        invocations[userName] = {};
        invocations[userName].commands = [];
        invocations[userName].lifetimeInvocations = 0;
        invocations[userName].commandInvocations = {}
        invocations[userName].isMember = false;
        invocations[userName].monthlyReset = new Date().toISOString().slice(0, 7);
    }

    return invocations;
}

// add invocation to invocations.json
const addInvocation = (interaction, invocations) => {
    const userName = getUserName(interaction);
    invocations[userName].commands.push({
        command: interaction.commandName,
        time: new Date().toISOString(),
        query: interaction.options.getString('input') || null,
    });
    if (interaction.commandName in invocations[userName].commandInvocations) {
        invocations[userName].commandInvocations[interaction.commandName] += 1;
    } else {
        invocations[userName].commandInvocations[interaction.commandName] = 1;
    }

    invocations[userName].lifetimeInvocations += 1;

    return invocations;
}

// save invocations.json
const saveInvocations = (invocations) => {
    fs.writeFileSync('./invocations.json', JSON.stringify(invocations, null, 2));
}

// if user monthlyReset is today, reset commandInvocations
const resetCommandInvocations = (invocations) => {
    const today = new Date().toISOString().slice(0, 7);
    for (const userName in invocations) {
        if (invocations[userName].monthlyReset === today) {
            invocations[userName].commandInvocations = {};
        }
    }

    return invocations;
}

// load invocations.json
const loadInvocations = () => {
    try {
        const data = fs.readFileSync('./invocations.json', 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error(err);
        return {};
    }
}

const loadCommandLimits = () => {
    try {
        const data = fs.readFileSync('./command_limits.json', 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error(err);
        return {};
    }
}


// main function
export const invocationWorkflow = async (interaction) => {
    let invocations = loadInvocations();
    invocations = addInvocation(interaction, invocations);
    saveInvocations(invocations);

    return invocations;
}

export const preWorkflow = async (interaction) => {
    let invocations = loadInvocations();
    invocations = addUser(interaction, invocations);
    // invocations = resetCommandInvocations(invocations);
    saveInvocations(invocations);

    return checkCommandLimits(interaction, invocations);
}

const checkCommandLimits = async (interaction, invocations) => {
    const commandLimits = loadCommandLimits();
    const userName = getUserName(interaction);
    const userInvocations = invocations[userName];
    const isMember = userInvocations.isMember;
    const commandName = interaction.commandName;

    if (commandName in commandLimits) {
        const commandLimit = commandLimits[commandName][isMember ? 'member' : 'free'];
        const commandInvocations = userInvocations.commandInvocations[commandName];

        if (commandInvocations >= commandLimit) {
            return false;
        }
    }

    return true;
}
