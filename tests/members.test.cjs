const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../Projekte/JS/api.js'), 'utf8');

function fixture() {
  const requests = [];
  const window = { sessionStorage: { getItem: () => 'test-jwt' }, location: {} };
  vm.runInNewContext(source, {
    window, console, setTimeout,
    fetch: async (url, options) => {
      requests.push({ path: new URL(url).pathname, ...options });
      const data = options.method === 'GET'
        ? [{ userId: 7, firstName: 'Mia', lastName: 'Muster', email: 'mia@test.de', role: 'MEMBER' }]
        : { message: 'member added' };
      return { status: 200, ok: true, text: async () => JSON.stringify(data) };
    }
  });
  return { api: window.PlanBApi, requests };
}

for (const [uiRole, apiRole] of [['TEAMMITGLIED', 'MEMBER'], ['PROJEKTLEITUNG', 'PROJECT_LEADER']]) {
  test(`member POST maps ${uiRole}, uses Bearer and no body token`, async () => {
    const { api, requests } = fixture();
    await api.addMember('3', { email: ' MIA@TEST.DE ', role: uiRole, token: 'must-not-send' });
    assert.equal(requests.length, 1);
    assert.equal(requests[0].path, '/projects/3/members');
    assert.equal(requests[0].method, 'POST');
    assert.equal(requests[0].headers.Authorization, 'Bearer test-jwt');
    assert.equal(requests[0].headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(requests[0].body), { email: 'mia@test.de', role: apiRole });
  });
}

test('members GET has no body and normalizes the existing UI fields', async () => {
  const { api, requests } = fixture();
  const members = await api.getMembers('3');
  assert.equal(requests[0].path, '/projects/3/members');
  assert.equal(requests[0].method, 'GET');
  assert.equal(requests[0].body, undefined);
  assert.equal(requests[0].headers.Authorization, 'Bearer test-jwt');
  assert.equal(members[0].userId, '7');
  assert.equal(members[0].name, 'Mia Muster');
  assert.equal(members[0].email, 'mia@test.de');
  assert.equal(members[0].role, 'TEAMMITGLIED');
});

test('legacy invitation UI makes no unsupported HTTP requests', async () => {
  const { api, requests } = fixture();
  assert.equal(await api.getOpenInvitationCount(), 0);
  assert.equal((await api.getInvitationOverview()).received.length, 0);
  await assert.rejects(api.acceptInvitation('1'));
  await assert.rejects(api.ignoreInvitation('1'));
  assert.equal(requests.length, 0);
  assert.doesNotMatch(source, /request\([^\n]*['"]\/invitations/);
  assert.doesNotMatch(source, /request\([^\n]*\+\s*['"]\/invitations/);
  const project = fs.readFileSync(path.join(__dirname, '../Projekte/JS/project.js'), 'utf8');
  assert.doesNotMatch(project, /loadInvitations|withdrawInvitation|api\.inviteMember/);
});
