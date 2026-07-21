import assert from 'node:assert/strict';
import test from 'node:test';
import { memberHasAnyRole, memberHasRole } from '../src/utils/memberRoles.ts';

test('member role checks support raw API role arrays', () => {
  const member = { roles: ['staff', 'member'] } as never;
  assert.equal(memberHasRole(member, 'staff'), true);
  assert.equal(memberHasAnyRole(member, ['admin', 'member']), true);
  assert.equal(memberHasRole(member, 'owner'), false);
});

test('member role checks support cached GuildMember roles', () => {
  const member = {
    roles: { cache: new Map([['manager', { id: 'manager' }]]) },
  } as never;
  assert.equal(memberHasRole(member, 'manager'), true);
  assert.equal(memberHasRole(member, 'staff'), false);
  assert.equal(memberHasAnyRole(null, ['manager']), false);
});
