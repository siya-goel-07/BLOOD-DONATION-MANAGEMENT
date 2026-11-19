require('dotenv').config();
const { connect } = require('./db');

async function seed() {
  const db = await connect();
  const groups = db.collection('blood_groups');
  const groupNames = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
  for (const name of groupNames) await groups.updateOne({ name }, { $setOnInsert: { name } }, { upsert: true });
  const groupId = async name => (await groups.findOne({ name }))._id;
  const insertIfEmpty = async (collection, filter, document) => {
    const c = db.collection(collection);
    let found = await c.findOne(filter);
    if (!found) { await c.insertOne(document); found = await c.findOne(filter); }
    return found;
  };
  const cityBank = await insertIfEmpty('blood_banks', { name: 'City Blood Bank' }, { name: 'City Blood Bank', address: 'Delhi', phone: '0112345678' });
  const lifeBank = await insertIfEmpty('blood_banks', { name: 'Life Care Blood Bank' }, { name: 'Life Care Blood Bank', address: 'Noida', phone: '0112345679' });
  const cityHospital = await insertIfEmpty('hospitals', { name: 'City Hospital' }, { name: 'City Hospital', address: 'Delhi', phone: '0112222333' });
  const lifeHospital = await insertIfEmpty('hospitals', { name: 'Life Care Hospital' }, { name: 'Life Care Hospital', address: 'Noida', phone: '0112222444' });
  const donors = [
    { name: 'Rahul Sharma', dob: new Date('2002-05-12'), gender: 'Male', phone: '9876543210', email: 'rahul@example.com', address: 'Delhi', bloodGroupId: await groupId('A+') },
    { name: 'Priya Verma', dob: new Date('2001-08-20'), gender: 'Female', phone: '9876543211', email: 'priya@example.com', address: 'Noida', bloodGroupId: await groupId('O+') },
    { name: 'Aman Gupta', dob: new Date('2000-03-15'), gender: 'Male', phone: '9876543212', email: 'aman@example.com', address: 'Gurgaon', bloodGroupId: await groupId('B+') },
    { name: 'Neha Singh', dob: new Date('2002-11-10'), gender: 'Female', phone: '9876543213', email: 'neha@example.com', address: 'Delhi', bloodGroupId: await groupId('AB+') }
  ];
  for (const donor of donors) await db.collection('donors').updateOne({ phone: donor.phone }, { $setOnInsert: { ...donor, createdAt: new Date() } }, { upsert: true });
  const savedDonors = await db.collection('donors').find({ phone: { $in: donors.map(d => d.phone) } }).toArray();
  for (const donor of savedDonors) {
    const check = donor.phone === '9876543212' ? 'Not Eligible' : 'Eligible';
    await db.collection('eligibility_checks').updateOne({ donorId: donor._id }, { $setOnInsert: { donorId: donor._id, checkDate: new Date(), status: check } }, { upsert: true });
  }
  for (const [phone, bank, day] of [['9876543210', cityBank, '2026-01-10'], ['9876543211', cityBank, '2026-02-15'], ['9876543213', lifeBank, '2026-04-05']]) {
    const donor = savedDonors.find(item => item.phone === phone);
    await db.collection('donations').updateOne({ donorId: donor._id, donationDate: new Date(day) }, { $setOnInsert: { donorId: donor._id, bankId: bank._id, bloodGroupId: donor.bloodGroupId, donationDate: new Date(day), unitsDonated: 1 } }, { upsert: true });
  }
  const inventory = [
    [cityBank, 'A+', 5], [cityBank, 'O+', 8], [cityBank, 'B+', 3], [lifeBank, 'AB+', 4], [lifeBank, 'O+', 6]
  ];
  for (const [bank, group, unitsAvailable] of inventory) await db.collection('blood_inventory').updateOne({ bankId: bank._id, bloodGroupId: await groupId(group) }, { $setOnInsert: { bankId: bank._id, bloodGroupId: await groupId(group), unitsAvailable } }, { upsert: true });
  const reqs = [
    { hospitalId: cityHospital._id, bankId: cityBank._id, bloodGroupId: await groupId('O+'), unitsRequired: 2, requestDate: new Date('2026-05-01'), status: 'Approved', adminId: null },
    { hospitalId: lifeHospital._id, bankId: lifeBank._id, bloodGroupId: await groupId('AB+'), unitsRequired: 3, requestDate: new Date('2026-05-02'), status: 'Pending', adminId: null },
    { hospitalId: cityHospital._id, bankId: cityBank._id, bloodGroupId: await groupId('A+'), unitsRequired: 1, requestDate: new Date('2026-05-03'), status: 'Rejected', adminId: null }
  ];
  for (const request of reqs) await db.collection('blood_requests').updateOne({ hospitalId: request.hospitalId, requestDate: request.requestDate }, { $setOnInsert: request }, { upsert: true });
  const approvedRequest = await db.collection('blood_requests').findOne({ hospitalId: cityHospital._id, requestDate: new Date('2026-05-01') });
  await db.collection('distributions').updateOne({ requestId: approvedRequest._id }, { $setOnInsert: { requestId: approvedRequest._id, unitsDistributed: 2, distributionDate: new Date('2026-05-02') } }, { upsert: true });
  console.log('Seed complete: blood groups, donors, banks, hospitals, inventory, checks and requests are ready.');
  process.exit(0);
}

seed().catch(error => { console.error(error); process.exit(1); });
