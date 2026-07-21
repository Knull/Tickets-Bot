import type { APIInteractionGuildMember, GuildMember } from 'discord.js';

type InteractionMember = GuildMember | APIInteractionGuildMember | null | undefined;

export function memberHasAnyRole(member: InteractionMember, roleIds: readonly string[]): boolean {
  if (!member) return false;

  const roles = member.roles;
  if (Array.isArray(roles)) {
    return roleIds.some(roleId => roles.includes(roleId));
  }

  return roleIds.some(roleId => roles.cache.has(roleId));
}

export function memberHasRole(member: InteractionMember, roleId: string): boolean {
  return memberHasAnyRole(member, [roleId]);
}
