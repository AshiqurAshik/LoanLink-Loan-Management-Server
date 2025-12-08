const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config(); 

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Build MongoDB URI dynamically
const uri = `mongodb+srv://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@cluster0.4jfw6yd.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let loansCollection;

// Connect to MongoDB
async function run() {
  try {
    await client.connect();
    const db = client.db(); // default DB
    loansCollection = db.collection('Loans'); // collection named 'Loans'

    console.log('✅ Connected successfully to MongoDB!');
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
  }
}

run().catch(console.dir);

// ---------------- Routes ----------------

// Basic test route
app.get('/', (req, res) => {
  res.send('🚀 Server is running!');
});

// GET all loans
app.get('/loans', async (req, res) => {
  try {
    const loans = await loansCollection.find().toArray();
    res.send(loans);
  } catch (err) {
    console.error('Error fetching loans:', err);
    res.status(500).send({ message: 'Failed to fetch loans' });
  }
});

// POST a new loan
app.post('/loans', async (req, res) => {
  try {
    const newLoan = { ...req.body, createdAt: new Date() };
    const result = await loansCollection.insertOne(newLoan);
    res.send({ message: 'Loan added', loanId: result.insertedId });
  } catch (err) {
    console.error('Error adding loan:', err);
    res.status(500).send({ message: 'Failed to add loan' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
