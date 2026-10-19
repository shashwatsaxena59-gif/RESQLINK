async function testSync() {
  const reqObj = {
    id: 'sync-test-auto-' + Date.now(),
    title: 'Live Cross-Device Emergency Test',
    category: 'rescue',
    priority: 'critical',
    status: 'active',
    details: 'Testing cross device phone to laptop live sync.',
    contactName: 'Test Sync User',
    contactPhone: '+91 98110 00112',
    distanceMiles: 0.1,
    createdAt: Date.now(),
    coords: { x: 50, y: 50 },
    peopleCount: 3,
    items: ['Food', 'Water'],
    isUserCreated: true
  };

  console.log('1. Posting test request to http://localhost:3001/api/sync/request...');
  const postRes = await fetch('http://localhost:3001/api/sync/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reqObj)
  });
  const postData = await postRes.json();
  console.log('POST Response:', postData.ok ? 'SUCCESS (OK)' : postData);

  console.log('2. Fetching sync state from http://localhost:3001/api/sync...');
  const getRes = await fetch('http://localhost:3001/api/sync');
  const getData = await getRes.json();
  console.log(`GET Sync Store: ${getData.requests.length} requests, version ${getData.version}`);

  console.log('3. Testing resolve on http://localhost:3001/api/sync/resolve...');
  const resRes = await fetch('http://localhost:3001/api/sync/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: reqObj.id })
  });
  const resData = await resRes.json();
  console.log('Resolve Response:', resData.ok ? 'SUCCESS (Resolved & Cleared)' : resData);
}

testSync().catch(console.error);
