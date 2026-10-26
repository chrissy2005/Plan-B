const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../Projekte/JS/api.js'), 'utf8');
function fixture() {
  const requests = [];
  const window = { sessionStorage: { getItem: () => 'test-jwt', removeItem() {} }, location: {} };
  vm.runInNewContext(source, {
    window, console, setTimeout,
    fetch: async (url, options) => {
      const path = new URL(url).pathname;
      const body = options.body ? JSON.parse(options.body) : undefined;
      requests.push({ path, method: options.method, headers: options.headers, body });
      let data = { message: 'ok', meetingId: 1, longToDoId: 1 };
      if (path.endsWith('/members')) data = [{ userId: 7, firstName: 'Test', role: 'MEMBER' }];
      if (path.endsWith('/meetings') && options.method === 'GET') data = [{ meetingId: 1, participantIds: [7] }];
      if (path.endsWith('/long-todos') && options.method === 'GET') data = [{ longToDoId: 1, assignedMemberIds: [7], subtasks: [{ subtaskId: 2, assigneeId: 7 }] }];
      return { status: 200, ok: true, text: async () => JSON.stringify(data) };
    }
  });
  return { api: window.PlanBApi, requests };
}
test('direct member POST: enum, bearer header, no token in JSON', async () => {
  const { api, requests } = fixture();
  await api.addMember('3', { email: ' TEST@EXAMPLE.COM ', role: 'PROJEKTLEITUNG' });
  assert.equal(requests[0].path, '/projects/3/members');
  assert.equal(requests[0].method, 'POST');
  assert.deepEqual(requests[0].body, { email: 'test@example.com', role: 'PROJECT_LEADER' });
  assert.equal(requests[0].headers.Authorization, 'Bearer test-jwt');
  assert.equal(requests[0].headers['Content-Type'], 'application/json');
  assert.equal('token' in requests[0].body, false);
});
test('resource IDs stay distinct and participant/assignee IDs become strings', async () => {
  const { api } = fixture();
  const tasks = await api.getTasks('3');
  assert.notEqual(tasks[0].id, tasks[1].id);
  assert.equal(tasks[0].participantIds.includes('7'), true);
  assert.equal(tasks[1].subtasks[0].assigneeId, '7');
});
test('meeting POST uses only meeting DTO fields and expands all members', async () => {
  const { api, requests } = fixture();
  await api.createMeeting('3', { title: 'Review', start: '2026-11-01T10:00', end: '2026-11-01T11:00', allParticipants: true });
  const request = requests.find(r => r.method === 'POST');
  assert.equal(request.path, '/projects/3/meetings');
  assert.deepEqual(request.body.participantIds, [7]);
  assert.equal(request.body.startDateTime, '2026-11-01T10:00');
  assert.equal('type' in request.body, false);
  assert.equal('token' in request.body, false);
});
test('long todo POST maps enums, dates, members and default subtask priority', async () => {
  const { api, requests } = fixture();
  await api.createLongTodo('3', { title: 'Todo', start: '2026-11-01T10:00', end: '2026-11-02T10:00', priority: 'HOCH', participantIds: ['7'], subtasks: [{ title: 'Tests' }] });
  assert.equal(requests[0].path, '/projects/3/long-todos');
  assert.equal(requests[0].body.priority, 'HIGH');
  assert.deepEqual(requests[0].body.assignedMemberIds, [7]);
  assert.equal(requests[0].body.subtasks[0].priority, 'MEDIUM');
});
test('member-role request uses documented PUT update envelope', async () => {
  const { api, requests } = fixture();
  await api.updateMemberRole('3', '7', 'TEAMMITGLIED');
  assert.equal(requests[0].method, 'PUT');
  assert.deepEqual(requests[0].body, { update: { attribute: 'role', newValue: 'MEMBER' } });
});
test('no invitation requests or generalized task routes remain in API source', () => {
  assert.equal(source.includes('/invitations'), false);
  assert.equal(source.includes('/tasks/'), false);
});
