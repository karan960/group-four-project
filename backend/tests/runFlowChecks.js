const axios = require('axios');

const BASE_URL = process.env.FLOW_TEST_BASE_URL || 'http://localhost:5000';
const ADMIN_USERNAME = process.env.FLOW_TEST_ADMIN_USER || 'admin123';
const ADMIN_PASSWORD = process.env.FLOW_TEST_ADMIN_PASS || 'password123';

const report = [];

const addResult = (name, ok, detail = '') => {
  report.push({ name, ok, detail });
  const prefix = ok ? 'PASS' : 'FAIL';
  console.log(`${prefix} ${name}${detail ? ` -> ${detail}` : ''}`);
};

const request = async (config) => axios({ timeout: 15000, ...config });

const run = async () => {
  let token = '';

  try {
    const login = await request({
      method: 'post',
      url: `${BASE_URL}/api/auth/login`,
      data: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD }
    });
    token = login.data?.token || '';
    addResult('Admin Login', Boolean(token), login.data?.user?.role || 'no-role');
  } catch (error) {
    addResult('Admin Login', false, error.response?.data?.message || error.message);
    finalize(1);
    return;
  }

  const headers = { Authorization: `Bearer ${token}` };

  try {
    const dashboard = await request({
      method: 'get',
      url: `${BASE_URL}/api/dashboard/admin/dashboard`,
      headers
    });
    const ok = Boolean(dashboard.data?.studentStats) && Boolean(dashboard.data?.facultyStats);
    addResult('Admin Dashboard', ok);
  } catch (error) {
    addResult('Admin Dashboard', false, error.response?.data?.message || error.message);
  }

  const testPrn = `ZZFLOW${Math.floor(Math.random() * 9000 + 1000)}`;

  try {
    await request({
      method: 'post',
      url: `${BASE_URL}/api/students`,
      headers,
      data: {
        prn: testPrn,
        rollNo: `R${testPrn}`,
        studentName: 'Flow Test Student',
        year: 'Third',
        branch: 'Information Technology',
        division: 'A',
        email: `${testPrn.toLowerCase()}@flow.test`,
        mobileNo: '9999999999'
      }
    });

    await request({
      method: 'put',
      url: `${BASE_URL}/api/students/${testPrn}`,
      headers,
      data: { studentName: 'Flow Test Student Updated' }
    });

    await request({
      method: 'delete',
      url: `${BASE_URL}/api/students/${testPrn}`,
      headers
    });

    addResult('Student CRUD', true, testPrn);
  } catch (error) {
    addResult('Student CRUD', false, error.response?.data?.message || error.message);
  }

  try {
    await request({
      method: 'get',
      url: `${BASE_URL}/api/change-requests/pending`,
      headers
    });
    addResult('Change Requests Flow', true);
  } catch (error) {
    addResult('Change Requests Flow', false, error.response?.data?.message || error.message);
  }

  try {
    const students = await request({
      method: 'get',
      url: `${BASE_URL}/api/students?limit=1`,
      headers
    });
    const firstPrn = students.data?.students?.[0]?.prn;
    if (!firstPrn) {
      addResult('ML Full Analysis Flow', false, 'No student available');
    } else {
      const ml = await request({
        method: 'get',
        url: `${BASE_URL}/api/ml-analysis/student/${firstPrn}/full-analysis`,
        headers
      });
      addResult('ML Full Analysis Flow', Boolean(ml.data?.success), firstPrn);
    }
  } catch (error) {
    addResult('ML Full Analysis Flow', false, error.response?.data?.error || error.message);
  }

  finalize(report.some((item) => !item.ok) ? 1 : 0);
};

const finalize = (code) => {
  const total = report.length;
  const passed = report.filter((item) => item.ok).length;
  const failed = total - passed;
  console.log('----------------------------------------');
  console.log(`Flow Check Summary: ${passed}/${total} passed, ${failed} failed`);
  process.exit(code);
};

run().catch((error) => {
  console.error('Flow test runner crashed:', error.message);
  process.exit(1);
});
