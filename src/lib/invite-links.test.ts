/**
 * Invite-link validation (src/lib/invite-links.ts). Run: npm run test:unit
 * Only https links on discord.gg / discord.com/invite / t.me / telegram.me may become a "Join"
 * link, rebuilt from the parsed code; everything else is null.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  discordBotInviteHref,
  discordInviteUrl,
  normalizeDiscordInvite,
  normalizeTelegramInvite,
  taskJoinLink,
  telegramBotName,
  telegramInviteUrl,
  withCommunityMetadata,
} from './invite-links'

test('Discord: discord.gg and discord.com/invite links, rebuilt as https://discord.gg/<code>', () => {
  assert.equal(discordInviteUrl('https://discord.gg/example'), 'https://discord.gg/example')
  assert.equal(discordInviteUrl('  https://discord.gg/Ab3-xY/  '), 'https://discord.gg/Ab3-xY')
  assert.equal(discordInviteUrl('https://discord.com/invite/example'), 'https://discord.gg/example')
  assert.equal(discordInviteUrl('https://DISCORD.GG/example'), 'https://discord.gg/example')
  // Query and fragment are dropped, never passed through.
  assert.equal(discordInviteUrl('https://discord.gg/example?event=1#x'), 'https://discord.gg/example')
})

test('Discord: anything else is not a join link', () => {
  for (const bad of [
    'http://discord.gg/example', // not https
    'javascript:alert(1)',
    'data:text/html,hi',
    'https://discord.gg/', // no code
    'https://discord.gg/a', // too short
    'https://discord.gg/exa mple',
    'https://discord.gg/example/extra',
    'https://discord.com/example', // discord.com needs /invite/
    'https://discord.com/channels/1/2',
    'https://discordapp.com/invite/example', // not one of the accepted hosts
    'https://discord.gg.evil.example/example', // look-alike host
    'https://evil.example/discord.gg/example',
    'https://discord.gg@evil.example/example', // userinfo
    'https://user:pw@discord.gg/example',
    'https://discord.gg:8443/example', // port
    'https://t.me/example_group', // the other platform
    'example', // a bare code is only accepted by the wizard's normalizer
    '',
    undefined,
    null,
    42,
    `https://discord.gg/${'a'.repeat(600)}`,
  ]) {
    assert.equal(discordInviteUrl(bad), null, String(bad))
  }
})

test('Telegram: usernames, +hash and joinchat links on t.me / telegram.me, rebuilt on t.me', () => {
  assert.equal(telegramInviteUrl('https://t.me/example_group'), 'https://t.me/example_group')
  assert.equal(telegramInviteUrl('https://telegram.me/example_group/'), 'https://t.me/example_group')
  assert.equal(telegramInviteUrl('https://t.me/+AbCdEf123456'), 'https://t.me/+AbCdEf123456')
  assert.equal(telegramInviteUrl('https://t.me/joinchat/AbCdEf123456'), 'https://t.me/joinchat/AbCdEf123456')
  assert.equal(telegramInviteUrl('https://T.ME/example_group?start=1'), 'https://t.me/example_group')
})

test('Telegram: anything else is not a join link', () => {
  for (const bad of [
    'http://t.me/example_group',
    'javascript:alert(1)',
    'https://t.me/',
    'https://t.me/abc', // too short for a username
    'https://t.me/1example', // must start with a letter
    'https://t.me/example_group/123', // a message link, not a chat
    'https://t.me/+short',
    'https://t.me/share', // reserved paths
    'https://t.me/addstickers',
    'https://t.me/joinchat',
    'https://t.me.evil.example/example_group',
    'https://evil.example/t.me/example_group',
    'https://telegram.org/example_group',
    'https://discord.gg/example',
    '@example_group',
    null,
  ]) {
    assert.equal(telegramInviteUrl(bad), null, String(bad))
  }
})

test('the wizard normalisers accept what hosts type, and still refuse other hosts', () => {
  assert.equal(normalizeDiscordInvite('example'), 'https://discord.gg/example')
  assert.equal(normalizeDiscordInvite('discord.gg/example'), 'https://discord.gg/example')
  assert.equal(normalizeDiscordInvite('http://discord.gg/example'), 'https://discord.gg/example')
  assert.equal(normalizeDiscordInvite(' https://discord.com/invite/example '), 'https://discord.gg/example')
  assert.equal(normalizeDiscordInvite('https://evil.example/x'), null)
  assert.equal(normalizeDiscordInvite('t.me/example_group'), null)
  assert.equal(normalizeDiscordInvite('javascript:alert(1)'), null)
  assert.equal(normalizeDiscordInvite(''), null)
  assert.equal(normalizeDiscordInvite(undefined), null)

  assert.equal(normalizeTelegramInvite('@example_group'), 'https://t.me/example_group')
  assert.equal(normalizeTelegramInvite('t.me/+AbCdEf123456'), 'https://t.me/+AbCdEf123456')
  assert.equal(normalizeTelegramInvite('http://telegram.me/example_group'), 'https://t.me/example_group')
  assert.equal(normalizeTelegramInvite('example_group'), null) // ambiguous: not a link
  assert.equal(normalizeTelegramInvite('https://example.com/join'), null)
  assert.equal(normalizeTelegramInvite('  '), null)
})

test('taskJoinLink: only JOIN_DISCORD / JOIN_TELEGRAM with a valid link get one', () => {
  assert.deepEqual(taskJoinLink({ type: 'JOIN_DISCORD', discordInviteLink: 'https://discord.gg/example' }), {
    href: 'https://discord.gg/example',
    label: 'Join the server',
    platform: 'Discord',
  })
  assert.deepEqual(taskJoinLink({ type: 'JOIN_TELEGRAM', telegramInviteLink: 'https://t.me/+AbCdEf123456' }), {
    href: 'https://t.me/+AbCdEf123456',
    label: 'Join the group',
    platform: 'Telegram',
  })
  assert.equal(taskJoinLink({ type: 'JOIN_DISCORD', discordInviteLink: 'https://evil.example/discord' }), null)
  assert.equal(taskJoinLink({ type: 'JOIN_DISCORD' }), null)
  // The link must match the task's own platform.
  assert.equal(taskJoinLink({ type: 'JOIN_TELEGRAM', discordInviteLink: 'https://discord.gg/example' }), null)
  assert.equal(taskJoinLink({ type: 'JOIN_DISCORD', telegramInviteLink: 'https://t.me/example_group' }), null)
  assert.equal(taskJoinLink({ type: 'SOCIAL_FOLLOW', discordInviteLink: 'https://discord.gg/example' }), null)
  assert.equal(taskJoinLink(null), null)
})

test('the wizard bot config: an https Discord OAuth authorize URL and a valid Telegram bot username', () => {
  const invite = 'https://discord.com/oauth2/authorize?client_id=123456789012345678&permissions=1024&scope=bot'
  assert.equal(discordBotInviteHref(invite), invite)
  assert.equal(discordBotInviteHref('https://discord.com/api/oauth2/authorize?client_id=1&scope=bot'), 'https://discord.com/api/oauth2/authorize?client_id=1&scope=bot')
  assert.equal(discordBotInviteHref('https://discord.com/oauth2/authorize?scope=bot'), null) // no client_id
  assert.equal(discordBotInviteHref('http://discord.com/oauth2/authorize?client_id=1'), null)
  assert.equal(discordBotInviteHref('https://evil.example/oauth2/authorize?client_id=1'), null)
  assert.equal(discordBotInviteHref('https://discord.gg/example'), null)
  assert.equal(discordBotInviteHref(undefined), null)

  assert.equal(telegramBotName('ExampleBot'), 'ExampleBot')
  assert.equal(telegramBotName('@ExampleBot'), 'ExampleBot')
  assert.equal(telegramBotName('bad name'), null)
  assert.equal(telegramBotName('x/../evil'), null)
  assert.equal(telegramBotName(''), null)
  assert.equal(telegramBotName(undefined), null)
})

test('withCommunityMetadata: the saved taskType tells Telegram from Discord; only valid links attach', () => {
  // The chain reads every DISCORD_JOIN slot as JOIN_DISCORD.
  const onChain = { id: '0', type: 'JOIN_DISCORD', description: 'Join us' }
  assert.deepEqual(withCommunityMetadata(onChain, { taskType: 'JOIN_TELEGRAM', telegramInviteLink: 'https://t.me/+AbCdEf123456' }), {
    ...onChain,
    type: 'JOIN_TELEGRAM',
    telegramInviteLink: 'https://t.me/+AbCdEf123456',
  })
  assert.deepEqual(withCommunityMetadata(onChain, { taskType: 'JOIN_TELEGRAM', telegramInviteLink: 'https://evil.example' }), { ...onChain, type: 'JOIN_TELEGRAM' })
  assert.deepEqual(withCommunityMetadata(onChain, { taskType: 'JOIN_DISCORD', discordInviteLink: 'discord.gg/example' }), onChain) // stored values must already be full https links
  assert.deepEqual(withCommunityMetadata(onChain, { taskType: 'JOIN_DISCORD', discordInviteLink: 'https://discord.com/invite/example' }), {
    ...onChain,
    discordInviteLink: 'https://discord.gg/example',
  })
  // A Discord task never picks up a Telegram link, and other types are untouched.
  assert.deepEqual(withCommunityMetadata(onChain, { taskType: 'JOIN_DISCORD', telegramInviteLink: 'https://t.me/example_group' }), onChain)
  const follow = { id: '1', type: 'SOCIAL_FOLLOW', description: 'Follow' }
  assert.equal(withCommunityMetadata(follow, { taskType: 'JOIN_TELEGRAM' }), follow)
  assert.equal(withCommunityMetadata(onChain, null), onChain)
})
