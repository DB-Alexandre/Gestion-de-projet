const DISCORD_WEBHOOK_URL = import.meta.env.VITE_DISCORD_WEBHOOK_URL;

export async function sendDiscordNotification(task: {
  title: string;
  description: string;
  deadline: string;
  assignedTo: { fullName: string; discordId?: string };
}) {
  const message = {
    content: task.assignedTo.discordId ? `<@${task.assignedTo.discordId}>` : task.assignedTo.fullName,
    embeds: [
      {
        title: "⚠️ Deadline Approaching!",
        description: `La tâche "${task.title}" arrive à échéance.\n\n${task.description}`,
        color: 15158332, // Rouge
        fields: [
          {
            name: "Date limite",
            value: new Date(task.deadline).toLocaleString('fr-FR'),
            inline: true
          },
          {
            name: "Assigné à",
            value: task.assignedTo.fullName,
            inline: true
          }
        ]
      }
    ]
  };

  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });
  } catch (error) {
    console.error('Erreur lors de l\'envoi de la notification Discord:', error);
  }
}