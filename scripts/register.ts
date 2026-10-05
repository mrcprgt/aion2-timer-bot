// Uploads slash command definitions to Discord. Run: npm run register
// Reads DISCORD_TOKEN and DISCORD_APPLICATION_ID from .dev.vars.
import { COMMANDS } from "../src/commands";

const { DISCORD_TOKEN, DISCORD_APPLICATION_ID } = process.env;
if (!DISCORD_TOKEN || !DISCORD_APPLICATION_ID) {
  throw new Error("Set DISCORD_TOKEN and DISCORD_APPLICATION_ID in .dev.vars");
}

const res = await fetch(`https://discord.com/api/v10/applications/${DISCORD_APPLICATION_ID}/commands`, {
  method: "PUT",
  headers: { Authorization: `Bot ${DISCORD_TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify(COMMANDS),
});
if (!res.ok) throw new Error(`Register failed: ${res.status} ${await res.text()}`);
console.log(`Registered ${COMMANDS.length} commands.`);
