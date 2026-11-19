require('dotenv').config();
const express = require('express');
const { ObjectId } = require('mongodb');
const { connect } = require('./db');

const app = express();
app.use(express.json());
app.use(express.static('public'));

function asId(value) {
  if (!ObjectId.isValid(value)) throw new Error('Invalid record ID');
  return new ObjectId(value);
}

app.get('/api/health', async (_req, res) => {
  try { const db = await connect(); await db.command({ ping: 1 }); res.json({ ok: true, database: db.databaseName }); }
  catch (error) { res.status(503).json({ ok: false, error: error.message }); }
});

app.get('/api/dashboard', async (_req, res) => {
  try {
    const db = await connect();
    const [donors, banks, hospitals, pending, inventory] = await Promise.all([
      db.collection('donors').countDocuments(), db.collection('blood_banks').countDocuments(),
      db.collection('hospitals').countDocuments(), db.collection('blood_requests').countDocuments({ status: 'Pending' }),
      db.collection('blood_inventory').aggregate([
        { $lookup: { from: 'blood_groups', localField: 'bloodGroupId', foreignField: '_id', as: 'group' } },
        { $lookup: { from: 'blood_banks', localField: 'bankId', foreignField: '_id', as: 'bank' } },
        { $unwind: '$group' }, { $unwind: '$bank' },
        { $project: { _id: 1, bankName: '$bank.name', bloodGroup: '$group.name', unitsAvailable: 1 } },
        { $sort: { bankName: 1, bloodGroup: 1 } }
      ]).toArray()
    ]);
    res.json({ donors, banks, hospitals, pending, inventory });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/lookups', async (_req, res) => {
  try {
    const db = await connect();
    const [bloodGroups, banks, hospitals, donors] = await Promise.all([
      db.collection('blood_groups').find().sort({ name: 1 }).toArray(),
      db.collection('blood_banks').find().sort({ name: 1 }).toArray(),
      db.collection('hospitals').find().sort({ name: 1 }).toArray(),
      db.collection('donors').aggregate([
        { $lookup: { from: 'blood_groups', localField: 'bloodGroupId', foreignField: '_id', as: 'group' } },
        { $unwind: { path: '$group', preserveNullAndEmptyArrays: true } },
        { $project: { name: 1, bloodGroup: '$group.name' } }, { $sort: { name: 1 } }
      ]).toArray()
    ]);
    res.json({ bloodGroups, banks, hospitals, donors });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/donors', async (_req, res) => {
  try {
    const db = await connect();
    const donors = await db.collection('donors').aggregate([
      { $lookup: { from: 'blood_groups', localField: 'bloodGroupId', foreignField: '_id', as: 'group' } },
      { $unwind: { path: '$group', preserveNullAndEmptyArrays: true } },
      { $project: { name: 1, phone: 1, email: 1, address: 1, gender: 1, bloodGroup: '$group.name' } },
      { $sort: { name: 1 } }
    ]).toArray();
    res.json(donors);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/donors', async (req, res) => {
  try {
    const { name, phone, email, address, gender, bloodGroupId } = req.body;
    if (!name?.trim() || !phone?.trim() || !bloodGroupId) return res.status(400).json({ error: 'Name, phone and blood group are required.' });
    const db = await connect();
    const groupId = asId(bloodGroupId);
    if (!await db.collection('blood_groups').findOne({ _id: groupId })) return res.status(400).json({ error: 'Choose a valid blood group.' });
    const donor = { name: name.trim(), phone: phone.trim(), address: address?.trim() || '', gender: gender || '', bloodGroupId: groupId, createdAt: new Date() };
    if (email?.trim()) donor.email = email.trim();
    const result = await db.collection('donors').insertOne(donor);
    res.status(201).json({ _id: result.insertedId });
  } catch (error) { res.status(error.code === 11000 ? 409 : 500).json({ error: error.code === 11000 ? 'Phone or email is already registered.' : error.message }); }
});

app.post('/api/donations', async (req, res) => {
  try {
    const { donorId, bankId, unitsDonated } = req.body;
    const units = Number(unitsDonated);
    if (!donorId || !bankId || !Number.isInteger(units) || units < 1) return res.status(400).json({ error: 'Choose a donor and bank, and enter a positive whole number of units.' });
    const db = await connect();
    const donorKey = asId(donorId); const bankKey = asId(bankId);
    const [donor, bank] = await Promise.all([
      db.collection('donors').findOne({ _id: donorKey }), db.collection('blood_banks').findOne({ _id: bankKey })
    ]);
    if (!donor || !bank) return res.status(400).json({ error: 'Choose valid donor and blood bank records.' });
    const latestCheck = await db.collection('eligibility_checks').find({ donorId: donorKey }).sort({ checkDate: -1 }).limit(1).next();
    if (!latestCheck || latestCheck.status !== 'Eligible') return res.status(400).json({ error: 'This donor needs a latest eligibility check marked Eligible before donation.' });
    const now = new Date();
    await db.collection('donations').insertOne({ donorId: donorKey, bankId: bankKey, bloodGroupId: donor.bloodGroupId, donationDate: now, unitsDonated: units });
    await db.collection('blood_inventory').updateOne(
      { bankId: bankKey, bloodGroupId: donor.bloodGroupId },
      { $inc: { unitsAvailable: units }, $setOnInsert: { bankId: bankKey, bloodGroupId: donor.bloodGroupId } },
      { upsert: true }
    );
    res.status(201).json({ ok: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/requests', async (_req, res) => {
  try {
    const db = await connect();
    const rows = await db.collection('blood_requests').aggregate([
      { $lookup: { from: 'hospitals', localField: 'hospitalId', foreignField: '_id', as: 'hospital' } },
      { $lookup: { from: 'blood_groups', localField: 'bloodGroupId', foreignField: '_id', as: 'group' } },
      { $lookup: { from: 'blood_banks', localField: 'bankId', foreignField: '_id', as: 'bank' } },
      { $unwind: '$hospital' }, { $unwind: '$group' }, { $unwind: '$bank' },
      { $project: { hospitalName: '$hospital.name', bloodGroup: '$group.name', bankName: '$bank.name', unitsRequired: 1, status: 1, requestDate: 1 } },
      { $sort: { requestDate: -1 } }
    ]).toArray();
    res.json(rows);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/requests', async (req, res) => {
  try {
    const { hospitalId, bankId, bloodGroupId, unitsRequired } = req.body;
    const units = Number(unitsRequired);
    if (!hospitalId || !bankId || !bloodGroupId || !Number.isInteger(units) || units < 1) return res.status(400).json({ error: 'Hospital, bank, blood group and a positive whole number of units are required.' });
    const db = await connect();
    const ids = { hospitalId: asId(hospitalId), bankId: asId(bankId), bloodGroupId: asId(bloodGroupId) };
    const [hospital, bank, group] = await Promise.all([
      db.collection('hospitals').findOne({ _id: ids.hospitalId }), db.collection('blood_banks').findOne({ _id: ids.bankId }), db.collection('blood_groups').findOne({ _id: ids.bloodGroupId })
    ]);
    if (!hospital || !bank || !group) return res.status(400).json({ error: 'Choose valid hospital, bank and blood group records.' });
    const result = await db.collection('blood_requests').insertOne({ ...ids, unitsRequired: units, requestDate: new Date(), status: 'Pending', adminId: null });
    res.status(201).json({ _id: result.insertedId });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.patch('/api/requests/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Approved', 'Rejected'].includes(status)) return res.status(400).json({ error: 'Status must be Approved or Rejected.' });
    const db = await connect();
    const result = await db.collection('blood_requests').updateOne({ _id: asId(req.params.id), status: 'Pending' }, { $set: { status, reviewedAt: new Date() } });
    if (!result.matchedCount) return res.status(404).json({ error: 'Pending request not found.' });
    res.json({ ok: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.use((error, _req, res, _next) => res.status(500).json({ error: error.message }));

const port = Number(process.env.PORT || 3000);
connect().then(() => app.listen(port, () => console.log(`Blood Donation System ready at http://localhost:${port}`)))
  .catch(error => { console.error('Could not connect to MongoDB:', error.message); process.exit(1); });
