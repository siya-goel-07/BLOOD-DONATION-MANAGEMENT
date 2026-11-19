const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.DB_NAME || 'blood_donation_management';
let client;
let database;

async function connect() {
  if (database) return database;
  client = new MongoClient(uri);
  await client.connect();
  database = client.db(dbName);
  await ensureIndexes(database);
  return database;
}

async function ensureIndexes(db) {
  await Promise.all([
    db.collection('blood_groups').createIndex({ name: 1 }, { unique: true }),
    db.collection('donors').createIndex({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' } } }),
    db.collection('donors').createIndex({ phone: 1 }, { unique: true, sparse: true }),
    db.collection('blood_banks').createIndex({ name: 1 }),
    db.collection('hospitals').createIndex({ name: 1 }),
    db.collection('blood_inventory').createIndex({ bankId: 1, bloodGroupId: 1 }, { unique: true }),
    db.collection('blood_requests').createIndex({ status: 1, requestDate: -1 }),
    db.collection('donations').createIndex({ donorId: 1, donationDate: -1 }),
    db.collection('eligibility_checks').createIndex({ donorId: 1, checkDate: -1 })
  ]);
}

module.exports = { connect };
