const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
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

// Connect to MongoDB
async function run() {
  try {
    await client.connect();
    const db = client.db(); 
    console.log('✅ Connected successfully to MongoDB!');
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
  }
}

run().catch(console.dir);

// Basic test route
app.get('/', (req, res) => {
  res.send('🚀 Server is running!');
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
