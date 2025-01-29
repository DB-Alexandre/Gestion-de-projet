import DiscordOAuth2 from 'discord-oauth2';

const oauth = new DiscordOAuth2({
  clientId: import.meta.env.VITE_DISCORD_CLIENT_ID,
  clientSecret: import.meta.env.VITE_DISCORD_CLIENT_SECRET,
  redirectUri: import.meta.env.VITE_DISCORD_REDIRECT_URI,
});

export const getAuthUrl = () => {
  return oauth.generateAuthUrl({
    scope: ['identify', 'email'],
  });
};

export const getDiscordUser = async (code: string) => {
  try {
    const tokenData = await oauth.tokenRequest({
      code,
      scope: ['identify', 'email'],
      grantType: 'authorization_code',
    });

    const user = await oauth.getUser(tokenData.access_token);
    return {
      id: user.id,
      email: user.email,
      fullName: user.username,
      avatarUrl: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null,
      discordId: user.id,
      isAdmin: false, // À gérer selon vos besoins
    };
  } catch (error) {
    console.error('Erreur lors de la récupération des données Discord:', error);
    throw error;
  }
};