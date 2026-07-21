import prisma from './database.js';

export async function populateTicketConfigs(): Promise<void> {
  const defaultConfigs = [
    {
      ticketType: "General",
      allowCustomInstructions: false,
      useCustomInstructions: false,
      instructions: "",
      previewTitle: ""
    },
    {
      ticketType: "Store",
      allowCustomInstructions: true,
      useCustomInstructions: true,
      instructions: "Once you're done selecting a product, please describe your payment method and any questions you have.",
      previewTitle: "Store Purchase"
    },
    {
      ticketType: "Alt Appeal",
      allowCustomInstructions: true,
      useCustomInstructions: true,
      instructions: "Please provide your appeal details to verify your identity.",
      previewTitle: "Alt Appeal Ticket"
    },
    {
      ticketType: "Partnership",
      allowCustomInstructions: true,
      useCustomInstructions: true,
      instructions: `### PRBW is no longer doing free partnerships.
      
Server must be Minecraft related (exceptions can be made, e.g., for performance enhancing softwares).
- **Server must have 1,000+ members. (In this case, we'll do a NoPing4Ping partnership, where you have to ping for our advertisement but we won't)**
- **For a Ping4Ping or a partnership with a smaller server, the prices are given below:**
\`\`\`arm
1. Simple Ping4Ping partnership, if your server is above 1000 members will cost $15 USD.
2. A Ping4Ping partnership with smaller servers may cost up to $20 USD.
3. A Ping4Ping CAN BE FREE for servers with 1.25x the number of members of PRBW.
4. A simple partnership with no pings for servers of any member count will cost $10 USD.
\`\`\``,
      previewTitle: "Partnership Requirements"
    },
    {
      ticketType: "Mute Appeal",
      allowCustomInstructions: true,
      useCustomInstructions: false,
      instructions: "Please provide your mute appeal details.",
      previewTitle: "Mute Appeal Ticket"
    },
    {
      ticketType: "Strike Appeal",
      allowCustomInstructions: true,
      useCustomInstructions: false,
      instructions: "Please provide your strike appeal details.",
      previewTitle: "Strike Appeal Ticket"
    },
    {
      ticketType: "Ban Appeal: Screenshare",
      allowCustomInstructions: true,
      useCustomInstructions: false,
      instructions: "Please provide details regarding your screenshare ban appeal.",
      previewTitle: "Screenshare Ban Appeal"
    },
    {
      ticketType: "Ban Appeal: Strike",
      allowCustomInstructions: true,
      useCustomInstructions: false,
      instructions: "Please provide details regarding your strike ban appeal.",
      previewTitle: "Strike Ban Appeal"
    }
  ];

  for (const cfg of defaultConfigs) {
    await prisma.ticketConfig.upsert({
      where: { ticketType: cfg.ticketType },
      // Seed missing rows without overwriting administrator customizations.
      update: {},
      create: cfg,
    });
  }
}
