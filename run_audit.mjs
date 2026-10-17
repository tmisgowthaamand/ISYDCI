/**
 * Comprehensive Automated Audit Runner for AUDIT_SPEC.md
 * Tests all 5 steps outlined in AUDIT_SPEC.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('===============================================================');
console.log('🔍 EXECUTING AUTOMATED AUDIT BASED ON AUDIT_SPEC.md');
console.log('===============================================================\n');

let totalPassed = 0;
let totalFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    totalPassed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    totalFailed++;
  }
}

// -----------------------------------------------------------------------------
// STEP 1 & 2: WACTO FLOW STRUCTURAL AUDIT (isydci_flow_v1.json)
// -----------------------------------------------------------------------------
console.log('📋 STEP 1 & 2: Verifying WACTO Flow JSON & Meta Limits...');
const flowPath = path.resolve(__dirname, 'src/data/isydci_flow_v1.json');
assert(fs.existsSync(flowPath), 'Flow JSON file exists at src/data/isydci_flow_v1.json');

const flow = JSON.parse(fs.readFileSync(flowPath, 'utf8'));
assert(Array.isArray(flow.nodes) && flow.nodes.length > 0, `Flow contains ${flow.nodes?.length} nodes`);
assert(Array.isArray(flow.edges) && flow.edges.length > 0, `Flow contains ${flow.edges?.length} edges`);

const rootNode = flow.nodes.find(n => n.nodeId === 'root');
assert(!!rootNode, 'Root node ("root") exists and starts flow');

// Reachability analysis
const reachable = new Set(['root']);
let added = true;
while (added) {
  added = false;
  flow.edges.forEach(edge => {
    if (reachable.has(edge.fromNodeId) && !reachable.has(edge.toNodeId)) {
      reachable.add(edge.toNodeId);
      added = true;
    }
  });
}
const unreachable = flow.nodes.filter(n => !reachable.has(n.nodeId)).map(n => n.name);
assert(unreachable.length === 0, `All ${flow.nodes.length} nodes are reachable from root (Unreachable: ${JSON.stringify(unreachable)})`);

// WhatsApp Limits Verification
let limitViolations = 0;
flow.nodes.forEach(node => {
  const d = node.data || {};
  if (d.body && d.body.length > 1024) limitViolations++;
  if (d.header?.text && d.header.text.length > 60) limitViolations++;
  if (d.footer && d.footer.length > 60) limitViolations++;
  const buttons = d.action?.buttons || [];
  if (buttons.length > 3) limitViolations++;
  buttons.forEach(b => {
    if (b.reply?.title && b.reply.title.length > 20) limitViolations++;
  });
  const sections = d.action?.sections || [];
  let rowCount = 0;
  sections.forEach(s => {
    (s.rows || []).forEach(r => {
      rowCount++;
      if (r.title && r.title.length > 24) limitViolations++;
    });
  });
  if (rowCount > 10) limitViolations++;
});
assert(limitViolations === 0, 'All messages comply 100% with Meta WhatsApp limits (buttons <= 20 chars, rows <= 24 chars, <= 10 rows)');

// -----------------------------------------------------------------------------
// STEP 3: REGISTERED ATHLETE FLOW & DATABASE INTEGRITY
// -----------------------------------------------------------------------------
console.log('\n📋 STEP 3: Verifying Registered Members Database...');
const membersPath = path.resolve(__dirname, 'backend/data/members.json');
assert(fs.existsSync(membersPath), 'Database file exists at backend/data/members.json');

const members = JSON.parse(fs.readFileSync(membersPath, 'utf8'));
assert(Array.isArray(members) && members.length >= 4, `Database contains ${members.length} registered members`);

const karthik = members.find(m => m.name.includes('KARTHIK'));
assert(!!karthik, 'Member KARTHIK RAJA found in database');
assert(!!(karthik?.dob && karthik?.age && karthik?.bloodGroup && karthik?.address && karthik?.district), 
  'KARTHIK RAJA has all card back-side fields populated (no missing dashes)');

const lokesh = members.find(m => m.name.includes('LOKESH'));
assert(!!lokesh, 'Member LOKESH found in database');
assert(!!(lokesh?.memberId && lokesh?.contact && lokesh?.district), 'LOKESH has valid ID, contact, and district');

// -----------------------------------------------------------------------------
// STEP 4: LIVE BACKEND API SERVICE CHECK
// -----------------------------------------------------------------------------
console.log('\n📋 STEP 4: Checking Backend REST Endpoints on http://localhost:5000...');
try {
  const healthRes = await fetch('http://localhost:5000/api/health');
  const healthData = await healthRes.json();
  assert(healthRes.status === 200 && healthData.status === 'OK', 'GET /api/health returned 200 OK');

  const membersRes = await fetch('http://localhost:5000/api/members');
  const membersData = await membersRes.json();
  assert(membersRes.status === 200 && membersData.success === true, `GET /api/members returned ${membersData.total} members`);

  const phoneRes = await fetch('http://localhost:5000/api/members/phone/8218213212');
  const phoneData = await phoneRes.json();
  assert(phoneRes.status === 200 && phoneData.member?.name?.includes('LOKESH'), 
    'GET /api/members/phone/8218213212 returns LOKESH for returning WhatsApp flow');
} catch (err) {
  assert(false, `Backend connection failed: ${err.message}`);
}

// -----------------------------------------------------------------------------
// STEP 5: FRONTEND PRODUCTION ASSETS
// -----------------------------------------------------------------------------
console.log('\n📋 STEP 5: Verifying Frontend Build Artifacts...');
const distIndex = path.resolve(__dirname, 'dist/index.html');
assert(fs.existsSync(distIndex), 'Production build output exists at dist/index.html');

console.log('\n===============================================================');
console.log(`🏁 AUDIT EXECUTION COMPLETE: ${totalPassed} PASSED, ${totalFailed} FAILED`);
console.log('===============================================================');

if (totalFailed > 0) {
  process.exitCode = 1;
} else {
  process.exitCode = 0;
}
